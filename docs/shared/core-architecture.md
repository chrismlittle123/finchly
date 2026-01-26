# Shared Core Architecture

This document describes the shared technology layer that powers both **Finchly** (external knowledge capture) and **Brief** (internal status intelligence).

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      SHARED PLATFORM                            │
├─────────────────────────────────────────────────────────────────┤
│  • Enrichment Engine                                            │
│  • Embeddings + Vector Search                                   │
│  • RAG Infrastructure                                           │
│  • Slack SDK Integration                                        │
│  • LLM Orchestration                                            │
│  • Database Layer                                               │
│  • Voice Interface                                              │
└─────────────────────────────────────────────────────────────────┘
              │                                    │
              ▼                                    ▼
┌─────────────────────────┐          ┌─────────────────────────┐
│        FINCHLY          │          │         BRIEF           │
│                         │          │                         │
│  External → In          │          │  Internal → Up          │
│  Knowledge capture      │          │  Status intelligence    │
│  Nests, queries         │          │  Check-ins, dashboards  │
└─────────────────────────┘          └─────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Backend** | Next.js API Routes | API endpoints, webhooks |
| **Database** | PostgreSQL + pgvector (Supabase) | Storage, vector search |
| **LLM** | Claude API | Summarization, Q&A, analysis |
| **Embeddings** | Voyage AI or OpenAI | Semantic search vectors |
| **Slack** | Bolt SDK (Node.js) | Bot interactions, events |
| **Voice** | LiveKit Agents | Real-time voice interface |
| **Hosting** | Vercel | Deployment, cron jobs |

---

## Enrichment Engine

Takes raw content and makes it useful. Used by both products.

### Capabilities

| Capability | Description |
|------------|-------------|
| **Metadata Extraction** | Title, description, og:image from URLs |
| **Source-Specific Parsing** | GitHub README, Arxiv abstracts, etc. |
| **Summarization** | LLM-generated 1-2 sentence summaries |
| **Tagging** | Auto-classification from fixed taxonomy |
| **Content Scraping** | Full page content for RAG context |

### Pipeline

```
Input (URL, text, document)
    │
    ▼
┌─────────────────┐
│ Metadata Fetch  │  ← Title, description, images
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Source Parser   │  ← GitHub, Arxiv, etc.
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Content Scrape  │  ← Full text for RAG
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ LLM Enrichment  │  ← Summary, tags
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Embedding Gen   │  ← Vector for search
└────────┬────────┘
         │
         ▼
Output (enriched record)
```

---

## Embeddings + Vector Search

Semantic search across all content.

### Configuration

```sql
-- Vector column (1024 dimensions for Voyage, 1536 for OpenAI)
embedding VECTOR(1024)

-- IVFFlat index for fast similarity search
CREATE INDEX embedding_idx ON table_name
USING ivfflat (embedding vector_cosine_ops);
```

### Search Function

```sql
-- Find similar content
SELECT *, 1 - (embedding <=> query_embedding) AS similarity
FROM content
WHERE 1 - (embedding <=> query_embedding) > 0.7
ORDER BY similarity DESC
LIMIT 10;
```

---

## RAG Infrastructure

Retrieval-Augmented Generation for Q&A.

### Flow

```
User Query
    │
    ▼
┌─────────────────┐
│ Query Embedding │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Vector Search   │  ← Find relevant content
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Context Build   │  ← Assemble retrieved docs
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ LLM Generation  │  ← Claude answers with context
└────────┬────────┘
         │
         ▼
Response with Sources
```

### Prompt Structure

```
You are an assistant with access to the following knowledge:

<context>
{retrieved_documents}
</context>

Answer the user's question based on this context.
Cite sources when possible.

User: {query}
```

---

## Slack SDK Integration

Both products live in Slack.

### Shared Capabilities

| Feature | Implementation |
|---------|----------------|
| **Event Subscription** | Listen for messages, links, reactions |
| **Bot DM** | Direct message interface for queries |
| **Channel Posting** | Automated summaries, reminders |
| **Interactive Messages** | Buttons, modals, forms |
| **Slash Commands** | `/finchly`, `/brief` |

### Event Types

```javascript
// Message events
app.event('message', handleMessage);

// Link shared
app.event('link_shared', handleLinkShared);

// Interactive components
app.action('button_click', handleButtonClick);

// Slash commands
app.command('/query', handleQuery);
```

---

## LLM Orchestration

Centralized Claude API usage.

### Prompt Management

```typescript
interface PromptConfig {
  system: string;
  temperature: number;
  maxTokens: number;
  model: 'claude-sonnet' | 'claude-haiku';
}

const prompts = {
  summarize: { ... },
  tag: { ... },
  answer: { ... },
  generateQuestions: { ... },  // Brief-specific
};
```

### Cost Optimization

| Task | Model | Reasoning |
|------|-------|-----------|
| Summarization | Haiku | High volume, simple task |
| Tagging | Haiku | Classification, fast |
| Q&A / RAG | Sonnet | Quality matters |
| Gap Detection | Sonnet | Complex reasoning |

---

## Database Layer

PostgreSQL on Supabase with shared schema patterns.

### Common Tables

```sql
-- Users (shared across products)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slack_user_id TEXT UNIQUE,
  slack_team_id TEXT,
  email TEXT,
  name TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Teams/Workspaces
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slack_team_id TEXT UNIQUE,
  name TEXT,
  settings JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Indexing Strategy

| Index Type | Use Case |
|------------|----------|
| **B-tree** | Primary keys, foreign keys, timestamps |
| **GIN** | Full-text search, JSONB, arrays |
| **IVFFlat** | Vector similarity search |

---

## Voice Interface

Shared voice infrastructure using LiveKit.

### Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   LiveKit   │────▶│   Agent     │
│  (iOS/Web)  │◀────│   Server    │◀────│  (Python)   │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
                                        ┌─────────────┐
                                        │  Backend    │
                                        │  API        │
                                        └─────────────┘
```

### Agent Capabilities

| Capability | Description |
|------------|-------------|
| **Speech-to-Text** | Transcribe user voice input |
| **Text-to-Speech** | Generate voice responses |
| **Conversation State** | Track multi-turn dialogue |
| **Tool Calling** | Search, save, query via API |

---

## API Design Patterns

Shared patterns across both products.

### Authentication

```typescript
// Middleware
async function authenticateRequest(req: Request) {
  const token = req.headers.get('Authorization');
  const session = await verifySlackToken(token);
  return session;
}
```

### Error Handling

```typescript
class APIError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

// Usage
throw new APIError(404, 'NOT_FOUND', 'Resource not found');
```

### Rate Limiting

```typescript
const rateLimit = {
  search: { requests: 100, window: '1m' },
  enrich: { requests: 50, window: '1m' },
  chat: { requests: 20, window: '1m' },
};
```

---

## Environment Variables

Shared across both products:

```bash
# Database
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# LLM
ANTHROPIC_API_KEY=sk-ant-...

# Embeddings
VOYAGE_API_KEY=...
# or
OPENAI_API_KEY=sk-...

# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...

# LiveKit (Voice)
LIVEKIT_URL=wss://...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...

# App
NEXT_PUBLIC_APP_URL=https://...
```

---

## Deployment

Both products deploy to Vercel with shared infrastructure.

```
┌─────────────────────────────────────────────────────────────────┐
│                         VERCEL                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Finchly    │  │   Brief     │  │   Shared    │            │
│  │  App        │  │   App       │  │   API       │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
│  ┌─────────────────────────────────────────────────┐           │
│  │              Cron Jobs                          │           │
│  │  • Weekly check-in reminders (Brief)            │           │
│  │  • Freshness checks (Finchly)                   │           │
│  │  • Digest generation (Both)                     │           │
│  └─────────────────────────────────────────────────┘           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SUPABASE                                 │
│                                                                 │
│  PostgreSQL + pgvector + Auth + Storage                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```
