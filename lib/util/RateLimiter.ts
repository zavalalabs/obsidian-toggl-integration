import { settingsStore } from "lib/util/stores";
import type { PluginSettings } from "lib/config/PluginSettings";

/**
 * Simple hourly sliding-window rate limiter based on Toggl Track plan tiers.
 * Persisted counters live inside PluginSettings so UI can surface remaining quota.
 */
export class RateLimiter {
  private _settings: PluginSettings;
  private _unsubscribe: () => void;

  // Hourly caps per plan (public Track documentation; subject to change).
  private static PLAN_CAPS: Record<string, number> = {
    free: 30,
    starter: 240,
    premium: 600,
  };

  // Optional temporary suspension until reset time (epoch ms) after 402 error.
  private _tempResetAt: number | null = null;

  constructor() {
  this._unsubscribe = settingsStore.subscribe((val: PluginSettings) => (this._settings = val));
  }

  public dispose() {
    if (this._unsubscribe) this._unsubscribe();
  }

  private _effectiveCap(): number {
    const override = this._settings?.planOverride;
    if (override && RateLimiter.PLAN_CAPS[override]) return RateLimiter.PLAN_CAPS[override];
    // Fallback to stored hourlyCap or default (free)
    return this._settings?.hourlyCap || RateLimiter.PLAN_CAPS.free;
  }

  private _resetWindowIfExpired() {
    if (!this._settings) return;
    const now = Date.now();
    const start = this._settings.hourWindowStart || now;
    if (now - start >= 60 * 60 * 1000) {
  settingsStore.update((s: PluginSettings) => ({ ...s, hourWindowStart: now, usedThisHour: 0 }));
      this._tempResetAt = null; // clear suspension
    }
  }

  /** Remaining requests in current hour window. */
  public remaining(): number {
    this._resetWindowIfExpired();
    const cap = this._effectiveCap();
    return Math.max(0, cap - (this._settings?.usedThisHour || 0));
  }

  /** Returns true if over hourly cap or temporarily suspended after 402. */
  public isBlocked(): boolean {
    this._resetWindowIfExpired();
    const cap = this._effectiveCap();
    if (this._tempResetAt && Date.now() < this._tempResetAt) return true;
    return (this._settings?.usedThisHour || 0) >= cap;
  }

  /** Consume n requests; returns false if would exceed cap. */
  public tryConsume(n = 1): boolean {
    if (!this._settings?.rateLimitEnabled) return true; // bypass
    this._resetWindowIfExpired();
    if (this.isBlocked()) return false;
  settingsStore.update((s: PluginSettings) => ({ ...s, usedThisHour: (s.usedThisHour || 0) + n, hourlyCap: this._effectiveCap() }));
    return true;
  }

  /** Mark a 402 response with "Try again in X seconds" suspension. */
  public applyTemporarySuspension(seconds: number) {
    const until = Date.now() + seconds * 1000;
    this._tempResetAt = until;
  }

  /** Epoch ms timestamp until suspension ends, or null. */
  public get tempResetAt(): number | null {
    return this._tempResetAt;
  }
}

export default RateLimiter;