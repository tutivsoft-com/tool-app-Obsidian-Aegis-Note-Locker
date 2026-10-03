"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
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

// publish/src/billing-checkout.ts
var billing_checkout_exports = {};
__export(billing_checkout_exports, {
  openAccountCheckout: () => openAccountCheckout,
  openAccountCheckoutByPrice: () => openAccountCheckoutByPrice,
  resumeAccountCheckout: () => resumeAccountCheckout
});
async function send(host, path, method, body, key) {
  const request = () => (0, import_obsidian2.requestUrl)({
    url: `https://app.tutivsoft.com/api/v1/billing/${path}`,
    method,
    throw: false,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${host.state.billingAccessToken}`, ...key ? { "Idempotency-Key": key } : {} },
    ...body ? { body: JSON.stringify(body) } : {}
  });
  let response = await request();
  if (response.status === 401 && await host.refreshSession()) response = await request();
  return response;
}
function resumeAccountCheckout(host) {
  var _a;
  if (!host.state.pendingAccountCheckout || !host.state.billingAccountLinked || host.state.pendingAccountCheckout.email !== host.state.billingEmail || timers.has(host.state)) return;
  const timer = setTimeout(() => {
    timers.delete(host.state);
    if (running.has(host.state)) {
      resumeAccountCheckout(host);
      return;
    }
    const operation = recover(host);
    running.set(host.state, operation);
    void operation.catch(() => void 0).finally(() => {
      running.delete(host.state);
      resumeAccountCheckout(host);
    });
  }, 15e3);
  timers.set(host.state, timer);
  (_a = timer.unref) == null ? void 0 : _a.call(timer);
}
async function recover(host) {
  var _a, _b, _c;
  const pending = host.state.pendingAccountCheckout;
  if (!pending || !host.state.billingAccountLinked || pending.email !== host.state.billingEmail) return;
  if (!pending.checkoutId) {
    const route = pending.priceId ? "checkout-price" : "checkout";
    const selection = pending.priceId ? { price_id: pending.priceId } : { plan_code: pending.plan };
    const response2 = await send(host, route, "POST", { app_id: host.appId, installation_id: host.installationId, ...selection, quantity: 1 }, pending.key);
    if (host.state.pendingAccountCheckout !== pending || pending.email !== host.state.billingEmail) return;
    if (response2.status < 200 || response2.status >= 300 || !((_b = (_a = response2.json) == null ? void 0 : _a.data) == null ? void 0 : _b.checkout_id)) return;
    pending.checkoutId = String(response2.json.data.checkout_id);
    await host.persist();
  }
  const response = await send(host, `checkouts/${encodeURIComponent(pending.checkoutId)}`, "GET");
  if (host.state.pendingAccountCheckout !== pending || pending.email !== host.state.billingEmail) return;
  if (response.status < 200 || response.status >= 300) return;
  const data = (_c = response.json) == null ? void 0 : _c.data;
  if ((data == null ? void 0 : data.settled) || ["completed", "fulfilled", "failed", "canceled", "cancelled", "expired"].includes(data == null ? void 0 : data.status)) {
    await host.syncBalance();
    if (host.state.pendingAccountCheckout !== pending || pending.email !== host.state.billingEmail) return;
    host.state.pendingAccountCheckout = null;
    await host.persist();
  }
}
async function startAccountCheckout(host, selection) {
  if (running.has(host.state)) return running.get(host.state);
  const operation = (async () => {
    var _a;
    if (!host.state.billingAccountLinked) {
      new import_obsidian2.Notice("Connect your billing account first.");
      return;
    }
    const saved = host.state.pendingAccountCheckout;
    if (saved && (selection.priceId && saved.priceId !== selection.priceId || selection.plan && saved.plan !== selection.plan || saved.email !== host.state.billingEmail)) {
      new import_obsidian2.Notice("A purchase is pending. Its status will refresh automatically before you can start another.");
      resumeAccountCheckout(host);
      return;
    }
    const pending = saved || { key: `checkout_${globalThis.crypto.randomUUID()}`, ...selection, email: host.state.billingEmail };
    host.state.pendingAccountCheckout = pending;
    try {
      await host.persist();
      const route = selection.priceId ? "checkout-price" : "checkout";
      const choice = selection.priceId ? { price_id: selection.priceId } : { plan_code: selection.plan };
      const response = await send(host, route, "POST", { app_id: host.appId, installation_id: host.installationId, ...choice, quantity: 1 }, pending.key);
      if (host.state.pendingAccountCheckout !== pending || pending.email !== host.state.billingEmail) return;
      const checkout = (_a = response.json) == null ? void 0 : _a.data;
      if (response.status < 200 || response.status >= 300 || !(checkout == null ? void 0 : checkout.checkout_id)) {
        new import_obsidian2.Notice("Checkout could not be confirmed. Retry the same purchase to recover it safely.");
        return;
      }
      pending.checkoutId = String(checkout.checkout_id);
      await host.persist();
      if (typeof checkout.checkout_url === "string" && checkout.checkout_url) {
        window.open(checkout.checkout_url, "_blank", "noopener");
        new import_obsidian2.Notice("Complete payment in your browser. Your balance will update automatically.");
      } else {
        new import_obsidian2.Notice("Checkout is still being confirmed. Its status will refresh automatically.");
      }
    } catch (e) {
      new import_obsidian2.Notice("Checkout could not be confirmed. Retry the same purchase to recover it safely.");
    } finally {
      resumeAccountCheckout(host);
    }
  })();
  running.set(host.state, operation);
  try {
    await operation;
  } finally {
    running.delete(host.state);
  }
}
function openAccountCheckoutByPrice(host, priceId) {
  return startAccountCheckout(host, { priceId });
}
function openAccountCheckout(host, plan) {
  return startAccountCheckout(host, { plan });
}
var import_obsidian2, running, timers;
var init_billing_checkout = __esm({
  "publish/src/billing-checkout.ts"() {
    "use strict";
    import_obsidian2 = require("obsidian");
    running = /* @__PURE__ */ new WeakMap();
    timers = /* @__PURE__ */ new WeakMap();
  }
});

// publish/src/constance-account.ts
var constance_account_exports = {};
__export(constance_account_exports, {
  CONSTANCE_ACCOUNT_BASE_URL: () => CONSTANCE_ACCOUNT_BASE_URL,
  addBillingAccountSettings: () => addBillingAccountSettings,
  claimAccountFreeUsage: () => claimAccountFreeUsage,
  refreshBillingSession: () => refreshBillingSession,
  registerBillingPersister: () => registerBillingPersister,
  requestAuthenticatedBilling: () => requestAuthenticatedBilling,
  signInBillingAccount: () => signInBillingAccount,
  signOutBillingAccount: () => signOutBillingAccount,
  spendAccountCredits: () => spendAccountCredits,
  validateBillingSession: () => validateBillingSession
});
function errorDetail(response, fallback) {
  var _a;
  const payload = ((_a = response.json) == null ? void 0 : _a.data) || response.json;
  const detail = payload == null ? void 0 : payload.detail;
  const code = (detail == null ? void 0 : detail.code) || (payload == null ? void 0 : payload.code);
  if (code === "invalid_credentials") return "The email or password is incorrect. Use Forgot password? to reset it.";
  if (code === "email_verification_required") return "Email not verified. Click the link in your email, then Connect again.";
  return String((detail == null ? void 0 : detail.message) || (typeof detail === "string" ? detail : "") || (payload == null ? void 0 : payload.message) || fallback);
}
async function linkAuthenticatedInstallation(adapter, token) {
  try {
    await linkInstallation(adapter, token);
  } catch (error) {
    if (error instanceof ConstanceAccountError && error.status === 401) {
      adapter.state.billingAccessToken = "";
      adapter.state.billingRefreshToken = "";
      adapter.state.billingAccountLinked = false;
      await adapter.persist();
    }
    throw error;
  }
}
async function authenticate(mode, email, password, installationId) {
  var _a, _b, _c;
  const body = mode !== "login" ? { email, password, external_customer_id: installationId } : { email, password };
  const response = await (0, import_obsidian3.requestUrl)({
    url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/auth/${mode}`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    throw: false
  });
  if (response.status < 200 || response.status >= 300) {
    throw new ConstanceAccountError(errorDetail(response, `Billing ${mode} failed (HTTP ${response.status})`), response.status);
  }
  const accessToken = String(((_a = response.json) == null ? void 0 : _a.access_token) || "");
  if (!accessToken && ((_b = response.json) == null ? void 0 : _b.verification_required)) {
    throw new Error("Account created. Verify the billing email, then sign in.");
  }
  const refreshToken = String(((_c = response.json) == null ? void 0 : _c.refresh_token) || "");
  if (!accessToken || !refreshToken) throw new Error("Constance did not return a complete account session.");
  return { accessToken, refreshToken };
}
function clearBillingSession(state) {
  state.billingAccessToken = "";
  state.billingRefreshToken = "";
  state.billingAccountLinked = false;
}
function registerBillingPersister(state, persist) {
  billingPersisters.set(state, persist);
}
async function refreshBillingSession(state, persist) {
  persist != null ? persist : persist = billingPersisters.get(state);
  const pending = billingRefreshes.get(state);
  if (pending) {
    const ok = await pending;
    if (ok) await (persist == null ? void 0 : persist());
    return ok;
  }
  const original = state.billingRefreshToken;
  if (!original) return false;
  const operation = (async () => {
    var _a, _b;
    try {
      const response = await (0, import_obsidian3.requestUrl)({
        url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/auth/refresh`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: original }),
        throw: false
      });
      if (state.billingRefreshToken !== original) return false;
      if (response.status === 401 || response.status === 403) {
        state.billingAccessToken = "";
        state.billingRefreshToken = "";
        state.billingAccountLinked = false;
        await (persist == null ? void 0 : persist());
        return false;
      }
      if (response.status < 200 || response.status >= 300) return false;
      const access = String(((_a = response.json) == null ? void 0 : _a.access_token) || "");
      const refresh = String(((_b = response.json) == null ? void 0 : _b.refresh_token) || "");
      if (!access || !refresh) return false;
      state.billingAccessToken = access;
      state.billingRefreshToken = refresh;
      await (persist == null ? void 0 : persist());
      return true;
    } catch (e) {
      return false;
    }
  })();
  billingRefreshes.set(state, operation);
  try {
    return await operation;
  } finally {
    billingRefreshes.delete(state);
  }
}
async function requestAuthenticatedBilling(state, options) {
  const send2 = () => (0, import_obsidian3.requestUrl)({
    ...options,
    headers: {
      ...options.headers || {},
      ...state.billingAccessToken ? { Authorization: `Bearer ${state.billingAccessToken}` } : {}
    },
    throw: false
  });
  let response = await send2();
  if (response.status === 401 && state.billingRefreshToken) {
    const hadRefreshToken = Boolean(state.billingRefreshToken);
    if (await refreshBillingSession(state)) response = await send2();
    else if (hadRefreshToken && state.billingRefreshToken) return { ...response, status: 503 };
  }
  return response;
}
async function linkInstallation(adapter, token) {
  const response = await (0, import_obsidian3.requestUrl)({
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
    throw new ConstanceAccountError(errorDetail(response, `Installation link failed (HTTP ${response.status})`), response.status);
  }
}
async function signInBillingAccount(adapter, password, mode) {
  const email = adapter.state.billingEmail.trim().toLowerCase();
  const journalState = adapter.state;
  const owner = String(journalState.pendingBillingOwnerEmail || "").toLowerCase();
  if (owner && owner !== email) throw new Error(`An unfinished billing request belongs to ${owner}. Connect that account to recover it first.`);
  if (!email || !email.includes("@")) throw new Error("Enter a valid billing email.");
  if (Array.from(password).length < 8 || Array.from(password).length > 128) throw new Error("Password must be between 8 and 128 characters.");
  if (!adapter.installationId) throw new Error("The plugin installation ID is not ready.");
  let tokens;
  try {
    tokens = await authenticate(mode, email, password, adapter.installationId);
  } catch (error) {
    if (mode !== "login" && error instanceof Error && error.message.startsWith("Account created. Verify")) {
      adapter.state.billingEmail = email;
      adapter.state.billingAccessToken = "";
      adapter.state.billingRefreshToken = "";
      adapter.state.billingAccountLinked = false;
      adapter.state.billingRegistrationPending = true;
      await adapter.persist();
    }
    throw error;
  }
  adapter.state.billingEmail = email;
  adapter.state.billingAccessToken = tokens.accessToken;
  adapter.state.billingRefreshToken = tokens.refreshToken;
  adapter.state.billingAccountLinked = false;
  adapter.state.billingRegistrationPending = false;
  await adapter.persist();
  await linkAuthenticatedInstallation(adapter, tokens.accessToken);
  adapter.state.billingAccountLinked = true;
  await adapter.persist();
  await adapter.syncBalance();
}
async function signOutBillingAccount(adapter) {
  const refreshToken = adapter.state.billingRefreshToken;
  const accessToken = adapter.state.billingAccessToken;
  try {
    if (refreshToken || accessToken) {
      await (0, import_obsidian3.requestUrl)({
        url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/auth/logout`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
        },
        body: JSON.stringify({ refresh_token: refreshToken || void 0 }),
        throw: false
      });
    }
  } catch (error) {
    console.warn("Constance account logout could not reach the server", error);
  } finally {
    adapter.state.billingAccessToken = "";
    adapter.state.billingRefreshToken = "";
    adapter.state.billingAccountLinked = false;
    adapter.state.billingRegistrationPending = false;
    await adapter.persist();
  }
}
async function validateBillingSession(adapter) {
  const token = adapter.state.billingAccessToken;
  if (!token || !adapter.state.billingAccountLinked || !adapter.installationId) return false;
  const query = new URLSearchParams({ app_id: adapter.appId, installation_id: adapter.installationId });
  const response = await requestAuthenticatedBilling(adapter.state, {
    url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/billing/entitlements/me?${query.toString()}`,
    method: "GET"
  });
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    if (adapter.state.billingRefreshToken) return false;
    clearBillingSession(adapter.state);
    await adapter.persist();
    return false;
  }
  const valid = response.status >= 200 && response.status < 300;
  if (valid) await adapter.persist();
  return valid;
}
async function claimAccountFreeUsage(state, appId, installationId, eventId, amount) {
  var _a, _b;
  if (!state.billingAccessToken || !state.billingAccountLinked) return { kind: "auth-required" };
  try {
    const response = await requestAuthenticatedBilling(state, {
      url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/billing/free-usage/claim`,
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.billingAccessToken}` },
      body: JSON.stringify({ app_id: appId, installation_id: installationId, event_id: eventId, amount })
    });
    if (response.status === 402) return { kind: "insufficient" };
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      clearBillingSession(state);
      return { kind: "auth-required" };
    }
    if (response.status < 200 || response.status >= 300) return { kind: "error" };
    const remaining = Math.max(0, Number((_b = (_a = response.json) == null ? void 0 : _a.data) == null ? void 0 : _b.remaining) || 0);
    new import_obsidian3.Notice(`Credit balance before this task: ${(remaining + amount).toLocaleString()} free credits.`);
    new import_obsidian3.Notice(`Task used ${amount.toLocaleString()} credits. Balance remaining: ${remaining.toLocaleString()} free credits.`);
    return { kind: "ok", remaining };
  } catch (error) {
    console.error("Constance account free-usage claim failed", error);
    return { kind: "error" };
  }
}
async function spendAccountCredits(state, appId, installationId, eventId, amount) {
  var _a, _b, _c;
  if (!state.billingAccessToken || !state.billingAccountLinked) return { kind: "auth-required" };
  try {
    const response = await requestAuthenticatedBilling(state, {
      url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/billing/credits/spend`,
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.billingAccessToken}` },
      body: JSON.stringify({ app_id: appId, installation_id: installationId, event_id: eventId, amount })
    });
    if (response.status === 402) return { kind: "insufficient" };
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      clearBillingSession(state);
      return { kind: "auth-required" };
    }
    if (response.status < 200 || response.status >= 300) return { kind: "error" };
    const balance = Number((_c = (_b = (_a = response.json) == null ? void 0 : _a.data) == null ? void 0 : _b.credits) == null ? void 0 : _c.balance);
    if (!Number.isFinite(balance)) return { kind: "error" };
    const remaining = Math.max(0, balance);
    new import_obsidian3.Notice(`Credit balance before this task: ${(remaining + amount).toLocaleString()} purchased credits.`);
    new import_obsidian3.Notice(`Task used ${amount.toLocaleString()} credits. Balance remaining: ${remaining.toLocaleString()} purchased credits.`);
    return { kind: "ok", balance: remaining };
  } catch (error) {
    console.error("Constance authenticated credit spend failed", error);
    return { kind: "error" };
  }
}
function addBillingAccountSettings(containerEl, adapter) {
  resumeAccountCheckout({ ...adapter, refreshSession: () => refreshBillingSession(adapter.state, adapter.persist) });
  let password = "";
  const section = containerEl.createDiv({ cls: "constance-account-billing-section" });
  section.createEl("h3", { text: "Account and billing" });
  const state = adapter.state;
  const numericBalances = Object.entries(state).filter(([key, value]) => /(?:credit|balance|remaining)/i.test(key) && typeof value === "number").map(([key, value]) => `${key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()}: ${Number(value).toLocaleString()}`);
  const accountStatus = adapter.state.billingAccountLinked ? `Signed in as ${adapter.state.billingEmail || "your account"}` : state.billingRegistrationPending ? `Registered as ${adapter.state.billingEmail} but not signed in. Check your email, click the confirmation link, then sign in here.` : "Not signed in.";
  section.createEl("p", {
    cls: "constance-account-status",
    text: numericBalances.length ? `${accountStatus} Balance \u2014 ${numericBalances.join("; ")}` : accountStatus
  });
  new import_obsidian3.Setting(section).setName("Email").setDesc(adapter.state.billingAccountLinked ? "Sign out before changing accounts." : "Used to register, sign in, restore purchases, and open checkout.").addText((text) => text.setPlaceholder("you@example.com").setValue(adapter.state.billingEmail).setDisabled(adapter.state.billingAccountLinked).onChange(async (value) => {
    if (adapter.state.billingAccountLinked) return;
    const journalState = adapter.state;
    const hasPending = Object.entries(journalState).some(([key, value2]) => /^pending/i.test(key) && key !== "pendingBillingOwnerEmail" && !!value2 && (Array.isArray(value2) ? value2.length > 0 : typeof value2 === "object" ? Object.keys(value2).length > 0 : true));
    if (hasPending && !journalState.pendingBillingOwnerEmail) journalState.pendingBillingOwnerEmail = adapter.state.billingEmail;
    if (!hasPending) journalState.pendingBillingOwnerEmail = void 0;
    adapter.state.billingEmail = value.trim();
    await adapter.persist();
  }));
  new import_obsidian3.Setting(section).setName("Password").setDesc("Used only for this request. The plugin never saves your password.").addText((text) => {
    text.inputEl.type = "password";
    text.inputEl.maxLength = 256;
    text.setPlaceholder("8 to 128 characters").onChange((value) => {
      password = value;
    });
  });
  new import_obsidian3.Setting(section).setName("Account").setDesc(accountStatus).addButton((button) => button.setButtonText("Connect").setDisabled(adapter.state.billingAccountLinked).onClick(async () => {
    var _a, _b;
    button.setDisabled(true);
    try {
      await signInBillingAccount(adapter, password, "connect");
      password = "";
      new import_obsidian3.Notice(adapter.state.billingRegistrationPending ? "Check your email and follow the verification link, then Connect again." : `Connected as ${adapter.state.billingEmail}.`);
      (_a = adapter.refresh) == null ? void 0 : _a.call(adapter);
    } catch (error) {
      new import_obsidian3.Notice(error instanceof Error ? error.message : "Connection failed. Please try again.");
      (_b = adapter.refresh) == null ? void 0 : _b.call(adapter);
    } finally {
      button.setDisabled(adapter.state.billingAccountLinked);
    }
  })).addButton((button) => button.setButtonText("Sign out").setDisabled(!adapter.state.billingAccessToken && !adapter.state.billingRefreshToken).onClick(async () => {
    var _a;
    await signOutBillingAccount(adapter);
    new import_obsidian3.Notice("Signed out.");
    (_a = adapter.refresh) == null ? void 0 : _a.call(adapter);
  }));
  new import_obsidian3.Setting(section).setName("Forgot password?").setDesc("Reset your Constance billing password in the browser.").addButton((button) => button.setButtonText("Open reset page").onClick(() => {
    window.open(`${CONSTANCE_ACCOUNT_BASE_URL}/password-reset`, "_blank", "noopener");
  }));
  const firstHeading = containerEl.querySelector(":scope > h1, :scope > h2");
  if (firstHeading == null ? void 0 : firstHeading.nextSibling) containerEl.insertBefore(section, firstHeading.nextSibling);
  else containerEl.prepend(section);
  queueMicrotask(() => {
    const candidates = Array.from(containerEl.querySelectorAll(":scope > .setting-item"));
    for (const item of candidates) {
      const label = item.textContent || "";
      if (/buy|checkout|refresh balance|sync balance|credit pack/i.test(label)) section.appendChild(item);
    }
    for (const summary of Array.from(containerEl.querySelectorAll('[class*="credit"][class*="summary"], [class*="balance"][class*="summary"]'))) {
      if (!section.contains(summary)) section.appendChild(summary);
    }
  });
}
var import_obsidian3, CONSTANCE_ACCOUNT_BASE_URL, ConstanceAccountError, billingPersisters, billingRefreshes;
var init_constance_account = __esm({
  "publish/src/constance-account.ts"() {
    "use strict";
    init_billing_checkout();
    import_obsidian3 = require("obsidian");
    CONSTANCE_ACCOUNT_BASE_URL = "https://app.tutivsoft.com";
    ConstanceAccountError = class extends Error {
      constructor(message, status) {
        super(message);
        __publicField(this, "status");
        this.name = "ConstanceAccountError";
        this.status = status;
      }
    };
    billingPersisters = /* @__PURE__ */ new WeakMap();
    billingRefreshes = /* @__PURE__ */ new WeakMap();
  }
});

// publish/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => AegisNoteLockerPlugin
});
module.exports = __toCommonJS(main_exports);

// publish/src/main.ts
var import_obsidian8 = require("obsidian");

// publish/src/crypto.ts
var AEGIS_FORMAT_VERSION = 1;
var DEFAULT_PBKDF2_ITERATIONS = 31e4;
var MAX_PBKDF2_ITERATIONS = 1e6;
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
  if (envelope.v !== AEGIS_FORMAT_VERSION || envelope.alg !== "AES-256-GCM" || envelope.kdf !== "PBKDF2-HMAC-SHA256" || !isSupportedPbkdf2Iterations(envelope.iterations) || typeof envelope.salt !== "string" || typeof envelope.iv !== "string" || typeof envelope.ciphertext !== "string" || typeof envelope.tag !== "string") {
    throw new Error("Unsupported or malformed Aegis envelope.");
  }
}
function isSupportedPbkdf2Iterations(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1e5 && value <= MAX_PBKDF2_ITERATIONS;
}
async function encryptText(plaintext, password, iterations = DEFAULT_PBKDF2_ITERATIONS) {
  if (!password) throw new Error("A password is required.");
  if (!isSupportedPbkdf2Iterations(iterations)) {
    throw new Error("Unsupported PBKDF2 iteration count.");
  }
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
  const digest2 = await cryptoApi().subtle.digest("SHA-256", source(new TextEncoder().encode(value)));
  return Array.from(new Uint8Array(digest2), (byte) => byte.toString(16).padStart(2, "0")).join("");
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

// publish/src/native-operations.ts
var import_obsidian4 = require("obsidian");
init_constance_account();
var BASE = "https://app.tutivsoft.com/api/v1";
async function digest(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
}
function codePoints(value) {
  return Array.from(value).length;
}
function nativeCost(appId, dimensions) {
  if (appId === "cairn-vault-linter") return Math.max(1, Math.ceil(dimensions.files / 5), Math.ceil(dimensions.edits / 20));
  if (appId === "meridian-timeline") return Math.max(1, Math.ceil(dimensions.notes / 20));
  return 1;
}
function jobId() {
  return `native_${crypto.randomUUID()}`;
}
async function api(host, path, body, publicRequest = false) {
  var _a, _b, _c;
  if (!publicRequest && (!host.settings.billingAccessToken || !host.settings.billingAccountLinked)) throw new Error("Keep this preview open. Sign in and verify your email in settings, then return to this exact result.");
  const send2 = () => (0, import_obsidian4.requestUrl)({
    url: BASE + path,
    method: body === void 0 ? "GET" : "POST",
    throw: false,
    headers: { "Content-Type": "application/json", ...!publicRequest ? { Authorization: `Bearer ${host.settings.billingAccessToken}` } : {} },
    body: body === void 0 ? void 0 : JSON.stringify(body)
  });
  let response = await send2();
  if (response.status === 401 && host.settings.billingRefreshToken) {
    const refresh = refreshBillingSession;
    if (refresh && await refresh(host.settings, () => host.persistNative())) {
      await host.persistNative();
      response = await send2();
    }
  }
  if (response.status < 200 || response.status >= 300) throw Object.assign(new Error(((_b = (_a = response.json) == null ? void 0 : _a.detail) == null ? void 0 : _b.message) || `Authorization unavailable (${response.status}). Your preview is retained; nothing new was applied.`), { status: response.status });
  if (!((_c = response.json) == null ? void 0 : _c.data)) throw new Error("Authorization response is incomplete.");
  return response.json.data;
}
var SplitModal = class extends import_obsidian4.Modal {
  constructor(app, split, resolve) {
    super(app);
    __publicField(this, "split", split);
    __publicField(this, "resolve", resolve);
  }
  onOpen() {
    this.contentEl.createEl("h2", { text: "Confirm useful operation" });
    this.contentEl.createEl("p", { text: `This exact result uses ${this.split.free_units} free units and ${this.split.paid_units} purchased units. Full reveal consumes the operation once; applying that result again does not. Purchased credits do not expire.` });
    new import_obsidian4.Setting(this.contentEl).addButton((b) => b.setButtonText("Confirm").setCta().onClick(() => {
      this.resolve(true);
      this.close();
    }));
  }
  onClose() {
    this.resolve(false);
    this.contentEl.empty();
  }
};
async function reserveNative(host, appId, eventId, source2, result, dimensions, reveal = false) {
  var _a;
  const state = host.settings;
  try {
    const source_digest = await digest(source2), result_digest = await digest(result);
    const amount = nativeCost(appId, dimensions);
    const owner = state.billingEmail.trim().toLowerCase();
    await recoverNative(host);
    const originalEventId = eventId;
    const lineage = (state.operationJournal || []).filter((j) => j.event_id === originalEventId || j.retry_of === originalEventId);
    if (lineage.some((j) => j.account !== owner)) throw new Error("This operation belongs to another account. Sign in to the original account; its preview and journal are retained.");
    if (lineage.some((j) => j.app_id !== appId || j.result_digest !== result_digest || j.source_digest !== source_digest || j.amount !== amount || JSON.stringify(j.dimensions) !== JSON.stringify(dimensions))) throw new Error("Source or operation changed. Keep the original preview; review a merge or start a separately priced run.");
    let existing = lineage.length ? lineage[lineage.length - 1] : void 0;
    if ((existing == null ? void 0 : existing.state) === "released") {
      eventId = jobId();
      existing = void 0;
    }
    if ((existing == null ? void 0 : existing.state) === "uncertain_released") throw new Error("The server released an operation after a local write may have started. Reconcile the vault output before retrying; no new reservation was created.");
    else if (existing) {
      eventId = existing.event_id;
    }
    const lineageIds = new Set(lineage.map((j) => j.event_id));
    if ((_a = state.operationJournal) == null ? void 0 : _a.some((j) => j.app_id === appId && j.account === owner && !lineageIds.has(j.event_id) && ["requesting", "writing", "verified", "reserved"].includes(j.state))) throw new Error("A previous write is uncertain. Reconcile its output before starting another operation; no reservation was refunded.");
    if (!state.installationCredential) {
      const installation = await api(host, "/public/installations", { app_id: appId, installation_id: state.constanceDeviceId }, true);
      if (typeof installation.installation_credential !== "string") throw new Error("Installation proof unavailable.");
      state.installationCredential = installation.installation_credential;
      await host.persistNative();
    }
    const body = { app_id: appId, installation_id: state.constanceDeviceId, event_id: eventId, amount, source_digest, result_digest, dimensions, installation_credential: state.installationCredential };
    const quote = await api(host, "/billing/operations/quote", body);
    if (quote.event_id !== eventId || quote.app_id !== appId || quote.installation_id !== state.constanceDeviceId || quote.source_digest !== source_digest || quote.result_digest !== result_digest || quote.amount !== amount) throw new Error("Quote identity conflicts with the preserved operation. Nothing was confirmed or written.");
    if (!Number.isInteger(quote.free_units) || !Number.isInteger(quote.paid_units) || quote.free_units < 0 || quote.paid_units < 0 || quote.free_units + quote.paid_units !== amount) throw new Error("Invalid server cost split.");
    if (quote.allowed === false) throw new Error(quote.message || "This operation is not authorized. Keep the preview and sign in to the original account, reduce the selection, or purchase.");
    if (existing && existing.state !== "released" && (existing.free_units !== quote.free_units || existing.paid_units !== quote.paid_units)) throw new Error("The original confirmed split changed. Nothing was written; reconcile the original operation.");
    if ((!existing || existing.state === "released") && !await new Promise((resolve) => new SplitModal(host.app, quote, resolve).open())) return null;
    const journal = existing || { event_id: eventId, app_id: appId, source_digest, result_digest, amount, free_units: quote.free_units, paid_units: quote.paid_units, dimensions, state: "requesting", account: owner, ...eventId !== originalEventId ? { retry_of: originalEventId } : {} };
    if (!existing) {
      state.operationJournal = [...state.operationJournal || [], journal];
      await host.persistNative();
    }
    const reserved = await api(host, "/billing/operations/reserve", { ...body, expected_free_units: quote.free_units, expected_paid_units: quote.paid_units });
    assertJournalIdentity(reserved, journal, state.constanceDeviceId);
    if (reserved.state === "released") {
      journal.state = "released";
      await host.persistNative();
      throw new Error("The server released this operation. Nothing was written; confirm a fresh exact quote before reauthorizing the preserved result.");
    }
    if (!["reserved", "committed"].includes(reserved.state)) throw new Error("Operation authorization is unavailable. Nothing was written; reconcile the preserved result.");
    if (reserved.free_units !== quote.free_units || reserved.paid_units !== quote.paid_units) throw new Error("Allowance changed after confirmation. Nothing was written; refresh the exact quote before continuing.");
    if (!["writing", "verified", "committed"].includes(journal.state)) journal.state = reserved.state;
    await host.persistNative();
    const settleRequest = async (action) => api(host, `/billing/operations/${encodeURIComponent(eventId)}/${action}`, { app_id: appId, installation_id: state.constanceDeviceId, result_digest });
    const settle = async (action) => {
      const response = await settleRequest(action);
      assertJournalIdentity(response, journal, state.constanceDeviceId);
      return response;
    };
    const reservation = {
      source: reserved.paid_units > 0 ? "purchased" : "free",
      markWriting: async (evidence) => {
        var _a2;
        if (!["reserved", "committed"].includes(journal.state)) throw new Error("No active operation hold. Nothing was written.");
        if (journal.state === "committed" && ((_a2 = journal.evidence) == null ? void 0 : _a2.length)) {
          new import_obsidian4.Notice("This immutable result already completed its write. Access the existing output; no write was replayed.");
          return false;
        }
        if (journal.state !== "committed") journal.state = "writing";
        journal.evidence = evidence;
        await host.persistNative();
        return true;
      },
      commit: async () => {
        if (journal.state === "committed") return { kind: "committed" };
        journal.state = "verified";
        await host.persistNative();
        try {
          const committed = await settle("commit");
          if (committed.result_digest !== result_digest || committed.source_digest !== source_digest || committed.event_id !== eventId) throw new Error("Commit identity mismatch");
          if (committed.state !== "committed") throw new Error("Commit incomplete");
          journal.state = "committed";
          await host.persistNative();
          return { kind: "committed" };
        } catch (e) {
          return { kind: "pending" };
        }
      },
      rollback: async () => {
        if (["writing", "verified", "committed"].includes(journal.state)) {
          new import_obsidian4.Notice("Write outcome requires reconciliation. Reservation retained; no blind refund or replay.");
          return;
        }
        const released = await settle("release");
        journal.state = released.state;
        await host.persistNative();
      }
    };
    if (reveal && (await reservation.commit()).kind !== "committed") throw new Error("Full reveal is pending. Retry this exact preview after reconnecting.");
    return reservation;
  } catch (error) {
    new import_obsidian4.Notice(error instanceof Error ? error.message : String(error));
    return null;
  }
}
function assertJournalIdentity(remote, journal, installationId) {
  if (remote.event_id !== journal.event_id || remote.app_id !== journal.app_id || remote.installation_id !== installationId || remote.source_digest !== journal.source_digest || remote.result_digest !== journal.result_digest || remote.amount !== journal.amount || remote.free_units !== journal.free_units || remote.paid_units !== journal.paid_units) throw Object.assign(new Error("Operation response conflicts with its immutable journal."), { identityMismatch: true });
}
async function recoverNative(host) {
  var _a, _b;
  const state = host.settings;
  if (!state.billingAccessToken || !state.billingAccountLinked) return;
  for (const journal of state.operationJournal || []) {
    if (!["requesting", "writing", "verified", "reserved"].includes(journal.state) || journal.account !== state.billingEmail.trim().toLowerCase()) continue;
    try {
      const remote = await api(host, `/billing/operations/${encodeURIComponent(journal.event_id)}?app_id=${encodeURIComponent(journal.app_id)}&installation_id=${encodeURIComponent(state.constanceDeviceId)}`);
      assertJournalIdentity(remote, journal, state.constanceDeviceId);
      if (remote.state === "committed") {
        journal.state = "committed";
        await host.persistNative();
        continue;
      }
      if (remote.state === "released") {
        if (journal.state === "writing" || ((_a = journal.evidence) == null ? void 0 : _a.length)) {
          journal.state = "uncertain_released";
          await host.persistNative();
          continue;
        }
        journal.state = "released";
        await host.persistNative();
        continue;
      }
      if (journal.state === "requesting" && remote.state === "reserved") {
        journal.state = "reserved";
        await host.persistNative();
        continue;
      }
      if (journal.state !== "verified") {
        if (!((_b = journal.evidence) == null ? void 0 : _b.length)) continue;
        const outcomes = await Promise.all(journal.evidence.map(async (evidence) => {
          try {
            const adapter = host.app.vault.adapter;
            const bytes = evidence.binary ? await adapter.readBinary(evidence.path) : await adapter.read(evidence.path);
            if (evidence.marker && typeof bytes === "string" && bytes.includes(evidence.marker)) return "after";
            const hash = await digest(bytes);
            return hash === evidence.after ? "after" : hash === evidence.before ? "before" : "unknown";
          } catch (e) {
            return "unknown";
          }
        }));
        if (outcomes.length === 0 || outcomes.some((outcome) => outcome !== "after")) continue;
      }
      const remoteCommit = await api(host, `/billing/operations/${encodeURIComponent(journal.event_id)}/commit`, { app_id: journal.app_id, installation_id: state.constanceDeviceId, result_digest: journal.result_digest });
      assertJournalIdentity(remoteCommit, journal, state.constanceDeviceId);
      if (remoteCommit.state === "committed" && remoteCommit.result_digest === journal.result_digest && remoteCommit.source_digest === journal.source_digest) {
        journal.state = "committed";
        await host.persistNative();
      }
    } catch (error) {
      if (journal.state === "requesting" && !(error == null ? void 0 : error.identityMismatch) && (!(error == null ? void 0 : error.status) || error.status === 404 || error.status >= 500)) try {
        const remote = await api(host, "/billing/operations/reserve", { app_id: journal.app_id, installation_id: state.constanceDeviceId, event_id: journal.event_id, amount: journal.amount, source_digest: journal.source_digest, result_digest: journal.result_digest, dimensions: journal.dimensions, expected_free_units: journal.free_units, expected_paid_units: journal.paid_units, installation_credential: state.installationCredential });
        assertJournalIdentity(remote, journal, state.constanceDeviceId);
        journal.state = remote.state;
        await host.persistNative();
      } catch (e) {
      }
    }
  }
}
function joinCurrentPacks(catalog, legacyLive, legacyAppId) {
  var _a;
  const publicPacks = Array.isArray((_a = catalog == null ? void 0 : catalog.data) == null ? void 0 : _a.packs) ? catalog.data.packs : catalog == null ? void 0 : catalog.packs;
  if (Array.isArray(publicPacks)) return publicPacks.map((pack) => {
    const priceId = typeof (pack == null ? void 0 : pack.price_id) === "string" ? pack.price_id : "";
    const units = Number(pack == null ? void 0 : pack.native_units);
    const unit2 = typeof (pack == null ? void 0 : pack.unit) === "string" && pack.unit.trim() ? pack.unit.trim() : "units";
    const available = (pack == null ? void 0 : pack.available) === true && !!priceId && Number.isSafeInteger(units) && units > 0 && typeof (pack == null ? void 0 : pack.formatted_total) === "string" && pack.formatted_total.length > 0;
    return { pack, price: pack, priceId, units, unit: unit2, available };
  });
  const configured = Array.isArray(catalog == null ? void 0 : catalog.one_time_packs) ? catalog.one_time_packs : [];
  const prices = Array.isArray(legacyLive == null ? void 0 : legacyLive[legacyAppId || (catalog == null ? void 0 : catalog.app_id)]) ? legacyLive[legacyAppId || (catalog == null ? void 0 : catalog.app_id)] : [];
  const unit = typeof (catalog == null ? void 0 : catalog.credit_unit_name) === "string" && catalog.credit_unit_name.trim() ? catalog.credit_unit_name.trim() : "credits";
  return configured.map((pack) => {
    const priceId = typeof pack.price_id === "string" ? pack.price_id : "";
    const price = priceId ? prices.find((item) => (item == null ? void 0 : item.price_id) === priceId && (item == null ? void 0 : item.interval) === "one_time") : void 0;
    const units = Number(pack.credits);
    const available = !!priceId && Number.isSafeInteger(units) && units > 0 && (price == null ? void 0 : price.status) === "active" && price.checkout_available === true && typeof price.amount === "string" && price.amount.length > 0 && (!pack.product_id || price.product_id === pack.product_id);
    return { pack, price, priceId, units, unit, available };
  });
}
async function renderNativePacks(container, host, appId, buy) {
  const root = container.createDiv();
  root.createEl("p", { text: "Loading current Paddle prices\u2026" });
  try {
    const catalog = await api(host, `/billing/public-products?app_id=${encodeURIComponent(appId)}`, void 0, true);
    const offers = joinCurrentPacks(catalog);
    if (!offers.length) throw new Error("No configured one-time offers");
    root.empty();
    for (const { pack, price, priceId, units, unit, available } of offers) {
      const details = [pack == null ? void 0 : pack.description, Number.isSafeInteger(units) && units > 0 ? `${units.toLocaleString()} ${unit}` : "", available ? "" : (pack == null ? void 0 : pack.availability_reason) || "Current price unavailable"].filter(Boolean).join(" \xB7 ");
      new import_obsidian4.Setting(root).setName((pack == null ? void 0 : pack.name) || (pack == null ? void 0 : pack.code) || "One-time offer").setDesc(details).addButton((b) => b.setButtonText(available ? pack.formatted_total : "Pricing unavailable").setDisabled(!available).onClick(() => void buy(priceId)));
    }
  } catch (e) {
    root.empty();
    root.createEl("p", { text: "Pricing temporarily unavailable. Buying is disabled; keep your preview open." });
  }
}

// publish/src/settings.ts
var import_obsidian5 = require("obsidian");

// publish/src/billing.ts
init_constance_account();
init_billing_checkout();
init_billing_checkout();
init_constance_account();

// publish/src/usage.ts
var DAILY_FREE_USES = 5;
function localDayKey(date = /* @__PURE__ */ new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function resetDailyUsageIfNeeded(state, date = /* @__PURE__ */ new Date()) {
  return state;
}
function remainingFreeUses(state, date = /* @__PURE__ */ new Date()) {
  const normalized = resetDailyUsageIfNeeded(state, date);
  return Math.max(0, DAILY_FREE_USES - normalized.freeUsesUsed);
}

// publish/src/billing.ts
init_constance_account();
var BASE_URL = "https://app.tutivsoft.com";
var AEGIS_APP_ID = "aegis-note-locker";
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
async function fetchBalance(plugin) {
  var _a, _b, _c, _d, _e;
  const response = await requestAuthenticatedBilling(plugin.settings, {
    url: `${BASE_URL}/api/v1/billing/entitlements/me?${new URLSearchParams({ app_id: AEGIS_APP_ID, installation_id: plugin.settings.constanceDeviceId }).toString()}`,
    method: "GET"
  });
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    plugin.settings.billingAccessToken = "";
    plugin.settings.billingRefreshToken = "";
    plugin.settings.billingAccountLinked = false;
    await saveBillingState(plugin);
    throw new Error("Billing session expired");
  }
  if (response.status < 200 || response.status >= 300) throw new Error(`Entitlement sync failed: HTTP ${response.status}`);
  if ((_b = (_a = response.json) == null ? void 0 : _a.data) == null ? void 0 : _b.free_usage) {
    plugin.settings.freeUsesDay = localDayKey();
    plugin.settings.freeUsesUsed = Math.max(0, 3 - Number(response.json.data.free_usage.remaining || 0));
  }
  return Math.max(0, Number((_e = (_d = (_c = response.json) == null ? void 0 : _c.data) == null ? void 0 : _d.credits) == null ? void 0 : _e.balance) || 0);
}
async function syncBalance(plugin, strict = false) {
  registerBillingPersister(plugin.settings, () => plugin.saveSettings());
  resumeAccountCheckout({
    state: plugin.settings,
    appId: AEGIS_APP_ID,
    installationId: plugin.settings.constanceDeviceId,
    persist: () => plugin.saveSettings(),
    syncBalance: () => syncBalance(plugin),
    refreshSession: () => refreshBillingSession(plugin.settings, () => plugin.saveSettings())
  });
  const deviceId = ensureDeviceId(plugin);
  try {
    if (!plugin.settings.billingAccessToken || !plugin.settings.billingAccountLinked) {
      if (strict) throw new Error("Connect your account before refreshing.");
      return;
    }
    plugin.settings.purchasedUses = await fetchBalance(plugin);
    await saveBillingState(plugin);
  } catch (error) {
    console.warn("Aegis: Constance balance sync failed", error);
    if (strict) throw error;
  }
}
async function spendPurchasedUse(plugin, eventId) {
  try {
    const result = await spendAccountCredits(plugin.settings, AEGIS_APP_ID, plugin.settings.constanceDeviceId, eventId, 1);
    if (result.kind === "auth-required") {
      plugin.settings.billingAccessToken = "";
      plugin.settings.billingRefreshToken = "";
      plugin.settings.billingAccountLinked = false;
      await saveBillingState(plugin);
      return { kind: "error" };
    }
    if (result.kind === "insufficient" || result.kind === "error") return result;
    return { kind: "ok", balance: Math.max(0, result.balance) };
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
    const result = await spendPurchasedUse(plugin, eventId);
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
  void recoverNative({ app: plugin.app, settings: plugin.settings, persistNative: () => plugin.saveSettings() });
  void syncBalance(plugin).then(() => retryPendingProtectionCharges(plugin));
}
async function reserveProtectionUse(plugin, source2 = "", result = "", eventId = jobId()) {
  return reserveNative({ app: plugin.app, settings: plugin.settings, persistNative: () => plugin.saveSettings() }, AEGIS_APP_ID, eventId, source2, result, { input_characters: codePoints(source2) });
}

// publish/src/settings.ts
init_constance_account();

// publish/src/types.ts
var DEFAULT_SETTINGS = {
  settingsMode: "simple",
  sessionTimeoutMinutes: 15,
  backupFolder: ".aegis-backups",
  showStatusBar: true,
  constanceDeviceId: "",
  billingEmail: "",
  billingAccessToken: "",
  billingRefreshToken: "",
  billingAccountLinked: false,
  freeUsesDay: "",
  freeUsesUsed: 0,
  purchasedUses: 0,
  pendingProtectionCharges: [],
  pendingCheckoutKey: "",
  pendingCheckoutPack: "",
  reviewBeforeApply: false,
  protectedProperties: ""
};

// publish/src/settings.ts
var AegisSettingTab = class extends import_obsidian5.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    __publicField(this, "plugin", plugin);
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Aegis Note Locker" });
    const advanced = this.plugin.settings.settingsMode === "advanced";
    new import_obsidian5.Setting(containerEl).setName("Settings mode").setDesc("Simple shows everyday controls. Advanced includes detailed behavior and troubleshooting.").addDropdown((dropdown) => dropdown.addOption("simple", "Simple").addOption("advanced", "Advanced").setValue(this.plugin.settings.settingsMode).onChange(async (value) => {
      this.plugin.settings.settingsMode = value === "advanced" ? "advanced" : "simple";
      await this.plugin.saveSettings();
      this.display();
    }));
    let sessionPassword = "";
    let passwordInput;
    new import_obsidian5.Setting(containerEl).setName("Session password").setDesc("Set this once per Obsidian session so Lock, Unlock, and Backup run without password pop-ups. The password stays in memory only and is never saved to plugin data.").addText((text) => {
      passwordInput = text;
      text.setPlaceholder("Session password");
      text.inputEl.type = "password";
      text.onChange((value) => sessionPassword = value);
    }).addButton((button) => button.setButtonText("Set for session").setCta().onClick(() => {
      if (!sessionPassword) {
        new import_obsidian5.Notice("Enter a password to set it for this session.");
        passwordInput == null ? void 0 : passwordInput.inputEl.focus();
        return;
      }
      this.plugin.setSessionPassword(sessionPassword);
      sessionPassword = "";
      passwordInput == null ? void 0 : passwordInput.setValue("");
      new import_obsidian5.Notice("Aegis session password set.");
    }));
    new import_obsidian5.Setting(containerEl).setName("Review before applying").setDesc("Off by default for one-click actions. Turn on to see a review/confirmation window before changes.").addToggle((toggle) => toggle.setValue(this.plugin.settings.reviewBeforeApply).onChange(async (value) => {
      this.plugin.settings.reviewBeforeApply = value;
      await this.plugin.saveSettings();
    }));
    if (advanced) {
      new import_obsidian5.Setting(containerEl).setName("Protected properties").setDesc("Comma or newline separated frontmatter property names to protect. Leave empty to protect every eligible property.").addTextArea((text) => text.setValue(this.plugin.settings.protectedProperties).onChange(async (value) => {
        this.plugin.settings.protectedProperties = value;
        await this.plugin.saveSettings();
      }));
    }
    containerEl.createEl("p", { text: "All encryption is local. Optional billing uses an account session and install ID; passwords and protected content never leave the vault." });
    new import_obsidian5.Setting(containerEl).setName("Billing").setHeading();
    const balanceEl = containerEl.createEl("p", { cls: "aegis-billing-summary" });
    const renderBalance = () => {
      var _a, _b;
      const pending = (_b = (_a = this.plugin.settings.pendingProtectionCharges) == null ? void 0 : _a.length) != null ? _b : 0;
      balanceEl.setText(`Protection uses remaining: ${remainingFreeUses(this.plugin.settings)} lifetime free remaining (server authoritative) + ${this.plugin.settings.purchasedUses.toLocaleString()} purchased${pending ? ` (${pending} charge pending)` : ""}`);
    };
    renderBalance();
    addBillingAccountSettings(containerEl, { state: this.plugin.settings, appId: "aegis-note-locker", installationId: this.plugin.settings.constanceDeviceId, appVersion: this.plugin.manifest.version, persist: () => this.plugin.saveSettings(), syncBalance: () => syncBalance(this.plugin), refresh: () => this.display() });
    new import_obsidian5.Setting(containerEl).setName("Retry preserved protection").setDesc("Use the exact encrypted preview kept in this session. Sign-in does not rerun encryption. Source changes block overwrite.").addButton((b) => b.setButtonText("Retry").onClick(() => void this.plugin.retryProtectionPreview()));
    void renderNativePacks(containerEl, { app: this.app, settings: this.plugin.settings, persistNative: () => this.plugin.saveSettings() }, "aegis-note-locker", async (plan) => {
      const { openAccountCheckoutByPrice: openAccountCheckoutByPrice2 } = await Promise.resolve().then(() => (init_billing_checkout(), billing_checkout_exports));
      await openAccountCheckoutByPrice2({ state: this.plugin.settings, appId: "aegis-note-locker", installationId: this.plugin.settings.constanceDeviceId, persist: () => this.plugin.saveSettings(), syncBalance: () => syncBalance(this.plugin), refreshSession: async () => {
        const a = await Promise.resolve().then(() => (init_constance_account(), constance_account_exports));
        return a.refreshBillingSession(this.plugin.settings, () => this.plugin.saveSettings());
      } }, plan);
    });
    new import_obsidian5.Setting(containerEl).setName("Refresh purchased balance").setDesc("Sync the purchased-use balance from Constance. Unlock, export, rollback, and viewing remain free.").addButton((button) => button.setButtonText("Refresh").onClick(async () => {
      button.setDisabled(true);
      try {
        await syncBalance(this.plugin, true);
        await retryPendingProtectionCharges(this.plugin);
        renderBalance();
      } catch (e) {
        new import_obsidian5.Notice("Aegis: balance could not be refreshed. Check your connection and account, then retry.");
      } finally {
        button.setDisabled(false);
      }
    }));
    void syncBalance(this.plugin).then(() => retryPendingProtectionCharges(this.plugin)).then(renderBalance).catch(() => {
      balanceEl.setText("Balance unavailable. Use Refresh to retry; your saved balance is retained.");
    });
    new import_obsidian5.Setting(containerEl).setName("Session timeout").setDesc("Minutes of inactivity before the password is cleared. Default: 15 minutes; enter it again to unlock later.").addDropdown((dropdown) => dropdown.addOption("5", "5 minutes \u2014 shorter sessions").addOption("15", "15 minutes \u2014 recommended").addOption("30", "30 minutes").addOption("60", "60 minutes").addOptions([5, 15, 30, 60].includes(this.plugin.settings.sessionTimeoutMinutes) ? {} : { [String(this.plugin.settings.sessionTimeoutMinutes)]: `${this.plugin.settings.sessionTimeoutMinutes} minutes \u2014 current` }).setValue(String(this.plugin.settings.sessionTimeoutMinutes)).onChange(async (value) => {
      this.plugin.settings.sessionTimeoutMinutes = Number(value);
      await this.plugin.saveSettings();
    }));
    if (advanced) {
      this.plugin.support.addDiagnosticsSetting(containerEl);
      new import_obsidian5.Setting(containerEl).setName("Encrypted backup folder").setDesc("Vault-relative folder used for user-requested encrypted exports.").addText((text) => text.setPlaceholder(".aegis-backups").setValue(this.plugin.settings.backupFolder).onChange(async (value) => {
        this.plugin.settings.backupFolder = value.trim() || ".aegis-backups";
        await this.plugin.saveSettings();
      }));
      new import_obsidian5.Setting(containerEl).setName("Show status bar").setDesc("Show the current note's locked or unlocked state in the status bar.").addToggle((toggle) => toggle.setValue(this.plugin.settings.showStatusBar).onChange(async (value) => {
        this.plugin.settings.showStatusBar = value;
        await this.plugin.saveSettings();
        this.plugin.updateStatusBar();
      }));
      containerEl.createEl("h3", { text: "Recovery" });
      containerEl.createEl("p", { text: "Use Export encrypted backup before migrations or sync changes. Rollback is available for the last operation while this plugin session still holds its volatile undo record." });
    }
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
var import_obsidian6 = require("obsidian");
function safeError(error) {
  const message = error instanceof Error ? error.message : "The operation failed.";
  if (/password|decrypt|authentication|envelope|corrupt|tamper/i.test(message)) return "The password was incorrect or the encrypted record is damaged.";
  return message.replace(/[\r\n]+/g, " ").slice(0, 180);
}
var ConfirmModal = class extends import_obsidian6.Modal {
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
var ProgressModal = class extends import_obsidian6.Modal {
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
  new import_obsidian6.Notice(`Aegis: ${safeError(error)}`);
}

// publish/src/plugin-support.ts
var import_obsidian7 = require("obsidian");
var SAFE_DETAIL_KEYS = /* @__PURE__ */ new Set([
  "version",
  "operation",
  "scope",
  "selectedCount",
  "total",
  "changed",
  "skipped",
  "failed",
  "unchanged",
  "reviewEnabled",
  "fieldCount",
  "noteChars",
  "httpStatus",
  "errorType",
  "outcome",
  "restored",
  "authorizationSource",
  "cancelled",
  "line",
  "column",
  "settingCount",
  "attempt",
  "attempts",
  "queueCount",
  "itemCount",
  "fileCount",
  "imageCount",
  "stage",
  "category",
  "status",
  "durationMs",
  "elapsedMs"
]);
function safeString(value) {
  if (value.length <= 120 && /^[A-Za-z0-9 _=.,:-]*$/.test(value) && !/(?:sk-[A-Za-z0-9]|bearer|api.?key|token|secret)/i.test(value)) {
    return value;
  }
  return "[omitted]";
}
function safeDetail(value) {
  if (value instanceof Error) return JSON.stringify({ errorType: safeString(value.name || "Error") });
  if (!value || typeof value !== "object" || Array.isArray(value)) return "[detail omitted]";
  const safe = {};
  for (const [key, item] of Object.entries(value)) {
    if (!SAFE_DETAIL_KEYS.has(key)) continue;
    if (typeof item === "string") safe[key] = safeString(item);
    else if (typeof item === "number" && Number.isFinite(item)) safe[key] = item;
    else if (typeof item === "boolean" || item === null) safe[key] = item;
  }
  return JSON.stringify(safe);
}
function safeErrorType(error) {
  if (error instanceof Error) return safeString(error.name || "Error");
  return safeString(typeof error);
}
var DocumentationModal = class extends import_obsidian7.Modal {
  constructor(app, docs) {
    super(app);
    __publicField(this, "docs", docs);
  }
  onOpen() {
    this.titleEl.setText(this.docs.name + " documentation");
    this.contentEl.createEl("p", { text: this.docs.summary });
    const addSection = (title, items) => {
      this.contentEl.createEl("h3", { text: title });
      const list = this.contentEl.createEl("ol");
      for (const item of items) list.createEl("li", { text: item });
    };
    addSection("Quick start", this.docs.quickStart);
    addSection("Useful commands", Array.from(/* @__PURE__ */ new Set([...this.docs.commands, "Copy full debug log"])));
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
    __publicField(this, "maxEntries", 1e3);
    __publicField(this, "droppedEntries", 0);
    __publicField(this, "started", false);
  }
  start() {
    if (this.started) return;
    this.started = true;
    this.info("plugin.loaded", { version: this.plugin.manifest.version });
    this.plugin.registerDomEvent(window, "error", (event) => {
      const error = event.error;
      this.error("runtime.error", {
        errorType: error instanceof Error ? error.name : "ErrorEvent",
        line: event.lineno,
        column: event.colno
      });
    });
    this.plugin.registerDomEvent(window, "unhandledrejection", (event) => {
      this.error("runtime.unhandled_rejection", { errorType: safeErrorType(event.reason) });
    });
    const addCommand = this.plugin.addCommand.bind(this.plugin);
    const registerCommand = (command) => addCommand(this.instrumentCommand(command));
    registerCommand({
      id: "open-documentation",
      name: "Open documentation",
      callback: () => new DocumentationModal(this.plugin.app, this.docs).open()
    });
    registerCommand({
      id: "copy-debug-log",
      name: "Copy full debug log",
      callback: () => this.copyDiagnostics()
    });
    registerCommand({
      id: "open-plugin-settings",
      name: "Open plugin settings",
      callback: () => {
        const setting = this.plugin.app.setting;
        setting == null ? void 0 : setting.open();
        setting == null ? void 0 : setting.openTabById(this.plugin.manifest.id);
      }
    });
    this.instrumentFutureCommands(addCommand);
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
  addDiagnosticsSetting(containerEl) {
    new import_obsidian7.Setting(containerEl).setName("Diagnostics").setDesc("Copy up to the latest 1,000 events recorded by this plugin. Logs reset when the plugin reloads. Note contents, paths, credentials, and raw error messages are excluded.").addButton((button) => button.setButtonText("Copy full log").onClick(() => {
      void this.copyDiagnostics();
    }));
  }
  instrumentFutureCommands(addCommand) {
    const originalDescriptor = Object.getOwnPropertyDescriptor(this.plugin, "addCommand");
    Object.defineProperty(this.plugin, "addCommand", {
      configurable: true,
      writable: true,
      value: (command) => addCommand(this.instrumentCommand(command))
    });
    this.plugin.register(() => {
      if (originalDescriptor) Object.defineProperty(this.plugin, "addCommand", originalDescriptor);
      else Reflect.deleteProperty(this.plugin, "addCommand");
    });
  }
  instrumentCommand(command) {
    const instrument = (callback) => (...args) => this.trackCommand(command.id, () => callback.apply(command, args));
    return {
      ...command,
      callback: command.callback ? instrument(command.callback) : void 0,
      editorCallback: command.editorCallback ? instrument(command.editorCallback) : void 0,
      checkCallback: command.checkCallback ? (checking) => checking ? command.checkCallback(checking) : this.trackCommand(command.id, () => command.checkCallback(checking)) : void 0,
      editorCheckCallback: command.editorCheckCallback ? (checking, editor, context) => checking ? command.editorCheckCallback(checking, editor, context) : this.trackCommand(command.id, () => command.editorCheckCallback(checking, editor, context)) : void 0
    };
  }
  trackCommand(commandId, action) {
    const startedAt = Date.now();
    this.info("command.started", { operation: commandId });
    try {
      const result = action();
      if (result && typeof result.then === "function") {
        return Promise.resolve(result).then(
          (value) => {
            this.info("command.completed", { operation: commandId, durationMs: Date.now() - startedAt });
            return value;
          },
          (error) => {
            this.error("command.failed", { operation: commandId, errorType: safeErrorType(error), durationMs: Date.now() - startedAt });
            throw error;
          }
        );
      }
      this.info("command.completed", { operation: commandId, durationMs: Date.now() - startedAt });
      return result;
    } catch (error) {
      this.error("command.failed", { operation: commandId, errorType: safeErrorType(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }
  record(level, event, detail) {
    var _a;
    const safeEvent = /^[a-z0-9][a-z0-9._-]{0,99}$/i.test(event) ? event : "invalid_event";
    const entry = { at: (/* @__PURE__ */ new Date()).toISOString(), level, event: safeEvent };
    if (detail !== void 0) entry.detail = safeDetail(detail);
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      const removed = this.entries.length - this.maxEntries;
      this.entries.splice(0, removed);
      this.droppedEntries += removed;
    }
    const method = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
    method.call(console, "[" + this.docs.name + "] " + entry.event, (_a = entry.detail) != null ? _a : "");
  }
  async copyDiagnostics() {
    this.info("diagnostics.copy_requested", { total: this.entries.length + 1 });
    const captured = (/* @__PURE__ */ new Date()).toISOString();
    const snapshot = this.entries.slice();
    const header = [
      "Plugin debug log",
      "Log scope: this plugin, since its most recent load",
      "Plugin: " + this.docs.name,
      "Plugin ID: " + this.plugin.manifest.id,
      "Version: " + this.plugin.manifest.version,
      "Captured: " + captured,
      "User agent: " + navigator.userAgent,
      "Events included: " + snapshot.length,
      "Older events omitted: " + this.droppedEntries,
      ""
    ];
    const text = header.concat(snapshot.map(
      (entry) => entry.at + " [" + entry.level.toUpperCase() + "] " + entry.event + (entry.detail ? " \u2014 " + entry.detail : "")
    )).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      this.info("diagnostics.copy_succeeded", { total: snapshot.length });
      const omitted = this.droppedEntries ? "; " + this.droppedEntries + " older events omitted" : "";
      new import_obsidian7.Notice(this.docs.name + ": copied " + snapshot.length + " log events" + omitted + ".");
    } catch (error) {
      this.error("diagnostics.copy_failed", { errorType: safeErrorType(error) });
      new import_obsidian7.Notice(this.docs.name + ": could not copy the debug log.");
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
var AegisNoteLockerPlugin = class extends import_obsidian8.Plugin {
  constructor() {
    super(...arguments);
    __publicField(this, "settings", { ...DEFAULT_SETTINGS });
    __publicField(this, "support");
    __publicField(this, "sessionPassword");
    __publicField(this, "sessionExpiresAt", 0);
    __publicField(this, "undoRecord");
    __publicField(this, "statusBar");
    __publicField(this, "activeProgress");
    __publicField(this, "protectionPreview");
  }
  async onload() {
    this.support = new PluginSupport(this, { name: "Aegis Note Locker", summary: "Encrypt note bodies or selected frontmatter properties with review and rollback safeguards.", quickStart: ["Open a note.", "Run Lock current note or Lock frontmatter properties.", "Review the scope and enter a password."], commands: ["Lock current note", "Unlock current note", "Clear password session"], troubleshooting: ["Use Copy debug log before reporting a problem.", "Keep the password safe; Aegis cannot recover it."] });
    this.support.start();
    await this.loadSettings();
    await initializeBilling(this);
    if (this.settings.showStatusBar) this.statusBar = this.addStatusBarItem();
    this.addRibbonIcon("lock", "Aegis: Lock current note", () => void this.lockCurrentNote());
    this.addCommand({ id: "lock-current-note", name: "Lock current note", callback: () => this.lockCurrentNote() });
    this.addCommand({ id: "unlock-current-note", name: "Unlock current note", callback: () => this.unlockCurrentNote() });
    this.addCommand({ id: "lock-frontmatter-properties", name: "Lock selected frontmatter properties", callback: () => this.lockProperties() });
    this.addCommand({ id: "lock-all-notes", name: "Lock all Markdown notes", callback: () => this.lockAllNotes() });
    this.addCommand({ id: "lock-now", name: "Lock now (clear session)", callback: () => this.lockNow() });
    this.addCommand({ id: "rollback-last-operation", name: "Roll back last operation", callback: () => this.rollbackLastOperation() });
    this.addCommand({ id: "export-encrypted-backup", name: "Export encrypted backup of current note", callback: () => this.exportEncryptedBackup() });
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
    this.settings.settingsMode = this.settings.settingsMode === "advanced" ? "advanced" : "simple";
    this.settings.sessionTimeoutMinutes = Math.max(1, Math.min(120, Number(this.settings.sessionTimeoutMinutes) || 15));
    this.settings.constanceDeviceId = typeof this.settings.constanceDeviceId === "string" ? this.settings.constanceDeviceId : "";
    this.settings.billingEmail = typeof this.settings.billingEmail === "string" ? this.settings.billingEmail : "";
    this.settings.billingAccessToken = typeof this.settings.billingAccessToken === "string" ? this.settings.billingAccessToken : "";
    this.settings.billingRefreshToken = typeof this.settings.billingRefreshToken === "string" ? this.settings.billingRefreshToken : "";
    this.settings.billingAccountLinked = this.settings.billingAccountLinked === true && Boolean(this.settings.billingAccessToken);
    this.settings.freeUsesDay = typeof this.settings.freeUsesDay === "string" ? this.settings.freeUsesDay : "";
    this.settings.freeUsesUsed = Number.isFinite(this.settings.freeUsesUsed) ? Math.max(0, Math.floor(this.settings.freeUsesUsed)) : 0;
    this.settings.purchasedUses = Number.isFinite(this.settings.purchasedUses) ? Math.max(0, Math.floor(this.settings.purchasedUses)) : 0;
    this.settings.pendingProtectionCharges = Array.isArray(this.settings.pendingProtectionCharges) ? this.settings.pendingProtectionCharges.filter((id) => typeof id === "string") : [];
    this.settings.pendingCheckoutKey = typeof this.settings.pendingCheckoutKey === "string" ? this.settings.pendingCheckoutKey : "";
    this.settings.pendingCheckoutPack = typeof this.settings.pendingCheckoutPack === "string" ? this.settings.pendingCheckoutPack : "";
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
    if (!(file instanceof import_obsidian8.TFile) || !isMarkdown(file)) return;
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
    if (this.sessionPassword && Date.now() < this.sessionExpiresAt) {
      this.touchSession();
      return this.sessionPassword;
    }
    new import_obsidian8.Notice("Aegis: set the session password in plugin settings before running this command.");
    return null;
  }
  async passwordForUnlock() {
    if (this.sessionPassword && Date.now() < this.sessionExpiresAt) {
      this.touchSession();
      return this.sessionPassword;
    }
    this.clearSession();
    new import_obsidian8.Notice("Aegis: set the session password in plugin settings before running this command.");
    return null;
  }
  setSessionPassword(password) {
    this.sessionPassword = password || void 0;
    this.touchSession();
  }
  touchSession() {
    this.sessionExpiresAt = Date.now() + this.settings.sessionTimeoutMinutes * 6e4;
  }
  expireSessionIfNeeded() {
    if (this.sessionPassword && Date.now() >= this.sessionExpiresAt) {
      this.clearSession();
      new import_obsidian8.Notice("Aegis session expired. Encrypted notes are locked.");
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
  async retryProtectionPreview() {
    const preview = this.protectionPreview;
    if (!preview) {
      new import_obsidian8.Notice("No protection preview is open.");
      return;
    }
    const reservation = await reserveProtectionUse(this, preview.original, preview.next, preview.eventId);
    if (!reservation) return;
    await this.applyProtectionChange(preview.file, preview.original, preview.next, reservation, preview.success);
  }
  async lockCurrentNote(file = this.currentFile()) {
    if (!file || !isMarkdown(file)) {
      new import_obsidian8.Notice("Aegis: open a Markdown note first.");
      return;
    }
    try {
      const original = await this.app.vault.read(file);
      const parsed = parseMarkdown(original);
      if (asRecord(parsed.frontmatter[AEGIS_KEY])) {
        new import_obsidian8.Notice("Aegis: this note already has protected content.");
        return;
      }
      if (this.settings.reviewBeforeApply && !await new ConfirmModal(this.app, "Review note lock", `The note body will become unreadable to Markdown search and third-party plugins. Its path and frontmatter will remain. A volatile undo record will be held for this session.`, "Continue").waitForResult()) return;
      const password = await this.passwordForNewEncryption();
      if (!password) return;
      const envelope = await encryptText(parsed.body, password);
      const verified = await decryptText(envelope, password);
      if (verified !== parsed.body) throw new Error("Aegis verification failed before the file was changed.");
      const next = serializeMarkdown({ ...parsed.frontmatter, [AEGIS_KEY]: { mode: "note", envelope } }, LOCKED_NOTE_PLACEHOLDER);
      this.protectionPreview = { file, original, next, eventId: jobId(), success: "Aegis: note locked." };
      if (!this.settings.billingAccessToken) {
        new import_obsidian8.Notice("Protection preview: note body would be encrypted; ciphertext is masked. Keep this session open, sign in/verify in settings, then Retry preserved protection. Nothing was written.");
        return;
      }
      await this.retryProtectionPreview();
    } catch (error) {
      notifyFailure(error);
    }
  }
  async lockProperties(file = this.currentFile()) {
    var _a, _b;
    if (!file || !isMarkdown(file)) {
      new import_obsidian8.Notice("Aegis: open a Markdown note first.");
      return;
    }
    try {
      const original = await this.app.vault.read(file);
      const parsed = parseMarkdown(original);
      if (((_a = asRecord(parsed.frontmatter[AEGIS_KEY])) == null ? void 0 : _a.mode) === "note") {
        new import_obsidian8.Notice("Aegis: unlock the note body before protecting properties.");
        return;
      }
      const existing = asRecord(parsed.frontmatter[AEGIS_KEY]);
      const keys = topLevelPropertyNames(parsed.frontmatter).filter((key) => {
        var _a2;
        return !((_a2 = existing == null ? void 0 : existing.properties) == null ? void 0 : _a2[key]);
      });
      if (!keys.length) {
        new import_obsidian8.Notice("Aegis: this note has no top-level frontmatter properties.");
        return;
      }
      const configured = this.settings.protectedProperties.split(/[\n,]/).map((key) => key.trim()).filter(Boolean);
      const chosen = configured.length ? keys.filter((key) => configured.includes(key)) : keys;
      if (!chosen.length) {
        new import_obsidian8.Notice("Aegis: none of the configured frontmatter properties exist in this note.");
        return;
      }
      if (this.settings.reviewBeforeApply && !await new ConfirmModal(this.app, "Review property lock", `Protect ${chosen.length} frontmatter propert${chosen.length === 1 ? "y" : "ies"}? Names stay visible; values will be replaced with a non-sensitive placeholder.`, "Continue").waitForResult()) return;
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
      this.protectionPreview = { file, original, next, eventId: jobId(), success: `Aegis: protected ${chosen.length} properties.` };
      if (!this.settings.billingAccessToken) {
        new import_obsidian8.Notice("Protection preview: selected properties would be encrypted; ciphertext is masked. Keep this session open, sign in/verify in settings, then Retry preserved protection. Nothing was written.");
        return;
      }
      await this.retryProtectionPreview();
    } catch (error) {
      notifyFailure(error);
    }
  }
  async unlockCurrentNote(file = this.currentFile()) {
    if (!file || !isMarkdown(file)) {
      new import_obsidian8.Notice("Aegis: open a Markdown note first.");
      return;
    }
    try {
      const original = await this.app.vault.read(file);
      const parsed = parseMarkdown(original);
      const record = asRecord(parsed.frontmatter[AEGIS_KEY]);
      if (!record) {
        new import_obsidian8.Notice("Aegis: this note is not locked.");
        return;
      }
      if (this.settings.reviewBeforeApply && !await new ConfirmModal(this.app, "Review unlock", "The encrypted record will be verified before the note is replaced. Nothing changes if the password is wrong or the file changed on disk.", "Continue").waitForResult()) return;
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
      new import_obsidian8.Notice("Aegis: note unlocked.");
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
        new import_obsidian8.Notice("Aegis: no unlocked Markdown notes found.");
        return;
      }
      if (this.settings.reviewBeforeApply && !await new ConfirmModal(this.app, "Review lock-all operation", `${candidates.length} Markdown notes will be encrypted. Each file is checked for sync conflicts and verified before replacement.`, "Continue").waitForResult()) return;
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
          const reservation = await reserveProtectionUse(this, original, next);
          if (!reservation) {
            progress.cancelled = true;
            break;
          }
          if (await this.applyProtectionChange(file, original, next, reservation, "", false)) {
            entries.push({ path: file.path, original, resulting: next });
          }
        } catch (error) {
          new import_obsidian8.Notice(`Aegis skipped ${file.path}: ${error instanceof Error ? error.message : "operation failed"}`);
        }
      }
      progress.update(entries.length, progress.cancelled ? "Cancelled" : "Complete");
      progress.close();
      this.activeProgress = void 0;
      if (entries.length) this.undoRecord = { createdAt: Date.now(), entries };
      new import_obsidian8.Notice(`Aegis: locked ${entries.length} note(s)${progress.cancelled ? " before cancellation" : ""}.`);
    } catch (error) {
      (_a = this.activeProgress) == null ? void 0 : _a.close();
      this.activeProgress = void 0;
      notifyFailure(error);
    }
  }
  async exportEncryptedBackup(file = this.currentFile()) {
    if (!file || !isMarkdown(file)) {
      new import_obsidian8.Notice("Aegis: open a Markdown note first.");
      return;
    }
    try {
      const original = await this.app.vault.read(file);
      if (this.settings.reviewBeforeApply && !await new ConfirmModal(this.app, "Export encrypted backup", "Aegis will write an encrypted copy into the configured vault backup folder. The backup will not contain your password.", "Continue").waitForResult()) return;
      const password = await this.passwordForNewEncryption();
      if (!password) return;
      const envelope = await encryptText(original, password);
      const backupResult = JSON.stringify({ v: 1, sourceHash: await sha256Hex(file.path), sourcePath: file.path, envelope }, null, 2);
      const newProtection = !asRecord(parseMarkdown(original).frontmatter[AEGIS_KEY]);
      const reservation = newProtection ? await reserveProtectionUse(this, original, backupResult) : null;
      if (newProtection && !reservation) return;
      const folder = this.settings.backupFolder.replace(/^\/+|\/+$/g, "") || ".aegis-backups";
      if (!await this.app.vault.adapter.exists(folder)) await this.app.vault.adapter.mkdir(folder);
      const pathDigest = (await sha256Hex(file.path)).slice(0, 16);
      const backupPath = `${folder}/${pathDigest}-${Date.now()}.aegis`;
      if ((reservation == null ? void 0 : reservation.markWriting) && !await reservation.markWriting([{ path: backupPath, after: await digest(backupResult) }])) return;
      await this.app.vault.adapter.write(backupPath, backupResult);
      if (await this.app.vault.adapter.read(backupPath) !== backupResult) throw new Error("Backup write uncertain; reservation retained.");
      const committed = await (reservation == null ? void 0 : reservation.commit());
      if ((committed == null ? void 0 : committed.kind) === "pending") new import_obsidian8.Notice("Encrypted backup saved; its original reservation is pending reconciliation.");
      new import_obsidian8.Notice(`Aegis: encrypted backup written to ${backupPath}.`);
    } catch (error) {
      notifyFailure(error);
    }
  }
  async rollbackLastOperation() {
    const record = this.undoRecord;
    if (!(record == null ? void 0 : record.entries.length)) {
      new import_obsidian8.Notice("Aegis: no volatile undo record is available.");
      return;
    }
    if (this.settings.reviewBeforeApply && !await new ConfirmModal(this.app, "Roll back last Aegis operation", `Restore ${record.entries.length} original note(s)? Aegis will refuse if any file changed since the operation.`, "Roll back").waitForResult()) return;
    let restored = 0;
    const remaining = [];
    for (const entry of record.entries) {
      const file = this.app.vault.getAbstractFileByPath(entry.path);
      if (!(file instanceof import_obsidian8.TFile)) {
        remaining.push(entry);
        continue;
      }
      try {
        await this.atomicChange(file, entry.resulting, entry.original, false);
        restored++;
      } catch (e) {
        remaining.push(entry);
        new import_obsidian8.Notice(`Aegis: rollback refused for ${entry.path} because it changed.`);
      }
    }
    this.undoRecord = remaining.length ? { ...record, entries: remaining } : void 0;
    new import_obsidian8.Notice(`Aegis: rolled back ${restored} note(s)${remaining.length ? `; ${remaining.length} still available to retry` : ""}.`);
  }
  async atomicChange(file, expected, next, recordUndo = true) {
    const current = await this.app.vault.read(file);
    assertNoConflict(expected, current);
    const tempPath = temporaryPath(file.path);
    try {
      await this.app.vault.adapter.write(tempPath, next);
      const staged = await this.app.vault.adapter.read(tempPath);
      if (staged !== next) throw new Error("Staged file verification failed.");
      await this.app.vault.process(file, (latest) => {
        assertNoConflict(expected, latest);
        return staged;
      });
      await this.app.vault.adapter.remove(tempPath);
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
      if (reservation.markWriting && !await reservation.markWriting([{ path: file.path, before: await digest(original), after: await digest(next) }])) return true;
      await this.atomicChange(file, original, next, recordUndo);
      const result = await reservation.commit();
      if (result.kind === "insufficient") {
        try {
          await this.atomicChange(file, next, original, false);
        } catch (rollbackError) {
          throw new Error(`Aegis could not confirm the protection charge or restore the note safely: ${rollbackError instanceof Error ? rollbackError.message : "rollback failed"}`);
        }
        new import_obsidian8.Notice("Aegis: no purchased use was available; the note was left unchanged.");
        return false;
      }
      if (successNotice) {
        new import_obsidian8.Notice(result.kind === "pending" ? `${successNotice} Billing will retry the purchased-use charge.` : successNotice);
      }
      return true;
    } catch (error) {
      await reservation.rollback();
      throw error;
    }
  }
};
