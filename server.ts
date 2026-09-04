import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Wünderkraf Paperware ERP Server'
  });
});

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
