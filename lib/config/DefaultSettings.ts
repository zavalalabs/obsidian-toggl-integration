import type { PluginSettings } from "./PluginSettings";

export const DEFAULT_SETTINGS: PluginSettings = {
  apiToken: null,
  charLimitStatusBar: 40,
  statusBarFormat: "m [minute]",
  statusBarNoEntryMesssage: "-",
  statusBarPrefix: "Timer: ",
  statusBarShowProject: false,
  updateInRealTime: true,
  workspace: { id: "none", name: "None selected" },
  rateLimitEnabled: true,
  planOverride: null,
  hourlyCap: 30, // default assume free tier until detected/overridden
  usedThisHour: 0,
  hourWindowStart: Date.now(),
};
