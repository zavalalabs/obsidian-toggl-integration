import type { PluginSettings } from "lib/config/PluginSettings";
import type {
  SearchTimeEntriesResponseItem,
  TimeEntryStart,
  TimeEntry,
  ProjectsSummaryResponseItem,
  ProjectsResponseItem,
  TagsResponseItem,
  SummaryReportResponse,
  DetailedReportResponseItem,
  ClientsResponseItem,
  ProjectId,
  TagId,
  ClientId,
  SummaryTimeChart,
} from "lib/model/Report-v3";
import type { TogglWorkspace } from "lib/model/TogglWorkspace";
import type { ISODate } from "lib/reports/ReportQuery";
import { settingsStore } from "lib/util/stores";
import RateLimiter from "lib/util/RateLimiter";
import moment from "moment";
import { Notice } from "obsidian";

import { ApiQueue } from "./ApiQueue";
import { createClient } from "./TogglClient";

type ReportOptions = {
  start_date: ISODate;
  end_date: ISODate;
  project_ids?: ProjectId[];
  tag_ids?: TagId[];
  client_ids?: ClientId[];
};

/** Wrapper class for performing common operations on the Toggl API. */
export default class TogglAPI {
  private _api: typeof import("toggl-client");
  private _settings: PluginSettings;
  private _queue = new ApiQueue();
  private _rawToken: string;
  private _rateLimiter: RateLimiter;

  constructor() {
    settingsStore.subscribe((val: PluginSettings) => (this._settings = val));
    this._rateLimiter = new RateLimiter();
  }

  /**
   * Must be called after constructor and before use of the API.
   */
  public async setToken(apiToken: string) {
    this._rawToken = apiToken;
    this._api = createClient(apiToken);
    try {
      await this.testConnection();
    } catch (err) {
      console.error("[toggl] primary client connection failed", err);
      // Attempt fallback direct fetch to v9 endpoint for better diagnostics.
      const fallbackOk = await this._fallbackDirectPing();
      if (!fallbackOk) {
        throw new Error("Cannot connect to Toggl API (client + fallback failed).");
      }
    }
  }

  /**
   * @throws an Error when the Toggl Track API cannot be reached.
   */
  public async testConnection() {
    await this._exec(() => this._api.workspaces.list());
  }

  /**
   * Fallback connectivity test using direct fetch to Track API v9.
   * Provides clearer error info in console if library is outdated or domain changed.
   */
  private async _fallbackDirectPing(): Promise<boolean> {
    if (!this._rawToken) return false;
    const basic = btoa(`${this._rawToken}:api_token`);
    try {
      const resp = await fetch("https://api.track.toggl.com/api/v9/me", {
        method: "GET",
        headers: {
          Authorization: `Basic ${basic}`,
          Accept: "application/json",
          "User-Agent": "Obsidian Toggl Integration Fallback",
        },
      });
      if (!resp.ok) {
        const text = await resp.text();
        console.error(`[toggl] fallback /me failed ${resp.status}: ${text}`);
        return false;
      }
      const data = await resp.json();
      if (!data || !Array.isArray(data.workspaces)) {
        console.warn("[toggl] fallback /me response did not include workspaces", data);
      }
      console.info("[toggl] fallback v9 /me succeeded; library may be outdated for workspaces endpoint.");
      return true;
    } catch (e) {
      console.error("[toggl] fallback connectivity error", e);
      return false;
    }
  }

  /** @returns list of the user's workspaces. */
  public async getWorkspaces(): Promise<TogglWorkspace[]> {
    const response: any[] = await this._exec(() =>
      this._api.workspaces.list().catch(async (e: unknown): Promise<any[]> => {
        console.error("[toggl] workspaces.list failed", e);
        const ok = await this._fallbackDirectPing();
        if (!ok) handleError(e as any);
        return [];
      }),
    );

    return response.map(
      (w: any) =>
        ({
          id: (w.id as number).toString(),
          name: w.name,
        } as TogglWorkspace),
    );
  }

  /** @returns list of the user's clients. */
  public async getClients(): Promise<ClientsResponseItem[]> {
    const clients = (await this._exec(() => this._api.workspaces.clients(this._settings.workspace.id)).catch((e: unknown) => {
        console.error("[toggl] clients() failed", e);
        handleError(e as any);
      })) as ClientsResponseItem[];

    return clients;
  }

  /**
   * @returns list of the user's projects for the configured Toggl workspace.
   * NOTE: this makes an async call to the Toggl API. To get cached projects,
   * use the computed property cachedProjects instead.
   */
  public async getProjects(): Promise<ProjectsResponseItem[]> {
    const projects = (await this._exec(() => this._api.workspaces.projects(this._settings.workspace.id)).catch((e: unknown) => {
        console.error("[toggl] projects() failed", e);
        handleError(e as any);
      })) as ProjectsResponseItem[];

    // Return all projects (including archived ones) to ensure time entries
    // logged to archived projects can still be enriched with project info.
    return projects ?? [];
  }

  /**
   * @returns list of the user's tags for the configured Toggl workspace.
   * NOTE: this makes an async call to the Toggl API. To get cached tags,
   * use the computed property cachedTags instead.
   */
  public async getTags(): Promise<TagsResponseItem[]> {
    const tags = (await this._exec(() => this._api.workspaces.tags(this._settings.workspace.id)).catch((e: unknown) => {
        console.error("[toggl] tags() failed", e);
        handleError(e as any);
      })) as TagsResponseItem[];

    return tags;
  }

  /**
   * @returns list of recent time entries for the user's workspace.
   */
  public async getRecentTimeEntries(): Promise<
    SearchTimeEntriesResponseItem[]
  > {
    const response: SearchTimeEntriesResponseItem[] = await this._exec(() =>
      this._api.reports
        .details(this._settings.workspace.id, {
          end_date: moment().format("YYYY-MM-DD"),
          order_by: "date",
          order_dir: "desc",
          start_date: moment().subtract(9, "day").format("YYYY-MM-DD"),
        })
        .catch(handleError),
    );

    return response.filter(
      (item) =>
        Array.isArray(item.time_entries) && item.time_entries.length > 0,
    );
  }

  /**
   * Fetches a report for the current day according to the Toggl Track Report API.
   * @returns a {@link Report} object containing the report data as defined by
   * the track report API
   * (see https://github.com/toggl/toggl_api_docs/blob/master/reports.md).
   *
   * NOTE: this method is used to fetch the latest summary at key events. To
   *       access the latest report, subscribe to the store {@link dailyReport}
   */
  public async getDailySummary(): Promise<ProjectsSummaryResponseItem[]> {
    const response: ProjectsSummaryResponseItem[] = await this._exec(() =>
      this._api.reports
        .projectsSummary(this._settings.workspace.id, {
          start_date: moment().format("YYYY-MM-DD"),
        })
        .catch(handleError),
    );

    return response;
  }

  /**
   * Gets a Toggl Summary Report between start_date and end_date date.
   * @param start_date ISO-formatted date string of the first day of the summary range (inclusive).
   * @param end_date ISO-formatted date string of the last day of the summary range (inclusive).
   * @returns The report.
   */
  public async getSummary(options: ReportOptions) {
    const response = (await this._exec(() =>
      this._api.reports
        .summary(this._settings.workspace.id, {
          ...options,
          collapse: true,
          grouping: "projects",
          sub_grouping: "time_entries",
          // order_field: 'duration',
          // order_desc: 'on'
        })
        .catch(handleError),
    )) as SummaryReportResponse;

    return response;
  }

  public async getSummaryTimeChart(options: ReportOptions) {
    const response = (await this._exec(() =>
      this._api.reports
        .totals(this._settings.workspace.id, {
          ...options,
          collapse: true,
          grouping: "projects",
          with_graph: true,
        })
        .catch(handleError),
    )) as SummaryTimeChart;

    return response;
  }

  /**
   * Gets a Toggl Detailed Report between start_date and end_date date.
   * Makes multiple HTTP requests until all pages of the paginated result are
   * gathered, then returns the combined report as a single object.
   * @param start_date ISO-formatted date string of the first day of the summary range (inclusive).
   * @param end_date ISO-formatted date string of the last day of the summary range (inclusive).
   * @returns The time entries on the specified page.
   */
  public async getDetailedReport(
    options: ReportOptions,
  ): Promise<DetailedReportResponseItem[]> {
    const response = await this._queue.queue<DetailedReportResponseItem[]>(() =>
      this._exec(() =>
        this._api.reports.detailsAll(this._settings.workspace.id, {
          ...options,
          grouped: true, // grouping means less pages, so less requests and faster results.
        }),
      ),
    );
    return response;
  }

  /**
   * Starts a new timer on Toggl Track with the given
   * description and project.
   * @param entry the description and project to start a timer on.
   */
  public async startTimer(entry: TimeEntryStart): Promise<TimeEntry> {
    return this._exec(() =>
      this._api.timeEntries
        .start({
          ...entry,
          created_with: "Toggl Track for Obsidian",
          duration: -moment().unix(),
          start: moment().format(),
          stop: null,
          workspace_id: parseInt(this._settings.workspace.id),
        })
        .catch(handleError),
    );
  }

  /**
   * Stops the currently running timer.
   */
  public async stopTimer(entry: TimeEntry): Promise<TimeEntry> {
    return this._exec(() => this._api.timeEntries.stop(entry).catch(handleError));
  }

  /**
   * Returns the currently running timer, if any.
   */
  public async getCurrentTimer(): Promise<TimeEntry> {
    return this._exec(() => this._api.timeEntries.current());
  }

  /**
   * Internal wrapper applying rate limiting & 402 parsing.
   */
  private async _exec<T>(fn: () => Promise<T>): Promise<T> {
    if (!this._settings?.rateLimitEnabled) return fn();
    if (!this._rateLimiter.tryConsume()) {
      const remainingMs = this._rateLimiter.tempResetAt ? this._rateLimiter.tempResetAt - Date.now() : 0;
      const minutes = Math.ceil(remainingMs / 60000);
      new Notice(
        `Toggl hourly quota exceeded. Remaining window resets in ${minutes > 0 ? minutes + 'm' : 'under a minute'}.`,
      );
      throw new Error("Rate limit exceeded (local limiter)");
    }
    try {
      return await fn();
    } catch (err: any) {
      // Parse 402 style message
      if (err && typeof err.message === "string" && /rate limit/i.test(err.message)) {
        const match = err.message.match(/(\d+)\s*seconds?/i);
        if (match) {
          const seconds = parseInt(match[1], 10);
          this._rateLimiter.applyTemporarySuspension(seconds);
          new Notice(`Toggl API rate limit hit. Pausing requests for ${seconds}s.`);
        }
      }
      throw err;
    }
  }
}

const handleError = (error: unknown) => {
  console.error("Toggl API error: ", error);
  new Notice("Error communicating with Toggl API: " + error);
};
