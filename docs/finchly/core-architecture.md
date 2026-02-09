# Finchly Core Architecture

This document describes the technology layer that powers Finchly.

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         THE WORLD                                │
│   Articles, papers, repos, news, blogs, tweets, podcasts...     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FINCHLY PLATFORM                            │
├─────────────────────────────────────────────────────────────────┤
│  • Enrichment Engine                                            │
│  • Embeddings + Vector Search                                   │
│  • RAG Infrastructure                                           │
│  • Slack SDK Integration                                        │
│  • LLM Orchestration                                            │
│  • Database Layer                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         NESTS                                    │
│   Curated collections of knowledge, queryable via RAG           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Monorepo** | Turborepo + pnpm workspaces | Task orchestration, package linking |
| **Frontend** | Next.js (App Router) + Tailwind CSS | Web interface (V2, thin BFF layer) |
| **Backend API** | Fastify (TypeScript) | API endpoints, webhooks, business logic |
| **Database** | AWS RDS PostgreSQL + pgvector + Drizzle ORM | Storage, vector search, migrations |
| **LLM** | `palindrom-ai/llm` (Python) | Summarization, Q&A, RAG, observability |
| **Embeddings** | `palindrom-ai/llm` | Semantic search vectors (Voyage AI or OpenAI) |
| **Slack** | Bolt SDK (Node.js) | Bot interactions, events |
| **Infrastructure** | `palindrom-ai/infra` (Pulumi) | All cloud resources — never write raw Pulumi |
| **Schema** | Zod → OpenAPI → Pydantic | Type-safe APIs, single source of truth |
| **Frontend Hosting** | Vercel | Next.js deployment |
| **Backend Hosting** | GCP Cloud Run | Fastify API deployment |

---

## Enrichment Engine

Takes raw content and makes it useful.

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

### Capabilities

| Feature | Implementation |
|---------|----------------|
| **Event Subscription** | Listen for messages, links, reactions |
| **Bot DM** | Direct message interface for queries |
| **Channel Posting** | Automated summaries, reminders |
| **Interactive Messages** | Buttons, modals, forms |
| **Slash Commands** | `/finchly` |

### Event Types

```javascript
// Message events
app.event('message', handleMessage);

// Link shared
app.event('link_shared', handleLinkShared);

// Interactive components
app.action('button_click', handleButtonClick);

// Slash commands
app.command('/finchly', handleQuery);
```

---

## LLM Orchestration

All LLM calls go through `palindrom-ai/llm` (Python). Never import Anthropic/OpenAI SDKs directly.

### What the Package Provides

| Feature | Description |
|---------|-------------|
| Unified API | Single interface for Claude, OpenAI, Google |
| Observability | Tracing, token counts, latency, cost via Langfuse |
| RAG | Retrieval-augmented generation utilities |
| Fallbacks | Primary model fails → backup |
| Cost tracking | Per project, feature, user |

### Required Metadata

All LLM calls include: `project`, `feature`, `userId`, `requestId`.

### Cost Optimization

| Task | Model | Reasoning |
|------|-------|-----------|
| Summarization | Haiku | High volume, simple task |
| Tagging | Haiku | Classification, fast |
| Q&A / RAG | Sonnet | Quality matters |

---

## Database Layer

AWS RDS PostgreSQL with Drizzle ORM. Migrations managed by Drizzle Kit.

### Common Tables (Drizzle Schema)

```typescript
// packages/db/schema/users.ts
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  slackUserId: text('slack_user_id').unique(),
  slackTeamId: text('slack_team_id'),
  email: text('email'),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow(),
});

// packages/db/schema/teams.ts
export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  slackTeamId: text('slack_team_id').unique(),
  name: text('name'),
  settings: jsonb('settings'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### Indexing Strategy

| Index Type | Use Case |
|------------|----------|
| **B-tree** | Primary keys, foreign keys, timestamps |
| **GIN** | Full-text search, JSONB, arrays |
| **IVFFlat** | Vector similarity search |

---

## API Design Patterns

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

```bash
# Database (AWS RDS)
DATABASE_URL=postgresql://...

# LLM (via palindrom-ai/llm)
ANTHROPIC_API_KEY=sk-ant-...
LANGFUSE_PUBLIC_KEY=pk-...
LANGFUSE_SECRET_KEY=sk-...

# Embeddings (via palindrom-ai/llm)
VOYAGE_API_KEY=...

# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...

# App
NEXT_PUBLIC_APP_URL=https://...
API_URL=https://...
```

---

## Infrastructure

All cloud resources are created and managed via `palindrom-ai/infra` (Pulumi). Never write raw Pulumi directly.

```typescript
import { Api, Database, Secret } from 'palindrom-ai/infra';

const db = new Database("Finchly");
const slackToken = new Secret("SlackBotToken");
const slackSecret = new Secret("SlackSigningSecret");
const anthropicKey = new Secret("AnthropicApiKey");

const api = new Api("FinchlyApi", {
  link: [db, slackToken, slackSecret, anthropicKey],
});
```

## Deployment

```
┌──────────────────────────┐     ┌──────────────────────────┐
│         VERCEL           │     │     GCP CLOUD RUN        │
├──────────────────────────┤     ├──────────────────────────┤
│                          │     │                          │
│  Next.js Frontend        │     │  Fastify API             │
│  (thin BFF layer)        │────▶│  Slack Webhooks          │
│                          │     │  Enrichment Pipeline     │
│                          │     │  Cron Jobs               │
│                          │     │                          │
└──────────────────────────┘     └──────────────────────────┘
                                           │
                                           ▼
                              ┌──────────────────────────┐
                              │       AWS RDS            │
                              │                          │
                              │  PostgreSQL + pgvector   │
                              │  Managed by Drizzle ORM  │
                              │                          │
                              └──────────────────────────┘

All resources provisioned via palindrom-ai/infra (Pulumi).
```
