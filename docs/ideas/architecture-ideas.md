# Finchly Architecture Ideas

## Feature Map

### Sources

- Slack channels
- X profiles (Future)
- News sites (Future)
- Blogs (Future)
- Every.to

Capture flows are configurable by user or team.

They are defined in a standard Capture Flow format (JSON probably?)

For example:

- Everything that is a GitHub link in this Channel, extract the Readme for each repo.
- Everything that mentions AI in this channel, use this tag: #ai
- (duplication is okay)
- Extract every Arxiv paper posted in this channel, get the abstract.

A list of tags (pre-verified and static) are used for sorting knowledge, Finchly determines the right tags for the information it's capturing.

Automatically enriches.

Automatically deduplicates links.

### Knowledge Base

Everything is stored as either a **NOTE** or a **LINK** - this is the knowledge base.

- **Link** = URL + metadata + enriched data
- **Note** = Markdown, could be connected to a Link

Every link and note is tied to a Source Event.

Versioning inside PostgreSQL database, which is where they are stored.

Many to Many relationship.

### Tagging

Multi-level tags (hierarchy exists) which are fixed.

Have to decide on the right tags and the right hierarchy/structure to capture and store information in appropriate clusters. This is essentially a Data Science project.

There are specific tags for Links and for Notes. These are constant and follow a software specific taxonomy.

Tags are used as a filtering mechanism when building nests.

### Filter Flows

Rules/flows are built by talking to Finchly in natural language, but are represented in a standardised JSON format.

They are used to take information from knowledge base and put them in the user's nests. If a filter flow changes, upon review the information in the Nest is reviewed against the filter flow and against the updated external research data.

### Nests

Markdown files which are put into context/RAG when a user asks Finchly questions. Finchly searches these directly, not the full knowledge base. A nest is actually a COLLECTION of markdown files. Each markdown file can have at least one connected note/link. Sometimes more. The markdown files all have an order, ordinal, so that when put in order they create a full document.

Some nests are team nests (shared), some are individual nests. When a nest goes from private to public, so do the Capture flows, Filter flows, Connected Notes and Links in the knowledge base. These flows can be copied and shared between people very easily. Think of it like "forking".

### Freshness

Nests are connected to notes + links. When a note or a link has been disconnected from all nest markdowns (or never connected) for more than 3 months, this note + link gets deleted. That's the default but it's configurable.

Finchly is constantly reviewing the freshness of nests, and when there is information inside a nest that is no longer relevant, both the information and the connection is removed.

### Skills

Creates content for you to learn. For example, creates a weekly newsletter that you can read on a Monday morning with all new AI news.

It can also post directly in Slack channels. So the idea being that you can use a Slack Channel as a source, and then Finchly can even enrich from other sources as well and then provide a summary of what has happened in AI in the last 7 days.

## Web App

Used mainly to view the source Notes (can also use Slack plugin for this, simply chat to Finchly, tell it to give you a list of nests and then choose a nest to view, then you can "pin" the nest to your Slack somewhere, perhaps using Canvas, if you want.)

Web app has all notes + links and search function, as well as all nests with a search function. A nice UI for navigating/viewing the markdown data.

## Voice Mode

Very similar to Finchly chat interface, but instead of typing you are speaking to Finchly, using LiveKit agents. Same Finchly API backend.

## Further Ideas

You should be able to use Finchly inside Claude Code / inside our Magpie UI to help you with ideation/researching new ways of doing things. It's a useful ideation tool, with information that YOU care about.

## Pricing

- 5 nests for free tier (unlimited sources, etc.)
- Unlimited for paid tier
