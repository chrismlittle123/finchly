#!/usr/bin/env bash
set -euo pipefail

# Updates the Slack app manifest to configure event subscriptions, redirect URLs, etc.
# Requires: SLACK_APP_ID, SLACK_CONFIG_TOKEN, APP_BASE_URL
#
# To get a config token:
#   1. Go to https://api.slack.com/apps/<APP_ID>/general
#   2. Scroll to "App-Level Tokens"
#   3. Generate a token with "connections:write" scope (or use the Manifest API directly)
#
# Or generate one at: https://api.slack.com/reference/manifests#config-tokens

SLACK_APP_ID="${SLACK_APP_ID:?Set SLACK_APP_ID}"
SLACK_CONFIG_TOKEN="${SLACK_CONFIG_TOKEN:?Set SLACK_CONFIG_TOKEN}"
APP_BASE_URL="${APP_BASE_URL:?Set APP_BASE_URL}"

MANIFEST=$(cat <<EOF
{
  "display_information": {
    "name": "Finchly",
    "description": "Finchly saves and organizes links shared in Slack. Install to any workspace, invite the bot to channels you want monitored, and Finchly automatically captures, enriches, and indexes every link — making your team's shared knowledge searchable and discoverable.",
    "background_color": "#1a1a2e"
  },
  "features": {
    "app_home": {
      "home_tab_enabled": false,
      "messages_tab_enabled": true,
      "messages_tab_read_only_enabled": false
    },
    "bot_user": {
      "display_name": "finchly",
      "always_online": true
    }
  },
  "oauth_config": {
    "redirect_urls": [
      "http://localhost:3001/slack/oauth/callback",
      "${APP_BASE_URL}/slack/oauth/callback"
    ],
    "scopes": {
      "bot": [
        "channels:history",
        "channels:read",
        "chat:write",
        "groups:history",
        "groups:read",
        "im:history",
        "im:write",
        "links:read",
        "links:write"
      ]
    }
  },
  "settings": {
    "event_subscriptions": {
      "request_url": "${APP_BASE_URL}/slack/events",
      "bot_events": [
        "link_shared",
        "message.channels",
        "message.groups",
        "message.im",
        "app_uninstalled"
      ]
    },
    "org_deploy_enabled": false,
    "socket_mode_enabled": false,
    "token_rotation_enabled": false
  }
}
EOF
)

echo "Updating Slack app manifest for ${SLACK_APP_ID}..."
echo "  Events URL: ${APP_BASE_URL}/slack/events"
echo "  OAuth callback: ${APP_BASE_URL}/slack/oauth/callback"

RESPONSE=$(curl -s -X POST https://slack.com/api/apps.manifest.update \
  -H "Authorization: Bearer ${SLACK_CONFIG_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"app_id\": \"${SLACK_APP_ID}\", \"manifest\": ${MANIFEST}}")

OK=$(echo "$RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('ok', False))")

if [ "$OK" = "True" ]; then
  echo "Slack app manifest updated successfully."
else
  echo "Failed to update manifest:"
  echo "$RESPONSE" | python3 -m json.tool
  exit 1
fi
