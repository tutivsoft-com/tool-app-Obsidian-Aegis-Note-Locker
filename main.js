"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// publish/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => AegisNoteLockerPlugin
});
module.exports = __toCommonJS(main_exports);

// publish/src/main.ts
var import_obsidian7 = require("obsidian");

// publish/src/crypto.ts
var AEGIS_FORMAT_VERSION = 1;
var DEFAULT_PBKDF2_ITERATIONS = 31e4;
function cryptoApi() {
  var _a;
  if (!((_a = globalThis.crypto) == null ? void 0 : _a.subtle)) throw new Error("Web Crypto is unavailable in this runtime.");
  return globalThis.crypto;
}
function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function randomBytes(length) {
  const result = new Uint8Array(length);
  cryptoApi().getRandomValues(result);
  return result;
}
function source(bytes) {
  return bytes;
}
async function deriveKey(password, salt, iterations) {
  const material = await cryptoApi().subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return cryptoApi().subtle.deriveKey(
    { name: "PBKDF2", salt: source(salt), iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
function validateEnvelope(value) {
  if (!value || typeof value !== "object") throw new Error("Invalid Aegis envelope.");
  const envelope = value;
  if (envelope.v !== AEGIS_FORMAT_VERSION || envelope.alg !== "AES-256-GCM" || envelope.kdf !== "PBKDF2-HMAC-SHA256" || typeof envelope.iterations !== "number" || envelope.iterations < 1e5 || typeof envelope.salt !== "string" || typeof envelope.iv !== "string" || typeof envelope.ciphertext !== "string" || typeof envelope.tag !== "string") {
    throw new Error("Unsupported or malformed Aegis envelope.");
  }
}
async function encryptText(plaintext, password, iterations = DEFAULT_PBKDF2_ITERATIONS) {
  if (!password) throw new Error("A password is required.");
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(password, salt, iterations);
  const encrypted = await cryptoApi().subtle.encrypt(
    { name: "AES-GCM", iv: source(iv) },
    key,
    new TextEncoder().encode(plaintext)
  );
  const encryptedBytes = new Uint8Array(encrypted);
  const tagLength = 16;
  return {
    v: AEGIS_FORMAT_VERSION,
    alg: "AES-256-GCM",
    kdf: "PBKDF2-HMAC-SHA256",
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(encryptedBytes.slice(0, -tagLength)),
    tag: bytesToBase64(encryptedBytes.slice(-tagLength))
  };
}
async function decryptText(envelope, password) {
  validateEnvelope(envelope);
  if (!password) throw new Error("A password is required.");
  const key = await deriveKey(password, base64ToBytes(envelope.salt), envelope.iterations);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  const tag = base64ToBytes(envelope.tag);
  const ciphertextAndTag = new Uint8Array(ciphertext.length + tag.length);
  ciphertextAndTag.set(ciphertext);
  ciphertextAndTag.set(tag, ciphertext.length);
  const plaintext = await cryptoApi().subtle.decrypt(
    { name: "AES-GCM", iv: source(base64ToBytes(envelope.iv)) },
    key,
    source(ciphertextAndTag)
  );
  return new TextDecoder().decode(plaintext);
}
async function sha256Hex(value) {
  const digest = await cryptoApi().subtle.digest("SHA-256", source(new TextEncoder().encode(value)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// publish/src/frontmatter.ts
var import_obsidian = require("obsidian");
var AEGIS_KEY = "aegis";
function parseMarkdown(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter: {}, body: content, hasFrontmatter: false };
  const parsed = (0, import_obsidian.parseYaml)(match[1]);
  return {
    frontmatter: parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {},
    body: content.slice(match[0].length),
    hasFrontmatter: true
  };
}
function serializeMarkdown(frontmatter, body) {
  if (Object.keys(frontmatter).length === 0) return body;
  const yaml = (0, import_obsidian.stringifyYaml)(frontmatter).trimEnd();
  return `---
${yaml}
---
${body}`;
}
function topLevelPropertyNames(frontmatter) {
  return Object.keys(frontmatter).filter((key) => key !== AEGIS_KEY && !key.startsWith("aegis-"));
}

// publish/src/settings.ts
var import_obsidian4 = require("obsidian");

// publish/src/billing.ts
var import_obsidian3 = require("obsidian");

// publish/src/usage.ts
var DAILY_FREE_USES = 3;
function localDayKey(date = /* @__PURE__ */ new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function resetDailyUsageIfNeeded(state, date = /* @__PURE__ */ new Date()) {
  const day = localDayKey(date);
  return state.freeUsesDay === day ? state : { freeUsesDay: day, freeUsesUsed: 0 };
}
function consumeFreeUse(state) {
  if (state.freeUsesUsed >= DAILY_FREE_USES) return null;
  return { ...state, freeUsesUsed: state.freeUsesUsed + 1 };
}
function remainingFreeUses(state, date = /* @__PURE__ */ new Date()) {
  const normalized = resetDailyUsageIfNeeded(state, date);
  return Math.max(0, DAILY_FREE_USES - normalized.freeUsesUsed);
}

// publish/src/constance-account.ts
var import_obsidian2 = require("obsidian");
var CONSTANCE_ACCOUNT_BASE_URL = "https://app.tutivsoft.com";
function errorDetail(response, fallback) {
  var _a, _b;
  return String(((_a = response.json) == null ? void 0 : _a.detail) || ((_b = response.json) == null ? void 0 : _b.message) || response.text || fallback);
}
async function authenticate(mode, email, password, installationId) {
  var _a;
  const body = mode === "register" ? { email, password, external_customer_id: installationId } : { email, password };
  const response = await (0, import_obsidian2.requestUrl)({
    url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/auth/${mode}`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    throw: false
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(errorDetail(response, `Billing ${mode} failed (HTTP ${response.status})`));
  }
  const token = String(((_a = response.json) == null ? void 0 : _a.access_token) || "");
  if (!token) throw new Error("Constance did not return an account token.");
  return token;
}
async function linkInstallation(adapter, token) {
  const response = await (0, import_obsidian2.requestUrl)({
    url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/billing/installations/link`,
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      app_id: adapter.appId,
      installation_id: adapter.installationId,
      legacy_external_customer_id: adapter.installationId,
      platform: "obsidian",
      app_version: adapter.appVersion || void 0
    }),
    throw: false
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(errorDetail(response, `Installation link failed (HTTP ${response.status})`));
  }
}
async function signInBillingAccount(adapter, password, mode) {
  const email = adapter.state.billingEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Enter a valid billing email.");
  if (password.length < 8) throw new Error("Password must contain at least 8 characters.");
  if (!adapter.installationId) throw new Error("The plugin installation ID is not ready.");
  const token = await authenticate(mode, email, password, adapter.installationId);
  await linkInstallation(adapter, token);
  adapter.state.billingEmail = email;
  adapter.state.billingAccessToken = token;
  adapter.state.billingAccountLinked = true;
  await adapter.persist();
  await adapter.syncBalance();
}
async function claimAccountFreeUsage(state, appId, installationId, eventId, amount) {
  var _a, _b;
  if (!state.billingAccessToken || !state.billingAccountLinked) return { kind: "auth-required" };
  try {
    const response = await (0, import_obsidian2.requestUrl)({
      url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/billing/free-usage/claim`,
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.billingAccessToken}` },
      body: JSON.stringify({ app_id: appId, installation_id: installationId, event_id: eventId, amount }),
      throw: false
    });
    if (response.status === 402) return { kind: "insufficient" };
    if (response.status === 401 || response.status === 403 || response.status === 404) return { kind: "auth-required" };
    if (response.status < 200 || response.status >= 300) return { kind: "error" };
    return { kind: "ok", remaining: Math.max(0, Number((_b = (_a = response.json) == null ? void 0 : _a.data) == null ? void 0 : _b.remaining) || 0) };
  } catch (error) {
    console.error("Constance account free-usage claim failed", error);
    return { kind: "error" };
  }
}
function addBillingAccountSettings(containerEl, adapter) {
  let password = "";
  new import_obsidian2.Setting(containerEl).setName("Billing account email").setDesc("Used for sign-in, purchase restore, and checkout. Reinstalling no longer creates a new free allowance.").addText((text) => text.setPlaceholder("you@example.com").setValue(adapter.state.billingEmail).onChange(async (value) => {
    adapter.state.billingEmail = value.trim();
    await adapter.persist();
  }));
  new import_obsidian2.Setting(containerEl).setName("Billing account password").setDesc("Used only for this sign-in request. The password is never saved by the plugin.").addText((text) => {
    text.inputEl.type = "password";
    text.setPlaceholder("At least 8 characters").onChange((value) => {
      password = value;
    });
  });
  const status = adapter.state.billingAccountLinked ? "Signed in and linked" : "Not signed in";
  new import_obsidian2.Setting(containerEl).setName("Billing account").setDesc(`${status}. The saved bearer session can restore purchases; your password is not stored.`).addButton((button) => button.setButtonText("Sign in").onClick(async () => {
    var _a;
    button.setDisabled(true);
    try {
      await signInBillingAccount(adapter, password, "login");
      new import_obsidian2.Notice("Billing account signed in and this installation was linked.");
      (_a = adapter.refresh) == null ? void 0 : _a.call(adapter);
    } catch (error) {
      new import_obsidian2.Notice(error instanceof Error ? error.message : "Billing sign-in failed.");
    } finally {
      button.setDisabled(false);
    }
  })).addButton((button) => button.setButtonText("Create account").onClick(async () => {
    var _a;
    button.setDisabled(true);
    try {
      await signInBillingAccount(adapter, password, "register");
      new import_obsidian2.Notice("Billing account created and this installation was linked.");
      (_a = adapter.refresh) == null ? void 0 : _a.call(adapter);
    } catch (error) {
      new import_obsidian2.Notice(error instanceof Error ? error.message : "Billing account creation failed.");
    } finally {
      button.setDisabled(false);
    }
  })).addButton((button) => button.setButtonText("Sign out").setDisabled(!adapter.state.billingAccessToken).onClick(async () => {
    var _a;
    adapter.state.billingAccessToken = "";
    adapter.state.billingAccountLinked = false;
    await adapter.persist();
    new import_obsidian2.Notice("Billing account signed out on this installation.");
    (_a = adapter.refresh) == null ? void 0 : _a.call(adapter);
  }));
}

// publish/src/billing.ts
var BASE_URL = "https://app.tutivsoft.com";
var AEGIS_APP_ID = "aegis-note-locker";
var AEGIS_PRICE_IDS = {
  usd_001: "pri_01m28hmsg8q4n1p9q1ebhnema4",
  usd_010: "pri_01m28hmtd16ghxd6fdqnsge4rc"
};
function generateEventId() {
  const bytes = new Uint8Array(12);
  window.crypto.getRandomValues(bytes);
  return `evt_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
function ensureDeviceId(plugin) {
  if (!plugin.settings.constanceDeviceId) {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    plugin.settings.constanceDeviceId = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return plugin.settings.constanceDeviceId;
}
async function saveBillingState(plugin) {
  try {
    await plugin.saveSettings();
    return true;
  } catch (error) {
    console.warn("Aegis: billing state save failed", error);
    return false;
  }
}
async function fetchBalance(deviceId) {
  var _a, _b, _c;
  const response = await (0, import_obsidian3.requestUrl)({
    url: `${BASE_URL}/api/v1/public/browser/entitlements`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: AEGIS_APP_ID, external_customer_id: deviceId, machine_id: deviceId }),
    throw: false
  });
  if (response.status < 200 || response.status >= 300) throw new Error(`Entitlement sync failed: HTTP ${response.status}`);
  return Math.max(0, Number((_c = (_b = (_a = response.json) == null ? void 0 : _a.data) == null ? void 0 : _b.credits) == null ? void 0 : _c.balance) || 0);
}
async function syncBalance(plugin) {
  const deviceId = ensureDeviceId(plugin);
  try {
    plugin.settings.purchasedUses = await fetchBalance(deviceId);
    await saveBillingState(plugin);
  } catch (error) {
    console.warn("Aegis: Constance balance sync failed", error);
  }
}
async function spendPurchasedUse(deviceId, eventId) {
  var _a, _b, _c;
  try {
    const response = await (0, import_obsidian3.requestUrl)({
      url: `${BASE_URL}/api/v1/public/browser/credits/spend`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: AEGIS_APP_ID,
        external_customer_id: deviceId,
        machine_id: deviceId,
        amount: 1,
        event_id: eventId
      }),
      throw: false
    });
    if (response.status === 402 || response.status === 404) return { kind: "insufficient" };
    if (response.status < 200 || response.status >= 300) return { kind: "error" };
    const balance = Number((_c = (_b = (_a = response.json) == null ? void 0 : _a.data) == null ? void 0 : _b.credits) == null ? void 0 : _c.balance);
    if (!Number.isFinite(balance)) return { kind: "error" };
    return { kind: "ok", balance: Math.max(0, balance) };
  } catch (error) {
    console.warn("Aegis: Constance credit spend call failed", error);
    return { kind: "error" };
  }
}
async function retryPendingProtectionCharges(plugin) {
  var _a;
  const pending = [...(_a = plugin.settings.pendingProtectionCharges) != null ? _a : []];
  if (!pending.length) return;
  const deviceId = ensureDeviceId(plugin);
  for (const eventId of pending) {
    const result = await spendPurchasedUse(deviceId, eventId);
    if (result.kind === "error") break;
    if (result.kind === "insufficient") {
      plugin.settings.purchasedUses = 0;
      plugin.settings.pendingProtectionCharges = plugin.settings.pendingProtectionCharges.filter((id) => id !== eventId);
      await saveBillingState(plugin);
      break;
    }
    plugin.settings.purchasedUses = result.balance;
    plugin.settings.pendingProtectionCharges = plugin.settings.pendingProtectionCharges.filter((id) => id !== eventId);
    if (!await saveBillingState(plugin)) break;
  }
}
async function initializeBilling(plugin) {
  var _a;
  ensureDeviceId(plugin);
  plugin.settings.pendingProtectionCharges = [...new Set(((_a = plugin.settings.pendingProtectionCharges) != null ? _a : []).filter((id) => typeof id === "string" && id.startsWith("evt_")))];
  plugin.settings = { ...plugin.settings, ...resetDailyUsageIfNeeded(plugin.settings) };
  await plugin.saveSettings();
  void syncBalance(plugin).then(() => retryPendingProtectionCharges(plugin));
}
async function reserveProtectionUse(plugin) {
  if (!plugin.settings.billingAccessToken || !plugin.settings.billingAccountLinked) {
    new import_obsidian3.Notice("Aegis: sign in or create a billing account in plugin settings before protecting a note.");
    return null;
  }
  plugin.settings = { ...plugin.settings, ...resetDailyUsageIfNeeded(plugin.settings) };
  const free = consumeFreeUse(plugin.settings);
  if (free) {
    const accountFree = await claimAccountFreeUsage(plugin.settings, AEGIS_APP_ID, ensureDeviceId(plugin), `free_${generateEventId()}`, 1);
    if (accountFree.kind !== "ok") {
      if (accountFree.kind === "auth-required") {
        plugin.settings.billingAccessToken = "";
        plugin.settings.billingAccountLinked = false;
        await saveBillingState(plugin);
      }
      new import_obsidian3.Notice(accountFree.kind === "insufficient" ? "Aegis: today's account free allowance is exhausted." : "Aegis: the account allowance could not be verified.");
      return null;
    }
    const previous = plugin.settings.freeUsesUsed;
    plugin.settings.freeUsesUsed = Math.max(0, 3 - accountFree.remaining);
    if (!await saveBillingState(plugin)) {
      plugin.settings.freeUsesUsed = previous;
      return null;
    }
    return {
      source: "free",
      commit: async () => ({ kind: "committed" }),
      rollback: async () => void 0
    };
  }
  await retryPendingProtectionCharges(plugin);
  if (plugin.settings.pendingProtectionCharges.length > 0) {
    new import_obsidian3.Notice("Aegis: a previous protection charge is still pending. Refresh your balance or complete the purchase first.");
    return null;
  }
  if (plugin.settings.purchasedUses <= 0) await syncBalance(plugin);
  if (plugin.settings.purchasedUses <= 0) {
    new import_obsidian3.Notice("Aegis: no protection uses remain. Buy more in Aegis settings.");
    return null;
  }
  const eventId = generateEventId();
  plugin.settings.pendingProtectionCharges = [...plugin.settings.pendingProtectionCharges, eventId];
  if (!await saveBillingState(plugin)) {
    plugin.settings.pendingProtectionCharges = plugin.settings.pendingProtectionCharges.filter((id) => id !== eventId);
    return null;
  }
  let settled = false;
  return {
    source: "purchased",
    commit: async () => {
      if (settled) return { kind: "committed" };
      const result = await spendPurchasedUse(ensureDeviceId(plugin), eventId);
      if (result.kind === "error") return { kind: "pending" };
      settled = true;
      if (result.kind === "insufficient") {
        plugin.settings.purchasedUses = 0;
        plugin.settings.pendingProtectionCharges = plugin.settings.pendingProtectionCharges.filter((id) => id !== eventId);
        await saveBillingState(plugin);
        return { kind: "insufficient" };
      }
      plugin.settings.purchasedUses = result.balance;
      plugin.settings.pendingProtectionCharges = plugin.settings.pendingProtectionCharges.filter((id) => id !== eventId);
      if (!await saveBillingState(plugin)) {
        plugin.settings.pendingProtectionCharges = [...plugin.settings.pendingProtectionCharges, eventId];
        return { kind: "pending" };
      }
      return { kind: "committed" };
    },
    rollback: async () => {
      if (settled) return;
      plugin.settings.pendingProtectionCharges = plugin.settings.pendingProtectionCharges.filter((id) => id !== eventId);
      await saveBillingState(plugin);
    }
  };
}
function openCheckout(plugin, pack) {
  if (!plugin.settings.billingAccessToken || !plugin.settings.billingAccountLinked) {
    new import_obsidian3.Notice("Sign in or create a billing account in Aegis settings before buying uses.");
    return;
  }
  const email = plugin.settings.billingEmail.trim();
  const priceId = AEGIS_PRICE_IDS[pack];
  if (!email || !email.includes("@")) {
    new import_obsidian3.Notice("Enter a valid billing email in Aegis settings first.");
    return;
  }
  if (!priceId) {
    new import_obsidian3.Notice("Aegis billing is not available for this pack yet.");
    return;
  }
  const params = new URLSearchParams({
    app_id: AEGIS_APP_ID,
    price_id: priceId,
    email,
    external_customer_id: ensureDeviceId(plugin)
  });
  window.open(`${BASE_URL}/buy?${params.toString()}`, "_blank");
  plugin.pollAfterCheckout();
}

// publish/src/types.ts
var DEFAULT_SETTINGS = {
  sessionTimeoutMinutes: 15,
  backupFolder: ".aegis-backups",
  showStatusBar: true,
  constanceDeviceId: "",
  billingEmail: "",
  billingAccessToken: "",
  billingAccountLinked: false,
  freeUsesDay: "",
  freeUsesUsed: 0,
  purchasedUses: 0,
  pendingProtectionCharges: []
};

// publish/src/settings.ts
var AegisSettingTab = class extends import_obsidian4.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    __publicField(this, "plugin", plugin);
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Aegis Note Locker" });
    containerEl.createEl("p", { text: "All encryption is local. Optional billing sync sends only an install ID and billing email; passwords and protected content never leave the vault." });
    new import_obsidian4.Setting(containerEl).setName("Billing").setHeading();
    const balanceEl = containerEl.createEl("p", { cls: "aegis-billing-summary" });
    const renderBalance = () => {
      var _a, _b;
      const pending = (_b = (_a = this.plugin.settings.pendingProtectionCharges) == null ? void 0 : _a.length) != null ? _b : 0;
      balanceEl.setText(`Protection uses remaining: ${remainingFreeUses(this.plugin.settings)} free today + ${this.plugin.settings.purchasedUses.toLocaleString()} purchased${pending ? ` (${pending} charge pending)` : ""}`);
    };
    renderBalance();
    addBillingAccountSettings(containerEl, { state: this.plugin.settings, appId: "aegis-note-locker", installationId: this.plugin.settings.constanceDeviceId, appVersion: this.plugin.manifest.version, persist: () => this.plugin.saveSettings(), syncBalance: () => syncBalance(this.plugin), refresh: () => this.display() });
    new import_obsidian4.Setting(containerEl).setName("Buy protection uses").setDesc("One protection use covers one successful note-body or frontmatter-protection operation. Unlock, backup, rollback, and viewing are free.").addButton((button) => button.setButtonText("Buy $1 (100 uses)").onClick(() => openCheckout(this.plugin, "usd_001"))).addButton((button) => button.setButtonText("Buy $10 (1,000 uses)").setCta().onClick(() => openCheckout(this.plugin, "usd_010")));
    new import_obsidian4.Setting(containerEl).setName("Refresh purchased balance").setDesc("Sync the purchased-use balance from Constance. Unlock, export, rollback, and viewing remain free.").addButton((button) => button.setButtonText("Refresh").onClick(async () => {
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
    new import_obsidian4.Setting(containerEl).setName("Session timeout").setDesc("Minutes of inactivity before the in-memory unlock password is cleared.").addSlider((slider) => slider.setLimits(1, 120, 1).setValue(this.plugin.settings.sessionTimeoutMinutes).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.sessionTimeoutMinutes = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian4.Setting(containerEl).setName("Encrypted backup folder").setDesc("Vault-relative folder used for user-requested encrypted exports.").addText((text) => text.setPlaceholder(".aegis-backups").setValue(this.plugin.settings.backupFolder).onChange(async (value) => {
      this.plugin.settings.backupFolder = value.trim() || ".aegis-backups";
      await this.plugin.saveSettings();
    }));
    new import_obsidian4.Setting(containerEl).setName("Show status bar").setDesc("Show the current note's locked or unlocked state in the status bar.").addToggle((toggle) => toggle.setValue(this.plugin.settings.showStatusBar).onChange(async (value) => {
      this.plugin.settings.showStatusBar = value;
      await this.plugin.saveSettings();
      this.plugin.updateStatusBar();
    }));
    containerEl.createEl("h3", { text: "Recovery" });
    containerEl.createEl("p", { text: "Use Export encrypted backup before migrations or sync changes. Rollback is available for the last operation while this plugin session still holds its volatile undo record." });
  }
};

// publish/src/safety.ts
function assertNoConflict(expected, current) {
  if (expected !== current) throw new Error("The note changed on disk; resolve the sync conflict before retrying.");
}
function temporaryPath(path) {
  return `${path}.aegis-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`;
}

// publish/src/ui.ts
var import_obsidian5 = require("obsidian");
function safeError(error) {
  const message = error instanceof Error ? error.message : "The operation failed.";
  if (/password|decrypt|authentication|envelope|corrupt|tamper/i.test(message)) return "The password was incorrect or the encrypted record is damaged.";
  return message.replace(/[\r\n]+/g, " ").slice(0, 180);
}
var ConfirmModal = class extends import_obsidian5.Modal {
  constructor(app, title, message, confirmLabel = "Continue") {
    super(app);
    __publicField(this, "title", title);
    __publicField(this, "message", message);
    __publicField(this, "confirmLabel", confirmLabel);
    __publicField(this, "resolvePromise");
    __publicField(this, "settled", false);
  }
  waitForResult() {
    this.open();
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: this.title });
    contentEl.createEl("p", { text: this.message });
    const actions = contentEl.createDiv({ cls: "aegis-actions" });
    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.setAttr("aria-label", "Cancel operation");
    cancel.onclick = () => this.finish(false);
    const confirm = actions.createEl("button", { text: this.confirmLabel, cls: "mod-cta" });
    confirm.setAttr("aria-label", this.confirmLabel);
    confirm.onclick = () => this.finish(true);
  }
  onClose() {
    this.finish(false);
  }
  finish(value) {
    var _a;
    if (this.settled) return;
    this.settled = true;
    (_a = this.resolvePromise) == null ? void 0 : _a.call(this, value);
    this.close();
  }
};
var PasswordModal = class extends import_obsidian5.Modal {
  constructor(app, title, confirmPassword) {
    super(app);
    __publicField(this, "title", title);
    __publicField(this, "confirmPassword", confirmPassword);
    __publicField(this, "resolvePromise");
    __publicField(this, "settled", false);
  }
  waitForResult() {
    this.open();
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: this.title });
    contentEl.createEl("p", { text: "Aegis keeps this password local. Forgetting it may make encrypted content unrecoverable." });
    const form = contentEl.createEl("form");
    const passwordLabel = form.createEl("label", { text: "Password" });
    const password = passwordLabel.createEl("input", { type: "password" });
    password.setAttr("autocomplete", this.confirmPassword ? "new-password" : "current-password");
    password.setAttr("required", "true");
    password.setAttr("aria-label", "Aegis password");
    let confirmation;
    if (this.confirmPassword) {
      const confirmLabel = form.createEl("label", { text: "Confirm password" });
      confirmation = confirmLabel.createEl("input", { type: "password" });
      confirmation.setAttr("autocomplete", "new-password");
      confirmation.setAttr("required", "true");
      confirmation.setAttr("aria-label", "Confirm Aegis password");
    }
    const error = form.createDiv({ cls: "aegis-error" });
    const actions = form.createDiv({ cls: "aegis-actions" });
    const cancel = actions.createEl("button", { text: "Cancel", type: "button" });
    cancel.onclick = () => this.finish(null);
    const submit = actions.createEl("button", { text: this.confirmPassword ? "Set password" : "Unlock", type: "submit", cls: "mod-cta" });
    form.onsubmit = (event) => {
      event.preventDefault();
      if (password.value.length < 8) {
        error.setText("Use at least 8 characters.");
        return;
      }
      if (this.confirmPassword && password.value !== (confirmation == null ? void 0 : confirmation.value)) {
        error.setText("Passwords do not match.");
        return;
      }
      this.finish({ password: password.value, confirmation: confirmation == null ? void 0 : confirmation.value });
    };
    window.setTimeout(() => password.focus(), 0);
    void submit;
  }
  onClose() {
    this.finish(null);
  }
  finish(value) {
    var _a;
    if (this.settled) return;
    this.settled = true;
    (_a = this.resolvePromise) == null ? void 0 : _a.call(this, value);
    this.close();
  }
};
var PropertyPickerModal = class extends import_obsidian5.Modal {
  constructor(app, properties) {
    super(app);
    __publicField(this, "properties", properties);
    __publicField(this, "resolvePromise");
    __publicField(this, "settled", false);
  }
  waitForResult() {
    this.open();
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Choose frontmatter properties to protect" });
    contentEl.createEl("p", { text: "Only selected top-level values will be encrypted. Names remain visible so the note stays understandable." });
    const form = contentEl.createEl("form");
    const boxes = [];
    for (const property of this.properties) {
      const label = form.createEl("label", { cls: "aegis-checkbox" });
      const input = label.createEl("input", { type: "checkbox" });
      input.checked = property.selected;
      input.dataset.key = property.key;
      input.setAttr("aria-label", property.key);
      boxes.push(input);
      label.createSpan({ text: property.key });
    }
    const actions = form.createDiv({ cls: "aegis-actions" });
    const cancel = actions.createEl("button", { text: "Cancel", type: "button" });
    cancel.onclick = () => this.finish(null);
    const submit = actions.createEl("button", { text: "Review", type: "submit", cls: "mod-cta" });
    form.onsubmit = (event) => {
      event.preventDefault();
      this.finish(boxes.filter((box) => box.checked).map((box) => {
        var _a;
        return (_a = box.dataset.key) != null ? _a : "";
      }));
    };
    void submit;
  }
  onClose() {
    this.finish(null);
  }
  finish(value) {
    var _a;
    if (this.settled) return;
    this.settled = true;
    (_a = this.resolvePromise) == null ? void 0 : _a.call(this, value);
    this.close();
  }
};
var ProgressModal = class extends import_obsidian5.Modal {
  constructor(app, total) {
    super(app);
    __publicField(this, "total", total);
    __publicField(this, "cancelled", false);
    __publicField(this, "status");
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Locking notes" });
    this.status = contentEl.createEl("p", { text: `Preparing 0 of ${this.total}\u2026` });
    this.status.setAttr("role", "status");
    const cancel = contentEl.createEl("button", { text: "Cancel" });
    cancel.onclick = () => {
      this.cancelled = true;
      cancel.disabled = true;
      cancel.setText("Cancelling\u2026");
    };
  }
  update(done, detail) {
    var _a;
    (_a = this.status) == null ? void 0 : _a.setText(`${detail} (${done} of ${this.total})`);
  }
};
function notifyFailure(error) {
  new import_obsidian5.Notice(`Aegis: ${safeError(error)}`);
}

// publish/src/plugin-support.ts
var import_obsidian6 = require("obsidian");
function safeDetail(value) {
  if (value instanceof Error) return value.stack || value.message;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch (e) {
    return String(value);
  }
}
var DocumentationModal = class extends import_obsidian6.Modal {
  constructor(app, docs) {
    super(app);
    __publicField(this, "docs", docs);
  }
  onOpen() {
    this.titleEl.setText(`${this.docs.name} documentation`);
    this.contentEl.createEl("p", { text: this.docs.summary });
    const addSection = (title, items) => {
      this.contentEl.createEl("h3", { text: title });
      const list = this.contentEl.createEl("ol");
      for (const item of items) list.createEl("li", { text: item });
    };
    addSection("Quick start", this.docs.quickStart);
    addSection("Useful commands", this.docs.commands);
    addSection("Troubleshooting", this.docs.troubleshooting);
  }
  onClose() {
    this.contentEl.empty();
  }
};
var PluginSupport = class {
  constructor(plugin, docs) {
    __publicField(this, "plugin", plugin);
    __publicField(this, "docs", docs);
    __publicField(this, "entries", []);
    __publicField(this, "maxEntries", 250);
  }
  start() {
    this.info("plugin.loaded", `version=${this.plugin.manifest.version}`);
    this.plugin.registerDomEvent(window, "error", (event) => {
      this.error("runtime.error", event.error || event.message);
    });
    this.plugin.registerDomEvent(window, "unhandledrejection", (event) => {
      this.error("runtime.unhandled_rejection", event.reason);
    });
    this.plugin.addCommand({
      id: "open-documentation",
      name: "Open documentation",
      callback: () => new DocumentationModal(this.plugin.app, this.docs).open()
    });
    this.plugin.addCommand({
      id: "copy-debug-log",
      name: "Copy debug log",
      callback: () => {
        void this.copyDiagnostics();
      }
    });
    this.plugin.addCommand({
      id: "open-plugin-settings",
      name: "Open plugin settings",
      callback: () => {
        const setting = this.plugin.app.setting;
        setting == null ? void 0 : setting.open();
        setting == null ? void 0 : setting.openTabById(this.plugin.manifest.id);
      }
    });
  }
  info(event, detail) {
    this.record("info", event, detail);
  }
  warn(event, detail) {
    this.record("warn", event, detail);
  }
  error(event, detail) {
    this.record("error", event, detail);
  }
  record(level, event, detail) {
    const entry = { at: (/* @__PURE__ */ new Date()).toISOString(), level, event };
    if (detail !== void 0) entry.detail = safeDetail(detail).slice(0, 4e3);
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) this.entries.splice(0, this.entries.length - this.maxEntries);
    const method = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
    method.call(console, `[${this.docs.name}] ${event}`, detail != null ? detail : "");
  }
  async copyDiagnostics() {
    const header = [
      `Plugin: ${this.docs.name}`,
      `Plugin ID: ${this.plugin.manifest.id}`,
      `Version: ${this.plugin.manifest.version}`,
      `Captured: ${(/* @__PURE__ */ new Date()).toISOString()}`,
      `User agent: ${navigator.userAgent}`,
      ""
    ];
    try {
      await navigator.clipboard.writeText(header.concat(this.entries.map(
        (entry) => `${entry.at} [${entry.level.toUpperCase()}] ${entry.event}${entry.detail ? ` \u2014 ${entry.detail}` : ""}`
      )).join("\n"));
      new import_obsidian6.Notice(`${this.docs.name}: debug log copied. Secrets and note contents are not included.`);
    } catch (error) {
      this.error("diagnostics.copy_failed", error);
      new import_obsidian6.Notice(`${this.docs.name}: could not copy the debug log.`);
    }
  }
};

// publish/src/main.ts
var LOCKED_NOTE_PLACEHOLDER = "> \u{1F512} Aegis: note body locked. Use \u201CAegis: Unlock current note\u201D to view it.";
var LOCKED_PROPERTY_PLACEHOLDER = "\u{1F512} Protected by Aegis";
function asRecord(value) {
  if (!value || typeof value !== "object") return null;
  const record = value;
  if (record.mode !== "note" && record.mode !== "properties") return null;
  return record;
}
function isMarkdown(file) {
  return file.extension.toLowerCase() === "md";
}
var AegisNoteLockerPlugin = class extends import_obsidian7.Plugin {
  constructor() {
    super(...arguments);
    __publicField(this, "settings", { ...DEFAULT_SETTINGS });
    __publicField(this, "support");
    __publicField(this, "sessionPassword");
    __publicField(this, "sessionExpiresAt", 0);
    __publicField(this, "undoRecord");
    __publicField(this, "statusBar");
    __publicField(this, "activeProgress");
  }
  async onload() {
    this.support = new PluginSupport(this, { name: "Aegis Note Locker", summary: "Encrypt note bodies or selected frontmatter properties with review and rollback safeguards.", quickStart: ["Open a note.", "Run Lock current note or Lock frontmatter properties.", "Review the scope and enter a password."], commands: ["Lock current note", "Unlock current note", "Clear password session"], troubleshooting: ["Use Copy debug log before reporting a problem.", "Keep the password safe; Aegis cannot recover it."] });
    this.support.start();
    await this.loadSettings();
    await initializeBilling(this);
    if (this.settings.showStatusBar) this.statusBar = this.addStatusBarItem();
    this.addRibbonIcon("lock", "Aegis: Lock current note", () => void this.lockCurrentNote());
    this.addCommand({ id: "lock-current-note", name: "Aegis: Lock current note", callback: () => void this.lockCurrentNote() });
    this.addCommand({ id: "unlock-current-note", name: "Aegis: Unlock current note", callback: () => void this.unlockCurrentNote() });
    this.addCommand({ id: "lock-frontmatter-properties", name: "Aegis: Lock selected frontmatter properties", callback: () => void this.lockProperties() });
    this.addCommand({ id: "lock-all-notes", name: "Aegis: Lock all Markdown notes", callback: () => void this.lockAllNotes() });
    this.addCommand({ id: "lock-now", name: "Aegis: Lock now (clear session)", callback: () => this.lockNow() });
    this.addCommand({ id: "rollback-last-operation", name: "Aegis: Roll back last operation", callback: () => void this.rollbackLastOperation() });
    this.addCommand({ id: "export-encrypted-backup", name: "Aegis: Export encrypted backup of current note", callback: () => void this.exportEncryptedBackup() });
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => this.addFileMenuItems(menu, file)));
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor) => this.addEditorMenuItems(menu, editor)));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.updateStatusBar()));
    this.registerInterval(window.setInterval(() => this.expireSessionIfNeeded(), 3e4));
    this.addSettingTab(new AegisSettingTab(this.app, this));
    this.updateStatusBar();
  }
  onunload() {
    this.lockNow();
  }
  async loadSettings() {
    const saved = await this.loadData();
    this.settings = { ...DEFAULT_SETTINGS, ...saved != null ? saved : {} };
    this.settings.constanceDeviceId = typeof this.settings.constanceDeviceId === "string" ? this.settings.constanceDeviceId : "";
    this.settings.billingEmail = typeof this.settings.billingEmail === "string" ? this.settings.billingEmail : "";
    this.settings.billingAccessToken = typeof this.settings.billingAccessToken === "string" ? this.settings.billingAccessToken : "";
    this.settings.billingAccountLinked = this.settings.billingAccountLinked === true && Boolean(this.settings.billingAccessToken);
    this.settings.freeUsesDay = typeof this.settings.freeUsesDay === "string" ? this.settings.freeUsesDay : "";
    this.settings.freeUsesUsed = Number.isFinite(this.settings.freeUsesUsed) ? Math.max(0, Math.floor(this.settings.freeUsesUsed)) : 0;
    this.settings.purchasedUses = Number.isFinite(this.settings.purchasedUses) ? Math.max(0, Math.floor(this.settings.purchasedUses)) : 0;
    this.settings.pendingProtectionCharges = Array.isArray(this.settings.pendingProtectionCharges) ? this.settings.pendingProtectionCharges.filter((id) => typeof id === "string") : [];
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  pollAfterCheckout() {
    let attempts = 0;
    const interval = this.registerInterval(window.setInterval(() => {
      attempts += 1;
      void syncBalance(this);
      if (attempts >= 6) window.clearInterval(interval);
    }, 15e3));
  }
  updateStatusBar() {
    var _a, _b;
    if (!this.settings.showStatusBar) {
      (_a = this.statusBar) == null ? void 0 : _a.setText("");
      return;
    }
    const file = this.currentFile();
    if (!file || !isMarkdown(file)) {
      (_b = this.statusBar) == null ? void 0 : _b.setText("Aegis: no note");
      return;
    }
    void this.app.vault.read(file).then((content) => {
      var _a2;
      const record = asRecord(parseMarkdown(content).frontmatter[AEGIS_KEY]);
      (_a2 = this.statusBar) == null ? void 0 : _a2.setText((record == null ? void 0 : record.mode) === "note" ? "Aegis: body locked" : (record == null ? void 0 : record.mode) === "properties" ? "Aegis: properties protected" : "Aegis: unlocked");
    }).catch(() => {
      var _a2;
      return (_a2 = this.statusBar) == null ? void 0 : _a2.setText("Aegis: unavailable");
    });
  }
  addFileMenuItems(menu, file) {
    if (!(file instanceof import_obsidian7.TFile) || !isMarkdown(file)) return;
    menu.addItem((item) => item.setTitle("Aegis: Lock note").setIcon("lock").onClick(() => void this.lockCurrentNote(file)));
    menu.addItem((item) => item.setTitle("Aegis: Unlock note").setIcon("unlock").onClick(() => void this.unlockCurrentNote(file)));
    menu.addItem((item) => item.setTitle("Aegis: Lock frontmatter properties").onClick(() => void this.lockProperties(file)));
    menu.addItem((item) => item.setTitle("Aegis: Export encrypted backup").onClick(() => void this.exportEncryptedBackup(file)));
  }
  addEditorMenuItems(menu, _editor) {
    menu.addItem((item) => item.setTitle("Aegis: Lock current note").setIcon("lock").onClick(() => void this.lockCurrentNote()));
    menu.addItem((item) => item.setTitle("Aegis: Unlock current note").setIcon("unlock").onClick(() => void this.unlockCurrentNote()));
  }
  currentFile() {
    return this.app.workspace.getActiveFile();
  }
  async passwordForNewEncryption() {
    const result = await new PasswordModal(this.app, "Set Aegis password", true).waitForResult();
    if (!result) return null;
    this.setSessionPassword(result.password);
    return result.password;
  }
  async passwordForUnlock() {
    if (this.sessionPassword && Date.now() < this.sessionExpiresAt) {
      this.touchSession();
      return this.sessionPassword;
    }
    this.clearSession();
    const result = await new PasswordModal(this.app, "Unlock with Aegis password", false).waitForResult();
    if (!result) return null;
    this.setSessionPassword(result.password);
    return result.password;
  }
  setSessionPassword(password) {
    this.sessionPassword = password;
    this.touchSession();
  }
  touchSession() {
    this.sessionExpiresAt = Date.now() + this.settings.sessionTimeoutMinutes * 6e4;
  }
  expireSessionIfNeeded() {
    if (this.sessionPassword && Date.now() >= this.sessionExpiresAt) {
      this.clearSession();
      new import_obsidian7.Notice("Aegis session expired. Encrypted notes are locked.");
    }
  }
  lockNow() {
    this.sessionPassword = void 0;
    this.sessionExpiresAt = 0;
    this.undoRecord = void 0;
    this.updateStatusBar();
  }
  clearSession() {
    this.sessionPassword = void 0;
    this.sessionExpiresAt = 0;
    this.undoRecord = void 0;
  }
  async lockCurrentNote(file = this.currentFile()) {
    if (!file || !isMarkdown(file)) {
      new import_obsidian7.Notice("Aegis: open a Markdown note first.");
      return;
    }
    try {
      const original = await this.app.vault.read(file);
      const parsed = parseMarkdown(original);
      if (asRecord(parsed.frontmatter[AEGIS_KEY])) {
        new import_obsidian7.Notice("Aegis: this note already has protected content.");
        return;
      }
      const preview = await new ConfirmModal(this.app, "Review note lock", `The note body will become unreadable to Markdown search and third-party plugins. Its path and frontmatter will remain. A volatile undo record will be held for this session.`, "Continue to password").waitForResult();
      if (!preview) return;
      const password = await this.passwordForNewEncryption();
      if (!password) return;
      const envelope = await encryptText(parsed.body, password);
      const verified = await decryptText(envelope, password);
      if (verified !== parsed.body) throw new Error("Aegis verification failed before the file was changed.");
      const next = serializeMarkdown({ ...parsed.frontmatter, [AEGIS_KEY]: { mode: "note", envelope } }, LOCKED_NOTE_PLACEHOLDER);
      const reservation = await reserveProtectionUse(this);
      if (!reservation) return;
      await this.applyProtectionChange(file, original, next, reservation, "Aegis: note locked.");
    } catch (error) {
      notifyFailure(error);
    }
  }
  async lockProperties(file = this.currentFile()) {
    var _a, _b;
    if (!file || !isMarkdown(file)) {
      new import_obsidian7.Notice("Aegis: open a Markdown note first.");
      return;
    }
    try {
      const original = await this.app.vault.read(file);
      const parsed = parseMarkdown(original);
      if (((_a = asRecord(parsed.frontmatter[AEGIS_KEY])) == null ? void 0 : _a.mode) === "note") {
        new import_obsidian7.Notice("Aegis: unlock the note body before protecting properties.");
        return;
      }
      const existing = asRecord(parsed.frontmatter[AEGIS_KEY]);
      const keys = topLevelPropertyNames(parsed.frontmatter).filter((key) => {
        var _a2;
        return !((_a2 = existing == null ? void 0 : existing.properties) == null ? void 0 : _a2[key]);
      });
      if (!keys.length) {
        new import_obsidian7.Notice("Aegis: this note has no top-level frontmatter properties.");
        return;
      }
      const chosen = await new PropertyPickerModal(this.app, keys.map((key) => ({ key, selected: false }))).waitForResult();
      if (!(chosen == null ? void 0 : chosen.length)) return;
      const preview = await new ConfirmModal(this.app, "Review property lock", `Protect ${chosen.length} frontmatter propert${chosen.length === 1 ? "y" : "ies"}? Names stay visible; values will be replaced with a non-sensitive placeholder.`, "Continue to password").waitForResult();
      if (!preview) return;
      const password = await this.passwordForNewEncryption();
      if (!password) return;
      const protectedValues = { ...(_b = existing == null ? void 0 : existing.properties) != null ? _b : {} };
      const updatedFrontmatter = { ...parsed.frontmatter };
      for (const key of chosen) {
        protectedValues[key] = await encryptText(JSON.stringify(parsed.frontmatter[key]), password);
        updatedFrontmatter[key] = LOCKED_PROPERTY_PLACEHOLDER;
      }
      const nextRecord = { mode: "properties", properties: protectedValues };
      const next = serializeMarkdown({ ...updatedFrontmatter, [AEGIS_KEY]: nextRecord }, parsed.body);
      const reservation = await reserveProtectionUse(this);
      if (!reservation) return;
      await this.applyProtectionChange(file, original, next, reservation, `Aegis: protected ${chosen.length} propert${chosen.length === 1 ? "y" : "ies"}.`);
    } catch (error) {
      notifyFailure(error);
    }
  }
  async unlockCurrentNote(file = this.currentFile()) {
    if (!file || !isMarkdown(file)) {
      new import_obsidian7.Notice("Aegis: open a Markdown note first.");
      return;
    }
    try {
      const original = await this.app.vault.read(file);
      const parsed = parseMarkdown(original);
      const record = asRecord(parsed.frontmatter[AEGIS_KEY]);
      if (!record) {
        new import_obsidian7.Notice("Aegis: this note is not locked.");
        return;
      }
      const preview = await new ConfirmModal(this.app, "Review unlock", "The encrypted record will be verified before the note is replaced. Nothing changes if the password is wrong or the file changed on disk.", "Continue to unlock").waitForResult();
      if (!preview) return;
      const password = await this.passwordForUnlock();
      if (!password) return;
      const nextFrontmatter = { ...parsed.frontmatter };
      delete nextFrontmatter[AEGIS_KEY];
      let nextBody = parsed.body;
      if (record.mode === "note" && record.envelope) {
        nextBody = await decryptText(record.envelope, password);
      } else if (record.mode === "properties" && record.properties) {
        for (const [key, envelope] of Object.entries(record.properties)) nextFrontmatter[key] = JSON.parse(await decryptText(envelope, password));
      } else throw new Error("Unsupported Aegis record.");
      const next = serializeMarkdown(nextFrontmatter, nextBody);
      await this.atomicChange(file, original, next);
      new import_obsidian7.Notice("Aegis: note unlocked.");
    } catch (error) {
      notifyFailure(error);
    }
  }
  async lockAllNotes() {
    var _a;
    try {
      const files = this.app.vault.getMarkdownFiles();
      const candidates = [];
      for (const file of files) {
        const content = await this.app.vault.read(file);
        if (!asRecord(parseMarkdown(content).frontmatter[AEGIS_KEY])) candidates.push(file);
      }
      if (!candidates.length) {
        new import_obsidian7.Notice("Aegis: no unlocked Markdown notes found.");
        return;
      }
      const approved = await new ConfirmModal(this.app, "Review lock-all operation", `${candidates.length} Markdown notes will be encrypted. Each file is checked for sync conflicts and verified before replacement.`, "Continue to password").waitForResult();
      if (!approved) return;
      const password = await this.passwordForNewEncryption();
      if (!password) return;
      const progress = new ProgressModal(this.app, candidates.length);
      this.activeProgress = progress;
      progress.open();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      const entries = [];
      for (let index = 0; index < candidates.length; index++) {
        if (progress.cancelled) break;
        const file = candidates[index];
        progress.update(index, file.path);
        try {
          const original = await this.app.vault.read(file);
          const parsed = parseMarkdown(original);
          if (asRecord(parsed.frontmatter[AEGIS_KEY])) continue;
          const envelope = await encryptText(parsed.body, password);
          if (await decryptText(envelope, password) !== parsed.body) throw new Error("verification failed");
          const next = serializeMarkdown({ ...parsed.frontmatter, [AEGIS_KEY]: { mode: "note", envelope } }, LOCKED_NOTE_PLACEHOLDER);
          const reservation = await reserveProtectionUse(this);
          if (!reservation) {
            progress.cancelled = true;
            break;
          }
          if (await this.applyProtectionChange(file, original, next, reservation, "", false)) {
            entries.push({ path: file.path, original, resulting: next });
          }
        } catch (error) {
          new import_obsidian7.Notice(`Aegis skipped ${file.path}: ${error instanceof Error ? error.message : "operation failed"}`);
        }
      }
      progress.update(entries.length, progress.cancelled ? "Cancelled" : "Complete");
      progress.close();
      this.activeProgress = void 0;
      if (entries.length) this.undoRecord = { createdAt: Date.now(), entries };
      new import_obsidian7.Notice(`Aegis: locked ${entries.length} note(s)${progress.cancelled ? " before cancellation" : ""}.`);
    } catch (error) {
      (_a = this.activeProgress) == null ? void 0 : _a.close();
      this.activeProgress = void 0;
      notifyFailure(error);
    }
  }
  async exportEncryptedBackup(file = this.currentFile()) {
    if (!file || !isMarkdown(file)) {
      new import_obsidian7.Notice("Aegis: open a Markdown note first.");
      return;
    }
    try {
      const original = await this.app.vault.read(file);
      const approved = await new ConfirmModal(this.app, "Export encrypted backup", "Aegis will write an encrypted copy into the configured vault backup folder. The backup will not contain your password.", "Choose password").waitForResult();
      if (!approved) return;
      const password = await this.passwordForNewEncryption();
      if (!password) return;
      const envelope = await encryptText(original, password);
      const folder = this.settings.backupFolder.replace(/^\/+|\/+$/g, "") || ".aegis-backups";
      if (!await this.app.vault.adapter.exists(folder)) await this.app.vault.adapter.mkdir(folder);
      const digest = (await sha256Hex(file.path)).slice(0, 16);
      const backupPath = `${folder}/${digest}-${Date.now()}.aegis`;
      await this.app.vault.adapter.write(backupPath, JSON.stringify({ v: 1, sourceHash: await sha256Hex(file.path), sourcePath: file.path, envelope }, null, 2));
      new import_obsidian7.Notice(`Aegis: encrypted backup written to ${backupPath}.`);
    } catch (error) {
      notifyFailure(error);
    }
  }
  async rollbackLastOperation() {
    const record = this.undoRecord;
    if (!(record == null ? void 0 : record.entries.length)) {
      new import_obsidian7.Notice("Aegis: no volatile undo record is available.");
      return;
    }
    const approved = await new ConfirmModal(this.app, "Roll back last Aegis operation", `Restore ${record.entries.length} original note(s)? Aegis will refuse if any file changed since the operation.`, "Roll back").waitForResult();
    if (!approved) return;
    let restored = 0;
    for (const entry of record.entries) {
      const file = this.app.vault.getAbstractFileByPath(entry.path);
      if (!(file instanceof import_obsidian7.TFile)) continue;
      try {
        await this.atomicChange(file, entry.resulting, entry.original, false);
        restored++;
      } catch (e) {
        new import_obsidian7.Notice(`Aegis: rollback refused for ${entry.path} because it changed.`);
      }
    }
    this.undoRecord = void 0;
    new import_obsidian7.Notice(`Aegis: rolled back ${restored} note(s).`);
  }
  async atomicChange(file, expected, next, recordUndo = true) {
    const current = await this.app.vault.read(file);
    assertNoConflict(expected, current);
    const tempPath = temporaryPath(file.path);
    try {
      await this.app.vault.adapter.write(tempPath, next);
      const staged = await this.app.vault.adapter.read(tempPath);
      if (staged !== next) throw new Error("Staged file verification failed.");
      await this.app.vault.adapter.rename(tempPath, file.path);
      const committed = await this.app.vault.read(file);
      if (committed !== next) throw new Error("Committed file verification failed.");
      if (recordUndo) this.undoRecord = { createdAt: Date.now(), entries: [{ path: file.path, original: expected, resulting: next }] };
    } catch (error) {
      if (await this.app.vault.adapter.exists(tempPath)) await this.app.vault.adapter.remove(tempPath).catch(() => void 0);
      throw error;
    }
  }
  async applyProtectionChange(file, original, next, reservation, successNotice, recordUndo = true) {
    try {
      await this.atomicChange(file, original, next, recordUndo);
      const result = await reservation.commit();
      if (result.kind === "insufficient") {
        try {
          await this.atomicChange(file, next, original, false);
        } catch (rollbackError) {
          throw new Error(`Aegis could not confirm the protection charge or restore the note safely: ${rollbackError instanceof Error ? rollbackError.message : "rollback failed"}`);
        }
        new import_obsidian7.Notice("Aegis: no purchased use was available; the note was left unchanged.");
        return false;
      }
      if (successNotice) {
        new import_obsidian7.Notice(result.kind === "pending" ? `${successNotice} Billing will retry the purchased-use charge.` : successNotice);
      }
      return true;
    } catch (error) {
      await reservation.rollback();
      throw error;
    }
  }
};
