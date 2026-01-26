# Slack Check-in Integration

This document explains how the weekly structured check-in Slack integration works.

## Overview

The system automatically posts weekly check-in reminders to a Slack channel. Team members click a button to start a voice check-in, and when they're done, a summary is posted back to the Slack thread.

## Architecture

### 1. Weekly Reminder (Cron Job)

**Endpoint:** `POST /api/cron/weekly-checkin`

- Triggered by Vercel Cron Jobs every Monday at 2 PM UTC (configurable in `vercel.json`)
- Posts a message to the configured Slack channel with a button link
- The link points to `/checkin/start?autostart=true` which immediately starts the voice session

**Cron Schedule (vercel.json):**
```json
{
  "crons": [{
    "path": "/api/cron/weekly-checkin",
    "schedule": "0 14 * * 1"  // Monday at 2 PM UTC
  }]
}
```

### 2. Check-in Start

When a user clicks the Slack button:
1. They're taken to `/checkin/start?autostart=true`
2. The page fetches the global structured template
3. Voice session starts automatically (no additional clicks)
4. Agent asks the structured questions
5. Responses are validated and saved

### 3. Completion Summary (Webhook)

**Endpoint:** `POST /api/slack/checkin-complete`

- Called after a check-in is saved
- Posts a summary back to the original Slack thread
- Includes key highlights (progress %, on-track status, work done)
- Provides a link to view the full check-in

## Environment Variables

### Required

```bash
# Slack Bot Token (starts with xoxb-)
SLACK_BOT_TOKEN=xoxb-your-bot-token

# Slack Team/Workspace ID
SLACK_TEAM_ID=T01234567

# Slack Bot User ID
SLACK_BOT_USER_ID=U01234567

# Frontend URL for generating check-in links
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### Optional

```bash
# Slack team name (for display)
SLACK_TEAM_NAME=Your Team

# Channel to post reminders to (default: general)
SLACK_CHECKIN_CHANNEL=general

# Channel ID (if you want to hardcode it instead of looking up by name)
SLACK_CHECKIN_CHANNEL_ID=C01234567

# Cron secret for verifying cron requests
CRON_SECRET=your-random-secret
```

## Slack Message Format

### Reminder Message

```
📊 Weekly Check-in Time!

It's time for your weekly project check-in. Share your progress,
challenges, and plans for next week via voice chat with our AI assistant.

[🎙️ Start Voice Check-in] (button)

💡 The check-in will start automatically when you click the button.
Takes about 5-10 minutes.
```

### Completion Summary

```
@username completed their weekly check-in ✅

📊 Progress: 75% complete
Status: ✅ On track
This Week: Implemented structured check-in system, added Slack integration...

[📄 View Full Check-in] (button)
```

## Testing

### Manual Cron Trigger

In development, you can manually trigger the cron job:

```bash
curl -X POST http://localhost:3000/api/cron/weekly-checkin
```

In production (with CRON_SECRET):

```bash
curl -X POST https://your-app.vercel.app/api/cron/weekly-checkin \
  -H "Authorization: Bearer your-cron-secret"
```

### Test Completion Summary

```bash
curl -X POST http://localhost:3000/api/slack/checkin-complete \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "checkinId": "your-checkin-id",
    "threadTs": "1234567890.123456",
    "channelId": "C01234567"
  }'
```

## Setup Instructions

### 1. Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App" > "From scratch"
3. Name it "Brief Check-ins" and select your workspace

### 2. Configure Bot Permissions

Go to "OAuth & Permissions" and add these **Bot Token Scopes**:
- `chat:write` - Post messages to channels
- `conversations:read` - List and view channels
- `channels:join` - Join public channels (optional)

### 3. Install to Workspace

1. Click "Install to Workspace"
2. Authorize the app
3. Copy the "Bot User OAuth Token" (starts with `xoxb-`)
4. Find your Bot User ID in "App Home" > "Your App's Bot User"

### 4. Find Team ID

```bash
# Using Slack API
curl https://slack.com/api/team.info \
  -H "Authorization: Bearer xoxb-your-bot-token"
```

Or check your workspace URL: `yourteam.slack.com` → Team ID is in the URL

### 5. Invite Bot to Channel

In Slack:
```
/invite @Brief Check-ins
```

### 6. Configure Environment Variables

Add all the environment variables listed above to your deployment platform (Vercel, etc.)

### 7. Deploy

Deploy to Vercel. The cron job will automatically be configured from `vercel.json`.

## Future Enhancements

- [ ] Support multiple channels/teams
- [ ] Configurable reminder schedule per team
- [ ] Remind individual users who haven't completed check-ins
- [ ] Weekly digest with all team check-ins
- [ ] Thread responses for questions/discussion
- [ ] Slash command to start check-in (`/brief`)
- [ ] Integration with Gap Detection Engine (smart questions based on tool data)
