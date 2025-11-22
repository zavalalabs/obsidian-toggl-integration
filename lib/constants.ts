/**
 * The interval in ms at which the active timer is polled
 * (Increased from 6s to 30s to reduce API quota consumption on free tier)
 */
export const ACTIVE_TIMER_POLLING_INTERVAL = 30000;

/**
 * The interval in ms at which the status bar is updated
 */
export const STATUS_BAR_UPDATE_INTERVAL = 1000;

/**
 * The language string used for report code blocks.
 */
export const CODEBLOCK_LANG = "toggl";
