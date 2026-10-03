// ============================================
// Voice Routes — ElevenLabs Speech-to-Text
// ============================================
import { Router } from 'express';

export const voiceRouter = Router();

voiceRouter.post('/transcribe', async (req, res, next) => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'ElevenLabs is not configured',
        message: 'ELEVENLABS_API_KEY is not set on the server.',
      });
    }

    const { audioBase64, mimeType = 'audio/webm' } = req.body || {};
    if (!audioBase64) {
      return res.status(400).json({ error: 'Missing audioBase64 in request body' });
    }

    const buffer = Buffer.from(audioBase64, 'base64');
    const blob = new Blob([buffer], { type: mimeType });

    const form = new FormData();
    form.append('file', blob, `recording.${mimeType.includes('wav') ? 'wav' : mimeType.includes('mp4') ? 'm4a' : 'webm'}`);
    form.append('model_id', 'scribe_v1');

    const elevenRes = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });

    if (!elevenRes.ok) {
      const errorData = await elevenRes.json().catch(() => ({}));
      console.warn('[ElevenLabs STT] Error response:', errorData);
      return res.status(elevenRes.status).json({
        error: 'ElevenLabs transcription failed',
        details: errorData,
      });
    }

    const data = await elevenRes.json();
    res.json({
      text: data.text || '',
      words: data.words || [],
      provider: 'ElevenLabs Scribe',
    });
  } catch (err) {
    console.error('[ElevenLabs STT] Exception:', err.message);
    next(err);
  }
});

// Check voice status
voiceRouter.get('/status', (req, res) => {
  const hasKey = Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY !== 'sk_your_key_here');
  res.json({
    available: hasKey,
    provider: 'ElevenLabs Scribe STT',
  });
});
