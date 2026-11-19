import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function createServer() {
  const app = express();
  app.use(express.json());

  app.post('/api/cheer', async (req, res) => {
    const startedAt = Date.now();
    try {
      const ai = getAiClient();
      if (!ai) {
        res.status(503).json({
          error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
        });
        return;
      }

      const { event, carName, stars, distance, zone } = req.body ?? {};
      const safeEvent =
        event === 'start' || event === 'milestone' || event === 'gameover'
          ? event
          : 'milestone';
      const safeCar = typeof carName === 'string' && carName.trim() ? carName.trim().slice(0, 32) : 'Red Rocket';
      const safeStars = Number.isFinite(Number(stars)) ? Math.max(0, Math.floor(Number(stars))) : 0;
      const safeDistance = Number.isFinite(Number(distance)) ? Math.max(0, Math.floor(Number(distance))) : 0;
      const safeZone = typeof zone === 'string' && zone.trim() ? zone.trim().slice(0, 32) : 'Sunny Meadow';

      const promptByEvent: Record<string, string> = {
        start: `The kid just picked the "${safeCar}" car and is starting a fun endless race in ${safeZone}. Give a super excited 1-sentence start cheer!`,
        milestone: `The kid driving "${safeCar}" in ${safeZone} just reached ${safeStars} stars and ${safeDistance} meters! Give an ultra-short cheering shoutout!`,
        gameover: `The kid finished a great drive in "${safeCar}" with ${safeStars} stars and ${safeDistance} meters across ${safeZone}. Celebrate their effort with a happy trophy title and 1 cheerful sentence!`,
      };

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: promptByEvent[safeEvent],
        config: {
          systemInstruction:
            'You are Pip, a joyful pit-crew mascot cheering for a 4-to-7-year-old playing a bright cartoon car game. Keep cheer under 11 words, warm, playful, easy English with an occasional fun word like "Zoom!", "Yay!", or "Shabash!". Never scold or use scary words. Keep stickerTitle 2-3 words max.',
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MINIMAL,
          },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              cheer: {
                type: Type.STRING,
                description: 'A cheerful kid-friendly 1-sentence shoutout under 11 words.',
              },
              stickerTitle: {
                type: Type.STRING,
                description: 'A fun 2-3 word badge title like Star Zoomer or Turbo Champ.',
              },
            },
            required: ['cheer', 'stickerTitle'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      const parsed = JSON.parse(rawText) as { cheer?: string; stickerTitle?: string };
      res.json({
        cheer: parsed.cheer || 'Zoom zoom! You are doing awesome!',
        stickerTitle: parsed.stickerTitle || 'Super Driver',
        latencyMs: Date.now() - startedAt,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate cheer';
      console.error('[/api/cheer] Gemini error:', message);
      res.status(502).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Zoomy Park server listening on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
