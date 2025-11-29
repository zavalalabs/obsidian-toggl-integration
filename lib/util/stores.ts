import type { PluginSettings } from "lib/config/PluginSettings";
import type TogglService from "lib/toggl/TogglService";
import type { ApiStatus } from "lib/toggl/TogglService";
import { writable } from "svelte/store";

export const settingsStore = writable<PluginSettings>(null);

export const togglService = writable<TogglService>(null);
export const apiStatusStore = writable<ApiStatus>(null);
export const timerActionInProgress = writable<boolean>(false);
