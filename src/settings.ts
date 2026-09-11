import { App, PluginSettingTab, Setting } from "obsidian";
import type AegisNoteLockerPlugin from "./main";
export { DEFAULT_SETTINGS } from "./types";

export class AegisSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: AegisNoteLockerPlugin) { super(app, plugin); }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Aegis Note Locker" });
    containerEl.createEl("p", { text: "All encryption is local. Aegis never sends passwords or protected content to a server." });
    new Setting(containerEl)
      .setName("Session timeout")
      .setDesc("Minutes of inactivity before the in-memory unlock password is cleared.")
      .addSlider((slider) => slider.setLimits(1, 120, 1).setValue(this.plugin.settings.sessionTimeoutMinutes).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.sessionTimeoutMinutes = value;
        await this.plugin.saveSettings();
      }));
    new Setting(containerEl)
      .setName("Encrypted backup folder")
      .setDesc("Vault-relative folder used for user-requested encrypted exports.")
      .addText((text) => text.setPlaceholder(".aegis-backups").setValue(this.plugin.settings.backupFolder).onChange(async (value) => {
        this.plugin.settings.backupFolder = value.trim() || ".aegis-backups";
        await this.plugin.saveSettings();
      }));
    new Setting(containerEl)
      .setName("Show status bar")
      .setDesc("Show the current note's locked or unlocked state in the status bar.")
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.showStatusBar).onChange(async (value) => {
        this.plugin.settings.showStatusBar = value;
        await this.plugin.saveSettings();
        this.plugin.updateStatusBar();
      }));
    containerEl.createEl("h3", { text: "Recovery" });
    containerEl.createEl("p", { text: "Use Export encrypted backup before migrations or sync changes. Rollback is available for the last operation while this plugin session still holds its volatile undo record." });
  }
}
