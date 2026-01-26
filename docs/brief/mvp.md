# Brief MVP: One Month Build

## What It Is

A Slack app that pulls from Linear, shows you what it already knows, asks only the gaps, and posts status updates to a team channel.

**That's it.** No web app. No separate dashboard. Everything lives in Slack where your team already works.

---

## The Pitch

> "Brief already knows I closed 8 tickets. It just asked why AUTH-42 is still blocked."
>
> 3 minutes instead of a 30-minute status meeting. All in Slack.

---

## Core Loop

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Linear      │ ──▶ │  Gap Detection  │ ──▶ │ Smart Questions │
│  (what's known) │     │  (what's missing)│     │   (2-4 max)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │  Slack Check-in │
                                               │  (DM or thread) │
                                               └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │ #brief-status   │
                                               │ (team channel)  │
                                               └─────────────────┘
```

---

## Why Slack-Only?

| Web App Problems | Slack-Only Benefits |
|------------------|---------------------|
| Another login | Already authenticated |
| Another tab to check | Already open all day |
| Notification fatigue | Native Slack notifications |
| Adoption friction | Zero new tools to learn |
| Build complexity | Ship faster |

The "dashboard" is just a Slack channel. Managers already watch Slack.

---

## Features

### 1. Linear Integration
- Connect to one Linear team
- Pull: tasks completed, in progress, blocked, created
- Track: what changed since last check-in

### 2. Gap Detection (Hardcoded Logic)
Simple rules to identify what's missing:

| Signal | Gap Question |
|--------|--------------|
| Task blocked > 3 days | "What's the situation with [task]?" |
| New tasks added mid-cycle | "Was there a scope change?" |
| No activity on assigned tasks | "Any blockers I should know about?" |
| Approaching deadline | "How are you feeling about [deadline]?" |

No ML. Just if/then logic based on Linear data.

### 3. Check-in Experience (Slack DM)
Weekly DM from Brief:

```
📊 Brief Check-in

Here's what I know from Linear:
• ✅ 8 tasks completed this week
• 🔄 2 in progress
• 🚫 1 blocked (AUTH-42, 5 days)

I just need to know:

1. AUTH-42 has been blocked for 5 days — what's happening there?
2. How confident are you about Friday's deadline? (1-5)

[🎙️ Voice] [⌨️ Type]
```

User responds inline. Brief summarizes and posts to team channel.

### 4. Team Status Channel (#brief-status)
All check-in summaries post here:

```
┌─────────────────────────────────────────────────────────────────┐
│  #brief-status                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📊 Weekly Status — Week of Jan 26                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                       │
│                                                                 │
│  Sarah     ✅ On track                                          │
│            AUTH-42 escalated to vendor, expects Wed resolution  │
│                                                                 │
│  Marcus    🚫 Blocked                                           │
│            Waiting on external API credentials                  │
│                                                                 │
│  James     ⚠️ Check-in pending                                  │
│                                                                 │
│  Lisa      ✅ On track                                          │
│            Ahead of schedule on design specs                    │
│                                                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                       │
│  3/4 checked in · 1 blocked · 0 at risk                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5. Slack Canvas (Weekly Overview)
Pin a Canvas to the channel that auto-updates:

```
┌─────────────────────────────────────────────────────────────────┐
│  📋 Brief: Team Status                              Live View   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  THIS WEEK                                                      │
│                                                                 │
│  ┌──────────┬────────────┬─────────────────────────────────┐   │
│  │ Person   │ Status     │ Summary                         │   │
│  ├──────────┼────────────┼─────────────────────────────────┤   │
│  │ Sarah    │ ✅ On track │ AUTH-42 escalated              │   │
│  │ Marcus   │ 🚫 Blocked  │ Waiting on API creds           │   │
│  │ James    │ ⚠️ Pending  │ —                              │   │
│  │ Lisa     │ ✅ On track │ Ahead on design                │   │
│  └──────────┴────────────┴─────────────────────────────────┘   │
│                                                                 │
│  BLOCKERS                                                       │
│  • Marcus: External API credentials (3 days)                   │
│                                                                 │
│  Last updated: Today, 5:42pm                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## NOT in MVP

| Feature | Status |
|---------|--------|
| Web dashboard | ❌ Not needed — Slack channel is the dashboard |
| GitHub integration | V2 — Linear only for now |
| Notion/Figma integration | V2 |
| Smart timing | V2 — fixed weekly schedule |
| AI-generated questions | V2 — template-based for now |
| Multiple teams | V2 — one team hardcoded |
| Mobile app | ❌ Not needed — Slack mobile works |

---

## Tech Stack

| Layer | Tech |
|-------|------|
| **Slack** | Bolt SDK (Node.js) |
| **Backend** | Next.js API routes (or plain Node) |
| **Database** | Postgres (Supabase) |
| **Linear** | Linear SDK / GraphQL API |
| **LLM** | Claude API (summarizing responses) |
| **Voice** | Web Speech API or Slack Huddle link |
| **Hosting** | Vercel |

No frontend framework needed. No React. No web UI.

---

## Database Schema

```sql
-- Team members
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slack_user_id TEXT UNIQUE,
  slack_team_id TEXT,
  linear_user_id TEXT,
  name TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Check-ins
CREATE TABLE checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES members(id),

  -- Linear context at time of check-in
  linear_snapshot JSONB,

  -- Questions and answers
  questions JSONB,  -- [{question: "...", answer: "..."}]

  -- Status
  status TEXT,  -- 'on_track', 'at_risk', 'blocked'
  confidence INT,  -- 1-5

  -- Summary (LLM-generated)
  summary TEXT,

  -- Slack references
  slack_thread_ts TEXT,
  slack_channel_id TEXT,

  -- Metadata
  week_of DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Weekly summaries (for Canvas updates)
CREATE TABLE weekly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slack_team_id TEXT,
  week_of DATE,
  summary_data JSONB,  -- Aggregated team status
  canvas_id TEXT,  -- Slack Canvas reference
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Routes

```
POST /api/slack/events        -- Event subscription
POST /api/slack/interactions  -- Button clicks
POST /api/slack/commands      -- /brief command

POST /api/checkin/start       -- Init check-in with Linear data
POST /api/checkin/respond     -- Save responses
POST /api/checkin/complete    -- Summarize + post to channel

POST /api/canvas/update       -- Update weekly Canvas

POST /api/cron/weekly-prompt  -- Send weekly reminders
POST /api/cron/reminder       -- Nudge people who haven't checked in
```

---

## Slack App Configuration

### Bot Scopes Required
```
chat:write          -- Post messages
chat:write.public   -- Post to public channels
im:write            -- DM users
im:history          -- Read DM responses
users:read          -- Get user info
channels:read       -- List channels
canvases:write      -- Update Canvas (if using)
commands            -- Slash commands
```

### Event Subscriptions
```
message.im          -- User responds to check-in DM
app_mention         -- @Brief mentions
```

### Slash Commands
```
/brief              -- Start a check-in manually
/brief status       -- See your current status
/brief team         -- See team overview (posts to you)
```

---

## Check-in Flow

```
1. Monday 2pm: Cron triggers weekly prompts
2. For each team member:
   a. Fetch their Linear data
   b. Run gap detection → 2-4 questions
   c. Send personalized Slack DM
3. User clicks [Voice] or [Type]
4. User answers questions (inline in DM)
5. Brief generates summary via Claude
6. Posts summary to #brief-status
7. Updates weekly Canvas
8. Wednesday: Nudge anyone who hasn't checked in
```

---

## Message Templates

### Check-in Prompt (DM)
```
📊 *Weekly Check-in*

Here's what I pulled from Linear:
• ✅ 8 tasks completed
• 🔄 2 in progress
• 🚫 1 blocked (AUTH-42)

*I just need to know:*
1. AUTH-42 has been blocked for 5 days — what's happening?
2. Confidence in Friday deadline? (1-5)

Reply here or click below:
[🎙️ Voice Check-in]
```

### Check-in Response (User types in DM)
```
@user: AUTH-42 is waiting on the vendor API team. I escalated
yesterday, expecting response by Wednesday. If that resolves,
I'm confident we hit Friday. Confidence: 4
```

### Summary Posted to #brief-status
```
✅ *Sarah* checked in

*Status:* On track
*Confidence:* 4/5
*Summary:* AUTH-42 blocked on vendor API — escalated, expects
Wednesday resolution. Confident about Friday if that clears.

_From Linear: 8 tasks done, 2 in progress, 1 blocked_
```

### Nudge (Wednesday)
```
👋 Hey! Brief check-in is still waiting on you.

Your team's counting on visibility. Takes 2 minutes:
[✏️ Check in now]
```

### Weekly Digest (Friday)
```
📊 *Weekly Brief — Jan 26*

*Team Status*
✅ 3 on track
🚫 1 blocked
⚠️ 0 at risk

*Blockers*
• Marcus: External API credentials (resolved Thu)

*Highlights*
• Sarah: AUTH module shipped ahead of schedule
• Lisa: Design specs complete, ready for eng

_All 4 team members checked in this week_ 🎉
```

---

## One Month Timeline

### Week 1: Linear + Slack Setup
- [ ] Create Slack app, install to workspace
- [ ] Linear OAuth, connect to team
- [ ] Fetch user's Linear data (tasks by status)
- [ ] Basic Postgres schema on Supabase
- [ ] Verify: can pull Linear data for each Slack user

### Week 2: Gap Detection + Check-in DM
- [ ] Implement gap detection logic
- [ ] Generate personalized questions
- [ ] Send check-in DM with Linear context
- [ ] Handle user responses (text in thread)
- [ ] Verify: users receive and can respond to check-ins

### Week 3: Summaries + Team Channel
- [ ] Summarize responses via Claude
- [ ] Post summaries to #brief-status
- [ ] Create/update weekly Canvas
- [ ] /brief slash command
- [ ] Verify: full flow from DM to team channel

### Week 4: Polish
- [ ] Wednesday nudge for missing check-ins
- [ ] Friday weekly digest
- [ ] Edge cases (no Linear data, empty responses)
- [ ] Test with real team for one cycle
- [ ] Demo prep

---

## Demo Script

1. **Show Linear** — "Here's our team's board"
2. **Check Slack** — DM arrives with context from Linear
3. **The insight** — "Brief knows I did 8 tasks. Only asking about the blocked one."
4. **Respond** — Type 2 sentences in thread (< 1 min)
5. **See #brief-status** — Summary appears for team
6. **Show Canvas** — Live overview of who's updated
7. **The value** — "No status meeting. Manager sees everything. Took 2 minutes."

---

## Success Criteria

A manager says:
> "I just watch #brief-status. I know what's happening."

A team member says:
> "I answered 2 questions in Slack. Done."

That's the MVP.

---

## V2 Features (Post-MVP)

- **More integrations** — GitHub, Notion, Figma, Calendar
- **Smart timing** — Don't interrupt deep work
- **AI questions** — Claude generates context-aware questions
- **Threaded discussions** — Manager can ask follow-ups in thread
- **Trends** — "Blocked tasks up 20% this month"
- **Alerts** — DM manager when someone's blocked 5+ days
- **Multi-team** — Different channels per team/project
