import { DEFAULT_SETTINGS } from "lib/config/DefaultSettings";
import type MyPlugin from "main";
import {
  App,
  ButtonComponent,
  DropdownComponent,
  ExtraButtonComponent,
  PluginSettingTab,
  Setting,
  TextComponent,
  ToggleComponent,
} from "obsidian";

import type { TogglWorkspace } from "../model/TogglWorkspace";

export default class TogglSettingsTab extends PluginSettingTab {
  private plugin: MyPlugin;
  private workspaceDropdown: DropdownComponent;
  private workspaces: TogglWorkspace[];

  constructor(app: App, plugin: MyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();
    containerEl.createEl("h2", {
      text: "Toggl Track integration for Obsidian",
    });

    this.addApiTokenSetting(containerEl);
    this.addTestConnectionSetting(containerEl);
    this.addWorkspaceSetting(containerEl);
    this.addUpdateRealTimeSetting(containerEl);

    containerEl.createEl("h2", {
      text: "Status bar display options",
    });
    this.addCharLimitStatusBarSetting(containerEl);
    this.addStatusBarFormatSetting(containerEl);
    this.addStatusBarPrefixSetting(containerEl);
    this.addStatusBarProjectSetting(containerEl);
    this.addStatusBarNoEntrySetting(containerEl);

    containerEl.createEl("h2", { text: "Rate limiting" });
    this.addRateLimitSettings(containerEl);
  }

  private addApiTokenSetting(containerEl: HTMLElement) {
    new Setting(containerEl)
      .setName("API Token")
      .setDesc(
        "Enter your Toggl Track API token to use this plugin. " +
          "You can find yours at the bottom of https://track.toggl.com/profile.",
      )
  .addText((text: TextComponent) =>
        text
          .setPlaceholder("Your API token")
          .setValue(this.plugin.settings.apiToken || "")
          .onChange(async (value: string) => {
            console.log("[toggl] API token changed, reconnecting...");
            this.plugin.settings.apiToken = value;
            await this.plugin.saveSettings();
            // Force reconnection with new token
            await this.plugin.toggl.refreshApiConnection(value);
          }),
      );
  }

  private addRateLimitSettings(containerEl: HTMLElement) {
    // Enable/disable
    new Setting(containerEl)
      .setName("Enable local rate limiter")
      .setDesc(
        "Track hourly Toggl API usage to avoid hitting remote quota. Prevents new requests once cap reached until window resets.",
      )
  .addToggle((toggle: ToggleComponent) => {
        toggle
          .setValue(this.plugin.settings.rateLimitEnabled ?? true)
          .onChange(async (value: boolean) => {
            this.plugin.settings.rateLimitEnabled = value;
            await this.plugin.saveSettings();
          });
      });

    // Plan selection
    new Setting(containerEl)
      .setName("Account plan override")
      .setDesc(
        "Select your Toggl Track plan to set an appropriate hourly cap. Leave on 'Auto/Default' to use stored cap (defaults to Free).",
      )
  .addDropdown((dd: DropdownComponent) => {
        dd.addOption("", "Auto / Default");
        dd.addOption("free", "Free (30/hr)");
        dd.addOption("starter", "Starter (240/hr)");
        dd.addOption("premium", "Premium (600/hr)");
        dd.setValue(this.plugin.settings.planOverride ?? "");
  dd.onChange(async (val: string) => {
          this.plugin.settings.planOverride = val === "" ? null : (val as any);
          // update hourlyCap immediately based on selection
          const caps: Record<string, number> = { free: 30, starter: 240, premium: 600 };
          if (this.plugin.settings.planOverride && caps[this.plugin.settings.planOverride]) {
            this.plugin.settings.hourlyCap = caps[this.plugin.settings.planOverride];
          } else if (!this.plugin.settings.hourlyCap) {
            this.plugin.settings.hourlyCap = 30; // fallback
          }
          await this.plugin.saveSettings();
          this.refreshRateLimitStats(containerEl);
        });
      });

    // Stats line (will be refreshed)
    this.refreshRateLimitStats(containerEl);
  }

  private refreshRateLimitStats(containerEl: HTMLElement) {
    // Remove any existing stats element
    const existing = containerEl.querySelector('.toggl-rate-limit-stats');
    if (existing) existing.remove();
    const cap = this.plugin.settings.hourlyCap || 30;
    const used = this.plugin.settings.usedThisHour || 0;
    const remaining = Math.max(0, cap - used);
    const start = this.plugin.settings.hourWindowStart || Date.now();
    const msElapsed = Date.now() - start;
    const msLeft = Math.max(0, 60*60*1000 - msElapsed);
    const minsLeft = Math.ceil(msLeft / 60000);
  const statsEl = (containerEl as any).createEl('div', { cls: 'toggl-rate-limit-stats' });
  (statsEl as any).createEl('div', { text: `Usage this hour: ${used}/${cap} (remaining ${remaining}) - resets in ~${minsLeft}m` });
  }

  private addTestConnectionSetting(containerEl: HTMLElement) {
    new Setting(containerEl)
      .setName("Test API connection")
      .setDesc("Test your API token by connecting to Toggl Track.")
      .addButton((button: ButtonComponent) => {
        button.setButtonText("connect");
        button.onClick(() => this.testConnection(button));
        button.setCta();
      });
  }

  private addWorkspaceSetting(containerEl: HTMLElement) {
    new Setting(containerEl)
      .setName("Toggl Workspace")
      .setDesc("Select your Toggl Workspace for fetching past timer entries.")
      .addExtraButton((button: ExtraButtonComponent) => {
        button.setIcon("reset").setTooltip("Fetch Workspaces");
        button.extraSettingsEl.addClass("extra-button");
        button.onClick(async () => {
          await this.fetchWorkspaces();
        });
      })
      .addDropdown(async (dropdown: DropdownComponent) => {
        // Register callback for saving new value
        dropdown.onChange(async (value: string) => {
          const workspace = this.workspaces.find((w) => w.id === value);
          this.plugin.settings.workspace = workspace;
          await this.plugin.saveSettings();
        });
        this.workspaceDropdown = dropdown;
        await this.fetchWorkspaces();
      });
  }

  private addUpdateRealTimeSetting(containerEl: HTMLElement) {
    new Setting(containerEl)
      .setName("Real time daily total")
      .setDesc(
        "Update the daily total time in the sidebar " +
          "every second when a timer is running.",
      )
  .addToggle((toggle: ToggleComponent) => {
        toggle
          .setValue(this.plugin.settings.updateInRealTime || false)
          .onChange(async (value: boolean) => {
            this.plugin.settings.updateInRealTime = value;
            await this.plugin.saveSettings();
          });
      });
  }

  private addCharLimitStatusBarSetting(containerEl: HTMLElement) {
    new Setting(containerEl)
      .setName("Status bar character limit")
      .setDesc(
        "Set a character limit for the time entry " + 
        "displayed in the status bar."
      )
  .addText((text: TextComponent) => {
        text.setPlaceholder(String(DEFAULT_SETTINGS.charLimitStatusBar))
        text.inputEl.type = "number"
        text.setValue(String(this.plugin.settings.charLimitStatusBar))
  text.onChange(async (value: string) => {
          this.plugin.settings.charLimitStatusBar = (
            value !== "" ? Number(value) : DEFAULT_SETTINGS.charLimitStatusBar
          );
          await this.plugin.saveSettings();
        });
    });
  }

  private addStatusBarFormatSetting(containerEl: HTMLElement) {
    new Setting(containerEl)
      .setName("Status bar time format")
      .setDesc(
        "Time format for the status bar. " +
          "See https://github.com/jsmreese/moment-duration-format for format options.",
      )
  .addText((text: TextComponent) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.statusBarFormat)
          .setValue(this.plugin.settings.statusBarFormat || "")
          .onChange(async (value: string) => {
            this.plugin.settings.statusBarFormat = value;
            await this.plugin.saveSettings();
          }),
      );
  }

  private addStatusBarPrefixSetting(containerEl: HTMLElement) {
    new Setting(containerEl)
      .setName("Status bar prefix")
      .setDesc(
        "Prefix before the time entry in the status bar. " +
          "Leave blank for no prefix.",
      )
  .addText((text: TextComponent) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.statusBarPrefix)
          .setValue(this.plugin.settings.statusBarPrefix || "")
          .onChange(async (value: string) => {
            this.plugin.settings.statusBarPrefix = value;
            await this.plugin.saveSettings();
          }),
      );
  }

  private addStatusBarProjectSetting(containerEl: HTMLElement) {
    new Setting(containerEl)
      .setName("Show project in status bar")
      .setDesc(
        "Show the project of the time entry displayed in the status bar."
      )
  .addToggle((toggle: ToggleComponent) => {
        toggle
          .setValue(this.plugin.settings.statusBarShowProject || false)
          .onChange(async (value: boolean) => {
            this.plugin.settings.statusBarShowProject = value;
            await this.plugin.saveSettings();
          });
      });
  }

  private addStatusBarNoEntrySetting(containerEl: HTMLElement) {
    new Setting(containerEl)
      .setName("No entry status bar message")
      .setDesc(
        "Message in the status bar when no time entry is running."
      )
  .addText((text: TextComponent) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.statusBarNoEntryMesssage)
          .setValue(this.plugin.settings.statusBarNoEntryMesssage || "")
          .onChange(async (value: string) => {
            this.plugin.settings.statusBarNoEntryMesssage = value;
            await this.plugin.saveSettings();
          }),
      );
  }

  private async fetchWorkspaces() {
    // empty the dropdown's list
    const selectEl = this.workspaceDropdown.selectEl;
    for (let i = selectEl.length - 1; i >= 0; i--) {
      this.workspaceDropdown.selectEl.remove(i);
    }

    // add the current setting to populate the field
    const currentWorkspace = this.plugin.settings.workspace;
    this.workspaceDropdown.addOption(
      currentWorkspace.id,
      currentWorkspace.name,
    );
    this.workspaceDropdown.setValue(currentWorkspace.id);

    // fetch the other workspaces from the Toggl API
    if (this.plugin.toggl.isApiAvailable) {
      this.workspaces = await this.plugin.toggl.getWorkspaces();
      this.workspaces = this.workspaces.filter(
        (w) => w.id != currentWorkspace.id,
      );
      for (const w of this.workspaces) {
        this.workspaceDropdown.addOption(w.id, w.name);
      }
    }
  }

  private async testConnection(button: ButtonComponent) {
    button.setDisabled(true);
    try {
      await this.plugin.toggl.testConnection();
      button.setButtonText("success!");
    } catch {
      button.setButtonText("test failed");
    } finally {
      button.setDisabled(false);
      window.setTimeout(() => {
        button.setButtonText("connect");
      }, 2500);
    }
  }
}
