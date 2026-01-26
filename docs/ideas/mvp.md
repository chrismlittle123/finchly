# Finchly MVP: One Month Build

## What It Is

A Slack bot that watches a channel, enriches everything shared, and lets you query it.

**That's it.** No nests. No flows. No dashboards. Just a smart memory for your Slack channel.

---

## The Pitch

> "What was that AI paper someone shared last week?"
>
> Instead of scrolling through Slack, you DM Finchly and get an instant answer.

---

## Core Loop

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Slack Channel  │ ──▶ │    Enrichment   │ ──▶ │  Knowledge Base │
│  (links posted) │     │  (auto, always) │     │   (searchable)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │   Slack Bot DM  │
                                               │  (ask anything) │
                                               └─────────────────┘
```

---

## Features

### 1. Slack Channel Monitoring
- Watch **one hardcoded channel**
- Capture every link posted
- Store who shared it, when, and their message

### 2. Auto-Enrichment (Hardcoded Logic)
Every link gets enriched automatically:

| Link Type | Enrichment |
|-----------|------------|
| Any URL | Fetch title, description, image |
| GitHub repo | Repo description + README summary |
| Arxiv paper | Title + abstract |
| All links | LLM-generated 1-sentence summary |
| All links | Auto-tags from fixed taxonomy |

No user configuration. It just does this for everything.

### 3. Knowledge Base
- Postgres database with pgvector
- Full-text search
- Semantic search (embeddings)
- That's the "knowledge base" — just a well-indexed database

### 4. Slack Bot Query Interface
DM the bot, ask anything:
- "What AI papers were shared this month?"
- "Show me everything from Sarah"
- "What did the team share about authentication?"
- "Summarize this week's links"

Bot uses RAG to search knowledge base and answer.

---

## NOT in MVP

| Feature | Status |
|---------|--------|
| Capture Flows | V2 — hardcoded logic for now |
| Filter Flows | V2 — no routing needed without nests |
| Nests | V2 — flat knowledge base only |
| Multiple channels | V2 — one channel hardcoded |
| Web dashboard | V2 — Slack-only interface |
| Check-ins | V2 — just retrieval for now |
| Voice | V2 |
| Teams/auth | V2 — single user/workspace |

---

## Tech Stack

| Layer | Tech |
|-------|------|
| **Slack** | Bolt SDK (Node.js) |
| **Backend** | Next.js API routes |
| **Database** | Postgres + pgvector (Supabase) |
| **LLM** | Claude API |
| **Embeddings** | Voyage or OpenAI |
| **Hosting** | Vercel |

---

## Database Schema

```sql
-- Links: the knowledge base
CREATE TABLE links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Original data
  url TEXT NOT NULL UNIQUE,
  posted_by TEXT,
  posted_by_name TEXT,
  message_text TEXT,
  slack_ts TEXT,
  slack_channel TEXT,

  -- Enrichment
  title TEXT,
  description TEXT,
  image_url TEXT,
  summary TEXT,
  tags TEXT[],
  raw_content TEXT,          -- scraped page content (for RAG)

  -- Search
  embedding VECTOR(1024),

  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX links_embedding_idx ON links USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX links_tags_idx ON links USING GIN (tags);
CREATE INDEX links_search_idx ON links USING GIN (
  to_tsvector('english',
    COALESCE(title, '') || ' ' ||
    COALESCE(description, '') || ' ' ||
    COALESCE(summary, '') || ' ' ||
    COALESCE(message_text, '')
  )
);
```

One table. That's the whole knowledge base.

---

## API Routes

```
POST /api/slack/events     -- Slack webhook (link posted)
POST /api/slack/messages   -- Slack bot DM handler

POST /api/enrich           -- Enrich a single link (internal)
POST /api/search           -- Search knowledge base (internal)
POST /api/chat             -- RAG query (internal)
```

---

## Enrichment Pipeline

When a link is posted:

```
1. Extract URL from Slack message
2. Check if URL already exists → skip if duplicate
3. Fetch page metadata (title, description, og:image)
4. If GitHub: fetch repo info via API
5. If Arxiv: fetch paper abstract
6. Scrape page content (for RAG context)
7. Generate summary via Claude (1-2 sentences)
8. Generate tags via Claude (from fixed list)
9. Generate embedding
10. Save to database
```

---

## Fixed Tag Taxonomy

```
AI / Machine Learning
Engineering
Design
Product
Business
Research
Tools
News
Other
```

Claude picks 1-3 tags per link. No custom tags for MVP.

---

## Slack Bot Behavior

| User says | Bot does |
|-----------|----------|
| Any question | RAG search → Claude answers with sources |
| "links" or "recent" | Show last 10 links |
| "links about X" | Search and list matches |
| "summarize this week" | Aggregate summary of week's links |

All responses include source links so user can click through.

---

## One Month Timeline

### Week 1: Slack + Database
- [ ] Create Slack app, install to workspace
- [ ] Bolt SDK setup, event subscription working
- [ ] Postgres + pgvector on Supabase
- [ ] Basic link capture (no enrichment yet)
- [ ] Verify: links appear in database when posted

### Week 2: Enrichment
- [ ] Page metadata fetching (unfurl)
- [ ] GitHub API integration
- [ ] Arxiv abstract extraction
- [ ] Claude summarization
- [ ] Claude tagging
- [ ] Embedding generation
- [ ] Verify: links fully enriched in database

### Week 3: Query Interface
- [ ] Full-text search endpoint
- [ ] Semantic search endpoint
- [ ] RAG chat endpoint (search + Claude)
- [ ] Slack bot DM handler
- [ ] Verify: can ask questions, get answers

### Week 4: Polish
- [ ] Error handling (failed fetches, rate limits)
- [ ] Better response formatting
- [ ] Edge cases (duplicates, invalid URLs)
- [ ] Seed with real data from your channel
- [ ] Demo prep

---

## Demo Script

1. **Show Slack channel** — "Here's our #research channel where we share links"
2. **Post a link** — Drop a GitHub repo or article
3. **Show it's captured** — "Finchly just enriched that automatically"
4. **Query demo** — DM bot: "What AI stuff was shared this week?"
5. **Get instant answer** — Bot responds with summary + links
6. **The value** — "No more scrolling. No more 'what was that link?'"

---

## Success Criteria

Someone uses it and says:

> "Oh nice, I don't have to search Slack anymore."

That's the MVP. Everything else is V2.

---

## V2 Features (Post-MVP)

- **Capture Flows** — User-configurable rules for what to extract
- **Filter Flows** — Route knowledge to different collections
- **Nests** — Curated collections of knowledge
- **Web Dashboard** — Visual interface for browsing
- **Check-ins** — "Fill in the gaps" experience
- **Multiple Channels** — Watch more than one channel
- **Multi-workspace** — Teams and authentication
- **Voice Interface** — Talk to Finchly
