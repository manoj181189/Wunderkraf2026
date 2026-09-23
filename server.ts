import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { mergeFactoryStates } from './src/lib/syncMerge';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

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

// In-memory cache of central state
let cachedCentralState: any = null;
function loadCentralStateFromDisk(): any {
  try {
    if (fs.existsSync(CENTRAL_STATE_FILE)) {
      const raw = fs.readFileSync(CENTRAL_STATE_FILE, 'utf8');
      cachedCentralState = JSON.parse(raw);
      return cachedCentralState;
    }
  } catch (e) {
    console.error('Failed to read central state file:', e);
  }
  return cachedCentralState;
}

function saveCentralStateToDisk(state: any): boolean {
  try {
    cachedCentralState = state;
    const tempFile = `${CENTRAL_STATE_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tempFile, CENTRAL_STATE_FILE);
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

// Central Sync Bridge Endpoints (Bidirectional Sync across all recording devices)
app.get('/api/sync/state', (req, res) => {
  try {
    const state = loadCentralStateFromDisk();
    const stats = fs.existsSync(CENTRAL_STATE_FILE) ? fs.statSync(CENTRAL_STATE_FILE) : null;
    res.json({
      success: true,
      timestamp: stats?.mtimeMs || Date.now(),
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

    if (!incomingState || !Array.isArray(incomingState.jobs)) {
      return res.status(400).json({ success: false, error: 'Invalid state payload: jobs array required' });
    }

    const currentBase = loadCentralStateFromDisk();
    const mergedState = mergeFactoryStates(currentBase, incomingState);
    const saved = saveCentralStateToDisk(mergedState);

    res.json({
      success: saved,
      timestamp: Date.now(),
      state: mergedState,
      jobCount: mergedState.jobs?.length || 0,
      logCount: mergedState.logs?.length || 0
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
    const { webhookUrl, phone, message, category = 'GENERAL', apiKey, sender = 'Wünderkraf ERP' } = req.body;

    if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('http')) {
      return res.status(400).json({ success: false, error: 'Valid webhookUrl starting with http is required' });
    }

    const cleanPhone = (phone || '').replace(/[^0-9+]/g, '');
    const payload = {
      phone: cleanPhone,
      message: message || '',
      category,
      sender,
      timestamp: new Date().toISOString()
    };

    const isGoogleScript = webhookUrl.includes('script.google.com');

    // Make server-side POST request - Node.js follows 302 redirects cleanly without CORS restrictions
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
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

// Vite Middleware & Static handling
async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Wünderkraf Factory ERP Server running on http://0.0.0.0:${PORT}`);
  });
}

setupVite().catch((err) => {
  console.error('Server startup error:', err);
});
