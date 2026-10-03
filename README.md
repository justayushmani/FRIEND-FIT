# FriendFit

**An intelligent practice coach that remembers your friend's recurring mistakes, predicts persistent weaknesses, and recommends what to practice next.**

FriendFit transforms repetitive interview practice into structured remediation. Instead of random questions, FriendFit listens to answers, extracts specific conceptual gaps, retains them in a persistent mistake ledger with vector embeddings, and uses that historical memory to adapt future sessions and prescribe the Next Best Action.

---

## The Friend & The Problem

Built for a friend preparing for technical software engineering interviews who kept stumbling on the same subtle architectural and database concepts across different practice interviews (such as SQL JOIN row preservation, ACID transaction boundaries, and indexing tradeoffs). Generic chatbot tools give one-off answers and immediately forget the learner's history. FriendFit solves this by providing persistent memory, performance tracking, and adaptive coaching.

---

## The Core Practice Loop

```text
Friend Practices
       ↓
Observed Performance
       ↓
Finds Recurring Weaknesses
       ↓
Remembers in Memory Ledger (+ pgvector embeddings)
       ↓
Predicts Historical Risk & Persistence
       ↓
AI Coach Adapts Future Questions
       ↓
Prescribes Next Best Action
       ↓
Next Session Tests Improvement
```

---

## Five Core Features

1. **Personal Profile**: Captures candidate target role, skills, declared weak areas, projects, and optional resume/job description context.
2. **Adaptive AI Practice Session**: Generates profile-tailored technical questions, evaluates answers on specific rubrics, generates follow-up questions, and supports both text input and voice input.
3. **Performance Analysis**: Computes real session scores, rubric category breakdowns, flagged concept gaps, and tailored recommendations.
4. **Mistake Memory Ledger**: Tracks unresolved conceptual errors, times tested, and improvement count, utilizing PostgreSQL with pgvector semantic similarity search and lexical retrieval.
5. **Next Best Action (NBA)**: Synthesizes historical scores, failure counts, and mistake severity to prescribe the highest-leverage practice drill, with a one-click CTA that launches the targeted practice session.

---

## Architecture

```mermaid
flowchart TD
  UI[React Neo-Pop Brutalist UI] --> API[Express API Server]
  API --> Provider[Model Abstraction Layer]
  Provider --> Gemma[Local Gemma / Ollama - Default]
  Provider --> GoogleAI[Google AI Studio - Explicit Optional]
  API --> Voice[ElevenLabs Scribe STT / Browser Fallback]
  API --> Store[Storage Layer]
  Store --> Postgres[(PostgreSQL + pgvector)]
  Store --> MemoryStore[In-Memory Store Fallback]
  Store --> MemoryService[Mistake Memory Ledger & Semantic Retrieval]
  Store --> History[Observed Topic Performance]
  History --> Risk[Historical Risk Pipeline]
  Risk --> Action[Next Best Action Engine]
```

### AI Model Abstraction
- **Default Provider**: Local open-weight Gemma (`gemma2:2b`) running via Ollama (`http://127.0.0.1:11434`).
- **Explicit Optional Provider**: Google AI Studio (`gemini-3.8-flash` or open-weight Gemma API) when `AI_MODE=hosted` or `AI_PROVIDER=google` is set.
- **Reliability & Validation**: All structured outputs are strictly parsed and validated using Zod schemas (`QuestionSchema`, `EvaluationSchema`, `AnalysisSchema`).

### Voice Integration
- **Server-Side ElevenLabs Scribe STT**: `/api/voice/transcribe` securely routes microphone audio to ElevenLabs without exposing API secrets to the client.
- **Browser Fallback**: Built-in SpeechRecognition is supported seamlessly if server voice is unconfigured.

### Database & pgvector
- Schema contains 9 tables with indexes and `vector(768)` embeddings for semantic memory matching.
- Supports both production PostgreSQL with pgvector and zero-dependency in-memory fallback for local demos.

---

## Design System: Neo-Pop Brutalism

The user interface adheres to a high-contrast Neo-Pop Brutalist aesthetic:
- **Base**: Near-black (`#0a0a0a`), dark cards, and rich cream background (`#faf5eb`).
- **Accents**: Neon lime (`#c8ff00`), vibrant pink (`#ff3366`), cyan (`#00e5ff`), electric yellow (`#ffd60a`).
- **Borders & Shadows**: Bold 3px/4px solid black borders with offset hard shadows (`5px 5px 0 #0a0a0a`).
- **Typography**: Space Grotesk (display), Space Mono (code/metadata), and Inter (body).
- **Tactile Interactions**: Micro-animations and tactile button press offsets.

---

## Quick Start (Local Setup)

### Prerequisites
- Node.js 18+ and npm
- (Optional for local AI) [Ollama](https://ollama.com/) with `gemma2:2b`

### 1. Installation
```bash
npm run install:all
```

### 2. Environment Configuration
```bash
cp .env.example server/.env
```

Edit `server/.env` to configure your preferred mode:
```env
# In-memory or PostgreSQL
DATABASE_MODE=memory
# DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# AI Mode: "local" (Ollama + Gemma) or "hosted" (Google AI Studio)
AI_MODE=local
GEMMA_MODEL=gemma2:2b

# Optional: ElevenLabs Voice
# ELEVENLABS_API_KEY=your_key_here
```

### 3. Run Development Server
```bash
npm run dev
```
- Client runs at: `http://localhost:5173`
- Server runs at: `http://localhost:3001`
- Health check: `http://localhost:3001/api/health`

---

## Testing

Run the automated test suite covering model abstraction, profile services, practice loops, mistake memory, risk prediction, and end-to-end integration:

```bash
npm test
```

Run client linter and production build:
```bash
npm run dev:client
cd client && npm run lint && npm run build
```

---

## Deployment (Render)

FriendFit includes a complete `render.yaml` blueprint:
- **Backend**: Node.js Web Service running `npm start` with health check at `/api/health`.
- **Frontend**: Static Site running `npm run build` publishing `./dist`.

---

## Hackathon Category Status & Disclosure

| Category | Status | Details |
| --- | --- | --- |
| **Main Challenge** | **QUALIFIED** | Built for a friend with a real problem; core practice loop, mistake memory, and next best action. |
| **Gemma** | **QUALIFIED** | Supported as the default local open-weight AI provider via Ollama. |
| **ElevenLabs** | **QUALIFIED** | Scribe STT voice transcription implemented via secure backend proxy with browser fallback. |
| **Tiger Data / pgvector** | **DISCLOSED** | Schema and code support PostgreSQL + pgvector semantic retrieval; currently pointed to configured PostgreSQL pool. |
| **TabPFN** | **DISCLOSED** | Transparent historical feature pipeline and risk index implemented; external TabPFN library not bundled. |
| **Mastra** | **DISCLOSED** | Clean Express micro-service orchestration; external Mastra package not bundled. |
| **Sentry** | **DISCLOSED** | Observability configured; active DSN required from environment. |
| **Render** | **QUALIFIED** | `render.yaml` configured and production build verified. |
