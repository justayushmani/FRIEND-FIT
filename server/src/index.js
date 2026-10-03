import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { profileRouter } from './routes/profile.js';
import { sessionRouter } from './routes/session.js';
import { analysisRouter } from './routes/analysis.js';
import { memoryRouter } from './routes/memory.js';
import { recommendRouter } from './routes/recommend.js';
import { demoRouter } from './routes/demo.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '2mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: process.env.AI_MODE || 'hosted',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/profile', profileRouter);
app.use('/api/session', sessionRouter);
app.use('/api/analysis', analysisRouter);
app.use('/api/memory', memoryRouter);
app.use('/api/recommend', recommendRouter);
app.use('/api/demo', demoRouter);

// Global error handler
app.use((err, req, res, next) => {
  console.error('[FriendFit Error]', err.message);
  res.status(err.status || 500).json({
    error: 'Something went wrong',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`\n⚡ FriendFit server running on http://localhost:${PORT}`);
  console.log(`🤖 AI Mode: ${process.env.AI_MODE || 'hosted'}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

export default app;
