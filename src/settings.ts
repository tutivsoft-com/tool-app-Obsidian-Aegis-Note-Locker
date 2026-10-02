import { renderNativePacks } from "./native-operations";
import { App, Notice, PluginSettingTab, Setting, type TextComponent } from "obsidian";
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
    const advanced = this.plugin.settings.settingsMode === "advanced";
    new Setting(containerEl).setName("Settings mode").setDesc("Simple shows everyday controls. Advanced includes detailed behavior and troubleshooting.").addDropdown((dropdown) => dropdown.addOption("simple", "Simple").addOption("advanced", "Advanced").setValue(this.plugin.settings.settingsMode).onChange(async (value) => { this.plugin.settings.settingsMode = value === "advanced" ? "advanced" : "simple"; await this.plugin.saveSettings(); this.display(); }));
    let sessionPassword = "";
    let passwordInput: TextComponent | undefined;
    new Setting(containerEl).setName("Session password").setDesc("Set this once per Obsidian session so Lock, Unlock, and Backup run without password pop-ups. The password stays in memory only and is never saved to plugin data.").addText((text) => { passwordInput = text; text.setPlaceholder("Session password"); text.inputEl.type = "password"; text.onChange((value) => sessionPassword = value); }).addButton((button) => button.setButtonText("Set for session").setCta().onClick(() => { if (!sessionPassword) { new Notice("Enter a password to set it for this session."); passwordInput?.inputEl.focus(); return; } this.plugin.setSessionPassword(sessionPassword); sessionPassword = ""; passwordInput?.setValue(""); new Notice("Aegis session password set."); }));
    new Setting(containerEl).setName("Review before applying").setDesc("Off by default for one-click actions. Turn on to see a review/confirmation window before changes.").addToggle((toggle) => toggle.setValue(this.plugin.settings.reviewBeforeApply).onChange(async (value) => { this.plugin.settings.reviewBeforeApply = value; await this.plugin.saveSettings(); }));
    if (advanced) {
    new Setting(containerEl).setName("Protected properties").setDesc("Comma or newline separated frontmatter property names to protect. Leave empty to protect every eligible property.").addTextArea((text) => text.setValue(this.plugin.settings.protectedProperties).onChange(async (value) => { this.plugin.settings.protectedProperties = value; await this.plugin.saveSettings(); }));
    }
    containerEl.createEl("p", { text: "All encryption is local. Optional billing uses an account session and install ID; passwords and protected content never leave the vault." });
    new Setting(containerEl).setName("Billing").setHeading();
    const balanceEl = containerEl.createEl("p", { cls: "aegis-billing-summary" });
    const renderBalance = (): void => {
      const pending = this.plugin.settings.pendingProtectionCharges?.length ?? 0;
      balanceEl.setText(`Protection uses remaining: ${remainingFreeUses(this.plugin.settings)} lifetime free remaining (server authoritative) + ${this.plugin.settings.purchasedUses.toLocaleString()} purchased${pending ? ` (${pending} charge pending)` : ""}`);
    };
    renderBalance();
    addBillingAccountSettings(containerEl, { state: this.plugin.settings, appId: "aegis-note-locker", installationId: this.plugin.settings.constanceDeviceId, appVersion: this.plugin.manifest.version, persist: () => this.plugin.saveSettings(), syncBalance: () => syncBalance(this.plugin), refresh: () => this.display() });
    new Setting(containerEl).setName("Retry preserved protection").setDesc("Use the exact encrypted preview kept in this session. Sign-in does not rerun encryption. Source changes block overwrite.").addButton(b=>b.setButtonText("Retry").onClick(()=>void this.plugin.retryProtectionPreview()));
    void renderNativePacks(containerEl,{app:this.app,settings:this.plugin.settings,persistNative:()=>this.plugin.saveSettings()},"aegis-note-locker",async plan=>{const {openAccountCheckoutByPrice}=await import("./billing-checkout");await openAccountCheckoutByPrice({state:this.plugin.settings,appId:"aegis-note-locker",installationId:this.plugin.settings.constanceDeviceId,persist:()=>this.plugin.saveSettings(),syncBalance:()=>syncBalance(this.plugin),refreshSession:async()=>{const a=await import("./constance-account");return a.refreshBillingSession(this.plugin.settings,()=>this.plugin.saveSettings());}},plan);});
    new Setting(containerEl)
      .setName("Refresh purchased balance")
      .setDesc("Sync the purchased-use balance from Constance. Unlock, export, rollback, and viewing remain free.")
      .addButton((button) => button.setButtonText("Refresh").onClick(async () => {
        button.setDisabled(true);
        try {
          await syncBalance(this.plugin, true);
          await retryPendingProtectionCharges(this.plugin);
          renderBalance();
        } catch {
          new Notice("Aegis: balance could not be refreshed. Check your connection and account, then retry.");
        } finally {
          button.setDisabled(false);
        }
      }));
    void syncBalance(this.plugin).then(() => retryPendingProtectionCharges(this.plugin)).then(renderBalance).catch(() => { balanceEl.setText("Balance unavailable. Use Refresh to retry; your saved balance is retained."); });
    new Setting(containerEl)
      .setName("Session timeout")
      .setDesc("Minutes of inactivity before the password is cleared. Default: 15 minutes; enter it again to unlock later.")
      .addDropdown((dropdown) => dropdown.addOption("5", "5 minutes — shorter sessions").addOption("15", "15 minutes — recommended").addOption("30", "30 minutes").addOption("60", "60 minutes").addOptions([5, 15, 30, 60].includes(this.plugin.settings.sessionTimeoutMinutes) ? {} : { [String(this.plugin.settings.sessionTimeoutMinutes)]: `${this.plugin.settings.sessionTimeoutMinutes} minutes — current` }).setValue(String(this.plugin.settings.sessionTimeoutMinutes)).onChange(async (value) => {
        this.plugin.settings.sessionTimeoutMinutes = Number(value);
        await this.plugin.saveSettings();
      }));
    if (advanced) {
    this.plugin.support.addDiagnosticsSetting(containerEl);
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
}
