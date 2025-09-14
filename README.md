## Key changes in this fork (2025)

- Manifest V3 migration
  - Background moved to a service worker (`background.js`)
  - `chrome.browserAction` → `chrome.action`
  - `alert()` → `chrome.notifications`
  - `chrome.tabs.getSelected` → `chrome.tabs.query`
  - Host access moved to `host_permissions`
  - Added `notifications` and `clipboardWrite` permissions

- Background (service worker)
  - One single aggregated notification (summary) instead of many popups
  - Per-source rate-limiting and deduplication
  - Stronger fetch safety (only http/https, error handling)
  - Reduced false positives with targeted validators:
    - Discord bot token: structure + base64url checks
    - SendGrid API key: strict format + base64url segment + local context check
  - Tab badge updated per active tab

- New secret detections
  - GitHub token (`gh[pousr]_...`)
  - GitLab PAT (`glpat-...`)
  - Slack tokens (`xoxb-`, `xoxp-`, `xapp-1-`)
  - Discord bot token and webhook
  - Stripe publishable key (`pk_live_...`) in addition to secret keys
  - Twilio Account SID (`AC...`)
  - SendGrid (`SG.x.y`)
  - Datadog (`ddapi_`, `ddapp_`)
  - Google API key (`AIza...`) and OAuth client ID
  - Shopify (`shpat_`, `shppa_`)
  - OpenAI (`sk-...`)
  - Generic `Bearer <token>`

- Popup UX
  - “Copy” per finding and “Copy All Findings”
  - Clickable source URL for each finding (open in new tab)
  - Export findings as CSV and JSON
  - Clear findings (per origin / all)

- Content script
  - HTML and external scripts scanned; non-http(s) script URLs are ignored

## Manifest V3 quick notes

- Background is ephemeral; avoid long-lived state in the service worker
- Use `chrome.action.setBadgeText({ text, tabId })` for per-tab badges
- Host permissions must be declared under `host_permissions`
- Manual install (unpacked) still supported via `chrome://extensions/` (Developer Mode)

Upstream: [trufflesecurity/Trufflehog-Chrome-Extension](https://github.com/trufflesecurity/Trufflehog-Chrome-Extension)
Fork: [koff75/Trufflehog-Chrome-Extension](https://github.com/koff75/Trufflehog-Chrome-Extension)
