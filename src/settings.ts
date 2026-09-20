import { App, PluginSettingTab, Setting } from "obsidian";
import type AegisNoteLockerPlugin from "./main";
import { openCheckout, retryPendingProtectionCharges, syncBalance } from "./billing";
import { remainingFreeUses } from "./usage";
import { addBillingAccountSettings } from "./constance-account";
export { DEFAULT_SETTINGS } from "./types";

export class AegisSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: AegisNoteLockerPlugin) { super(app, plugin); }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Aegis Note Locker" });
    containerEl.createEl("p", { text: "All encryption is local. Optional billing sync sends only an install ID and billing email; passwords and protected content never leave the vault." });
    new Setting(containerEl).setName("Billing").setHeading();
    const balanceEl = containerEl.createEl("p", { cls: "aegis-billing-summary" });
    const renderBalance = (): void => {
      const pending = this.plugin.settings.pendingProtectionCharges?.length ?? 0;
      balanceEl.setText(`Protection uses remaining: ${remainingFreeUses(this.plugin.settings)} free today + ${this.plugin.settings.purchasedUses.toLocaleString()} purchased${pending ? ` (${pending} charge pending)` : ""}`);
    };
    renderBalance();
    addBillingAccountSettings(containerEl, { state: this.plugin.settings, appId: "aegis-note-locker", installationId: this.plugin.settings.constanceDeviceId, appVersion: this.plugin.manifest.version, persist: () => this.plugin.saveSettings(), syncBalance: () => syncBalance(this.plugin), refresh: () => this.display() });
    new Setting(containerEl)
      .setName("Buy protection uses")
      .setDesc("One protection use covers one successful note-body or frontmatter-protection operation. Unlock, backup, rollback, and viewing are free.")
      .addButton((button) => button.setButtonText("Buy $1 (100 uses)").onClick(() => openCheckout(this.plugin, "usd_001")))
      .addButton((button) => button.setButtonText("Buy $10 (1,000 uses)").setCta().onClick(() => openCheckout(this.plugin, "usd_010")));
    new Setting(containerEl)
      .setName("Refresh purchased balance")
      .setDesc("Sync the purchased-use balance from Constance. Unlock, export, rollback, and viewing remain free.")
      .addButton((button) => button.setButtonText("Refresh").onClick(async () => {
        button.setDisabled(true);
        try {
          await syncBalance(this.plugin);
          await retryPendingProtectionCharges(this.plugin);
          renderBalance();
        } finally {
          button.setDisabled(false);
        }
      }));
    void syncBalance(this.plugin).then(() => retryPendingProtectionCharges(this.plugin)).then(renderBalance);
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
