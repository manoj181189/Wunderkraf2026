import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { mergeFactoryStates } from './src/lib/syncMerge.ts';
import { processWhatsAppIncomingQuery, generateWhatsAppStockQueryReply, generateShiftChangeoverReportText } from './src/lib/whatsappReports.ts';

dotenv.config();

const getFilename = () => {
  try {
    if (typeof __filename !== 'undefined' && __filename) return __filename;
    if (typeof import.meta !== 'undefined' && import.meta?.url) {
      return fileURLToPath(import.meta.url);
    }
  } catch (e) {}
  return path.join(process.cwd(), 'server.ts');
};

const currentFilename = getFilename();
const currentDirname = path.dirname(currentFilename);

const app = express();
const PORT = 3000;

// CORS headers to allow cross-device and remote tablet sync
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Shared repository file path for Central Sync Bridge
const DATA_DIR = path.join(process.cwd(), 'data');
const CENTRAL_STATE_FILE = path.join(DATA_DIR, 'central_factory_state.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error('Failed to create data directory:', e);
  }
}

// In-memory cache of central state and monotonic revision counter
let cachedCentralState: any = null;
let centralStateRevision: number = Date.now();

function loadCentralStateFromDisk(): any {
  try {
    if (fs.existsSync(CENTRAL_STATE_FILE)) {
      const raw = fs.readFileSync(CENTRAL_STATE_FILE, 'utf8');
      cachedCentralState = JSON.parse(raw);
      if (cachedCentralState && !cachedCentralState.users) {
        cachedCentralState.users = {};
      }
      return cachedCentralState;
    }
  } catch (e) {
    console.error('Failed to read central state file:', e);
  }
  return cachedCentralState;
}

// Active SSE streaming clients for instant multi-device live sync
const sseClients = new Set<express.Response>();

function broadcastSyncEvent(eventData: any) {
  const payload = `data: ${JSON.stringify(eventData)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

function saveCentralStateToDisk(state: any): boolean {
  try {
    centralStateRevision++;
    state.lastUpdated = new Date().toISOString();
    state.lastRevision = centralStateRevision;
    cachedCentralState = state;
    const tempFile = `${CENTRAL_STATE_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tempFile, CENTRAL_STATE_FILE);

    // Instant real-time push to all connected devices/desks
    broadcastSyncEvent({
      type: 'STATE_CHANGED',
      revision: centralStateRevision,
      timestamp: Date.now(),
      lastUpdated: state.lastUpdated,
      jobCount: state.jobs?.length || 0,
      logCount: state.logs?.length || 0
    });

    return true;
  } catch (e) {
    console.error('Failed to write central state file:', e);
    return false;
  }
}

// Initialize on boot
loadCentralStateFromDisk();

// Body parser
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ extended: true, limit: '150mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Wünderkraf Paperware ERP Server'
  });
});

// Dedicated Lightweight User Authentication & Workstation Directory Endpoints
app.get('/api/users', (req, res) => {
  try {
    const state = loadCentralStateFromDisk();
    res.json({
      success: true,
      users: state?.users || {}
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || password === undefined) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }
    const cleanUser = String(username).trim().toLowerCase();
    const cleanPass = String(password).trim();
    const state = loadCentralStateFromDisk();
    const users = state?.users || {};
    
    // Find user by exact key or name or email prefix
    let targetKey = cleanUser;
    let userObj = users[cleanUser];

    if (!userObj) {
      const emailPrefix = cleanUser.includes('@') ? cleanUser.split('@')[0] : '';
      const entry = Object.entries(users).find(([k, v]: [string, any]) => {
        const keyLow = k.toLowerCase();
        const nameLow = (v.name || '').toLowerCase();
        return (
          keyLow === cleanUser ||
          keyLow === emailPrefix ||
          nameLow === cleanUser ||
          (cleanUser.length > 2 && nameLow.includes(cleanUser)) ||
          (cleanUser.length > 2 && cleanUser.includes(keyLow))
        );
      });
      if (entry) {
        targetKey = entry[0];
        userObj = entry[1];
      }
    }

    if (!userObj) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    const isMasterUser = targetKey === 'admin' || targetKey === 'manoj' || targetKey === 'sandip';

    const isValid =
      userObj.pass === cleanPass ||
      (isMasterUser && (
        cleanPass === '1118' ||
        cleanPass === '1811' ||
        cleanPass.toUpperCase() === 'WKF1811' ||
        cleanPass.toLowerCase() === 'admin' ||
        cleanPass.toLowerCase() === 'manoj' ||
        cleanPass.toUpperCase() === 'MANOJ' ||
        cleanPass === '1632'
      )) ||
      (targetKey === 'balu' && (cleanPass === '08' || cleanPass === '8')) ||
      (targetKey === 'supervisor' && (cleanPass === '1811' || cleanPass === '1118' || cleanPass.toUpperCase() === 'WKF1811')) ||
      // Master Emergency PIN: 1118 or 1811 unlocks any workstation
      (cleanPass === '1118' || cleanPass === '1811' || cleanPass.toUpperCase() === 'WKF1811');

    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Incorrect password or PIN' });
    }

    const isMaster =
      isMasterUser ||
      userObj.perms?.includes('*') ||
      userObj.perms?.includes('Admin') ||
      userObj.role?.toLowerCase() === 'administrator' ||
      userObj.role?.toLowerCase() === 'admin';

    res.json({
      success: true,
      user: {
        username: targetKey,
        name: userObj.name || targetKey.toUpperCase(),
        role: userObj.role || 'Operator',
        perms: isMaster ? ['*'] : (userObj.perms || [])
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Real-Time Server-Sent Events (SSE) Stream for Instant Multi-Device Live Sync
app.get('/api/sync/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  sseClients.add(res);

  // Send initial connected handshake with current server state revision
  res.write(`data: ${JSON.stringify({
    type: 'CONNECTED',
    revision: centralStateRevision,
    timestamp: Date.now(),
    jobCount: cachedCentralState?.jobs?.length || 0
  })}\n\n`);

  const keepAlive = setInterval(() => {
    try {
      res.write(':keepalive\n\n');
    } catch {
      clearInterval(keepAlive);
      sseClients.delete(res);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

// Fast Ping endpoint for 100ms multi-device live polling
app.get('/api/sync/ping', (req, res) => {
  const stats = fs.existsSync(CENTRAL_STATE_FILE) ? fs.statSync(CENTRAL_STATE_FILE) : null;
  res.json({
    success: true,
    revision: centralStateRevision,
    timestamp: stats?.mtimeMs || Date.now(),
    jobCount: cachedCentralState?.jobs?.length || 0,
    logCount: cachedCentralState?.logs?.length || 0,
    lastUpdated: cachedCentralState?.lastUpdated || null
  });
});

// Central Sync Bridge Endpoints (Bidirectional Sync across all recording devices)
app.get('/api/sync/state', (req, res) => {
  try {
    const state = loadCentralStateFromDisk();
    const stats = fs.existsSync(CENTRAL_STATE_FILE) ? fs.statSync(CENTRAL_STATE_FILE) : null;
    res.json({
      success: true,
      timestamp: stats?.mtimeMs || Date.now(),
      revision: centralStateRevision,
      lastUpdated: state?.lastUpdated || new Date().toISOString(),
      state: state || null,
      jobCount: state?.jobs?.length || 0,
      logCount: state?.logs?.length || 0
    });
  } catch (err: any) {
    console.error('Central sync GET error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/sync/state', (req, res) => {
  try {
    const incomingPayload = req.body;
    const incomingState = incomingPayload.state || incomingPayload;
    const isForceOverwrite = 
      incomingPayload.overwrite === true || 
      incomingPayload.force === true || 
      incomingPayload.reset === true ||
      req.query.overwrite === 'true' || 
      req.query.force === 'true';

    if (!incomingState || !Array.isArray(incomingState.jobs)) {
      return res.status(400).json({ success: false, error: 'Invalid state payload: jobs array required' });
    }

    if (isForceOverwrite) {
      incomingState.lastResetTimestamp = Date.now();
    }

    // If force overwrite requested (e.g., backup restore or factory reset), replace state on disk without merging old data
    const currentCentral = loadCentralStateFromDisk();

    // Protective Guard: If central database has active jobs, NEVER allow an ordinary unforced push with 0 jobs to wipe out the database
    if (!isForceOverwrite && (!incomingState.jobs || incomingState.jobs.length === 0) && (currentCentral?.jobs && currentCentral.jobs.length > 0)) {
      console.warn('[Sync Guard] Blocked empty client state push. Preserving existing central state with', currentCentral.jobs.length, 'jobs.');
      return res.json({
        success: true,
        timestamp: Date.now(),
        state: currentCentral,
        overwritten: false,
        jobCount: currentCentral.jobs.length,
        logCount: currentCentral.logs?.length || 0
      });
    }

    const finalState = (isForceOverwrite || !currentCentral)
      ? incomingState
      : mergeFactoryStates(currentCentral, incomingState);

    if (isForceOverwrite) {
      finalState.lastResetTimestamp = incomingState.lastResetTimestamp || Date.now();
    } else {
      finalState.lastResetTimestamp = Math.max(currentCentral?.lastResetTimestamp || 0, incomingState?.lastResetTimestamp || 0);
    }

    const saved = saveCentralStateToDisk(finalState);

    res.json({
      success: saved,
      timestamp: Date.now(),
      state: finalState,
      overwritten: isForceOverwrite,
      jobCount: finalState.jobs?.length || 0,
      logCount: finalState.logs?.length || 0
    });
  } catch (err: any) {
    console.error('Central sync POST error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/sync/status', (req, res) => {
  const exists = fs.existsSync(CENTRAL_STATE_FILE);
  const stats = exists ? fs.statSync(CENTRAL_STATE_FILE) : null;
  res.json({
    status: 'operational',
    bridge: '100_2026_V1 Bidirectional Sync Bridge',
    hasCentralState: exists,
    sizeBytes: stats?.size || 0,
    lastModified: stats?.mtime || null
  });
});

// Lazy Google GenAI initialization
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not set in environment.');
    }
    aiClient = new GoogleGenAI({ apiKey: apiKey || '' });
  }
  return aiClient;
}

// Audio Transcription API Endpoint
// Uses gemini-3.5-transcribe as requested by feature specification
app.post('/api/ai/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/webm', prompt } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: 'audioBase64 is required' });
    }

    const ai = getAI();
    const systemPrompt = prompt || 'Please transcribe the following factory floor audio recording accurately. If the speaker mentions job IDs, crate numbers, operator names, machine downtime reasons, or production counts, ensure names and numbers are precisely transcribed.';

    let response;
    try {
      // Primary model: gemini-3.5-transcribe
      response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: [
          {
            role: 'user',
            parts: [
              { text: systemPrompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: audioBase64
                }
              }
            ]
          }
        ]
      });
    } catch (primaryErr: any) {
      console.warn('gemini-3.5-transcribe attempt failed, falling back to gemini-2.5-flash:', primaryErr.message);
      // Fallback model: gemini-2.5-flash
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: systemPrompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: audioBase64
                }
              }
            ]
          }
        ]
      });
    }

    const transcription = response.text || '';
    res.json({
      success: true,
      transcription: transcription.trim()
    });
  } catch (error: any) {
    console.error('Transcription error:', error);
    res.status(500).json({
      error: error.message || 'Failed to transcribe audio'
    });
  }
});

// WhatsApp Server-Side Dispatch Proxy (Supports Google Apps Script, Meta Cloud API, and generic Webhooks)
app.post('/api/whatsapp/dispatch', async (req, res) => {
  try {
    const currentState = loadCentralStateFromDisk() || { jobs: [], packJobs: [], logs: [] };
    const configWebhook = currentState.whatsappConfig?.webhookUrl || '';
    const configApiKey = currentState.whatsappConfig?.apiKey || '';

    const finalWebhookUrl = (req.body.webhookUrl || configWebhook || '').trim();
    const finalApiKey = req.body.apiKey || configApiKey || '';
    const { phone, message, category = 'GENERAL', sender = 'Wünderkraf ERP' } = req.body;

    if (!finalWebhookUrl || !finalWebhookUrl.startsWith('http')) {
      return res.status(400).json({ success: false, error: 'Valid webhookUrl starting with http is required' });
    }

    const cleanPhone = (phone || '').replace(/[^0-9+]/g, '');
    const payload = {
      phone: cleanPhone,
      message: message || '',
      category,
      sender,
      apiKey: finalApiKey,
      timestamp: new Date().toISOString()
    };

    const isGoogleScript = finalWebhookUrl.includes('script.google.com');

    // Make server-side POST request - Node.js follows 302 redirects cleanly without CORS restrictions
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (finalApiKey) {
      headers['Authorization'] = `Bearer ${finalApiKey}`;
    }

    let finalPayload: any = payload;
    if (finalWebhookUrl.includes('graph.facebook.com')) {
      finalPayload = {
        messaging_product: "whatsapp",
        to: cleanPhone.replace(/[^0-9]/g, ''),
        type: "text",
        text: {
          body: message || ''
        }
      };
    }

    const response = await fetch(finalWebhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(finalPayload),
      redirect: 'follow'
    });

    let responseData: any = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        responseData = await response.json();
      } catch (e) {
        responseData = await response.text();
      }
    } else {
      responseData = await response.text();
    }

    res.json({
      success: response.ok || (isGoogleScript && response.status < 400),
      status: response.status,
      data: responseData
    });
  } catch (error: any) {
    console.error('WhatsApp server dispatch error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to dispatch webhook via server proxy'
    });
  }
});

// Two-Way WhatsApp Automated Query API (Instant reply for "मुझे इसका स्टॉक चाहिए", "stock", "job", "report")
app.get('/api/whatsapp/query', (req, res) => {
  try {
    const q = (req.query.q || req.query.text || req.query.query || 'stock').toString();
    const currentState = loadCentralStateFromDisk() || { jobs: [], packJobs: [], logs: [] };
    const processed = processWhatsAppIncomingQuery(currentState, q);

    res.json({
      success: true,
      query: q,
      category: processed.category,
      matchedKeyword: processed.matchedKeyword,
      reply: processed.reply,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('WhatsApp query error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/whatsapp/query', (req, res) => {
  try {
    const { query, message, text } = req.body;
    const q = (query || message || text || 'stock').toString();
    const currentState = loadCentralStateFromDisk() || { jobs: [], packJobs: [], logs: [] };
    const processed = processWhatsAppIncomingQuery(currentState, q);

    res.json({
      success: true,
      query: q,
      category: processed.category,
      matchedKeyword: processed.matchedKeyword,
      reply: processed.reply,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('WhatsApp query POST error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// In-memory store for incoming WhatsApp messages
const inboundWhatsAppLogs: Array<{
  id: string;
  timestamp: string;
  from: string;
  query: string;
  reply: string;
  category: string;
  status: string;
}> = [];

// Meta Webhook Verification Handshake & Health Check
app.get('/api/whatsapp/incoming', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && (token === 'wunderkraf_token' || token === (process.env.WHATSAPP_VERIFY_TOKEN || 'wunderkraf'))) {
      console.log('Meta Webhook verified successfully!');
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  }

  // Regular browser GET test
  res.json({
    status: 'online',
    endpoint: '/api/whatsapp/incoming',
    description: 'Wünderkraf Paperware ERP WhatsApp Two-Way Webhook Listener',
    usage: 'POST JSON with { phone, message } to receive real-time stock/report reply',
    recentInboundCount: inboundWhatsAppLogs.length
  });
});

// Inbound logs endpoint for real-time frontend monitoring
app.get('/api/whatsapp/inbound-logs', (req, res) => {
  res.json({
    success: true,
    logs: inboundWhatsAppLogs.slice(-50).reverse()
  });
});

// WhatsApp Incoming Webhook Handler (Receives inbound messages from Meta Cloud API, AutoResponder for WA, Google Apps Script or external webhook)
app.post('/api/whatsapp/incoming', async (req, res) => {
  try {
    const body = req.body || {};
    let incomingText = '';
    let fromPhone = '';

    // Meta WhatsApp Cloud API format: entry[0].changes[0].value.messages[0]
    if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      const msgObj = body.entry[0].changes[0].value.messages[0];
      incomingText = msgObj.text?.body || '';
      fromPhone = msgObj.from || '';
    } else {
      // Standard webhook format: { phone, message, query, text }
      incomingText = body.message || body.query || body.text || body.Body || '';
      fromPhone = body.phone || body.from || body.From || '';
    }

    const currentState = loadCentralStateFromDisk() || { jobs: [], packJobs: [], logs: [] };
    const processed = processWhatsAppIncomingQuery(currentState, incomingText || 'stock');

    // Record in real-time inbound feed
    const logItem = {
      id: `IN-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      from: fromPhone || 'Unknown / Webhook',
      query: incomingText || 'Stock Query',
      reply: processed.reply,
      category: processed.category,
      status: 'REPLIED'
    };
    inboundWhatsAppLogs.push(logItem);
    if (inboundWhatsAppLogs.length > 100) inboundWhatsAppLogs.shift();

    // If outbound webhook is configured in ERP, dispatch the reply back to the sender
    const webhookUrl = currentState.whatsappConfig?.webhookUrl;
    if (webhookUrl && webhookUrl.startsWith('http') && fromPhone) {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (currentState.whatsappConfig?.apiKey) {
          headers['Authorization'] = `Bearer ${currentState.whatsappConfig.apiKey}`;
        }
        let finalPayload: any = {
          phone: fromPhone,
          message: processed.reply,
          category: processed.category,
          sender: 'Wünderkraf Two-Way Bot',
          apiKey: currentState.whatsappConfig?.apiKey || '',
          timestamp: new Date().toISOString()
        };
        if (webhookUrl.includes('graph.facebook.com')) {
          finalPayload = {
            messaging_product: "whatsapp",
            to: fromPhone.replace(/[^0-9]/g, ''),
            type: "text",
            text: {
              body: processed.reply
            }
          };
        }
        fetch(webhookUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(finalPayload)
        }).catch(err => console.warn('Inbound auto-reply dispatch warning:', err));
      } catch (e) {
        console.warn('Dispatch failed:', e);
      }
    }

    // Return the response immediately for the webhook caller
    res.json({
      success: true,
      from: fromPhone,
      incomingText,
      reply: processed.reply,
      category: processed.category,
      matchedKeyword: processed.matchedKeyword,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('WhatsApp incoming webhook error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Search Grounding API Endpoint
// Uses gemini-3.5-flash with googleSearch tool as requested
app.post('/api/ai/search-grounding', async (req, res) => {
  try {
    const { query, topic = 'paperware_industry' } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const ai = getAI();
    let enhancedPrompt = query;

    if (topic === 'paper_rates') {
      enhancedPrompt = `Provide current market trends, price benchmarks per MT/KG, and mill availability for: "${query}". Include relevant Indian paper mills (ITC, Century, JK Paper, West Coast, Emami) and GSM categories (e.g., 200-350 GSM for biodegradable paper cutlery).`;
    } else if (topic === 'compliance') {
      enhancedPrompt = `Search and summarize the latest regulations, BIS/FSSAI standards, biodegradable food contact compliance norms, and export standards for paper cutlery and tableware for query: "${query}".`;
    } else if (topic === 'machinery') {
      enhancedPrompt = `Search and provide technical specifications, tooling maintenance best practices, heater temperature controls, and troubleshooting guidance for paper tableware slitting, hydraulic cutting, and thermo-forming machines for query: "${query}".`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: enhancedPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.3
      }
    });

    const text = response.text || '';
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata || null;

    res.json({
      success: true,
      result: text,
      groundingMetadata: groundingMetadata
    });
  } catch (error: any) {
    console.error('Search grounding error:', error);
    res.status(500).json({
      error: error.message || 'Failed to perform search grounded intelligence query'
    });
  }
});

// Background checking function for Scheduled WhatsApp Shift Reports (Every 60 seconds)
setInterval(async () => {
  try {
    const currentState = loadCentralStateFromDisk();
    if (!currentState || !currentState.whatsappConfig) return;

    const config = currentState.whatsappConfig;
    const rawPhone = config.phone || '';
    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    const apiKey = config.apiKey || '';

    // If no phone or no API Key (CallMeBot key is stored in config.apiKey), we cannot send automated reports
    if (!cleanPhone || !apiKey) return;

    // Get current time in India/Kolkata (HH:MM)
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const currentTimeStr = formatter.format(new Date()); // e.g., "20:00"

    const todayDateStr = new Date().toISOString().split('T')[0]; // e.g., "2026-09-28"

    // 1. Check Day Shift Report
    const dayTime = config.dayShiftReportTime || '20:00';
    const hasSentDayToday = config.lastSentDayDate === todayDateStr;
    const shouldSendDay = config.autoSendShiftReportDay && currentTimeStr === dayTime && !hasSentDayToday;

    if (shouldSendDay) {
      console.log(`⏰ Triggering automated Day Shift Report to ${cleanPhone} at ${currentTimeStr}`);
      // Generate report text
      const reportText = generateShiftChangeoverReportText(currentState, 'DAY');
      
      // Dispatch via CallMeBot (100% free)
      const callmebotUrl = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodeURIComponent(reportText)}&apikey=${apiKey}`;
      const response = await fetch(callmebotUrl);
      if (response.ok) {
        console.log(`✅ Automated Day Shift Report sent successfully!`);
        config.lastSentDayDate = todayDateStr;
        
        // Record in logs
        if (!config.dispatchLogs) config.dispatchLogs = [];
        config.dispatchLogs.unshift({
          id: `SCHED-DAY-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }),
          category: 'SHIFT_DAY',
          recipient: cleanPhone,
          sender: 'System Scheduler',
          preview: reportText.slice(0, 85) + '...',
          status: 'SENT'
        });
        saveCentralStateToDisk(currentState);
      } else {
        console.warn(`❌ Failed to send Day Shift Report via CallMeBot: ${response.statusText}`);
      }
    }

    // 2. Check Night Shift Report
    const nightTime = config.nightShiftReportTime || '08:00';
    const hasSentNightToday = config.lastSentNightDate === todayDateStr;
    const shouldSendNight = config.autoSendShiftReportNight && currentTimeStr === nightTime && !hasSentNightToday;

    if (shouldSendNight) {
      console.log(`⏰ Triggering automated Night Shift Report to ${cleanPhone} at ${currentTimeStr}`);
      // Generate report text
      const reportText = generateShiftChangeoverReportText(currentState, 'NIGHT');
      
      // Dispatch via CallMeBot (100% free)
      const callmebotUrl = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodeURIComponent(reportText)}&apikey=${apiKey}`;
      const response = await fetch(callmebotUrl);
      if (response.ok) {
        console.log(`✅ Automated Night Shift Report sent successfully!`);
        config.lastSentNightDate = todayDateStr;
        
        // Record in logs
        if (!config.dispatchLogs) config.dispatchLogs = [];
        config.dispatchLogs.unshift({
          id: `SCHED-NIGHT-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }),
          category: 'SHIFT_NIGHT',
          recipient: cleanPhone,
          sender: 'System Scheduler',
          preview: reportText.slice(0, 85) + '...',
          status: 'SENT'
        });
        saveCentralStateToDisk(currentState);
      } else {
        console.warn(`❌ Failed to send Night Shift Report via CallMeBot: ${response.statusText}`);
      }
    }
  } catch (err) {
    console.error('Error in scheduled WhatsApp dispatcher:', err);
  }
}, 60000); // Check every 60 seconds

// Vite Middleware & Static handling
async function setupVite() {
  const distPath = path.join(process.cwd(), 'dist');
  const isBundled = typeof __filename !== 'undefined' && __filename.includes('server.cjs');
  const isProduction = process.env.NODE_ENV === 'production' || isBundled;

  if (isProduction && fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Wünderkraf Factory ERP Server running on http://0.0.0.0:${PORT}`);
  });
}

setupVite().catch((err) => {
  console.error('Server startup error:', err);
});
