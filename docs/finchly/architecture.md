# Finchly Architecture

## Overview

Finchly captures external knowledge from the noisy world and builds organized, queryable nests for your team.

**Tagline:** "Build nests of knowledge from a noisy world."

---

## Core Concept

```
┌─────────────────────────────────────────────────────────────────┐
│                         THE WORLD                                │
│   Articles, papers, repos, news, blogs, tweets, podcasts...     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CAPTURE FLOWS                               │
│   Rules that determine what to capture and how to enrich it     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     KNOWLEDGE BASE                               │
│   Links + Notes, enriched, tagged, embedded, searchable         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FILTER FLOWS                                │
│   Rules that route knowledge into specific nests                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         NESTS                                    │
│   Curated collections of knowledge, queryable via RAG           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Sources

Where external knowledge comes from:

- Slack channels (MVP)
- X/Twitter profiles (Future)
- News sites (Future)
- Blogs / RSS (Future)
- Every.to (Future)
- Manual submission (Future)

---

## Capture Flows

Configurable rules that determine what to capture and how to enrich it.

Defined in a standard format (JSON). Examples:

- "Everything that is a GitHub link in #engineering, extract the README for each repo"
- "Everything that mentions AI in #research, tag with #ai"
- "Extract every Arxiv paper posted in #papers, get the abstract"

Capture flows handle:
- URL detection and extraction
- Source-specific enrichment (GitHub, Arxiv, etc.)
- Auto-tagging based on rules
- Deduplication

---

## Knowledge Base

Everything is stored as either a **Link** or a **Note**.

| Type | Description |
|------|-------------|
| **Link** | URL + metadata + enriched data (summary, tags, embedding) |
| **Note** | Markdown content, can be connected to a Link |

Every Link and Note is tied to a Source Event (who shared it, when, where).

### Data Model

- Many-to-many relationships between Links, Notes, and Nests
- Drizzle ORM for schema definition and migrations
- AWS RDS PostgreSQL with pgvector
- Full-text and semantic search indexes

---

## Tagging

Multi-level tag hierarchy (fixed taxonomy):

```
AI / Machine Learning
  ├── LLMs
  ├── Computer Vision
  ├── Agents
  └── Research

Engineering
  ├── Frontend
  ├── Backend
  ├── Infrastructure
  └── Architecture

Design
Product
Business
Research
Tools
News
```

Tags are:
- Fixed and curated (not user-created in MVP)
- Automatically assigned by LLM
- Used for filtering when building nests

---

## Filter Flows

Rules that route knowledge from the Knowledge Base into Nests.

Built via natural language, represented in JSON format.

Examples:
- "Put all AI research papers into my 'AI Research' nest"
- "Anything tagged #frontend goes into the 'Frontend Resources' nest"

When a Filter Flow changes:
- Nest contents are re-evaluated
- Knowledge is added/removed based on new rules

---

## Nests

Curated collections of knowledge, organized as markdown documents.

### Structure

A Nest is a **collection of markdown files**, each connected to Links/Notes from the Knowledge Base.

- Files have an ordinal (order) so they form a coherent document when combined
- Each markdown file can connect to one or more Links/Notes
- Nests are what gets put into RAG context when querying Finchly

### Visibility

| Type | Description |
|------|-------------|
| Private | Individual nest, only visible to creator |
| Team | Shared nest, visible to team members |

When a nest goes from private to public:
- Connected Capture Flows become visible
- Connected Filter Flows become visible
- Connected Notes/Links become accessible

Flows can be "forked" and shared between users.

---

## Freshness

Knowledge has a shelf life.

Default behavior:
- Notes/Links disconnected from all Nests for 3+ months get deleted
- Configurable per workspace

Finchly continuously reviews nest freshness:
- Flags outdated information
- Suggests removal of stale content
- Maintains relevance over time

---

## Skills

Automated outputs Finchly can generate:

| Skill | Description |
|-------|-------------|
| Weekly Newsletter | Curated digest of new content in a nest |
| Slack Summary | Post a summary to a channel on schedule |
| Learning Path | Ordered content for onboarding/education |
| Trend Report | What's new/changing in a topic area |

Skills can:
- Pull from one or more nests
- Enrich with external sources
- Post directly to Slack channels
- Be scheduled (daily, weekly, etc.)

---

## Interfaces

### Slack Bot
- Query nests via DM
- View nest contents
- Pin nests to Slack Canvas
- Receive skill outputs (newsletters, summaries)

### Web App (Next.js on Vercel)
- Browse all Links and Notes
- Search across Knowledge Base
- View and manage Nests
- Configure Capture and Filter Flows
- Thin BFF layer — all business logic in Fastify backend (GCP Cloud Run)

### Voice Mode
- Same as chat interface, but spoken
- Powered by `progression-labs/livekit-agents` (Python)
- Same Finchly Fastify API backend

---

## Use Cases

- **Research Team**: Capture papers, articles, repos shared in Slack → query "What's new in RAG this month?"
- **Engineering Team**: Build a "Best Practices" nest from shared resources → onboard new engineers
- **Product Team**: Track competitor news and industry trends → weekly digest to leadership
- **Individual**: Personal learning nest for a topic you're studying

---

## Pricing

| Tier | Nests | Notes |
|------|-------|-------|
| Free | 5 nests | Unlimited sources, users |
| Paid | Unlimited | Team features, advanced skills |

---

## Future Ideas

- Use Finchly inside Claude Code for ideation/research
- Integration with Magpie UI
- Browser extension for manual capture
- Mobile app for on-the-go queries
