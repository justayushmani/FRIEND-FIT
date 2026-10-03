import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { profileRouter } from './routes/profile.js';
import { sessionRouter } from './routes/session.js';
import { analysisRouter } from './routes/analysis.js';
import { memoryRouter } from './routes/memory.js';
import { recommendRouter } from './routes/recommend.js';
import { demoRouter } from './routes/demo.js';
import { voiceRouter } from './routes/voice.js';
import { getModelStatus, getModelProvider } from './ai/modelProvider.js';
import { isDatabaseEnabled } from './db/mode.js';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration supporting single or comma-separated origins
const corsOrigin = process.env.CORS_ORIGIN
  ? (process.env.CORS_ORIGIN.includes(',') ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()) : process.env.CORS_ORIGIN)
  : 'http://localhost:5173';

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', async (req, res) => {
  const provider = getModelProvider();
  const ai = await getModelStatus();
  res.json({
    status: 'ok',
    mode: provider.getInfo().local ? 'local-gemma' : 'hosted-google',
    ai,
    voice: {
      available: Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY !== 'sk_your_key_here'),
      provider: 'ElevenLabs Scribe STT',
    },
    storage: isDatabaseEnabled() ? 'postgres' : 'in-memory',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/profile', profileRouter);
app.use('/api/session', sessionRouter);
app.use('/api/analysis', analysisRouter);
app.use('/api/memory', memoryRouter);
app.use('/api/recommend', recommendRouter);
app.use('/api/demo', demoRouter);
app.use('/api/voice', voiceRouter);

// Global error handler
app.use((err, req, res, next) => {
  console.error('[FriendFit Error]', err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: 'Something went wrong',
    message: err.message || 'The request could not be completed. Check model status and try again.',
  });
});

import { fileURLToPath } from 'url';
const isDirectRun = Boolean(
  process.argv[1] && (
    fileURLToPath(import.meta.url) === process.argv[1] ||
    process.argv[1].endsWith('src\\index.js') ||
    process.argv[1].endsWith('src/index.js')
  )
);

if (isDirectRun) {
  app.listen(PORT, () => {
    const provider = getModelProvider();
    console.log(`\n⚡ FriendFit server running on http://localhost:${PORT}`);
    console.log(`🤖 AI Provider: ${provider.getInfo().provider} (${provider.getInfo().local ? 'Local' : 'Hosted'})`);
    console.log(`📦 Storage: ${isDatabaseEnabled() ? 'PostgreSQL + pgvector' : 'In-Memory'}`);
    console.log(`🎙️ Voice: ${process.env.ELEVENLABS_API_KEY ? 'ElevenLabs Scribe enabled' : 'Browser fallback'}`);
    console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}\n`);
  });
}

export default app;
