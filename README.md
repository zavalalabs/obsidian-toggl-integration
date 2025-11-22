[![GitHub tag (Latest by date)](https://img.shields.io/github/v/tag/mcndt/obsidian-toggl-integration)](https://github.com/mcndt/obsidian-toggl-integration/releases) ![GitHub all releases](https://img.shields.io/github/downloads/mcndt/obsidian-toggl-integration/total)

# Toggl Track Integration for Obsidian (zavalalabs fork)

Add integration with the Toggl Track API to manage your timers inside Obsidian.

This fork extends the original plugin with enhanced diagnostics, automatic workspace setup, and proactive API quota management (local rate limiting + status bar quota display). Original upstream by @mcndt; see `FORK_GUIDE.md` for fork usage & release differences.

## Support & Attribution

The original creator **Maxime Cannoodt (@mcndt)** deserves full credit for the foundational architecture and features of this plugin. This fork by **Chris Zavala (@zavalalabs)** focuses on maintenance, error hardening, diagnostics, and new capabilities (rate limiting, workspace auto-selection, quota visibility).

If these ongoing improvements save you time or help keep your workflow stable, you can tip the fork maintainer here:

<a href="https://www.buymeacoffee.com/cztech"><img src="https://img.buymeacoffee.com/button-api/?text=Tip fork maintainer&emoji=&slug=cztech&button_colour=5F7FFF&font_colour=ffffff&font_family=Inter&outline_colour=000000&coffee_colour=FFDD00"></a>

If upstream absorbs these changes later, attribution for the maintenance effort is kindly requested.

## Functionality

- Generate time tracking reports inside of your notes with code blocks (SUMMARY & LIST)
- See your current timer and how long it has been running in the status bar
- Status bar quota indicator (remaining hourly API requests with warning under 20%)
- Local hourly rate limiter (optional) prevents overshooting Toggl Track account quotas (supports Free / Starter / Premium caps)
- Auto-selects first workspace on initial successful connection if none configured
- Fallback connectivity test to `/api/v9/me` for clearer troubleshooting when primary client fails
- Get a summary of your day in the side panel
- Create, start, and stop a new timer using the command palette, or restart a recent one

![](https://raw.githubusercontent.com/mcndt/obsidian-toggl-integration/master/demo2.gif)

## Rendering time reports inside your notes

Using simple code blocks it is possible to render time tracking reports inside your Obsidian notes. For example,

````
```toggl
SUMMARY
PAST 7 DAYS
```
````

Will result in something like:

![example-summary-report](https://user-images.githubusercontent.com/23149353/148293946-4e70ede9-0a9f-401e-af4b-f954caaeed84.png)

You can find a full tutorial and reference on rendering time reports in the [plugin wiki](<https://github.com/mcndt/obsidian-toggl-integration/wiki/Toggl-Query-Language-(TQL)-Reference>).

### Fork Additions to Reporting

Reports now defensively handle early render while projects/clients/tags are still loading, avoiding crashes (formerly `Cannot read properties of undefined (reading 'find')`). Enrichment supports both `client_id` and legacy `cid` fields from the v9 API.

## Setup

Configuring this plugin requires you to first request an API token from Toggl. More info on how to do this [can be found here](https://support.toggl.com/en/articles/3116844-where-is-my-api-token-located).

To set up this plugin, simply enter your API token in the settings tab, click connect and select the Toggl Workspace you wish to use.

If no workspace is selected, the fork will auto-select the first available workspace after a successful connection and save it to settings.

![settings](https://raw.githubusercontent.com/mcndt/obsidian-toggl-integration/master/settings.png)

## Use with other plugins:

### QuickAdd

The developer of the QuickAdd plugin has created a preset menu for timers using QuickAdd. Instructions are available [here](https://github.com/chhoumann/quickadd/blob/master/docs/docs/Examples/Macro_TogglManager.md) and you can find out how he did it on the Obsidian Discord server ([link to message](https://discord.com/channels/686053708261228577/707816848615407697/876069796553293835)).

## Roadmap

You can see my more detailed roadmap for this plugin on this page: [Development Roadmap](https://github.com/mcndt/obsidian-toggl-integration/projects/1). I try to keep the cards in each column sorted by priority.

## Feature Requests

Please make feature requests in the GitHub discussions tab: [click here](https://github.com/mcndt/obsidian-toggl-integration/discussions/categories/feature-requests)

If you would to like to talk about the plugin with me more directly, you can find me in the Obsidian Discord server as `Maximio#6460`. Feel free to tag me!

## Dependencies

Currently I rely on this repo for providing a JavaScript interface with the Toggl Track API: https://github.com/saintedlama/toggl-client

However in the future I might write fork this so I can refactor it to use mobile friendly APIs (e.g. using Obsidian’s own request API).

### Rate Limiting

The fork adds a lightweight local hourly rate limiter to reduce the chance of hitting remote Toggl quota errors (402). You can:

1. Toggle the limiter on/off in Settings → Rate Limiting.
2. Set (or override) your plan tier (Free 30/hr, Starter 240/hr, Premium 600/hr). If unsure, leave on Auto/Default.
3. Monitor live usage stats (used/cap and minutes until window reset).
4. View remaining quota directly in the status bar: `… | Q 12/30` with a warning icon when under 20%.

When the remote API responds with a 402 style rate limit message ("Try again in X seconds"), requests are temporarily suspended and you receive a Notice with the cooldown duration.

### Troubleshooting

| Symptom | Possible Cause | Resolution |
|---------|----------------|-----------|
| Status bar shows `Connecting to Toggl...` indefinitely | Invalid token or network block | Re-enter API token; check connectivity; use fallback ping in console logs (`/api/v9/me`). |
| Report block error: `Cannot read properties of undefined (reading 'find')` | Data stores not yet loaded (projects/clients) | Reload note after a few seconds; fork now includes defensive checks to avoid crash. |
| `(No Project)` appears for active timer | Timer has no project id | Expected; assign a project manually when starting timers. |
| Frequent rate limit Notices | High polling or many report refreshes | Ensure rate limiter enabled; reduce manual refreshes; verify correct plan tier override. |
| Workspace auto-select did not run | Existing workspace already saved or none returned | Manually pick workspace in settings; verify account has at least one workspace. |

### New Settings (Fork)

- Hourly rate limiter toggle
- Plan override dropdown (Free / Starter / Premium / Auto)
- Live quota stats & remaining reset time
- Status bar quota display (automatic)

### Fork Release Workflow

Test releases use tag prefixes (`test-*`, `fork-*`) and install under plugin id `obsidian-toggl-integration-zavala-fork` allowing side-by-side usage with upstream.

## Legacy Support Link (Upstream)

To also support the original author for his foundational work:

<a href="https://www.buymeacoffee.com/mcndt"><img src="https://img.buymeacoffee.com/button-api/?text=Support original author&emoji=&slug=mcndt&button_colour=444444&font_colour=ffffff&font_family=Inter&outline_colour=000000&coffee_colour=FFDD00"></a>
