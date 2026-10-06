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

// publish/src/diagnostics.ts
function isPromise(value) {
  return value != null && Object.prototype.toString.call(value) === "[object Promise]";
}
function isError(value) {
  return value instanceof Error || Object.prototype.toString.call(value) === "[object Error]";
}
function report(stage, error) {
  try {
    const failure = isError(error) ? error : new Error(String(error));
    if (!isError(error)) Object.defineProperty(failure, "cause", { value: error, configurable: true });
    if (sink) sink.error(stage + ".failed", failure);
    else console.error("[Plugin diagnostics] " + stage + ".failed", failure);
  } catch (e) {
  }
}
var sink, enabled, span, repetitions, noop, diagnostics;
var init_diagnostics = __esm({
  "publish/src/diagnostics.ts"() {
    "use strict";
    enabled = () => false;
    span = 0;
    repetitions = /* @__PURE__ */ new Map();
    noop = () => {
    };
    diagnostics = {
      attach(target, isEnabled) {
        sink = target;
        enabled = isEnabled;
        repetitions.clear();
      },
      detach(target) {
        if (sink === target) {
          sink = void 0;
          enabled = () => false;
        }
      },
      start(stage) {
        try {
          if (!sink || !enabled()) return noop;
          const started = performance.now();
          const previous = repetitions.get(stage);
          if (previous && started - previous.at < 1e3) {
            if (++previous.count > 4) return noop;
          } else {
            if (repetitions.size >= 512) repetitions.delete(repetitions.keys().next().value);
            repetitions.set(stage, { at: started, count: 1 });
          }
          const id = ++span, target = sink;
          target.info(stage + ".start", { span: id });
          return () => {
            try {
              target.info(stage + ".end", { span: id, elapsedMs: Math.round(performance.now() - started) });
            } catch (e) {
            }
          };
        } catch (e) {
          return noop;
        }
      },
      run(stage, action) {
        const end = this.start(stage);
        try {
          const result = action();
          if (isPromise(result)) {
            return result.then((value) => {
              end();
              return value;
            }, (error) => {
              this.failure(stage, error);
              end();
              throw error;
            });
          }
          end();
          return result;
        } catch (error) {
          this.failure(stage, error);
          end();
          throw error;
        }
      },
      /** Consume failures only where Obsidian invokes us; internal operations keep rejecting. */
      guard(stage, action, fallback) {
        const recover2 = (error) => {
          var _a;
          this.failure(stage, error);
          if (!(isError(error) && error.name === "AbortError")) {
            try {
              (_a = sink == null ? void 0 : sink.notifyFailure) == null ? void 0 : _a.call(sink, stage);
            } catch (e) {
            }
          }
          return fallback;
        };
        try {
          const result = action();
          return isPromise(result) ? result.catch(recover2) : result;
        } catch (error) {
          return recover2(error);
        }
      },
      wrap(stage, callback, fallback) {
        return function(...args) {
          return diagnostics.guard(stage, () => callback.apply(this, args), fallback);
        };
      },
      request(stage, action, ...args) {
        return this.run(stage, () => {
          const result = action(...args);
          const reportStatus = (value) => {
            const status = value == null ? void 0 : value.status;
            if (typeof status === "number" && status >= 400) {
              const error = new Error("HTTP request failed with status " + status);
              error.httpStatus = status;
              if (sink) {
                try {
                  sink.error(stage + ".http_failed", error);
                } catch (e) {
                }
              } else report(stage + ".http_failed", error);
            }
          };
          if (isPromise(result)) return result.then((value) => {
            reportStatus(value);
            return value;
          });
          reportStatus(result);
          return result;
        });
      },
      failure(stage, error) {
        if (isError(error) && error.name === "AbortError") {
          try {
            sink == null ? void 0 : sink.info(stage + ".cancelled");
          } catch (e) {
          }
        } else report(stage, error != null ? error : new Error("Operation failed"));
      },
      legacy(level, stage) {
        try {
          if (level === "info") sink == null ? void 0 : sink.info(stage);
          else sink == null ? void 0 : sink.error(stage, { outcome: "failed" });
        } catch (e) {
        }
      }
    };
  }
});

// publish/src/settings-layout.ts
function label(node) {
  var _a;
  return (((_a = node.querySelector(".setting-item-name")) == null ? void 0 : _a.textContent) || node.textContent || "").trim();
}
function makeSection(root, title, kind = "everyday") {
  const section = root.createEl("section", { cls: `ui-settings-section ui-section-${kind}` });
  section.createEl("h3", { text: title, cls: "ui-section-heading" });
  return section.createDiv({ cls: "ui-settings-card" });
}
function applySettingsLayout(root, appId) {
  var _a, _b;
  if (root.querySelector(":scope > .ui-settings-section")) return;
  root.addClass("ui-settings-layout");
  const nodes = Array.from(root.children);
  const account = nodes.find((node) => node.classList.contains("constance-account-billing-section"));
  let accountCard;
  if (account) {
    account.addClass("ui-settings-section", "ui-section-billing");
    const heading = account.querySelector(":scope > h3");
    heading == null ? void 0 : heading.addClass("ui-section-heading");
    const content = Array.from(account.children).filter((node) => node !== heading);
    accountCard = account.createDiv({ cls: "ui-settings-card" });
    content.forEach((node) => accountCard.appendChild(node));
    accountCard.querySelectorAll("button").forEach((button) => {
      var _a2;
      if (((_a2 = button.textContent) == null ? void 0 : _a2.trim()) === "Connect") button.addClass("mod-cta");
    });
  }
  const title = nodes.find((node) => /^H[12]$/.test(node.tagName)) || (appTitles[appId] ? root.createEl("h2", { text: appTitles[appId] }) : void 0);
  if (title) {
    title.addClass("ui-settings-title");
    root.prepend(title);
  }
  if (account) {
    if (title) title.after(account);
    else root.prepend(account);
  }
  let current;
  let support;
  let viewSection;
  let billingContext = false;
  const supportLabels = /* @__PURE__ */ new Set(["Help", "Debug logging", "Enable debug logging", "Diagnostics"]);
  const billingLabels = /^(?:Billing(?: & usage)?|Credits|Credit balance|OCR credits|Purchased balance|Refresh (?:purchased )?balance|Refresh account|Buy .+|Account)$/i;
  for (const node of nodes) {
    if (node === account || node === title) continue;
    const name = label(node);
    if (node.classList.contains("setting-item") && supportLabels.has(name)) {
      support || (support = makeSection(root, "Help and diagnostics", "support"));
      support.appendChild(node);
      continue;
    }
    if (node.classList.contains("setting-item") && /^Settings (?:mode|view)$/i.test(name)) {
      const view = makeSection(root, "Settings view");
      view.appendChild(node);
      viewSection = view.parentElement;
      continue;
    }
    const isHeading = /^H[1-4]$/.test(node.tagName) || node.classList.contains("setting-item-heading");
    if (isHeading) {
      billingContext = /^Billing(?: & usage)?$/i.test(name);
      if (billingContext) {
        node.remove();
        continue;
      }
      const kind = /recovery|privacy|diagnostic/i.test(name) ? "support" : /AI|quality|naming|capture|date|original files/i.test(name) ? "feature" : "everyday";
      current = makeSection(root, name, kind);
      node.remove();
      continue;
    }
    if (accountCard && (node.classList.contains("ui-billing-packs") || node.classList.contains("ui-billing-summary") || node.classList.contains("setting-item") && billingLabels.test(name) || billingContext && node.tagName === "P")) {
      accountCard.appendChild(node);
      if (node.tagName === "P") node.addClass("ui-billing-summary");
      continue;
    }
    billingContext = false;
    current || (current = makeSection(root, "Everyday settings"));
    current.appendChild(node);
    if (node.tagName === "P") node.addClass("ui-section-note");
  }
  if (viewSection) {
    if (account) account.after(viewSection);
    else if (title) title.after(viewSection);
    else root.prepend(viewSection);
  }
  if (support) root.appendChild(support.parentElement);
  for (const card of Array.from(root.querySelectorAll(".ui-settings-card"))) {
    if (!card.children.length) (_a = card.parentElement) == null ? void 0 : _a.remove();
  }
  const rows = Array.from(root.querySelectorAll(".ui-settings-card .setting-item")).filter((node) => !node.closest(".ui-section-billing, .ui-section-support") && !/^Settings (mode|view)$/i.test(label(node)));
  const limit = Math.max(1, Math.ceil(rows.length * 0.1));
  let marked = 0;
  for (const name of keySettings[appId] || []) {
    const row = rows.find((node) => label(node) === name);
    if (!row || marked >= limit) continue;
    row.classList.add("ui-key-setting");
    const badge = document.createElement("span");
    badge.className = "ui-key-badge";
    badge.textContent = "Important";
    (_b = row.querySelector(".setting-item-name")) == null ? void 0 : _b.appendChild(badge);
    marked++;
  }
}
var keySettings, appTitles;
var init_settings_layout = __esm({
  "publish/src/settings-layout.ts"() {
    "use strict";
    keySettings = {
      "culebra-ai-spell-correct": ["Review before applying"],
      "denali-ai-file-renamer-front-matter": ["Rename new notes automatically", "Review before applying"],
      "garda-handwriting-text-ocr": ["AI connection"],
      "torbert-text-ai-obsidian": ["Review before applying", "AI classification folders", "Custom prompt presets", "OpenRouter API key"],
      "kairo-quick-capture": ["Destination mode", "Automatic delivery"],
      "cairn-vault-linter": ["Review repairs before applying", "Ignored folders"],
      "tundra-frontmatter-wrangler": ["Existing AI properties", "Review before applying"],
      "meridian-timeline": ["Date properties"],
      "aegis-note-locker": ["Session password", "Session timeout"],
      "mica-webp-optimizer": ["Automatic optimization", "After conversion", "Watched folders"]
    };
    appTitles = {
      "kairo-quick-capture": "Kairo Quick Capture",
      "culebra-ai-spell-correct": "Culebra AI Spell Correct"
    };
  }
});

// publish/src/account-guidance.ts
function renderAccountGuidance(section, host) {
  var _a;
  const diagnosticAction1 = () => {
    const guide = section.createDiv({ cls: "ui-account-intro" });
    guide.createEl("h4", { text: host.connected ? "Ready to use" : "Get started" });
    if (host.connected) {
      guide.createEl("p", { text: host.workflow });
      return;
    }
    guide.createEl("p", { text: "Enter your email and password below, then choose Connect to sign in or create an account." });
    const label2 = guide.createEl("p", { text: `Free credits: ${host.defaultAllowance.toLocaleString()} ${host.unit} per account. Connect to check what remains.` });
    const help = guide.createEl("details");
    help.createEl("summary", { text: "Email not received?" });
    help.createEl("p", { text: "Check spam and confirm the email address below. Use the emailed verification link, return here, and Connect again. Correct the email below if needed. If the link expired or no email arrived, open your account page for available recovery options." });
    help.createEl("a", { text: "Open account page", href: "https://app.tutivsoft.com", attr: { target: "_blank", rel: "noopener noreferrer" } });
    help.createEl("p", { text: "Forgot your password? Use the reset link below. Do not create another account to restore purchases." });
    const details = guide.createEl("details");
    details.createEl("summary", { text: "About the allowance and purchases" });
    details.createEl("p", { text: host.workflow });
    details.createEl("p", { text: "Connect your account to load your free and purchased credits. Free credits are used first, then purchased credits. Your balance stays with your account after reinstalling. Current quantities and prices are shown in Account." });
    void diagnostics.guard("account-guidance.background_1", () => {
      var _a2, _b, _c;
      return ((_c = (_b = (_a2 = diagnostics) == null ? void 0 : _a2.request) == null ? void 0 : _b.call(_a2, "network.account-guidance.renderAccountGuidance", import_obsidian3.requestUrl, { url: `https://app.tutivsoft.com/api/v1/billing/policy?app_id=${encodeURIComponent(host.appId)}`, method: "GET", throw: false })) != null ? _c : (0, import_obsidian3.requestUrl)({ url: `https://app.tutivsoft.com/api/v1/billing/policy?app_id=${encodeURIComponent(host.appId)}`, method: "GET", throw: false })).then((response) => {
        var _a3, _b2;
        const p = response.status === 200 ? (_b2 = (_a3 = response.json) == null ? void 0 : _a3.data) == null ? void 0 : _b2.account_free_usage : null;
        if (!p || !Number.isFinite(p.allowance) || p.allowance < 0) return;
        const unit = String(p.unit).replace(/_/g, " ");
        label2.setText(p.enabled ? `Free credits: ${Number(p.allowance).toLocaleString()} ${unit} per account. Connect to check what remains.` : "Connect to check your account access and available credits.");
      }).catch((rejectedError1) => {
        diagnostics.failure("account-guidance.rejected_2", rejectedError1);
      });
    });
  };
  return ((_a = diagnostics) == null ? void 0 : _a.run) ? diagnostics.run("account-guidance.renderAccountGuidance", diagnosticAction1) : diagnosticAction1();
}
var import_obsidian3;
var init_account_guidance = __esm({
  "publish/src/account-guidance.ts"() {
    "use strict";
    init_diagnostics();
    import_obsidian3 = require("obsidian");
  }
});

// publish/src/billing-checkout.ts
var billing_checkout_exports = {};
__export(billing_checkout_exports, {
  openAccountCheckout: () => openAccountCheckout,
  openAccountCheckoutByPrice: () => openAccountCheckoutByPrice,
  resumeAccountCheckout: () => resumeAccountCheckout
});
async function send(host, path, method, body, key) {
  var _a, _b, _c, _d, _e;
  const diagnosticEnd1 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "billing-checkout.send")) != null ? _c : (() => {
  });
  try {
    const request = () => {
      var _a2, _b2, _c2;
      return (_c2 = (_b2 = (_a2 = diagnostics) == null ? void 0 : _a2.request) == null ? void 0 : _b2.call(_a2, "network.billing-checkout.send", import_obsidian4.requestUrl, {
        url: `https://app.tutivsoft.com/api/v1/billing/${path}`,
        method,
        throw: false,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${host.state.billingAccessToken}`, ...key ? { "Idempotency-Key": key } : {} },
        ...body ? { body: JSON.stringify(body) } : {}
      })) != null ? _c2 : (0, import_obsidian4.requestUrl)({
        url: `https://app.tutivsoft.com/api/v1/billing/${path}`,
        method,
        throw: false,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${host.state.billingAccessToken}`, ...key ? { "Idempotency-Key": key } : {} },
        ...body ? { body: JSON.stringify(body) } : {}
      });
    };
    let response = await request();
    if (response.status === 401 && await host.refreshSession()) response = await request();
    return await response;
  } catch (diagnosticError1) {
    (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "billing-checkout.send", diagnosticError1);
    throw diagnosticError1;
  } finally {
    diagnosticEnd1();
  }
}
function resumeAccountCheckout(host) {
  var _a;
  if (!host.state.pendingAccountCheckout || !host.state.billingAccountLinked || host.state.pendingAccountCheckout.email !== host.state.billingEmail || timers.has(host.state)) return;
  const timer = setTimeout(() => {
    return diagnostics.guard("billing-checkout.timer_1", () => {
      timers.delete(host.state);
      if (running.has(host.state)) {
        resumeAccountCheckout(host);
        return;
      }
      const operation = recover(host);
      running.set(host.state, operation);
      void diagnostics.guard("billing-checkout.background_2", () => operation.catch((rejectedError1) => {
        diagnostics.failure("billing-checkout.rejected_2", rejectedError1);
        return void 0;
      }).finally(() => {
        running.delete(host.state);
        resumeAccountCheckout(host);
      }));
    });
  }, 15e3);
  timers.set(host.state, timer);
  (_a = timer.unref) == null ? void 0 : _a.call(timer);
}
async function recover(host) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const diagnosticEnd2 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "billing-checkout.recover")) != null ? _c : (() => {
  });
  try {
    const pending = host.state.pendingAccountCheckout;
    if (!pending || !host.state.billingAccountLinked || pending.email !== host.state.billingEmail) return;
    if (!pending.checkoutId) {
      const route = pending.priceId ? "checkout-price" : "checkout";
      const selection = pending.priceId ? { price_id: pending.priceId } : { plan_code: pending.plan };
      const response2 = await send(host, route, "POST", { app_id: host.appId, installation_id: host.installationId, ...selection, quantity: 1 }, pending.key);
      if (host.state.pendingAccountCheckout !== pending || pending.email !== host.state.billingEmail) return;
      if (response2.status < 200 || response2.status >= 300 || !((_e = (_d = response2.json) == null ? void 0 : _d.data) == null ? void 0 : _e.checkout_id)) return;
      pending.checkoutId = String(response2.json.data.checkout_id);
      await host.persist();
    }
    const response = await send(host, `checkouts/${encodeURIComponent(pending.checkoutId)}`, "GET");
    if (host.state.pendingAccountCheckout !== pending || pending.email !== host.state.billingEmail) return;
    if (response.status < 200 || response.status >= 300) return;
    const data = (_f = response.json) == null ? void 0 : _f.data;
    if ((data == null ? void 0 : data.settled) || ["completed", "fulfilled", "failed", "canceled", "cancelled", "expired"].includes(data == null ? void 0 : data.status)) {
      await host.syncBalance();
      if (host.state.pendingAccountCheckout !== pending || pending.email !== host.state.billingEmail) return;
      host.state.pendingAccountCheckout = null;
      await host.persist();
    }
  } catch (diagnosticError2) {
    (_h = (_g = diagnostics) == null ? void 0 : _g.failure) == null ? void 0 : _h.call(_g, "billing-checkout.recover", diagnosticError2);
    throw diagnosticError2;
  } finally {
    diagnosticEnd2();
  }
}
async function startAccountCheckout(host, selection) {
  var _a, _b, _c, _d, _e;
  const diagnosticEnd3 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "billing-checkout.startAccountCheckout")) != null ? _c : (() => {
  });
  try {
    if (running.has(host.state)) return await running.get(host.state);
    const operation = (async () => {
      var _a2, _b2, _c2, _d2, _e2, _f;
      const diagnosticEnd4 = (_c2 = (_b2 = (_a2 = diagnostics) == null ? void 0 : _a2.start) == null ? void 0 : _b2.call(_a2, "billing-checkout.background.3712")) != null ? _c2 : (() => {
      });
      try {
        if (!host.state.billingAccountLinked) {
          new import_obsidian4.Notice("Connect your account first.");
          return;
        }
        const saved = host.state.pendingAccountCheckout;
        if (saved && (selection.priceId && saved.priceId !== selection.priceId || selection.plan && saved.plan !== selection.plan || saved.email !== host.state.billingEmail)) {
          new import_obsidian4.Notice("A purchase is pending. Its status will refresh automatically before you can start another.");
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
          const checkout = (_d2 = response.json) == null ? void 0 : _d2.data;
          if (response.status < 200 || response.status >= 300 || !(checkout == null ? void 0 : checkout.checkout_id)) {
            new import_obsidian4.Notice("Checkout could not be confirmed. Retry the same purchase to recover it safely.");
            return;
          }
          pending.checkoutId = String(checkout.checkout_id);
          await host.persist();
          if (typeof checkout.checkout_url === "string" && checkout.checkout_url) {
            window.open(checkout.checkout_url, "_blank", "noopener");
            new import_obsidian4.Notice("Complete payment in your browser. Your balance will update automatically.");
          } else {
            new import_obsidian4.Notice("Checkout is still being confirmed. Its status will refresh automatically.");
          }
        } catch (caughtError3) {
          diagnostics.failure("billing-checkout.caught_4", caughtError3);
          new import_obsidian4.Notice("Checkout could not be confirmed. Retry the same purchase to recover it safely.");
        } finally {
          resumeAccountCheckout(host);
        }
      } catch (diagnosticError4) {
        (_f = (_e2 = diagnostics) == null ? void 0 : _e2.failure) == null ? void 0 : _f.call(_e2, "billing-checkout.background.3712", diagnosticError4);
        throw diagnosticError4;
      } finally {
        diagnosticEnd4();
      }
    })();
    running.set(host.state, operation);
    try {
      await operation;
    } finally {
      running.delete(host.state);
    }
  } catch (diagnosticError3) {
    (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "billing-checkout.startAccountCheckout", diagnosticError3);
    throw diagnosticError3;
  } finally {
    diagnosticEnd3();
  }
}
function openAccountCheckoutByPrice(host, priceId) {
  return startAccountCheckout(host, { priceId });
}
function openAccountCheckout(host, plan) {
  return startAccountCheckout(host, { plan });
}
var import_obsidian4, running, timers;
var init_billing_checkout = __esm({
  "publish/src/billing-checkout.ts"() {
    "use strict";
    init_diagnostics();
    import_obsidian4 = require("obsidian");
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
  var _a, _b, _c, _d, _e;
  const diagnosticEnd1 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "constance-account.linkAuthenticatedInstallation")) != null ? _c : (() => {
  });
  try {
    try {
      await linkInstallation(adapter, token);
    } catch (error) {
      diagnostics.failure("constance-account.caught_1", error);
      if (error instanceof ConstanceAccountError && error.status === 401) {
        adapter.state.billingAccessToken = "";
        adapter.state.billingRefreshToken = "";
        adapter.state.billingAccountLinked = false;
        await adapter.persist();
      }
      throw error;
    }
  } catch (diagnosticError1) {
    (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "constance-account.linkAuthenticatedInstallation", diagnosticError1);
    throw diagnosticError1;
  } finally {
    diagnosticEnd1();
  }
}
async function authenticate(mode, email, password, installationId) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
  const diagnosticEnd2 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "constance-account.authenticate")) != null ? _c : (() => {
  });
  try {
    const body = mode !== "login" ? { email, password, external_customer_id: installationId } : { email, password };
    const response = await ((_f = (_e = (_d = diagnostics) == null ? void 0 : _d.request) == null ? void 0 : _e.call(_d, "network.constance-account.authenticate", import_obsidian5.requestUrl, {
      url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/auth/${mode}`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      throw: false
    })) != null ? _f : (0, import_obsidian5.requestUrl)({
      url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/auth/${mode}`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      throw: false
    }));
    if (response.status < 200 || response.status >= 300) {
      throw new ConstanceAccountError(errorDetail(response, `Could not connect your account. Check your connection and try again.`), response.status);
    }
    const accessToken = String(((_g = response.json) == null ? void 0 : _g.access_token) || "");
    if (!accessToken && ((_h = response.json) == null ? void 0 : _h.verification_required)) {
      throw new Error("Account created. Verify your email, then sign in.");
    }
    const refreshToken = String(((_i = response.json) == null ? void 0 : _i.refresh_token) || "");
    if (!accessToken || !refreshToken) throw new Error("Could not complete sign-in. Try connecting again.");
    return { accessToken, refreshToken };
  } catch (diagnosticError2) {
    (_k = (_j = diagnostics) == null ? void 0 : _j.failure) == null ? void 0 : _k.call(_j, "constance-account.authenticate", diagnosticError2);
    throw diagnosticError2;
  } finally {
    diagnosticEnd2();
  }
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
  var _a, _b, _c, _d, _e;
  const diagnosticEnd3 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "constance-account.refreshBillingSession")) != null ? _c : (() => {
  });
  try {
    persist != null ? persist : persist = billingPersisters.get(state);
    const pending = billingRefreshes.get(state);
    if (pending) {
      const ok = await pending;
      if (ok) await (persist == null ? void 0 : persist());
      return await ok;
    }
    const original = state.billingRefreshToken;
    if (!original) return false;
    const operation = (async () => {
      var _a2, _b2, _c2, _d2, _e2, _f, _g, _h, _i, _j;
      const diagnosticEnd4 = (_c2 = (_b2 = (_a2 = diagnostics) == null ? void 0 : _a2.start) == null ? void 0 : _b2.call(_a2, "constance-account.background.4476")) != null ? _c2 : (() => {
      });
      try {
        try {
          const response = await ((_f = (_e2 = (_d2 = diagnostics) == null ? void 0 : _d2.request) == null ? void 0 : _e2.call(_d2, "network.constance-account.refreshBillingSession", import_obsidian5.requestUrl, {
            url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/auth/refresh`,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: original }),
            throw: false
          })) != null ? _f : (0, import_obsidian5.requestUrl)({
            url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/auth/refresh`,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: original }),
            throw: false
          }));
          if (state.billingRefreshToken !== original) return false;
          if (response.status === 401 || response.status === 403) {
            state.billingAccessToken = "";
            state.billingRefreshToken = "";
            state.billingAccountLinked = false;
            await (persist == null ? void 0 : persist());
            return false;
          }
          if (response.status < 200 || response.status >= 300) return false;
          const access = String(((_g = response.json) == null ? void 0 : _g.access_token) || "");
          const refresh = String(((_h = response.json) == null ? void 0 : _h.refresh_token) || "");
          if (!access || !refresh) return false;
          state.billingAccessToken = access;
          state.billingRefreshToken = refresh;
          await (persist == null ? void 0 : persist());
          return true;
        } catch (caughtError2) {
          diagnostics.failure("constance-account.caught_3", caughtError2);
          return false;
        }
      } catch (diagnosticError4) {
        (_j = (_i = diagnostics) == null ? void 0 : _i.failure) == null ? void 0 : _j.call(_i, "constance-account.background.4476", diagnosticError4);
        throw diagnosticError4;
      } finally {
        diagnosticEnd4();
      }
    })();
    billingRefreshes.set(state, operation);
    try {
      return await operation;
    } finally {
      billingRefreshes.delete(state);
    }
  } catch (diagnosticError3) {
    (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "constance-account.refreshBillingSession", diagnosticError3);
    throw diagnosticError3;
  } finally {
    diagnosticEnd3();
  }
}
async function requestAuthenticatedBilling(state, options) {
  var _a, _b, _c, _d, _e;
  const diagnosticEnd5 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "constance-account.requestAuthenticatedBilling")) != null ? _c : (() => {
  });
  try {
    const send2 = () => {
      var _a2, _b2, _c2;
      return (_c2 = (_b2 = (_a2 = diagnostics) == null ? void 0 : _a2.request) == null ? void 0 : _b2.call(_a2, "network.constance-account.requestAuthenticatedBilling", import_obsidian5.requestUrl, {
        ...options,
        headers: {
          ...options.headers || {},
          ...state.billingAccessToken ? { Authorization: `Bearer ${state.billingAccessToken}` } : {}
        },
        throw: false
      })) != null ? _c2 : (0, import_obsidian5.requestUrl)({
        ...options,
        headers: {
          ...options.headers || {},
          ...state.billingAccessToken ? { Authorization: `Bearer ${state.billingAccessToken}` } : {}
        },
        throw: false
      });
    };
    let response = await send2();
    if (response.status === 401 && state.billingRefreshToken) {
      const hadRefreshToken = Boolean(state.billingRefreshToken);
      if (await refreshBillingSession(state)) response = await send2();
      else if (hadRefreshToken && state.billingRefreshToken) return { ...response, status: 503 };
    }
    return await response;
  } catch (diagnosticError5) {
    (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "constance-account.requestAuthenticatedBilling", diagnosticError5);
    throw diagnosticError5;
  } finally {
    diagnosticEnd5();
  }
}
async function linkInstallation(adapter, token) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const diagnosticEnd6 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "constance-account.linkInstallation")) != null ? _c : (() => {
  });
  try {
    const response = await ((_f = (_e = (_d = diagnostics) == null ? void 0 : _d.request) == null ? void 0 : _e.call(_d, "network.constance-account.linkInstallation", import_obsidian5.requestUrl, {
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
    })) != null ? _f : (0, import_obsidian5.requestUrl)({
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
    }));
    if (response.status < 200 || response.status >= 300) {
      throw new ConstanceAccountError(errorDetail(response, `Could not connect this installation to your account. Try connecting again.`), response.status);
    }
  } catch (diagnosticError6) {
    (_h = (_g = diagnostics) == null ? void 0 : _g.failure) == null ? void 0 : _h.call(_g, "constance-account.linkInstallation", diagnosticError6);
    throw diagnosticError6;
  } finally {
    diagnosticEnd6();
  }
}
async function signInBillingAccount(adapter, password, mode) {
  var _a, _b, _c, _d, _e;
  const diagnosticEnd7 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "constance-account.signInBillingAccount")) != null ? _c : (() => {
  });
  try {
    const email = adapter.state.billingEmail.trim().toLowerCase();
    const journalState = adapter.state;
    const owner = String(journalState.pendingBillingOwnerEmail || "").toLowerCase();
    if (owner && owner !== email) throw new Error(`A pending action belongs to ${owner}. Connect that account to resume it first.`);
    if (!email || !email.includes("@")) throw new Error("Enter a valid email address.");
    if (Array.from(password).length < 8 || Array.from(password).length > 128) throw new Error("Password must be between 8 and 128 characters.");
    if (!adapter.installationId) throw new Error("The plugin is still starting. Try again shortly.");
    let tokens;
    try {
      tokens = await authenticate(mode, email, password, adapter.installationId);
    } catch (error) {
      diagnostics.failure("constance-account.caught_4", error);
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
  } catch (diagnosticError7) {
    (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "constance-account.signInBillingAccount", diagnosticError7);
    throw diagnosticError7;
  } finally {
    diagnosticEnd7();
  }
}
async function signOutBillingAccount(adapter) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
  const diagnosticEnd8 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "constance-account.signOutBillingAccount")) != null ? _c : (() => {
  });
  try {
    const refreshToken = adapter.state.billingRefreshToken;
    const accessToken = adapter.state.billingAccessToken;
    try {
      if (refreshToken || accessToken) {
        await ((_f = (_e = (_d = diagnostics) == null ? void 0 : _d.request) == null ? void 0 : _e.call(_d, "network.constance-account.signOutBillingAccount", import_obsidian5.requestUrl, {
          url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/auth/logout`,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
          },
          body: JSON.stringify({ refresh_token: refreshToken || void 0 }),
          throw: false
        })) != null ? _f : (0, import_obsidian5.requestUrl)({
          url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/auth/logout`,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
          },
          body: JSON.stringify({ refresh_token: refreshToken || void 0 }),
          throw: false
        }));
      }
    } catch (error) {
      diagnostics.failure("constance-account.caught_extra_1", error);
      (_h = (_g = diagnostics) == null ? void 0 : _g.legacy) == null ? void 0 : _h.call(_g, "warn", "constance-account.constance_account_logout_could_not_reach_the_server");
    } finally {
      adapter.state.billingAccessToken = "";
      adapter.state.billingRefreshToken = "";
      adapter.state.billingAccountLinked = false;
      adapter.state.billingRegistrationPending = false;
      await adapter.persist();
    }
  } catch (diagnosticError8) {
    (_j = (_i = diagnostics) == null ? void 0 : _i.failure) == null ? void 0 : _j.call(_i, "constance-account.signOutBillingAccount", diagnosticError8);
    throw diagnosticError8;
  } finally {
    diagnosticEnd8();
  }
}
async function validateBillingSession(adapter) {
  var _a, _b, _c, _d, _e;
  const diagnosticEnd9 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "constance-account.validateBillingSession")) != null ? _c : (() => {
  });
  try {
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
    return await valid;
  } catch (diagnosticError9) {
    (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "constance-account.validateBillingSession", diagnosticError9);
    throw diagnosticError9;
  } finally {
    diagnosticEnd9();
  }
}
async function claimAccountFreeUsage(state, appId, installationId, eventId, amount) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i;
  const diagnosticEnd10 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "constance-account.claimAccountFreeUsage")) != null ? _c : (() => {
  });
  try {
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
      const remaining = Math.max(0, Number((_e = (_d = response.json) == null ? void 0 : _d.data) == null ? void 0 : _e.remaining) || 0);
      new import_obsidian5.Notice(`Credit balance before this task: ${(remaining + amount).toLocaleString()} free credits.`);
      new import_obsidian5.Notice(`Task used ${amount.toLocaleString()} credits. Balance remaining: ${remaining.toLocaleString()} free credits.`);
      return { kind: "ok", remaining };
    } catch (error) {
      diagnostics.failure("constance-account.caught_extra_2", error);
      (_g = (_f = diagnostics) == null ? void 0 : _f.legacy) == null ? void 0 : _g.call(_f, "error", "constance-account.constance_account_free_usage_claim_failed");
      return { kind: "error" };
    }
  } catch (diagnosticError10) {
    (_i = (_h = diagnostics) == null ? void 0 : _h.failure) == null ? void 0 : _i.call(_h, "constance-account.claimAccountFreeUsage", diagnosticError10);
    throw diagnosticError10;
  } finally {
    diagnosticEnd10();
  }
}
async function spendAccountCredits(state, appId, installationId, eventId, amount) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
  const diagnosticEnd11 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "constance-account.spendAccountCredits")) != null ? _c : (() => {
  });
  try {
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
      const balance = Number((_f = (_e = (_d = response.json) == null ? void 0 : _d.data) == null ? void 0 : _e.credits) == null ? void 0 : _f.balance);
      if (!Number.isFinite(balance)) return { kind: "error" };
      const remaining = Math.max(0, balance);
      new import_obsidian5.Notice(`Credit balance before this task: ${(remaining + amount).toLocaleString()} purchased credits.`);
      new import_obsidian5.Notice(`Task used ${amount.toLocaleString()} credits. Balance remaining: ${remaining.toLocaleString()} purchased credits.`);
      return { kind: "ok", balance: remaining };
    } catch (error) {
      diagnostics.failure("constance-account.caught_extra_3", error);
      (_h = (_g = diagnostics) == null ? void 0 : _g.legacy) == null ? void 0 : _h.call(_g, "error", "constance-account.constance_authenticated_credit_spend_failed");
      return { kind: "error" };
    }
  } catch (diagnosticError11) {
    (_j = (_i = diagnostics) == null ? void 0 : _i.failure) == null ? void 0 : _j.call(_i, "constance-account.spendAccountCredits", diagnosticError11);
    throw diagnosticError11;
  } finally {
    diagnosticEnd11();
  }
}
function addBillingAccountSettings(containerEl, adapter) {
  resumeAccountCheckout({ ...adapter, refreshSession: () => refreshBillingSession(adapter.state, adapter.persist) });
  let password = "";
  const section = containerEl.createDiv({ cls: "constance-account-billing-section" });
  section.createEl("h3", { text: "Account and billing" });
  renderAccountGuidance(section, { appId: adapter.appId, connected: Boolean(adapter.state.billingAccountLinked && adapter.state.billingAccessToken), defaultAllowance: 5, unit: "protection operations", workflow: "Start with 5 protection operations on your account. Free credits are used automatically before purchased credits." });
  const state = adapter.state;
  const numericBalances = Object.entries(state).filter(([key, value]) => /(?:credit|balance|remaining)/i.test(key) && typeof value === "number").map(([key, value]) => `${key.replace(/^cached/i, "").replace(/^free/i, "Free ").replace(/^purchased/i, "Purchased ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").trim().toLowerCase()}: ${Number(value).toLocaleString()}`);
  const accountStatus = adapter.state.billingAccountLinked ? `Signed in as ${adapter.state.billingEmail || "your account"}` : state.billingRegistrationPending ? `Registered as ${adapter.state.billingEmail} but not signed in. Check your email, click the confirmation link, then sign in here.` : "Not signed in.";
  section.createEl("p", {
    cls: "constance-account-status",
    text: adapter.state.billingAccountLinked && adapter.state.billingAccessToken && numericBalances.length ? `${accountStatus} Balance \u2014 ${numericBalances.join("; ")}` : accountStatus
  });
  new import_obsidian5.Setting(section).setName("Email").setDesc(adapter.state.billingAccountLinked ? "Sign out before changing accounts." : "Use the email associated with your account and purchases.").addText((text) => text.setPlaceholder("you@example.com").setValue(adapter.state.billingEmail).setDisabled(adapter.state.billingAccountLinked).onChange(async (value) => {
    return diagnostics.guard("constance-account.control_5", async () => {
      var _a, _b, _c, _d, _e;
      const diagnosticEnd12 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "control.email.onChange")) != null ? _c : (() => {
      });
      try {
        if (adapter.state.billingAccountLinked) return;
        const journalState = adapter.state;
        const hasPending = Object.entries(journalState).some(([key, value2]) => /^pending/i.test(key) && key !== "pendingBillingOwnerEmail" && !!value2 && (Array.isArray(value2) ? value2.length > 0 : typeof value2 === "object" ? Object.keys(value2).length > 0 : true));
        if (hasPending && !journalState.pendingBillingOwnerEmail) journalState.pendingBillingOwnerEmail = adapter.state.billingEmail;
        if (!hasPending) journalState.pendingBillingOwnerEmail = void 0;
        adapter.state.billingEmail = value.trim();
        await adapter.persist();
      } catch (diagnosticError12) {
        (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "control.email.onChange", diagnosticError12);
        throw diagnosticError12;
      } finally {
        diagnosticEnd12();
      }
    });
  }));
  new import_obsidian5.Setting(section).setName("Password").setDesc("Your password is used to sign in and is not saved by the plugin.").addText((text) => {
    text.inputEl.type = "password";
    text.inputEl.maxLength = 256;
    text.setPlaceholder("8 to 128 characters").onChange((value) => {
      return diagnostics.guard("constance-account.control_6", () => {
        var _a;
        const diagnosticAction13 = () => {
          password = value;
        };
        return ((_a = diagnostics) == null ? void 0 : _a.run) ? diagnostics.run("control.17095.onChange", diagnosticAction13) : diagnosticAction13();
      });
    });
  });
  new import_obsidian5.Setting(section).setName("Account").setDesc(accountStatus).addButton((button) => button.setButtonText("Connect").setDisabled(adapter.state.billingAccountLinked).onClick(async () => {
    return diagnostics.guard("constance-account.control_7", async () => {
      var _a, _b, _c, _d, _e, _f, _g;
      const diagnosticEnd14 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "control.account.onClick")) != null ? _c : (() => {
      });
      try {
        button.setDisabled(true);
        try {
          await signInBillingAccount(adapter, password, "connect");
          password = "";
          new import_obsidian5.Notice(adapter.state.billingRegistrationPending ? "Check your email and follow the verification link, then Connect again." : `Connected as ${adapter.state.billingEmail}.`);
          (_d = adapter.refresh) == null ? void 0 : _d.call(adapter);
        } catch (error) {
          diagnostics.failure("constance-account.caught_8", error);
          new import_obsidian5.Notice(error instanceof Error ? error.message : "Connection failed. Please try again.");
          (_e = adapter.refresh) == null ? void 0 : _e.call(adapter);
        } finally {
          button.setDisabled(adapter.state.billingAccountLinked);
        }
      } catch (diagnosticError14) {
        (_g = (_f = diagnostics) == null ? void 0 : _f.failure) == null ? void 0 : _g.call(_f, "control.account.onClick", diagnosticError14);
        throw diagnosticError14;
      } finally {
        diagnosticEnd14();
      }
    });
  })).addButton((button) => button.setButtonText("Sign out").setDisabled(!adapter.state.billingAccessToken && !adapter.state.billingRefreshToken).onClick(async () => {
    return diagnostics.guard("constance-account.control_9", async () => {
      var _a, _b, _c, _d, _e, _f;
      const diagnosticEnd15 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "control.account.onClick")) != null ? _c : (() => {
      });
      try {
        await signOutBillingAccount(adapter);
        new import_obsidian5.Notice("Signed out.");
        (_d = adapter.refresh) == null ? void 0 : _d.call(adapter);
      } catch (diagnosticError15) {
        (_f = (_e = diagnostics) == null ? void 0 : _e.failure) == null ? void 0 : _f.call(_e, "control.account.onClick", diagnosticError15);
        throw diagnosticError15;
      } finally {
        diagnosticEnd15();
      }
    });
  }));
  new import_obsidian5.Setting(section).setName("Forgot password?").setDesc("Reset your account password in your browser.").addButton((button) => button.setButtonText("Open reset page").onClick(() => {
    return diagnostics.guard("constance-account.control_10", () => {
      var _a;
      const diagnosticAction16 = () => {
        window.open(`${CONSTANCE_ACCOUNT_BASE_URL}/password-reset`, "_blank", "noopener");
      };
      return ((_a = diagnostics) == null ? void 0 : _a.run) ? diagnostics.run("control.forgot_password_.onClick", diagnosticAction16) : diagnosticAction16();
    });
  }));
  const firstHeading = containerEl.querySelector(":scope > h1, :scope > h2");
  if (firstHeading == null ? void 0 : firstHeading.nextSibling) containerEl.insertBefore(section, firstHeading.nextSibling);
  else containerEl.prepend(section);
  queueMicrotask(() => {
    const candidates = Array.from(containerEl.querySelectorAll(":scope > .setting-item"));
    for (const item of candidates) {
      const label2 = item.textContent || "";
      if (/buy|checkout|refresh balance|sync balance|credit pack/i.test(label2)) section.appendChild(item);
    }
    for (const summary of Array.from(containerEl.querySelectorAll('[class*="credit"][class*="summary"], [class*="balance"][class*="summary"]'))) {
      if (!section.contains(summary)) section.appendChild(summary);
    }
  });
  queueMicrotask(() => applySettingsLayout(containerEl, adapter.appId));
}
var import_obsidian5, CONSTANCE_ACCOUNT_BASE_URL, ConstanceAccountError, billingPersisters, billingRefreshes;
var init_constance_account = __esm({
  "publish/src/constance-account.ts"() {
    "use strict";
    init_settings_layout();
    init_diagnostics();
    init_account_guidance();
    init_billing_checkout();
    import_obsidian5 = require("obsidian");
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

// publish/src/selection-scope.ts
var import_obsidian = require("obsidian");
function selectedFiles(entries, accepts) {
  const files = /* @__PURE__ */ new Map();
  const folders = /* @__PURE__ */ new Set();
  const visit = (entry) => {
    if (entry instanceof import_obsidian.TFile) {
      if (accepts(entry) && !files.has(entry.path)) files.set(entry.path, entry);
    } else if (entry instanceof import_obsidian.TFolder && !folders.has(entry.path)) {
      folders.add(entry.path);
      for (const child of [...entry.children]) visit(child);
    }
  };
  for (const entry of entries) visit(entry);
  return [...files.values()];
}
var markdownFile = (file) => file.extension.toLowerCase() === "md";
function registerSelectionAction(plugin, config) {
  const add = (menu, entries) => {
    const files = selectedFiles(entries, config.accepts);
    if (!files.length) return;
    menu.addItem((item) => item.setTitle(`${config.name} (${files.length} file${files.length === 1 ? "" : "s"})`).setIcon(config.icon).onClick(async () => {
      try {
        await config.run(files);
      } catch (e) {
        new import_obsidian.Notice(`${config.name}: operation failed. Check the status and try again.`);
      }
    }));
  };
  if (config.folders) plugin.registerEvent(plugin.app.workspace.on("file-menu", (menu, entry) => {
    if (entry instanceof import_obsidian.TFolder) add(menu, [entry]);
  }));
  if (config.multiple !== false) plugin.registerEvent(plugin.app.workspace.on("files-menu", add));
}

// publish/src/main.ts
init_diagnostics();
var import_obsidian10 = require("obsidian");

// publish/src/crypto.ts
init_diagnostics();
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
  var _a, _b, _c, _d, _e;
  const diagnosticEnd1 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "crypto.deriveKey")) != null ? _c : (() => {
  });
  try {
    const material = await cryptoApi().subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );
    return await cryptoApi().subtle.deriveKey(
      { name: "PBKDF2", salt: source(salt), iterations, hash: "SHA-256" },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  } catch (diagnosticError1) {
    (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "crypto.deriveKey", diagnosticError1);
    throw diagnosticError1;
  } finally {
    diagnosticEnd1();
  }
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
  var _a, _b, _c, _d, _e;
  const diagnosticEnd2 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "crypto.encryptText")) != null ? _c : (() => {
  });
  try {
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
  } catch (diagnosticError2) {
    (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "crypto.encryptText", diagnosticError2);
    throw diagnosticError2;
  } finally {
    diagnosticEnd2();
  }
}
async function decryptText(envelope, password) {
  var _a, _b, _c, _d, _e;
  const diagnosticEnd3 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "crypto.decryptText")) != null ? _c : (() => {
  });
  try {
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
    return await new TextDecoder().decode(plaintext);
  } catch (diagnosticError3) {
    (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "crypto.decryptText", diagnosticError3);
    throw diagnosticError3;
  } finally {
    diagnosticEnd3();
  }
}
async function sha256Hex(value) {
  var _a, _b, _c, _d, _e;
  const diagnosticEnd4 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "crypto.sha256Hex")) != null ? _c : (() => {
  });
  try {
    const digest2 = await cryptoApi().subtle.digest("SHA-256", source(new TextEncoder().encode(value)));
    return await Array.from(new Uint8Array(digest2), (byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch (diagnosticError4) {
    (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "crypto.sha256Hex", diagnosticError4);
    throw diagnosticError4;
  } finally {
    diagnosticEnd4();
  }
}

// publish/src/frontmatter.ts
init_diagnostics();
var import_obsidian2 = require("obsidian");
var AEGIS_KEY = "aegis";
function parseMarkdown(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter: {}, body: content, hasFrontmatter: false };
  const parsed = (0, import_obsidian2.parseYaml)(match[1]);
  return {
    frontmatter: parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {},
    body: content.slice(match[0].length),
    hasFrontmatter: true
  };
}
function serializeMarkdown(frontmatter, body) {
  if (Object.keys(frontmatter).length === 0) return body;
  const yaml = (0, import_obsidian2.stringifyYaml)(frontmatter).trimEnd();
  return `---
${yaml}
---
${body}`;
}
function topLevelPropertyNames(frontmatter) {
  return Object.keys(frontmatter).filter((key) => key !== AEGIS_KEY && !key.startsWith("aegis-"));
}

// publish/src/settings.ts
init_diagnostics();

// publish/src/loyalty-discount.ts
function renderLoyaltyDiscount(root, pricesBelow = true) {
  const doc = root.ownerDocument;
  const box = doc.createElement("div");
  box.className = "loyalty-discount-offer";
  box.style.cssText = "padding:14px;margin:12px 0;border:1px solid var(--interactive-accent,var(--accent,var(--brand,#6366f1)));border-radius:8px;background:var(--background-secondary,var(--surface,transparent));line-height:1.5";
  const title = doc.createElement("strong");
  title.textContent = "Thank you for choosing this app!";
  const offer = doc.createElement("p");
  offer.style.margin = "8px 0";
  offer.append(doc.createTextNode(pricesBelow ? "Get 50% off all prices below with coupon " : "Get 50% off with coupon "));
  const code = doc.createElement("code");
  code.textContent = "OBSLOYALE3";
  offer.append(code, doc.createTextNode("."));
  const instructions = doc.createElement("p");
  instructions.style.margin = "8px 0";
  instructions.textContent = "On the payment page, click Add discount on the left and enter the coupon code.";
  const validity = doc.createElement("p");
  validity.style.margin = "8px 0";
  validity.textContent = "Valid until the end of this quarter.";
  const button = doc.createElement("button");
  button.type = "button";
  button.textContent = "Copy code";
  const status = doc.createElement("span");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.style.marginLeft = "8px";
  button.addEventListener("click", async () => {
    var _a, _b;
    try {
      await ((_a = doc.defaultView) == null ? void 0 : _a.navigator.clipboard.writeText("OBSLOYALE3"));
      if (!((_b = doc.defaultView) == null ? void 0 : _b.navigator.clipboard)) throw new Error("Clipboard unavailable");
      status.textContent = "Code copied.";
    } catch (error) {
      const focused = doc.activeElement;
      const field = doc.createElement("textarea");
      field.value = "OBSLOYALE3";
      field.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      doc.body.appendChild(field);
      field.select();
      let copied = false;
      try {
        copied = doc.execCommand("copy");
      } catch (copyError) {
        console.error("Coupon copy failed", copyError);
      } finally {
        field.remove();
        if (focused instanceof HTMLElement) focused.focus();
      }
      status.textContent = copied ? "Code copied." : "Select and copy OBSLOYALE3 manually.";
    }
  });
  box.append(title, offer, instructions, validity, button, status);
  root.appendChild(box);
  return box;
}

// publish/src/native-operations.ts
init_diagnostics();
var import_obsidian6 = require("obsidian");
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
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const diagnosticEnd1 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "native-operations.api")) != null ? _c : (() => {
  });
  try {
    if (!publicRequest && (!host.settings.billingAccessToken || !host.settings.billingAccountLinked)) throw new Error("Keep this preview open. Sign in and verify your email in Settings, then return here to continue.");
    const send2 = () => {
      var _a2, _b2, _c2;
      return (_c2 = (_b2 = (_a2 = diagnostics) == null ? void 0 : _a2.request) == null ? void 0 : _b2.call(_a2, "network.native-operations.api", import_obsidian6.requestUrl, {
        url: BASE + path,
        method: body === void 0 ? "GET" : "POST",
        throw: false,
        headers: { "Content-Type": "application/json", ...!publicRequest ? { Authorization: `Bearer ${host.settings.billingAccessToken}` } : {} },
        body: body === void 0 ? void 0 : JSON.stringify(body)
      })) != null ? _c2 : (0, import_obsidian6.requestUrl)({
        url: BASE + path,
        method: body === void 0 ? "GET" : "POST",
        throw: false,
        headers: { "Content-Type": "application/json", ...!publicRequest ? { Authorization: `Bearer ${host.settings.billingAccessToken}` } : {} },
        body: body === void 0 ? void 0 : JSON.stringify(body)
      });
    };
    let response = await send2();
    if (response.status === 401 && host.settings.billingRefreshToken) {
      const refresh = refreshBillingSession;
      if (refresh && await refresh(host.settings, () => host.persistNative())) {
        await host.persistNative();
        response = await send2();
      }
    }
    if (response.status < 200 || response.status >= 300) throw Object.assign(new Error(((_e = (_d = response.json) == null ? void 0 : _d.detail) == null ? void 0 : _e.message) || `Your account could not be verified. Your preview is saved and no new changes were applied.`), { status: response.status });
    if (!((_f = response.json) == null ? void 0 : _f.data)) throw new Error("Your account could not be verified. Reconnect and try again.");
    return await response.json.data;
  } catch (diagnosticError1) {
    (_h = (_g = diagnostics) == null ? void 0 : _g.failure) == null ? void 0 : _h.call(_g, "native-operations.api", diagnosticError1);
    throw diagnosticError1;
  } finally {
    diagnosticEnd1();
  }
}
async function reserveLegacyNative(host, appId, eventId, source2, result, dimensions, reveal = false) {
  var _a, _b, _c, _d, _e, _f;
  const diagnosticEnd2 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "native-operations.reserveLegacyNative")) != null ? _c : (() => {
  });
  try {
    const state = host.settings;
    try {
      const source_digest = await digest(source2), result_digest = await digest(result);
      const amount = nativeCost(appId, dimensions);
      const owner = state.billingEmail.trim().toLowerCase();
      await recoverNative(host);
      const originalEventId = eventId;
      const lineage = (state.operationJournal || []).filter((j) => j.event_id === originalEventId || j.retry_of === originalEventId);
      if (lineage.some((j) => j.account !== owner)) throw new Error("Sign in to the account that started this action. Your preview and recovery data are saved.");
      if (lineage.some((j) => j.app_id !== appId || j.result_digest !== result_digest || j.source_digest !== source_digest || j.amount !== amount || JSON.stringify(j.dimensions) !== JSON.stringify(dimensions))) throw new Error("The source or selected action changed. Review your edits before starting a new action, which may use additional credits.");
      let existing = lineage.length ? lineage[lineage.length - 1] : void 0;
      if ((existing == null ? void 0 : existing.state) === "released") {
        eventId = jobId();
        existing = void 0;
      }
      if ((existing == null ? void 0 : existing.state) === "uncertain_released") throw new Error("This action could not be confirmed. Check your vault for saved changes before retrying.");
      else if (existing) {
        eventId = existing.event_id;
      }
      const lineageIds = new Set(lineage.map((j) => j.event_id));
      if ((_d = state.operationJournal) == null ? void 0 : _d.some((j) => j.app_id === appId && j.account === owner && !lineageIds.has(j.event_id) && ["requesting", "writing", "verified", "reserved"].includes(j.state))) throw new Error("The previous changes could not be confirmed. Check your vault before starting another action. Its credits are still reserved.");
      if (!state.installationCredential) {
        const installation = await api(host, "/public/installations", { app_id: appId, installation_id: state.constanceDeviceId }, true);
        if (typeof installation.installation_credential !== "string") throw new Error("This installation could not be verified. Reconnect your account.");
        state.installationCredential = installation.installation_credential;
        await host.persistNative();
      }
      const body = { app_id: appId, installation_id: state.constanceDeviceId, event_id: eventId, amount, source_digest, result_digest, dimensions, installation_credential: state.installationCredential };
      const quote = await api(host, "/billing/operations/quote", body);
      if (quote.event_id !== eventId || quote.app_id !== appId || quote.installation_id !== state.constanceDeviceId || quote.source_digest !== source_digest || quote.result_digest !== result_digest || quote.amount !== amount) throw new Error("The price could not be matched to this action. Nothing was confirmed or saved.");
      if (!Number.isInteger(quote.free_units) || !Number.isInteger(quote.paid_units) || quote.free_units < 0 || quote.paid_units < 0 || quote.free_units + quote.paid_units !== amount && !(quote.retained_access === true && quote.free_units === 0 && quote.paid_units === 0)) throw new Error("The credit amount could not be verified. Refresh your balance and retry.");
      if (quote.allowed === false) throw new Error(quote.message || "This action could not proceed. Keep the preview open, then sign in to the original account, select fewer items, or add credits.");
      if (existing && existing.state !== "released" && (existing.free_units !== quote.free_units || existing.paid_units !== quote.paid_units)) throw new Error("The credit amount changed. Nothing was saved. Refresh your balance before continuing.");
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
        throw new Error("This action expired. Nothing was saved. Refresh the price before continuing with this result.");
      }
      if (!["reserved", "committed"].includes(reserved.state)) throw new Error("This action could not be confirmed. Nothing was saved. Reconnect and retry this result.");
      if (reserved.free_units !== quote.free_units || reserved.paid_units !== quote.paid_units) throw new Error("Your available credits changed. Nothing was saved. Refresh the price before continuing.");
      if (!["writing", "verified", "committed"].includes(journal.state)) journal.state = reserved.state;
      await host.persistNative();
      const settleRequest = async (action) => {
        var _a2, _b2, _c2, _d2, _e2;
        const diagnosticEnd3 = (_c2 = (_b2 = (_a2 = diagnostics) == null ? void 0 : _a2.start) == null ? void 0 : _b2.call(_a2, "native-operations.settleRequest")) != null ? _c2 : (() => {
        });
        try {
          return await api(host, `/billing/operations/${encodeURIComponent(eventId)}/${action}`, { app_id: appId, installation_id: state.constanceDeviceId, result_digest });
        } catch (diagnosticError3) {
          (_e2 = (_d2 = diagnostics) == null ? void 0 : _d2.failure) == null ? void 0 : _e2.call(_d2, "native-operations.settleRequest", diagnosticError3);
          throw diagnosticError3;
        } finally {
          diagnosticEnd3();
        }
      };
      const settle = async (action) => {
        var _a2, _b2, _c2, _d2, _e2;
        const diagnosticEnd4 = (_c2 = (_b2 = (_a2 = diagnostics) == null ? void 0 : _a2.start) == null ? void 0 : _b2.call(_a2, "native-operations.settle")) != null ? _c2 : (() => {
        });
        try {
          const response = await settleRequest(action);
          assertJournalIdentity(response, journal, state.constanceDeviceId);
          return await response;
        } catch (diagnosticError4) {
          (_e2 = (_d2 = diagnostics) == null ? void 0 : _d2.failure) == null ? void 0 : _e2.call(_d2, "native-operations.settle", diagnosticError4);
          throw diagnosticError4;
        } finally {
          diagnosticEnd4();
        }
      };
      const reservation = {
        source: reserved.paid_units > 0 ? "purchased" : "free",
        markWriting: async (evidence) => {
          var _a2, _b2, _c2, _d2, _e2, _f2;
          const diagnosticEnd5 = (_c2 = (_b2 = (_a2 = diagnostics) == null ? void 0 : _a2.start) == null ? void 0 : _b2.call(_a2, "native-operations.background.8612")) != null ? _c2 : (() => {
          });
          try {
            if (!["reserved", "committed"].includes(journal.state)) throw new Error("The reserved credits are no longer available. Nothing was saved. Refresh your balance and retry.");
            if (journal.state === "committed" && ((_d2 = journal.evidence) == null ? void 0 : _d2.length)) {
              new import_obsidian6.Notice("This result is already saved. Open the existing output.");
              return false;
            }
            if (journal.state !== "committed") journal.state = "writing";
            journal.evidence = evidence;
            await host.persistNative();
            return true;
          } catch (diagnosticError5) {
            (_f2 = (_e2 = diagnostics) == null ? void 0 : _e2.failure) == null ? void 0 : _f2.call(_e2, "native-operations.background.8612", diagnosticError5);
            throw diagnosticError5;
          } finally {
            diagnosticEnd5();
          }
        },
        commit: async () => {
          var _a2, _b2, _c2, _d2, _e2;
          const diagnosticEnd6 = (_c2 = (_b2 = (_a2 = diagnostics) == null ? void 0 : _a2.start) == null ? void 0 : _b2.call(_a2, "native-operations.background.9080")) != null ? _c2 : (() => {
          });
          try {
            if (journal.state === "committed") return { kind: "committed" };
            journal.state = "verified";
            await host.persistNative();
            try {
              const committed = await settle("commit");
              if (committed.result_digest !== result_digest || committed.source_digest !== source_digest || committed.event_id !== eventId) throw new Error("The action could not be matched to your saved result.");
              if (committed.state !== "committed") throw new Error("The action could not be confirmed. Reconnect and retry.");
              journal.state = "committed";
              await host.persistNative();
              return { kind: "committed" };
            } catch (caughtError1) {
              diagnostics.failure("native-operations.caught_2", caughtError1);
              return { kind: "pending" };
            }
          } catch (diagnosticError6) {
            (_e2 = (_d2 = diagnostics) == null ? void 0 : _d2.failure) == null ? void 0 : _e2.call(_d2, "native-operations.background.9080", diagnosticError6);
            throw diagnosticError6;
          } finally {
            diagnosticEnd6();
          }
        },
        rollback: async () => {
          var _a2, _b2, _c2, _d2, _e2;
          const diagnosticEnd7 = (_c2 = (_b2 = (_a2 = diagnostics) == null ? void 0 : _a2.start) == null ? void 0 : _b2.call(_a2, "native-operations.background.9659")) != null ? _c2 : (() => {
          });
          try {
            if (["writing", "verified", "committed"].includes(journal.state)) {
              new import_obsidian6.Notice("The saved changes could not be confirmed. Check the output before retrying. Its credits are still reserved.");
              return;
            }
            const released = await settle("release");
            journal.state = released.state;
            await host.persistNative();
          } catch (diagnosticError7) {
            (_e2 = (_d2 = diagnostics) == null ? void 0 : _d2.failure) == null ? void 0 : _e2.call(_d2, "native-operations.background.9659", diagnosticError7);
            throw diagnosticError7;
          } finally {
            diagnosticEnd7();
          }
        }
      };
      if (reveal && (await reservation.commit()).kind !== "committed") throw new Error("The full result is not yet available. Reconnect and retry this preview.");
      return await reservation;
    } catch (error) {
      diagnostics.failure("native-operations.caught_3", error);
      new import_obsidian6.Notice(error instanceof Error ? error.message : String(error));
      return null;
    }
  } catch (diagnosticError2) {
    (_f = (_e = diagnostics) == null ? void 0 : _e.failure) == null ? void 0 : _f.call(_e, "native-operations.reserveLegacyNative", diagnosticError2);
    throw diagnosticError2;
  } finally {
    diagnosticEnd2();
  }
}
async function reserveNative(host, appId, eventId, source2, result, dimensions, reveal = false) {
  var _a, _b, _c, _d, _e, _f;
  const diagnosticEnd8 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "native-operations.reserveNative")) != null ? _c : (() => {
  });
  try {
    const state = host.settings;
    const prior = (state.operationJournal || []).find((j) => j.event_id === eventId || j.retry_of === eventId);
    if (prior && prior.protocol !== "usage") return await reserveLegacyNative(host, appId, eventId, source2, result, dimensions, reveal);
    try {
      if (!state.billingAccountLinked || !state.billingAccessToken) throw new Error("Open plugin settings and choose Connect to sign in or create an account and use your free allowance.");
      await recoverNative(host);
      const owner = state.billingEmail.trim().toLowerCase(), source_digest = await digest(source2), result_digest = await digest(result), amount = nativeCost(appId, dimensions);
      const pendingExact = (state.operationJournal || []).find((j) => {
        var _a2;
        return j.protocol === "usage" && j.app_id === appId && j.account === owner && j.source_digest === source_digest && j.result_digest === result_digest && j.amount === amount && JSON.stringify(j.dimensions) === JSON.stringify(dimensions) && (["requesting", "reserved", "writing", "verified"].includes(j.state) || j.state === "committed" && Boolean((_a2 = j.evidence) == null ? void 0 : _a2.length));
      });
      if (pendingExact) eventId = pendingExact.event_id;
      let journal = (state.operationJournal || []).find((j) => j.event_id === eventId);
      if (journal && (journal.account !== owner || journal.app_id !== appId || journal.source_digest !== source_digest || journal.result_digest !== result_digest || journal.amount !== amount || JSON.stringify(journal.dimensions) !== JSON.stringify(dimensions))) throw new Error("The account or source changed. Resume the original action before starting a new one.");
      if ((journal == null ? void 0 : journal.state) === "uncertain_released") throw new Error("The previous changes could not be confirmed. Check the output before retrying. No new charge or changes were made.");
      if ((state.operationJournal || []).some((j) => j.app_id === appId && j.account === owner && j.event_id !== eventId && ["requesting", "reserved", "writing", "verified"].includes(j.state))) throw new Error("Recover the previous pending operation before starting another one.");
      if (!journal) {
        journal = { protocol: "usage", event_id: eventId, app_id: appId, source_digest, result_digest, amount, free_units: -1, paid_units: -1, dimensions, state: "requesting", account: owner };
        state.operationJournal = [...state.operationJournal || [], journal];
        await host.persistNative();
      }
      if (journal.state === "released") throw new Error("This canceled operation cannot be replayed. Start a new operation.");
      let row;
      try {
        row = await api(host, "/billing/usage/reserve", usageBody(journal, state));
      } catch (error) {
        diagnostics.failure("native-operations.caught_4", error);
        if ((error == null ? void 0 : error.status) === 402) {
          journal.state = "denied";
          await host.persistNative();
        }
        throw error;
      }
      adoptUsageSplit(row, journal, state.constanceDeviceId);
      applyUsageBalance(row, state);
      if (row.state === "released") {
        journal.state = ((_d = journal.evidence) == null ? void 0 : _d.length) ? "uncertain_released" : "released";
        await host.persistNative();
        throw new Error("This action expired. Check its original result before retrying.");
      }
      if (!["reserved", "committed"].includes(row.state)) throw new Error("This action could not be verified. Reconnect and try again.");
      if (!["writing", "verified", "committed"].includes(journal.state)) journal.state = row.state;
      await host.persistNative();
      const retained = journal;
      const settle = async (action) => {
        var _a2, _b2, _c2, _d2, _e2;
        const diagnosticEnd9 = (_c2 = (_b2 = (_a2 = diagnostics) == null ? void 0 : _a2.start) == null ? void 0 : _b2.call(_a2, "native-operations.settle")) != null ? _c2 : (() => {
        });
        try {
          const response = await api(host, `/billing/usage/${encodeURIComponent(eventId)}/${action}`, { app_id: appId, installation_id: state.constanceDeviceId, result_digest });
          assertJournalIdentity(response, retained, state.constanceDeviceId);
          applyUsageBalance(response, state);
          return await response;
        } catch (diagnosticError9) {
          (_e2 = (_d2 = diagnostics) == null ? void 0 : _d2.failure) == null ? void 0 : _e2.call(_d2, "native-operations.settle", diagnosticError9);
          throw diagnosticError9;
        } finally {
          diagnosticEnd9();
        }
      };
      const reservation = {
        source: row.paid_units > 0 ? "purchased" : "free",
        markWriting: async (evidence) => {
          var _a2, _b2, _c2, _d2, _e2, _f2;
          const diagnosticEnd10 = (_c2 = (_b2 = (_a2 = diagnostics) == null ? void 0 : _a2.start) == null ? void 0 : _b2.call(_a2, "native-operations.background.14371")) != null ? _c2 : (() => {
          });
          try {
            if (!["reserved", "committed"].includes(retained.state)) throw new Error("The reserved credits are no longer available. Nothing was saved. Refresh your balance and retry.");
            if (retained.state === "committed" && ((_d2 = retained.evidence) == null ? void 0 : _d2.length)) return false;
            if (retained.state !== "committed") retained.state = "writing";
            retained.evidence = evidence;
            await host.persistNative();
            return true;
          } catch (diagnosticError10) {
            (_f2 = (_e2 = diagnostics) == null ? void 0 : _e2.failure) == null ? void 0 : _f2.call(_e2, "native-operations.background.14371", diagnosticError10);
            throw diagnosticError10;
          } finally {
            diagnosticEnd10();
          }
        },
        commit: async () => {
          var _a2, _b2, _c2, _d2, _e2;
          const diagnosticEnd11 = (_c2 = (_b2 = (_a2 = diagnostics) == null ? void 0 : _a2.start) == null ? void 0 : _b2.call(_a2, "native-operations.background.14784")) != null ? _c2 : (() => {
          });
          try {
            if (retained.state === "committed") return { kind: "committed" };
            retained.state = "verified";
            await host.persistNative();
            try {
              const committed = await settle("commit");
              if (committed.state !== "committed") throw new Error("Commit pending");
              retained.state = "committed";
              await host.persistNative();
              return { kind: "committed" };
            } catch (caughtError5) {
              diagnostics.failure("native-operations.caught_6", caughtError5);
              return { kind: "pending" };
            }
          } catch (diagnosticError11) {
            (_e2 = (_d2 = diagnostics) == null ? void 0 : _d2.failure) == null ? void 0 : _e2.call(_d2, "native-operations.background.14784", diagnosticError11);
            throw diagnosticError11;
          } finally {
            diagnosticEnd11();
          }
        },
        rollback: async () => {
          var _a2, _b2, _c2, _d2, _e2;
          const diagnosticEnd12 = (_c2 = (_b2 = (_a2 = diagnostics) == null ? void 0 : _a2.start) == null ? void 0 : _b2.call(_a2, "native-operations.background.15218")) != null ? _c2 : (() => {
          });
          try {
            if (["writing", "verified", "committed"].includes(retained.state)) {
              new import_obsidian6.Notice("The saved changes could not be confirmed. Check the output or contact support to review the charge.");
              return;
            }
            const released = await settle("release");
            retained.state = released.state;
            await host.persistNative();
          } catch (diagnosticError12) {
            (_e2 = (_d2 = diagnostics) == null ? void 0 : _d2.failure) == null ? void 0 : _e2.call(_d2, "native-operations.background.15218", diagnosticError12);
            throw diagnosticError12;
          } finally {
            diagnosticEnd12();
          }
        }
      };
      if (reveal && (await reservation.commit()).kind !== "committed") throw new Error("This action is awaiting confirmation. Reconnect and retry the same result.");
      return await reservation;
    } catch (error) {
      diagnostics.failure("native-operations.caught_7", error);
      new import_obsidian6.Notice(error instanceof Error ? error.message : String(error));
      return null;
    }
  } catch (diagnosticError8) {
    (_f = (_e = diagnostics) == null ? void 0 : _e.failure) == null ? void 0 : _f.call(_e, "native-operations.reserveNative", diagnosticError8);
    throw diagnosticError8;
  } finally {
    diagnosticEnd8();
  }
}
function applyUsageBalance(remote, state) {
  var _a, _b, _c, _d;
  const cached = state;
  const remaining = (_a = remote.free_usage) == null ? void 0 : _a.remaining, balance = (_b = remote.credits) == null ? void 0 : _b.balance;
  if (Number.isSafeInteger(remaining) && remaining >= 0) {
    for (const key of ["freeUsesRemaining", "freeConversionsRemaining"]) if (key in cached) cached[key] = remaining;
    if ("freeRepairBatchesUsed" in cached && Number.isSafeInteger((_c = remote.free_usage) == null ? void 0 : _c.allowance)) cached.freeRepairBatchesUsed = Math.max(0, remote.free_usage.allowance - remaining);
    if ("freeUsesUsed" in cached && Number.isSafeInteger((_d = remote.free_usage) == null ? void 0 : _d.allowance)) cached.freeUsesUsed = Math.max(0, remote.free_usage.allowance - remaining);
  }
  if (Number.isSafeInteger(balance) && balance >= 0) {
    for (const key of ["purchasedUses", "purchasedConversions", "purchasedRepairBatches"]) if (key in cached) cached[key] = balance;
  }
}
function usageBody(journal, state) {
  return { app_id: journal.app_id, installation_id: state.constanceDeviceId, event_id: journal.event_id, amount: journal.amount, source_digest: journal.source_digest, result_digest: journal.result_digest, dimensions: journal.dimensions };
}
function adoptUsageSplit(remote, journal, installationId) {
  if (!Number.isSafeInteger(remote.free_units) || !Number.isSafeInteger(remote.paid_units) || remote.free_units < 0 || remote.paid_units < 0 || remote.free_units + remote.paid_units !== journal.amount && !(remote.retained_access === true && remote.free_units === 0 && remote.paid_units === 0)) throw new Error("Credit usage could not be confirmed. Refresh your balance and retry.");
  const expected = { ...journal, free_units: remote.free_units, paid_units: remote.paid_units };
  assertJournalIdentity(remote, expected, installationId);
  if (journal.free_units >= 0 && (journal.free_units !== remote.free_units || journal.paid_units !== remote.paid_units)) throw new Error("The credit amount for this action changed. Refresh your balance before continuing.");
  journal.free_units = remote.free_units;
  journal.paid_units = remote.paid_units;
}
function assertJournalIdentity(remote, journal, installationId) {
  if (remote.event_id !== journal.event_id || remote.app_id !== journal.app_id || remote.installation_id !== installationId || remote.source_digest !== journal.source_digest || remote.result_digest !== journal.result_digest || remote.amount !== journal.amount || remote.free_units !== journal.free_units || remote.paid_units !== journal.paid_units) throw Object.assign(new Error("This action could not be matched to its saved result. Resume the original action."), { identityMismatch: true });
}
async function recoverNative(host) {
  var _a, _b, _c, _d, _e, _f, _g;
  const diagnosticEnd13 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "native-operations.recoverNative")) != null ? _c : (() => {
  });
  try {
    const state = host.settings;
    if (!state.billingAccessToken || !state.billingAccountLinked) return;
    for (const journal of state.operationJournal || []) {
      if (!["requesting", "writing", "verified", "reserved"].includes(journal.state) || journal.account !== state.billingEmail.trim().toLowerCase()) continue;
      try {
        const remote = await api(host, `/billing/${journal.protocol === "usage" ? "usage" : "operations"}/${encodeURIComponent(journal.event_id)}?app_id=${encodeURIComponent(journal.app_id)}&installation_id=${encodeURIComponent(state.constanceDeviceId)}`);
        if (journal.protocol === "usage") adoptUsageSplit(remote, journal, state.constanceDeviceId);
        else assertJournalIdentity(remote, journal, state.constanceDeviceId);
        if (remote.state === "committed") {
          if (journal.protocol === "usage") applyUsageBalance(remote, state);
          journal.state = "committed";
          await host.persistNative();
          continue;
        }
        if (remote.state === "released") {
          if (journal.state === "writing" || ((_d = journal.evidence) == null ? void 0 : _d.length)) {
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
          if (!((_e = journal.evidence) == null ? void 0 : _e.length)) continue;
          const outcomes = await Promise.all(journal.evidence.map(async (evidence) => {
            var _a2, _b2, _c2, _d2, _e2;
            const diagnosticEnd14 = (_c2 = (_b2 = (_a2 = diagnostics) == null ? void 0 : _a2.start) == null ? void 0 : _b2.call(_a2, "native-operations.background.19943")) != null ? _c2 : (() => {
            });
            try {
              try {
                const adapter = host.app.vault.adapter;
                const bytes = evidence.binary ? await adapter.readBinary(evidence.path) : await adapter.read(evidence.path);
                if (evidence.marker && typeof bytes === "string" && bytes.includes(evidence.marker)) return "after";
                const hash = await digest(bytes);
                return hash === evidence.after ? "after" : hash === evidence.before ? "before" : "unknown";
              } catch (caughtError8) {
                diagnostics.failure("native-operations.caught_9", caughtError8);
                return "unknown";
              }
            } catch (diagnosticError14) {
              (_e2 = (_d2 = diagnostics) == null ? void 0 : _d2.failure) == null ? void 0 : _e2.call(_d2, "native-operations.background.19943", diagnosticError14);
              throw diagnosticError14;
            } finally {
              diagnosticEnd14();
            }
          }));
          if (outcomes.length === 0 || outcomes.some((outcome) => outcome !== "after")) continue;
        }
        const remoteCommit = await api(host, `/billing/${journal.protocol === "usage" ? "usage" : "operations"}/${encodeURIComponent(journal.event_id)}/commit`, { app_id: journal.app_id, installation_id: state.constanceDeviceId, result_digest: journal.result_digest });
        assertJournalIdentity(remoteCommit, journal, state.constanceDeviceId);
        if (remoteCommit.state === "committed" && remoteCommit.result_digest === journal.result_digest && remoteCommit.source_digest === journal.source_digest) {
          if (journal.protocol === "usage") applyUsageBalance(remoteCommit, state);
          journal.state = "committed";
          await host.persistNative();
        }
      } catch (error) {
        diagnostics.failure("native-operations.caught_10", error);
        if (journal.state === "requesting" && !(error == null ? void 0 : error.identityMismatch) && (!(error == null ? void 0 : error.status) || error.status === 404 || error.status >= 500)) try {
          const remote = await api(host, journal.protocol === "usage" ? "/billing/usage/reserve" : "/billing/operations/reserve", journal.protocol === "usage" ? usageBody(journal, state) : { app_id: journal.app_id, installation_id: state.constanceDeviceId, event_id: journal.event_id, amount: journal.amount, source_digest: journal.source_digest, result_digest: journal.result_digest, dimensions: journal.dimensions, expected_free_units: journal.free_units, expected_paid_units: journal.paid_units, installation_credential: state.installationCredential });
          if (journal.protocol === "usage") adoptUsageSplit(remote, journal, state.constanceDeviceId);
          else assertJournalIdentity(remote, journal, state.constanceDeviceId);
          journal.state = remote.state;
          await host.persistNative();
        } catch (caughtError11) {
          diagnostics.failure("native-operations.caught_12", caughtError11);
        }
      }
    }
  } catch (diagnosticError13) {
    (_g = (_f = diagnostics) == null ? void 0 : _f.failure) == null ? void 0 : _g.call(_f, "native-operations.recoverNative", diagnosticError13);
    throw diagnosticError13;
  } finally {
    diagnosticEnd13();
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
  var _a, _b, _c, _d, _e;
  const diagnosticEnd15 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "native-operations.renderNativePacks")) != null ? _c : (() => {
  });
  try {
    const root = container.createDiv({ cls: "ui-billing-packs" });
    renderLoyaltyDiscount(root);
    root.createEl("p", { text: "Loading prices\u2026" });
    try {
      const catalog = await api(host, `/billing/public-products?app_id=${encodeURIComponent(appId)}`, void 0, true);
      const offers = joinCurrentPacks(catalog);
      if (!offers.length) throw new Error("No credit packs are currently available.");
      root.empty();
      renderLoyaltyDiscount(root);
      for (const { pack, price, priceId, units, unit, available } of offers) {
        const details = [pack == null ? void 0 : pack.description, Number.isSafeInteger(units) && units > 0 ? `${units.toLocaleString()} ${unit}` : "", available ? "" : (pack == null ? void 0 : pack.availability_reason) || "Current price unavailable"].filter(Boolean).join(" \xB7 ");
        new import_obsidian6.Setting(root).setName((pack == null ? void 0 : pack.price_name) || (pack == null ? void 0 : pack.name) || (pack == null ? void 0 : pack.code) || "Credit pack").setDesc(details).addButton((b) => b.setButtonText(available ? pack.formatted_total : "Pricing unavailable").setDisabled(!available).onClick(() => {
          return diagnostics.guard("native-operations.control_13", () => {
            var _a2;
            const diagnosticAction16 = () => void diagnostics.guard("native-operations.background_14", () => buy(priceId));
            return ((_a2 = diagnostics) == null ? void 0 : _a2.run) ? diagnostics.run("control.24887.onClick", diagnosticAction16) : diagnosticAction16();
          });
        }));
      }
    } catch (caughtError15) {
      diagnostics.failure("native-operations.caught_16", caughtError15);
      root.empty();
      renderLoyaltyDiscount(root);
      root.createEl("p", { text: "Pricing temporarily unavailable. Buying is disabled; keep your preview open." });
    }
  } catch (diagnosticError15) {
    (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "native-operations.renderNativePacks", diagnosticError15);
    throw diagnosticError15;
  } finally {
    diagnosticEnd15();
  }
}

// publish/src/settings.ts
var import_obsidian7 = require("obsidian");

// publish/src/billing.ts
init_diagnostics();
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
  var _a, _b, _c, _d, _e, _f, _g;
  const diagnosticEnd1 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "billing.saveBillingState")) != null ? _c : (() => {
  });
  try {
    try {
      await plugin.saveSettings();
      return true;
    } catch (error) {
      diagnostics.failure("billing.caught_extra_1", error);
      (_e = (_d = diagnostics) == null ? void 0 : _d.legacy) == null ? void 0 : _e.call(_d, "warn", "billing.aegis_billing_state_save_failed");
      return false;
    }
  } catch (diagnosticError1) {
    (_g = (_f = diagnostics) == null ? void 0 : _f.failure) == null ? void 0 : _g.call(_f, "billing.saveBillingState", diagnosticError1);
    throw diagnosticError1;
  } finally {
    diagnosticEnd1();
  }
}
async function fetchBalance(plugin) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p;
  const diagnosticEnd2 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "billing.fetchBalance")) != null ? _c : (() => {
  });
  try {
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
    if (response.status < 200 || response.status >= 300) throw new Error(`Your account could not be updated. Check your connection and try again.`);
    const paid = (_j = (_f = (_e = (_d = response.json) == null ? void 0 : _d.data) == null ? void 0 : _e.credits) == null ? void 0 : _f.total_available) != null ? _j : (_i = (_h = (_g = response.json) == null ? void 0 : _g.data) == null ? void 0 : _h.credits) == null ? void 0 : _i.balance;
    if (paid === void 0 || paid === null || String(paid).trim() === "" || !Number.isFinite(Number(paid)) || Number(paid) < 0) throw new Error("Your balance could not be updated. Refresh it and try again.");
    if (!((_l = (_k = response.json) == null ? void 0 : _k.data) == null ? void 0 : _l.free_usage)) throw new Error("Your balance could not be updated. Refresh it and try again.");
    if ((_n = (_m = response.json) == null ? void 0 : _m.data) == null ? void 0 : _n.free_usage) {
      const remaining = response.json.data.free_usage.remaining;
      if (!Number.isFinite(remaining) || remaining < 0) throw new Error("Your balance could not be updated. Refresh it and try again.");
      plugin.settings.freeUsesDay = localDayKey();
      plugin.settings.freeUsesUsed = Math.max(0, 5 - Number(remaining));
    }
    return Number(paid);
  } catch (diagnosticError2) {
    (_p = (_o = diagnostics) == null ? void 0 : _o.failure) == null ? void 0 : _p.call(_o, "billing.fetchBalance", diagnosticError2);
    throw diagnosticError2;
  } finally {
    diagnosticEnd2();
  }
}
async function syncBalance(plugin, strict = false) {
  var _a, _b, _c, _d, _e, _f, _g;
  const diagnosticEnd3 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "billing.syncBalance")) != null ? _c : (() => {
  });
  try {
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
      diagnostics.failure("billing.caught_extra_2", error);
      (_e = (_d = diagnostics) == null ? void 0 : _d.legacy) == null ? void 0 : _e.call(_d, "warn", "billing.aegis_constance_balance_sync_failed");
      if (strict) throw error;
    }
  } catch (diagnosticError3) {
    (_g = (_f = diagnostics) == null ? void 0 : _f.failure) == null ? void 0 : _g.call(_f, "billing.syncBalance", diagnosticError3);
    throw diagnosticError3;
  } finally {
    diagnosticEnd3();
  }
}
async function spendPurchasedUse(plugin, eventId) {
  var _a, _b, _c, _d, _e, _f, _g;
  const diagnosticEnd4 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "billing.spendPurchasedUse")) != null ? _c : (() => {
  });
  try {
    try {
      const result = await spendAccountCredits(plugin.settings, AEGIS_APP_ID, plugin.settings.constanceDeviceId, eventId, 1);
      if (result.kind === "auth-required") {
        plugin.settings.billingAccessToken = "";
        plugin.settings.billingRefreshToken = "";
        plugin.settings.billingAccountLinked = false;
        await saveBillingState(plugin);
        return { kind: "error" };
      }
      if (result.kind === "insufficient" || result.kind === "error") return await result;
      return { kind: "ok", balance: Math.max(0, result.balance) };
    } catch (error) {
      diagnostics.failure("billing.caught_extra_3", error);
      (_e = (_d = diagnostics) == null ? void 0 : _d.legacy) == null ? void 0 : _e.call(_d, "warn", "billing.aegis_constance_credit_spend_call_failed");
      return { kind: "error" };
    }
  } catch (diagnosticError4) {
    (_g = (_f = diagnostics) == null ? void 0 : _f.failure) == null ? void 0 : _g.call(_f, "billing.spendPurchasedUse", diagnosticError4);
    throw diagnosticError4;
  } finally {
    diagnosticEnd4();
  }
}
async function retryPendingProtectionCharges(plugin) {
  var _a, _b, _c, _d, _e, _f;
  const diagnosticEnd5 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "billing.retryPendingProtectionCharges")) != null ? _c : (() => {
  });
  try {
    const pending = [...(_d = plugin.settings.pendingProtectionCharges) != null ? _d : []];
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
  } catch (diagnosticError5) {
    (_f = (_e = diagnostics) == null ? void 0 : _e.failure) == null ? void 0 : _f.call(_e, "billing.retryPendingProtectionCharges", diagnosticError5);
    throw diagnosticError5;
  } finally {
    diagnosticEnd5();
  }
}
async function initializeBilling(plugin) {
  var _a, _b, _c, _d, _e, _f;
  const diagnosticEnd6 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "billing.initializeBilling")) != null ? _c : (() => {
  });
  try {
    ensureDeviceId(plugin);
    plugin.settings.pendingProtectionCharges = [...new Set(((_d = plugin.settings.pendingProtectionCharges) != null ? _d : []).filter((id) => typeof id === "string" && id.startsWith("evt_")))];
    plugin.settings = { ...plugin.settings, ...resetDailyUsageIfNeeded(plugin.settings) };
    await plugin.saveSettings();
    void diagnostics.guard("billing.background_1", () => recoverNative({ app: plugin.app, settings: plugin.settings, persistNative: () => plugin.saveSettings() }));
    void diagnostics.guard("billing.background_2", () => syncBalance(plugin).then(() => retryPendingProtectionCharges(plugin)));
  } catch (diagnosticError6) {
    (_f = (_e = diagnostics) == null ? void 0 : _e.failure) == null ? void 0 : _f.call(_e, "billing.initializeBilling", diagnosticError6);
    throw diagnosticError6;
  } finally {
    diagnosticEnd6();
  }
}
async function reserveProtectionUse(plugin, source2 = "", result = "", eventId = jobId()) {
  var _a, _b, _c, _d, _e;
  const diagnosticEnd7 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "billing.reserveProtectionUse")) != null ? _c : (() => {
  });
  try {
    return await reserveNative({ app: plugin.app, settings: plugin.settings, persistNative: () => plugin.saveSettings() }, AEGIS_APP_ID, eventId, source2, result, { input_characters: codePoints(source2) });
  } catch (diagnosticError7) {
    (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "billing.reserveProtectionUse", diagnosticError7);
    throw diagnosticError7;
  } finally {
    diagnosticEnd7();
  }
}

// publish/src/settings.ts
init_constance_account();

// publish/src/types.ts
var DEFAULT_SETTINGS = {
  settingsMode: "simple",
  debugLogging: false,
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
var AegisSettingTab = class extends import_obsidian7.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    __publicField(this, "plugin", plugin);
  }
  display() {
    return diagnostics.guard("settings.display_1", () => {
      var _a;
      const diagnosticAction1 = () => {
        var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J, _K, _L, _M, _N, _O, _P, _Q, _R, _S, _T, _U, _V, _W, _X, _Y, _Z, __;
        const { containerEl } = this;
        const diagnosticStage2 = (_c = (_b = (_a2 = diagnostics) == null ? void 0 : _a2.start) == null ? void 0 : _b.call(_a2, "settings.render.clear")) != null ? _c : (() => {
        });
        containerEl.empty();
        diagnosticStage2();
        const diagnosticStage3 = (_f = (_e = (_d = diagnostics) == null ? void 0 : _d.start) == null ? void 0 : _e.call(_d, "settings.render.help")) != null ? _f : (() => {
        });
        this.plugin.support.addHelpSetting(containerEl);
        diagnosticStage3();
        (_h = (_g = this.plugin.support).addDebugSetting) == null ? void 0 : _h.call(_g, containerEl);
        const diagnosticStage4 = (_k = (_j = (_i = diagnostics) == null ? void 0 : _i.start) == null ? void 0 : _j.call(_i, "settings.render.stage_1")) != null ? _k : (() => {
        });
        containerEl.createEl("h2", { text: "Aegis Note Locker" });
        diagnosticStage4();
        const advanced = this.plugin.settings.settingsMode === "advanced";
        const diagnosticStage5 = (_n = (_m = (_l = diagnostics) == null ? void 0 : _l.start) == null ? void 0 : _m.call(_l, "settings.render.settings_mode")) != null ? _n : (() => {
        });
        new import_obsidian7.Setting(containerEl).setName("Settings mode").setDesc("Simple shows everyday controls. Advanced includes detailed behavior and troubleshooting.").addDropdown((dropdown) => dropdown.addOption("simple", "Simple").addOption("advanced", "Advanced \u2014 optional").setValue(this.plugin.settings.settingsMode).onChange(async (value) => {
          return diagnostics.guard("settings.control_2", async () => {
            var _a3, _b2, _c2, _d2, _e2;
            const diagnosticEnd19 = (_c2 = (_b2 = (_a3 = diagnostics) == null ? void 0 : _a3.start) == null ? void 0 : _b2.call(_a3, "control.settings_mode.onChange")) != null ? _c2 : (() => {
            });
            try {
              this.plugin.settings.settingsMode = value === "advanced" ? "advanced" : "simple";
              await this.plugin.saveSettings();
              this.display();
            } catch (diagnosticError19) {
              (_e2 = (_d2 = diagnostics) == null ? void 0 : _d2.failure) == null ? void 0 : _e2.call(_d2, "control.settings_mode.onChange", diagnosticError19);
              throw diagnosticError19;
            } finally {
              diagnosticEnd19();
            }
          });
        }));
        diagnosticStage5();
        let sessionPassword = "";
        let passwordInput;
        const diagnosticStage6 = (_q = (_p = (_o = diagnostics) == null ? void 0 : _o.start) == null ? void 0 : _p.call(_o, "settings.render.session_password")) != null ? _q : (() => {
        });
        new import_obsidian7.Setting(containerEl).setName("Session password").setDesc("Set this once per Obsidian session so Lock, Unlock, and Backup run without password pop-ups. The password stays in memory only and is never saved to plugin data.").addText((text) => {
          passwordInput = text;
          text.setPlaceholder("Session password");
          text.inputEl.type = "password";
          text.onChange((value) => {
            return diagnostics.guard("settings.control_3", () => {
              var _a3;
              const diagnosticAction20 = () => sessionPassword = value;
              return ((_a3 = diagnostics) == null ? void 0 : _a3.run) ? diagnostics.run("control.1766.onChange", diagnosticAction20) : diagnosticAction20();
            });
          });
        }).addButton((button) => button.setButtonText("Set for session").setCta().onClick(() => {
          return diagnostics.guard("settings.control_4", () => {
            var _a3;
            const diagnosticAction21 = () => {
              if (!sessionPassword) {
                new import_obsidian7.Notice("Enter a password to set it for this session.");
                passwordInput == null ? void 0 : passwordInput.inputEl.focus();
                return;
              }
              this.plugin.setSessionPassword(sessionPassword);
              sessionPassword = "";
              passwordInput == null ? void 0 : passwordInput.setValue("");
              new import_obsidian7.Notice("Aegis session password set.");
            };
            return ((_a3 = diagnostics) == null ? void 0 : _a3.run) ? diagnostics.run("control.session_password.onClick", diagnosticAction21) : diagnosticAction21();
          });
        }));
        diagnosticStage6();
        const diagnosticStage7 = (_t = (_s = (_r = diagnostics) == null ? void 0 : _r.start) == null ? void 0 : _s.call(_r, "settings.render.review_before_applying")) != null ? _t : (() => {
        });
        new import_obsidian7.Setting(containerEl).setName("Review before applying").setDesc("Review and confirm changes before applying them. Off by default.").addToggle((toggle) => toggle.setValue(this.plugin.settings.reviewBeforeApply).onChange(async (value) => {
          return diagnostics.guard("settings.control_5", async () => {
            var _a3, _b2, _c2, _d2, _e2;
            const diagnosticEnd22 = (_c2 = (_b2 = (_a3 = diagnostics) == null ? void 0 : _a3.start) == null ? void 0 : _b2.call(_a3, "control.review_before_applying.onChange")) != null ? _c2 : (() => {
            });
            try {
              this.plugin.settings.reviewBeforeApply = value;
              await this.plugin.saveSettings();
            } catch (diagnosticError22) {
              (_e2 = (_d2 = diagnostics) == null ? void 0 : _d2.failure) == null ? void 0 : _e2.call(_d2, "control.review_before_applying.onChange", diagnosticError22);
              throw diagnosticError22;
            } finally {
              diagnosticEnd22();
            }
          });
        }));
        diagnosticStage7();
        const diagnosticStage8 = (_w = (_v = (_u = diagnostics) == null ? void 0 : _u.start) == null ? void 0 : _v.call(_u, "settings.render.protected_properties")) != null ? _w : (() => {
        });
        if (advanced) {
          new import_obsidian7.Setting(containerEl).setName("Protected properties").setDesc("Comma or newline separated frontmatter property names to protect. Leave empty to protect every eligible property.").addTextArea((text) => text.setValue(this.plugin.settings.protectedProperties).onChange(async (value) => {
            return diagnostics.guard("settings.control_6", async () => {
              var _a3, _b2, _c2, _d2, _e2;
              const diagnosticEnd23 = (_c2 = (_b2 = (_a3 = diagnostics) == null ? void 0 : _a3.start) == null ? void 0 : _b2.call(_a3, "control.protected_properties.onChange")) != null ? _c2 : (() => {
              });
              try {
                this.plugin.settings.protectedProperties = value;
                await this.plugin.saveSettings();
              } catch (diagnosticError23) {
                (_e2 = (_d2 = diagnostics) == null ? void 0 : _d2.failure) == null ? void 0 : _e2.call(_d2, "control.protected_properties.onChange", diagnosticError23);
                throw diagnosticError23;
              } finally {
                diagnosticEnd23();
              }
            });
          }));
        }
        diagnosticStage8();
        const diagnosticStage9 = (_z = (_y = (_x = diagnostics) == null ? void 0 : _x.start) == null ? void 0 : _y.call(_x, "settings.render.stage_2")) != null ? _z : (() => {
        });
        containerEl.createEl("p", { text: "Encryption happens on your device. Passwords and protected content are never uploaded. Account and purchase requests use the account service." });
        diagnosticStage9();
        const diagnosticStage10 = (_C = (_B = (_A = diagnostics) == null ? void 0 : _A.start) == null ? void 0 : _B.call(_A, "settings.render.billing")) != null ? _C : (() => {
        });
        new import_obsidian7.Setting(containerEl).setName("Billing").setHeading();
        diagnosticStage10();
        const balanceEl = containerEl.createEl("p", { cls: "aegis-billing-summary" });
        const renderBalance = () => {
          var _a3;
          const diagnosticAction24 = () => {
            var _a4, _b2;
            const pending = (_b2 = (_a4 = this.plugin.settings.pendingProtectionCharges) == null ? void 0 : _a4.length) != null ? _b2 : 0;
            balanceEl.setText(!this.plugin.settings.billingAccountLinked || !this.plugin.settings.billingAccessToken ? "Create an account or sign in, then Connect to load your free and purchased credits." : `Protection uses remaining: ${remainingFreeUses(this.plugin.settings)} free (last updated balance) + ${this.plugin.settings.purchasedUses.toLocaleString()} purchased${pending ? ` (${pending} charge pending)` : ""}`);
          };
          return ((_a3 = diagnostics) == null ? void 0 : _a3.run) ? diagnostics.run("settings.renderBalance", diagnosticAction24) : diagnosticAction24();
        };
        const diagnosticStage11 = (_F = (_E = (_D = diagnostics) == null ? void 0 : _D.start) == null ? void 0 : _E.call(_D, "settings.render.stage_3")) != null ? _F : (() => {
        });
        renderBalance();
        diagnosticStage11();
        const diagnosticStage12 = (_I = (_H = (_G = diagnostics) == null ? void 0 : _G.start) == null ? void 0 : _H.call(_G, "settings.render.account")) != null ? _I : (() => {
        });
        addBillingAccountSettings(containerEl, { state: this.plugin.settings, appId: "aegis-note-locker", installationId: this.plugin.settings.constanceDeviceId, appVersion: this.plugin.manifest.version, persist: () => this.plugin.saveSettings(), syncBalance: () => syncBalance(this.plugin), refresh: () => this.display() });
        diagnosticStage12();
        const diagnosticStage13 = (_L = (_K = (_J = diagnostics) == null ? void 0 : _J.start) == null ? void 0 : _K.call(_J, "settings.render.retry_preserved_protection")) != null ? _L : (() => {
        });
        new import_obsidian7.Setting(containerEl).setName("Resume protection").setDesc("Continue with the preview saved in this session. Notes that changed since the preview will not be overwritten.").addButton((b) => b.setButtonText("Retry").onClick(() => {
          return diagnostics.guard("settings.control_7", () => {
            var _a3;
            const diagnosticAction25 = () => void diagnostics.guard("settings.background_8", () => this.plugin.retryProtectionPreview());
            return ((_a3 = diagnostics) == null ? void 0 : _a3.run) ? diagnostics.run("control.retry_preserved_protection.onClick", diagnosticAction25) : diagnosticAction25();
          });
        }));
        diagnosticStage13();
        const diagnosticStage14 = (_O = (_N = (_M = diagnostics) == null ? void 0 : _M.start) == null ? void 0 : _N.call(_M, "settings.render.catalog")) != null ? _O : (() => {
        });
        void diagnostics.guard("settings.background_9", () => renderNativePacks(containerEl, { app: this.app, settings: this.plugin.settings, persistNative: () => this.plugin.saveSettings() }, "aegis-note-locker", async (plan) => {
          var _a3, _b2, _c2, _d2, _e2;
          const diagnosticEnd26 = (_c2 = (_b2 = (_a3 = diagnostics) == null ? void 0 : _a3.start) == null ? void 0 : _b2.call(_a3, "settings.background.4643")) != null ? _c2 : (() => {
          });
          try {
            const { openAccountCheckoutByPrice: openAccountCheckoutByPrice2 } = await Promise.resolve().then(() => (init_billing_checkout(), billing_checkout_exports));
            await openAccountCheckoutByPrice2({ state: this.plugin.settings, appId: "aegis-note-locker", installationId: this.plugin.settings.constanceDeviceId, persist: () => this.plugin.saveSettings(), syncBalance: () => syncBalance(this.plugin), refreshSession: async () => {
              var _a4, _b3, _c3, _d3, _e3;
              const diagnosticEnd27 = (_c3 = (_b3 = (_a4 = diagnostics) == null ? void 0 : _a4.start) == null ? void 0 : _b3.call(_a4, "settings.background.4962")) != null ? _c3 : (() => {
              });
              try {
                const a = await Promise.resolve().then(() => (init_constance_account(), constance_account_exports));
                return await a.refreshBillingSession(this.plugin.settings, () => this.plugin.saveSettings());
              } catch (diagnosticError27) {
                (_e3 = (_d3 = diagnostics) == null ? void 0 : _d3.failure) == null ? void 0 : _e3.call(_d3, "settings.background.4962", diagnosticError27);
                throw diagnosticError27;
              } finally {
                diagnosticEnd27();
              }
            } }, plan);
          } catch (diagnosticError26) {
            (_e2 = (_d2 = diagnostics) == null ? void 0 : _d2.failure) == null ? void 0 : _e2.call(_d2, "settings.background.4643", diagnosticError26);
            throw diagnosticError26;
          } finally {
            diagnosticEnd26();
          }
        }));
        diagnosticStage14();
        const diagnosticStage15 = (_R = (_Q = (_P = diagnostics) == null ? void 0 : _P.start) == null ? void 0 : _Q.call(_P, "settings.render.refresh_purchased_balance")) != null ? _R : (() => {
        });
        new import_obsidian7.Setting(containerEl).setName("Refresh balance").setDesc("Update your free and purchased credit balance. Unlocking, viewing, restoring, and exporting already protected content are free.").addButton((button) => button.setButtonText("Refresh").onClick(async () => {
          return diagnostics.guard("settings.control_10", async () => {
            var _a3, _b2, _c2, _d2, _e2;
            const diagnosticEnd28 = (_c2 = (_b2 = (_a3 = diagnostics) == null ? void 0 : _a3.start) == null ? void 0 : _b2.call(_a3, "control.refresh_purchased_balance.onClick")) != null ? _c2 : (() => {
            });
            try {
              button.setDisabled(true);
              try {
                await syncBalance(this.plugin, true);
                await retryPendingProtectionCharges(this.plugin);
                renderBalance();
              } catch (caughtError11) {
                diagnostics.failure("settings.caught_12", caughtError11);
                new import_obsidian7.Notice("Aegis: balance could not be refreshed. Check your connection and account, then retry.");
              } finally {
                button.setDisabled(false);
              }
            } catch (diagnosticError28) {
              (_e2 = (_d2 = diagnostics) == null ? void 0 : _d2.failure) == null ? void 0 : _e2.call(_d2, "control.refresh_purchased_balance.onClick", diagnosticError28);
              throw diagnosticError28;
            } finally {
              diagnosticEnd28();
            }
          });
        }));
        diagnosticStage15();
        const diagnosticStage16 = (_U = (_T = (_S = diagnostics) == null ? void 0 : _S.start) == null ? void 0 : _T.call(_S, "settings.render.stage_4")) != null ? _U : (() => {
        });
        void diagnostics.guard("settings.background_13", () => syncBalance(this.plugin).then(() => retryPendingProtectionCharges(this.plugin)).then(renderBalance).catch((rejectedError1) => {
          diagnostics.failure("settings.rejected_2", rejectedError1);
          balanceEl.setText("Balance unavailable. Use Refresh to retry; your saved balance is retained.");
        }));
        diagnosticStage16();
        const diagnosticStage17 = (_X = (_W = (_V = diagnostics) == null ? void 0 : _V.start) == null ? void 0 : _W.call(_V, "settings.render.session_timeout")) != null ? _X : (() => {
        });
        new import_obsidian7.Setting(containerEl).setName("Session timeout").setDesc("Minutes of inactivity before the password is cleared. Default: 15 minutes; enter it again to unlock later.").addDropdown((dropdown) => dropdown.addOption("5", "5 minutes \u2014 shorter sessions").addOption("15", "15 minutes \u2014 recommended").addOption("30", "30 minutes").addOption("60", "60 minutes").addOptions([5, 15, 30, 60].includes(this.plugin.settings.sessionTimeoutMinutes) ? {} : { [String(this.plugin.settings.sessionTimeoutMinutes)]: `${this.plugin.settings.sessionTimeoutMinutes} minutes \u2014 current` }).setValue(String(this.plugin.settings.sessionTimeoutMinutes)).onChange(async (value) => {
          return diagnostics.guard("settings.control_14", async () => {
            var _a3, _b2, _c2, _d2, _e2;
            const diagnosticEnd29 = (_c2 = (_b2 = (_a3 = diagnostics) == null ? void 0 : _a3.start) == null ? void 0 : _b2.call(_a3, "control.session_timeout.onChange")) != null ? _c2 : (() => {
            });
            try {
              this.plugin.settings.sessionTimeoutMinutes = Number(value);
              await this.plugin.saveSettings();
            } catch (diagnosticError29) {
              (_e2 = (_d2 = diagnostics) == null ? void 0 : _d2.failure) == null ? void 0 : _e2.call(_d2, "control.session_timeout.onChange", diagnosticError29);
              throw diagnosticError29;
            } finally {
              diagnosticEnd29();
            }
          });
        }));
        diagnosticStage17();
        const diagnosticStage18 = (__ = (_Z = (_Y = diagnostics) == null ? void 0 : _Y.start) == null ? void 0 : _Z.call(_Y, "settings.render.encrypted_backup_folder")) != null ? __ : (() => {
        });
        if (advanced) {
          this.plugin.support.addDiagnosticsSetting(containerEl);
          new import_obsidian7.Setting(containerEl).setName("Encrypted backup folder").setDesc("Vault-relative folder used for user-requested encrypted exports.").addText((text) => text.setPlaceholder(".aegis-backups").setValue(this.plugin.settings.backupFolder).onChange(async (value) => {
            return diagnostics.guard("settings.control_15", async () => {
              var _a3, _b2, _c2, _d2, _e2;
              const diagnosticEnd30 = (_c2 = (_b2 = (_a3 = diagnostics) == null ? void 0 : _a3.start) == null ? void 0 : _b2.call(_a3, "control.encrypted_backup_folder.onChange")) != null ? _c2 : (() => {
              });
              try {
                this.plugin.settings.backupFolder = value.trim() || ".aegis-backups";
                await this.plugin.saveSettings();
              } catch (diagnosticError30) {
                (_e2 = (_d2 = diagnostics) == null ? void 0 : _d2.failure) == null ? void 0 : _e2.call(_d2, "control.encrypted_backup_folder.onChange", diagnosticError30);
                throw diagnosticError30;
              } finally {
                diagnosticEnd30();
              }
            });
          }));
          new import_obsidian7.Setting(containerEl).setName("Show status bar").setDesc("Show the current note's locked or unlocked state in the status bar.").addToggle((toggle) => toggle.setValue(this.plugin.settings.showStatusBar).onChange(async (value) => {
            return diagnostics.guard("settings.control_16", async () => {
              var _a3, _b2, _c2, _d2, _e2;
              const diagnosticEnd31 = (_c2 = (_b2 = (_a3 = diagnostics) == null ? void 0 : _a3.start) == null ? void 0 : _b2.call(_a3, "control.show_status_bar.onChange")) != null ? _c2 : (() => {
              });
              try {
                this.plugin.settings.showStatusBar = value;
                await this.plugin.saveSettings();
                this.plugin.updateStatusBar();
              } catch (diagnosticError31) {
                (_e2 = (_d2 = diagnostics) == null ? void 0 : _d2.failure) == null ? void 0 : _e2.call(_d2, "control.show_status_bar.onChange", diagnosticError31);
                throw diagnosticError31;
              } finally {
                diagnosticEnd31();
              }
            });
          }));
          containerEl.createEl("h3", { text: "Recovery" });
          containerEl.createEl("p", { text: "Use Export encrypted backup before moving notes or changing sync settings. You can restore the latest action during the current plugin session." });
        }
        diagnosticStage18();
      };
      return ((_a = diagnostics) == null ? void 0 : _a.run) ? diagnostics.run("settings.open", diagnosticAction1) : diagnosticAction1();
    });
  }
  hide() {
    var _a, _b, _c;
    const end = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "settings.close")) != null ? _c : (() => {
    });
    try {
      super.hide();
    } finally {
      end();
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
init_diagnostics();
var import_obsidian8 = require("obsidian");
function safeError(error) {
  const message = error instanceof Error ? error.message : "The operation failed.";
  if (/password|decrypt|authentication|envelope|corrupt|tamper/i.test(message)) return "The password was incorrect or the encrypted record is damaged.";
  return message.replace(/[\r\n]+/g, " ").slice(0, 180);
}
var ConfirmModal = class extends import_obsidian8.Modal {
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
    return diagnostics.guard("ui.onOpen_1", () => {
      var _a;
      const diagnosticAction1 = () => {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: this.title });
        contentEl.createEl("p", { text: this.message });
        const actions = contentEl.createDiv({ cls: "aegis-actions" });
        const cancel = actions.createEl("button", { text: "Cancel" });
        cancel.setAttr("aria-label", "Cancel operation");
        cancel.onclick = diagnostics.wrap("ui.dom_1", () => this.finish(false));
        const confirm = actions.createEl("button", { text: this.confirmLabel, cls: "mod-cta" });
        confirm.setAttr("aria-label", this.confirmLabel);
        confirm.onclick = diagnostics.wrap("ui.dom_2", () => this.finish(true));
      };
      return ((_a = diagnostics) == null ? void 0 : _a.run) ? diagnostics.run("ui.onOpen", diagnosticAction1) : diagnosticAction1();
    });
  }
  onClose() {
    return diagnostics.guard("ui.onClose_2", () => {
      var _a;
      const diagnosticAction2 = () => {
        this.finish(false);
      };
      return ((_a = diagnostics) == null ? void 0 : _a.run) ? diagnostics.run("ui.onClose", diagnosticAction2) : diagnosticAction2();
    });
  }
  finish(value) {
    var _a;
    if (this.settled) return;
    this.settled = true;
    (_a = this.resolvePromise) == null ? void 0 : _a.call(this, value);
    this.close();
  }
};
var ProgressModal = class extends import_obsidian8.Modal {
  constructor(app, total) {
    super(app);
    __publicField(this, "total", total);
    __publicField(this, "cancelled", false);
    __publicField(this, "status");
  }
  onOpen() {
    return diagnostics.guard("ui.onOpen_8", () => {
      var _a;
      const diagnosticAction7 = () => {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: "Locking notes" });
        this.status = contentEl.createEl("p", { text: `Preparing 0 of ${this.total}\u2026` });
        this.status.setAttr("role", "status");
        const cancel = contentEl.createEl("button", { text: "Cancel" });
        cancel.onclick = diagnostics.wrap("ui.dom_7", () => {
          this.cancelled = true;
          cancel.disabled = true;
          cancel.setText("Cancelling\u2026");
        });
      };
      return ((_a = diagnostics) == null ? void 0 : _a.run) ? diagnostics.run("ui.onOpen", diagnosticAction7) : diagnosticAction7();
    });
  }
  update(done, detail) {
    var _a;
    (_a = this.status) == null ? void 0 : _a.setText(`${detail} (${done} of ${this.total})`);
  }
};
function notifyFailure(error) {
  new import_obsidian8.Notice(`Aegis: ${safeError(error)}`);
}

// publish/src/plugin-support.ts
init_diagnostics();
var import_obsidian9 = require("obsidian");
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
  "span",
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
function isError2(value) {
  return value instanceof Error || Object.prototype.toString.call(value) === "[object Error]";
}
function safeDetail(value) {
  if (isError2(value)) {
    const status = value.httpStatus;
    return JSON.stringify({ errorType: safeString(value.name || "Error"), ...typeof status === "number" && Number.isFinite(status) ? { httpStatus: status } : {} });
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return "[detail omitted]";
  const safe = {};
  for (const [key, item] of Object.entries(value)) {
    if (!SAFE_DETAIL_KEYS.has(key)) continue;
    if (typeof item === "string") {
      if (key === "version" && /^\d+\.\d+\.\d+$/.test(item)) safe[key] = item;
      else if (key === "errorType") safe[key] = ["Error", "TypeError", "RangeError", "SyntaxError", "AbortError"].includes(item) ? item : "Error";
      else if (key === "outcome" && ["failed", "cancelled", "completed"].includes(item)) safe[key] = item;
    } else if (typeof item === "number" && Number.isFinite(item)) safe[key] = item;
    else if (typeof item === "boolean" || item === null) safe[key] = item;
  }
  return JSON.stringify(safe);
}
var DocumentationModal = class extends import_obsidian9.Modal {
  constructor(app, docs, plugin, welcome = false) {
    super(app);
    __publicField(this, "docs", docs);
    __publicField(this, "plugin", plugin);
    __publicField(this, "welcome", welcome);
  }
  onOpen() {
    return diagnostics.guard("plugin-support.onOpen_1", () => {
      this.titleEl.setText(this.welcome ? "Welcome to " + this.docs.name : this.docs.name + " Help");
      this.contentEl.createEl("p", { text: this.docs.summary });
      const steps = this.contentEl.createEl("ol");
      ["Open Account to sign in or create an account. Verify your email if prompted.", "Open a note, choose what to protect, and keep the encryption password safe. It cannot be recovered.", "Review the result. Use Undo or the available recovery options if needed."].forEach((text) => steps.createEl("li", { text }));
      const settings = () => {
        var _a;
        const target = this.app.setting;
        target == null ? void 0 : target.open();
        target == null ? void 0 : target.openTabById((_a = this.plugin) == null ? void 0 : _a.manifest.id);
        this.close();
      };
      new import_obsidian9.Setting(this.contentEl).addButton((button) => button.setButtonText("Open account").setCta().onClick(diagnostics.wrap("plugin-support.control_2", settings))).addButton((button) => button.setButtonText("Lock current note").onClick(() => {
        return diagnostics.guard("plugin-support.control_3", () => {
          var _a, _b;
          const commands = this.app.commands;
          const command = "lock-current-note";
          const id = command === "command-palette:open" ? command : ((_a = this.plugin) == null ? void 0 : _a.manifest.id) + ":" + command;
          const available = (_b = commands == null ? void 0 : commands.executeCommandById) == null ? void 0 : _b.call(commands, id);
          if (available === false || !(commands == null ? void 0 : commands.executeCommandById)) new import_obsidian9.Notice("Open the command palette and choose " + this.docs.name + ". Check the selected note or attachment first.");
          this.close();
        });
      }));
      const section = (title, items) => {
        const details = this.contentEl.createEl("details");
        details.createEl("summary", { text: title });
        const list = details.createEl("ul");
        items.forEach((text) => list.createEl("li", { text }));
        return details;
      };
      const problems = section("Common problems", ["Email not received? Check spam, confirm the address in Account, then use Connect again after verification. Use the account page for recovery; do not create another account to recover purchases.", ...this.docs.troubleshooting]);
      new import_obsidian9.Setting(problems).addButton((button) => button.setButtonText("Open account").onClick(diagnostics.wrap("plugin-support.control_4", settings)));
      problems.createEl("a", { text: "Forgot password?", href: "https://app.tutivsoft.com/password-reset", attr: { target: "_blank", rel: "noopener noreferrer" } });
      section("Account and purchases", ["Your remaining free allowance and purchases belong to your account. Your credit balance stays with your account after reinstalling. Current prices are shown in Account. Refresh balance after a delayed payment instead of purchasing again."]);
      section("Advanced settings \u2014 optional", ["Simple shows everyday controls. Open Settings and choose Advanced for more customization and troubleshooting. Switching views keeps saved preferences."]);
      section("Useful commands", Array.from(/* @__PURE__ */ new Set([...this.docs.commands, "Open documentation", "Copy diagnostic log"])));
      section("Removing the app", ["Removing this plugin does not undo edits or delete your account. Export anything you want to keep before removing it in Obsidian Settings \u2192 Community plugins. Reconnect the same account after reinstalling to restore its remaining allowance and purchases. Locked notes remain encrypted after removal. Unlock notes first if you want readable Markdown. The encryption password is separate from your account password; account recovery cannot recover it."]);
    });
  }
  onClose() {
    return diagnostics.guard("plugin-support.onClose_5", () => {
      this.contentEl.empty();
    });
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
    __publicField(this, "lastFailureNotice", 0);
    __publicField(this, "knownCommands", /* @__PURE__ */ new Set(["toggle-debug-logging", "open-documentation", "copy-debug-log", "open-plugin-settings", "lock-current-note", "unlock-current-note", "lock-frontmatter-properties", "lock-all-notes", "lock-now", "rollback-last-operation", "export-encrypted-backup"]));
    __publicField(this, "repetitions", /* @__PURE__ */ new Map());
    diagnostics.attach(this, () => this.debugEnabled());
    this.plugin.register(() => diagnostics.guard("plugin-support.event_6", () => diagnostics.detach(this)));
  }
  debugEnabled() {
    var _a;
    return ((_a = this.plugin.settings) == null ? void 0 : _a.debugLogging) === true;
  }
  addDebugSetting(containerEl) {
    const renderEnd = diagnostics.start("settings.render.debug_logging");
    try {
      new import_obsidian9.Setting(containerEl).setName("Debug logging").setDesc("Record detailed activity logs for troubleshooting. Off by default.").addToggle((toggle) => toggle.setValue(this.debugEnabled()).onChange((value) => diagnostics.guard("plugin-support.control_7", () => this.setDebugLogging(value))));
    } finally {
      renderEnd();
    }
  }
  async setDebugLogging(value) {
    const host = this.plugin;
    const previous = host.settings.debugLogging;
    host.settings.debugLogging = value;
    const end = diagnostics.start("settings.debug_logging.callback");
    try {
      if (host.persist) await host.persist();
      else if (host.saveSettings) await host.saveSettings();
      else await host.saveData(host.settings);
    } catch (error) {
      diagnostics.failure("settings.debug_logging.callback", error);
      host.settings.debugLogging = previous;
      throw error;
    } finally {
      end();
    }
  }
  start() {
    if (this.started) return;
    this.started = true;
    this.info("plugin.loaded", { version: this.plugin.manifest.version });
    this.plugin.registerDomEvent(window, "error", (event) => {
      return diagnostics.guard("plugin-support.event_8", () => {
        var _a;
        const source2 = event.filename || ((_a = event.error) == null ? void 0 : _a.stack) || "";
        if (source2 && !source2.includes("plugin:" + this.plugin.manifest.id)) return;
        this.error("runtime.error", event.error || new Error(event.message || "Uncaught runtime error"));
      });
    });
    this.plugin.registerDomEvent(window, "unhandledrejection", (event) => {
      return diagnostics.guard("plugin-support.event_9", () => {
        var _a;
        const source2 = ((_a = event.reason) == null ? void 0 : _a.stack) || "";
        if (source2 && !source2.includes("plugin:" + this.plugin.manifest.id)) return;
        diagnostics.failure("runtime.unhandled_rejection", event.reason);
      });
    });
    const addCommand = this.plugin.addCommand.bind(this.plugin);
    const registerCommand = (command) => addCommand(this.instrumentCommand(command));
    registerCommand({
      id: "open-documentation",
      name: "Open documentation",
      callback: () => new DocumentationModal(this.plugin.app, this.docs, this.plugin).open()
    });
    registerCommand({
      id: "copy-debug-log",
      name: "Copy diagnostic log",
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
    registerCommand({
      id: "toggle-debug-logging",
      name: "Toggle debug logging",
      callback: async () => {
        try {
          await this.setDebugLogging(!this.debugEnabled());
          new import_obsidian9.Notice(this.docs.name + ": debug logging " + (this.debugEnabled() ? "enabled." : "disabled."));
        } catch (caughtError10) {
          diagnostics.failure("plugin-support.caught_11", caughtError10);
          new import_obsidian9.Notice(this.docs.name + ": could not save the logging setting. Try again.");
        }
      }
    });
    this.instrumentFutureCommands(addCommand);
  }
  /** Called after settings and first-action commands have loaded, including on a ready workspace. */
  showWelcome() {
    this.plugin.app.workspace.onLayoutReady(() => {
      return diagnostics.guard("plugin-support.event_12", () => {
        var _a;
        const host = this.plugin;
        const state = ((_a = host.settings) == null ? void 0 : _a.billing) || host.settings;
        if (!this.automaticWindowsEnabled() || !state || state.billingAccountLinked || state.flowWelcomeSeen || state.accountWelcomeSeen || state.billingOnboardingSeen || state.onboardingShown || host.settings.onboardingShown) return;
        const persist = host.persist ? () => host.persist() : host.saveSettings ? () => host.saveSettings() : () => this.plugin.saveData(host.settings);
        state.flowWelcomeSeen = true;
        void diagnostics.guard("plugin-support.background_13", () => persist().then(() => new DocumentationModal(this.plugin.app, this.docs, this.plugin, true).open()).catch((rejectedError1) => {
          diagnostics.failure("plugin-support.rejected_2", rejectedError1);
          state.flowWelcomeSeen = false;
          new import_obsidian9.Notice("Could not save setup progress. Your existing data is unchanged; reopen Help to continue.");
        }));
      });
    });
  }
  notifyFailure(_stage) {
    const now = Date.now();
    if (now - this.lastFailureNotice < 5e3) return;
    this.lastFailureNotice = now;
    try {
      new import_obsidian9.Notice(this.docs.name + ": this action could not be completed. Try again or copy the diagnostic log for support.");
    } catch (caughtError14) {
    }
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
  automaticWindowsEnabled() {
    var _a;
    return ((_a = this.plugin.settings) == null ? void 0 : _a.autoShowOperationWindows) === true;
  }
  addHelpSetting(containerEl) {
    new import_obsidian9.Setting(containerEl).setName("Show automatic windows").setDesc("Open queue, progress, result, and welcome windows automatically. Off by default; status messages remain visible.").addToggle((toggle) => toggle.setValue(this.automaticWindowsEnabled()).onChange(async (enabled2) => {
      const host = this.plugin;
      const previous = host.settings.autoShowOperationWindows;
      host.settings.autoShowOperationWindows = enabled2;
      try {
        if (host.persist) await host.persist();
        else if (host.saveSettings) await host.saveSettings();
        else await host.saveData(host.settings);
      } catch (error) {
        host.settings.autoShowOperationWindows = previous;
        toggle.setValue(this.automaticWindowsEnabled());
        new import_obsidian9.Notice("Could not save the automatic windows preference. Try again.");
      }
    }));
    new import_obsidian9.Setting(containerEl).setName("Help").setDesc("Get started, recover your account, or remove the plugin.").addButton((button) => button.setButtonText("Open Help").onClick(() => diagnostics.guard("plugin-support.control_16", () => new DocumentationModal(this.plugin.app, this.docs, this.plugin).open())));
  }
  addDiagnosticsSetting(containerEl) {
    new import_obsidian9.Setting(containerEl).setName("Diagnostics").setDesc("Copy up to the latest 1,000 events recorded by this plugin. Logs reset when the plugin reloads. Note contents, paths, credentials, and raw error messages are excluded.").addButton((button) => button.setButtonText("Copy full log").onClick(() => {
      return diagnostics.guard("plugin-support.control_17", () => {
        void diagnostics.guard("plugin-support.background_18", () => this.copyDiagnostics());
      });
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
      return diagnostics.guard("plugin-support.event_19", () => {
        if (originalDescriptor) Object.defineProperty(this.plugin, "addCommand", originalDescriptor);
        else Reflect.deleteProperty(this.plugin, "addCommand");
      });
    });
  }
  instrumentCommand(command) {
    const instrument = (callback) => (...args) => this.trackCommand(command.id, () => callback.apply(command, args));
    return {
      ...command,
      callback: command.callback ? instrument(command.callback) : void 0,
      editorCallback: command.editorCallback ? instrument(command.editorCallback) : void 0,
      checkCallback: command.checkCallback ? (checking) => this.trackCommand(command.id, () => command.checkCallback(checking)) : void 0,
      editorCheckCallback: command.editorCheckCallback ? (checking, editor, context) => this.trackCommand(command.id, () => command.editorCheckCallback(checking, editor, context)) : void 0
    };
  }
  trackCommand(commandId, action) {
    const stage = "command." + (this.knownCommands.has(commandId) ? commandId : "custom");
    return diagnostics.guard(stage, () => diagnostics.run(stage, action), false);
  }
  record(level, event, detail) {
    var _a, _b;
    const admittedEnd = event.endsWith(".end") && typeof (detail == null ? void 0 : detail.span) === "number";
    if (level === "info" && !this.debugEnabled() && !admittedEnd) return;
    const now = Date.now();
    const repeatKey = level + ":" + event;
    const previous = this.repetitions.get(repeatKey);
    if (!event.endsWith(".start") && !event.endsWith(".end") && previous && now - previous.at < 1e3) {
      previous.count++;
      if (previous.count > 4) return;
    } else {
      if (this.repetitions.size >= 512) this.repetitions.delete(this.repetitions.keys().next().value);
      this.repetitions.set(repeatKey, { at: now, count: 1 });
    }
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
    try {
      const prefix = "[" + this.docs.name + " v" + this.plugin.manifest.version + "] " + entry.event;
      if (isError2(detail)) method.call(console, prefix, (_a = entry.detail) != null ? _a : "", detail);
      else method.call(console, prefix, (_b = entry.detail) != null ? _b : "");
    } catch (caughtError20) {
    }
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
      new import_obsidian9.Notice(this.docs.name + ": copied " + snapshot.length + " log events" + omitted + ".");
    } catch (error) {
      diagnostics.failure("plugin-support.caught_22", error);
      this.error("diagnostics.copy_failed", error);
      new import_obsidian9.Notice(this.docs.name + ": could not copy the debug log.");
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
var AegisNoteLockerPlugin = class extends import_obsidian10.Plugin {
  constructor() {
    super(...arguments);
    __publicField(this, "settings", { ...DEFAULT_SETTINGS });
    __publicField(this, "support");
    __publicField(this, "sessionPassword");
    __publicField(this, "sessionExpiresAt", 0);
    __publicField(this, "undoRecord");
    __publicField(this, "statusBar");
    __publicField(this, "activeProgress");
    __publicField(this, "selectionInFlight", false);
    __publicField(this, "protectionPreview");
  }
  async onload() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    let diagnosticStartupEnd = () => {
    };
    const diagnosticEnd1 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "main.onload")) != null ? _c : (() => {
    });
    try {
      this.support = new PluginSupport(this, { name: "Aegis Note Locker", summary: "Encrypt note bodies or selected frontmatter properties with review and rollback safeguards.", quickStart: ["Open a note.", "Run Lock current note or Lock frontmatter properties.", "Review the scope and enter a password."], commands: ["Lock current note", "Unlock current note", "Clear password session"], troubleshooting: ["Use Copy diagnostic log before reporting a problem.", "Keep the password safe; Aegis cannot recover it."] });
      this.support.start();
      await this.loadSettings();
      diagnosticStartupEnd = (_f = (_e = (_d = diagnostics) == null ? void 0 : _d.start) == null ? void 0 : _e.call(_d, "startup.initialize")) != null ? _f : (() => {
      });
      await initializeBilling(this);
      if (this.settings.showStatusBar) this.statusBar = this.addStatusBarItem();
      this.addRibbonIcon("lock", "Aegis: Lock current note", () => diagnostics.guard("main.event_1", () => void diagnostics.guard("main.background_2", () => this.lockCurrentNote())));
      this.addCommand({ id: "lock-current-note", name: "Lock current note", callback: () => this.lockCurrentNote() });
      this.addCommand({ id: "unlock-current-note", name: "Unlock current note", callback: () => this.unlockCurrentNote() });
      this.addCommand({ id: "lock-frontmatter-properties", name: "Lock selected frontmatter properties", callback: () => this.lockProperties() });
      this.addCommand({ id: "lock-all-notes", name: "Lock all Markdown notes", callback: () => this.lockAllNotes() });
      this.addCommand({ id: "cancel-lock-all", name: "Cancel active lock/unlock batch", callback: () => {
        if (this.activeProgress) {
          this.activeProgress.cancelled = true;
          new import_obsidian10.Notice("Aegis: cancelling the batch after the current note.");
        }
      } });
      this.addCommand({ id: "lock-now", name: "Lock now (clear session)", callback: () => this.lockNow() });
      this.addCommand({ id: "rollback-last-operation", name: "Roll back last operation", callback: () => this.rollbackLastOperation() });
      this.addCommand({ id: "export-encrypted-backup", name: "Export encrypted backup of current note", callback: () => this.exportEncryptedBackup() });
      this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => diagnostics.guard("main.event_3", () => this.addFileMenuItems(menu, file))));
      this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor, info) => diagnostics.guard("main.event_4", () => this.addEditorMenuItems(menu, editor, info == null ? void 0 : info.file))));
      this.registerEvent(this.app.workspace.on("active-leaf-change", () => diagnostics.guard("main.event_5", () => this.updateStatusBar())));
      this.registerInterval(window.setInterval(() => diagnostics.guard("main.timer_6", () => this.expireSessionIfNeeded()), 3e4));
      registerSelectionAction(this, {
        name: "Aegis: Lock selected notes",
        icon: "lock",
        accepts: markdownFile,
        folders: true,
        run: (files) => {
          if (this.activeProgress) {
            new import_obsidian10.Notice("Aegis: a lock batch is already running.");
            return;
          }
          return this.lockAllNotes(files);
        }
      });
      registerSelectionAction(this, {
        name: "Aegis: Unlock selected notes",
        icon: "unlock",
        accepts: markdownFile,
        folders: true,
        run: (files) => this.unlockSelectedNotes(files)
      });
      this.addSettingTab(new AegisSettingTab(this.app, this));
      this.support.showWelcome();
      this.updateStatusBar();
    } catch (diagnosticError1) {
      (_h = (_g = diagnostics) == null ? void 0 : _g.failure) == null ? void 0 : _h.call(_g, "main.onload", diagnosticError1);
      throw diagnosticError1;
    } finally {
      diagnosticStartupEnd();
      (_j = (_i = diagnostics) == null ? void 0 : _i.legacy) == null ? void 0 : _j.call(_i, "info", "startup.finished");
      diagnosticEnd1();
    }
  }
  onunload() {
    return diagnostics.guard("main.onunload_7", () => {
      var _a;
      const diagnosticAction2 = () => {
        this.lockNow();
      };
      return ((_a = diagnostics) == null ? void 0 : _a.run) ? diagnostics.run("main.onunload", diagnosticAction2) : diagnosticAction2();
    });
  }
  async loadSettings() {
    var _a, _b, _c, _d, _e;
    const diagnosticEnd3 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "main.loadSettings")) != null ? _c : (() => {
    });
    try {
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
    } catch (diagnosticError3) {
      (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "main.loadSettings", diagnosticError3);
      throw diagnosticError3;
    } finally {
      diagnosticEnd3();
    }
  }
  async saveSettings() {
    var _a, _b, _c, _d, _e;
    const diagnosticEnd4 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "main.saveSettings")) != null ? _c : (() => {
    });
    try {
      await this.saveData(this.settings);
    } catch (diagnosticError4) {
      (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "main.saveSettings", diagnosticError4);
      throw diagnosticError4;
    } finally {
      diagnosticEnd4();
    }
  }
  pollAfterCheckout() {
    let attempts = 0;
    const interval = this.registerInterval(window.setInterval(() => {
      return diagnostics.guard("main.timer_8", () => {
        attempts += 1;
        void diagnostics.guard("main.background_9", () => syncBalance(this));
        if (attempts >= 6) window.clearInterval(interval);
      });
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
    void diagnostics.guard("main.background_10", () => this.app.vault.read(file).then((content) => {
      var _a2;
      const record = asRecord(parseMarkdown(content).frontmatter[AEGIS_KEY]);
      (_a2 = this.statusBar) == null ? void 0 : _a2.setText((record == null ? void 0 : record.mode) === "note" ? "Aegis: body locked" : (record == null ? void 0 : record.mode) === "properties" ? "Aegis: properties protected" : "Aegis: unlocked");
    }).catch((rejectedError1) => {
      var _a2;
      diagnostics.failure("main.rejected_2", rejectedError1);
      return (_a2 = this.statusBar) == null ? void 0 : _a2.setText("Aegis: unavailable");
    }));
  }
  addFileMenuItems(menu, file) {
    if (!(file instanceof import_obsidian10.TFile) || !isMarkdown(file)) return;
    menu.addItem((item) => item.setTitle("Aegis: Lock note").setIcon("lock").onClick(() => {
      return diagnostics.guard("main.control_11", () => {
        var _a;
        const diagnosticAction5 = () => void diagnostics.guard("main.background_12", () => this.lockCurrentNote(file));
        return ((_a = diagnostics) == null ? void 0 : _a.run) ? diagnostics.run("control.7015.onClick", diagnosticAction5) : diagnosticAction5();
      });
    }));
    menu.addItem((item) => item.setTitle("Aegis: Unlock note").setIcon("unlock").onClick(() => {
      return diagnostics.guard("main.control_13", () => {
        var _a;
        const diagnosticAction6 = () => void diagnostics.guard("main.background_14", () => this.unlockCurrentNote(file));
        return ((_a = diagnostics) == null ? void 0 : _a.run) ? diagnostics.run("control.7145.onClick", diagnosticAction6) : diagnosticAction6();
      });
    }));
    menu.addItem((item) => item.setTitle("Aegis: Lock frontmatter properties").onClick(() => {
      return diagnostics.guard("main.control_15", () => {
        var _a;
        const diagnosticAction7 = () => void diagnostics.guard("main.background_16", () => this.lockProperties(file));
        return ((_a = diagnostics) == null ? void 0 : _a.run) ? diagnostics.run("control.7275.onClick", diagnosticAction7) : diagnosticAction7();
      });
    }));
    menu.addItem((item) => item.setTitle("Aegis: Export encrypted backup").onClick(() => {
      return diagnostics.guard("main.control_17", () => {
        var _a;
        const diagnosticAction8 = () => void diagnostics.guard("main.background_18", () => this.exportEncryptedBackup(file));
        return ((_a = diagnostics) == null ? void 0 : _a.run) ? diagnostics.run("control.7398.onClick", diagnosticAction8) : diagnosticAction8();
      });
    }));
  }
  addEditorMenuItems(menu, _editor, file = this.currentFile()) {
    menu.addItem((item) => item.setTitle("Aegis: Lock current note").setIcon("lock").onClick(() => {
      return diagnostics.guard("main.control_19", () => {
        var _a;
        const diagnosticAction9 = () => void diagnostics.guard("main.background_20", () => this.lockCurrentNote(file));
        return ((_a = diagnostics) == null ? void 0 : _a.run) ? diagnostics.run("control.7609.onClick", diagnosticAction9) : diagnosticAction9();
      });
    }));
    menu.addItem((item) => item.setTitle("Aegis: Unlock current note").setIcon("unlock").onClick(() => {
      return diagnostics.guard("main.control_21", () => {
        var _a;
        const diagnosticAction10 = () => void diagnostics.guard("main.background_22", () => this.unlockCurrentNote(file));
        return ((_a = diagnostics) == null ? void 0 : _a.run) ? diagnostics.run("control.7743.onClick", diagnosticAction10) : diagnosticAction10();
      });
    }));
  }
  currentFile() {
    return this.app.workspace.getActiveFile();
  }
  async passwordForNewEncryption() {
    var _a, _b, _c, _d, _e;
    const diagnosticEnd11 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "main.passwordForNewEncryption")) != null ? _c : (() => {
    });
    try {
      if (this.sessionPassword && Date.now() < this.sessionExpiresAt) {
        this.touchSession();
        return await this.sessionPassword;
      }
      new import_obsidian10.Notice("Aegis: set the session password in plugin settings before running this command.");
      return null;
    } catch (diagnosticError11) {
      (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "main.passwordForNewEncryption", diagnosticError11);
      throw diagnosticError11;
    } finally {
      diagnosticEnd11();
    }
  }
  async passwordForUnlock() {
    var _a, _b, _c, _d, _e;
    const diagnosticEnd12 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "main.passwordForUnlock")) != null ? _c : (() => {
    });
    try {
      if (this.sessionPassword && Date.now() < this.sessionExpiresAt) {
        this.touchSession();
        return await this.sessionPassword;
      }
      this.clearSession();
      new import_obsidian10.Notice("Aegis: set the session password in plugin settings before running this command.");
      return null;
    } catch (diagnosticError12) {
      (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "main.passwordForUnlock", diagnosticError12);
      throw diagnosticError12;
    } finally {
      diagnosticEnd12();
    }
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
      new import_obsidian10.Notice("The password session expired. Enter your password again to unlock encrypted notes.");
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
    var _a, _b, _c, _d, _e;
    const diagnosticEnd13 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "main.retryProtectionPreview")) != null ? _c : (() => {
    });
    try {
      const preview = this.protectionPreview;
      if (!preview) {
        new import_obsidian10.Notice("No protection preview is open.");
        return;
      }
      const reservation = await reserveProtectionUse(this, preview.original, preview.next, preview.eventId);
      if (!reservation) return;
      await this.applyProtectionChange(preview.file, preview.original, preview.next, reservation, preview.success);
    } catch (diagnosticError13) {
      (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "main.retryProtectionPreview", diagnosticError13);
      throw diagnosticError13;
    } finally {
      diagnosticEnd13();
    }
  }
  async lockCurrentNote(file = this.currentFile()) {
    var _a, _b, _c, _d, _e;
    const diagnosticEnd14 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "main.lockCurrentNote")) != null ? _c : (() => {
    });
    try {
      if (!file || !isMarkdown(file)) {
        new import_obsidian10.Notice("Aegis: open a Markdown note first.");
        return;
      }
      try {
        const original = await this.app.vault.read(file);
        const parsed = parseMarkdown(original);
        if (asRecord(parsed.frontmatter[AEGIS_KEY])) {
          new import_obsidian10.Notice("Aegis: this note already has protected content.");
          return;
        }
        if (this.settings.reviewBeforeApply && !await new ConfirmModal(this.app, "Review note lock", `The encrypted note body cannot be read by search or other plugins. Its path and frontmatter remain visible. You can restore the original during this session.`, "Continue").waitForResult()) return;
        const password = await this.passwordForNewEncryption();
        if (!password) return;
        const envelope = await encryptText(parsed.body, password);
        const verified = await decryptText(envelope, password);
        if (verified !== parsed.body) throw new Error("Aegis verification failed before the file was changed.");
        const next = serializeMarkdown({ ...parsed.frontmatter, [AEGIS_KEY]: { mode: "note", envelope } }, LOCKED_NOTE_PLACEHOLDER);
        this.protectionPreview = { file, original, next, eventId: jobId(), success: "Aegis: note locked." };
        if (!this.settings.billingAccessToken) {
          new import_obsidian10.Notice("Your note is ready to encrypt. Keep this session open, sign in and verify your email in Settings, then choose Resume protection. Nothing has been saved.");
          return;
        }
        await this.retryProtectionPreview();
      } catch (error) {
        diagnostics.failure("main.caught_23", error);
        notifyFailure(error);
      }
    } catch (diagnosticError14) {
      (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "main.lockCurrentNote", diagnosticError14);
      throw diagnosticError14;
    } finally {
      diagnosticEnd14();
    }
  }
  async lockProperties(file = this.currentFile()) {
    var _a, _b, _c, _d, _e, _f, _g;
    const diagnosticEnd15 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "main.lockProperties")) != null ? _c : (() => {
    });
    try {
      if (!file || !isMarkdown(file)) {
        new import_obsidian10.Notice("Aegis: open a Markdown note first.");
        return;
      }
      try {
        const original = await this.app.vault.read(file);
        const parsed = parseMarkdown(original);
        if (((_d = asRecord(parsed.frontmatter[AEGIS_KEY])) == null ? void 0 : _d.mode) === "note") {
          new import_obsidian10.Notice("Aegis: unlock the note body before protecting properties.");
          return;
        }
        const existing = asRecord(parsed.frontmatter[AEGIS_KEY]);
        const keys = topLevelPropertyNames(parsed.frontmatter).filter((key) => {
          var _a2;
          return !((_a2 = existing == null ? void 0 : existing.properties) == null ? void 0 : _a2[key]);
        });
        if (!keys.length) {
          new import_obsidian10.Notice("Aegis: this note has no top-level frontmatter properties.");
          return;
        }
        const configured = this.settings.protectedProperties.split(/[\n,]/).map((key) => key.trim()).filter(Boolean);
        const chosen = configured.length ? keys.filter((key) => configured.includes(key)) : keys;
        if (!chosen.length) {
          new import_obsidian10.Notice("Aegis: none of the configured frontmatter properties exist in this note.");
          return;
        }
        if (this.settings.reviewBeforeApply && !await new ConfirmModal(this.app, "Review property lock", `Protect ${chosen.length} frontmatter propert${chosen.length === 1 ? "y" : "ies"}? Names stay visible; values will be replaced with a non-sensitive placeholder.`, "Continue").waitForResult()) return;
        const password = await this.passwordForNewEncryption();
        if (!password) return;
        const protectedValues = { ...(_e = existing == null ? void 0 : existing.properties) != null ? _e : {} };
        const updatedFrontmatter = { ...parsed.frontmatter };
        for (const key of chosen) {
          protectedValues[key] = await encryptText(JSON.stringify(parsed.frontmatter[key]), password);
          updatedFrontmatter[key] = LOCKED_PROPERTY_PLACEHOLDER;
        }
        const nextRecord = { mode: "properties", properties: protectedValues };
        const next = serializeMarkdown({ ...updatedFrontmatter, [AEGIS_KEY]: nextRecord }, parsed.body);
        this.protectionPreview = { file, original, next, eventId: jobId(), success: `Aegis: protected ${chosen.length} properties.` };
        if (!this.settings.billingAccessToken) {
          new import_obsidian10.Notice("Your selected properties are ready to encrypt. Keep this session open, sign in and verify your email in Settings, then choose Resume protection. Nothing has been saved.");
          return;
        }
        await this.retryProtectionPreview();
      } catch (error) {
        diagnostics.failure("main.caught_24", error);
        notifyFailure(error);
      }
    } catch (diagnosticError15) {
      (_g = (_f = diagnostics) == null ? void 0 : _f.failure) == null ? void 0 : _g.call(_f, "main.lockProperties", diagnosticError15);
      throw diagnosticError15;
    } finally {
      diagnosticEnd15();
    }
  }
  async unlockCurrentNote(file = this.currentFile(), batch) {
    var _a, _b, _c, _d, _e, _f;
    const diagnosticEnd16 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "main.unlockCurrentNote")) != null ? _c : (() => {
    });
    try {
      if (!batch && this.selectionInFlight) {
        new import_obsidian10.Notice("Aegis: a note batch is already running.");
        return null;
      }
      if (!file || !isMarkdown(file)) {
        new import_obsidian10.Notice("Aegis: open a Markdown note first.");
        return null;
      }
      try {
        const original = await this.app.vault.read(file);
        const parsed = parseMarkdown(original);
        const record = asRecord(parsed.frontmatter[AEGIS_KEY]);
        if (!record) {
          new import_obsidian10.Notice("Aegis: this note is not locked.");
          return null;
        }
        if (!batch && this.settings.reviewBeforeApply && !await new ConfirmModal(this.app, "Review unlock", "The encrypted record will be verified before the note is replaced. Nothing changes if the password is wrong or the file changed on disk.", "Continue").waitForResult()) return null;
        const password = (_d = batch == null ? void 0 : batch.password) != null ? _d : await this.passwordForUnlock();
        if (!password) return null;
        const nextFrontmatter = { ...parsed.frontmatter };
        delete nextFrontmatter[AEGIS_KEY];
        let nextBody = parsed.body;
        if (record.mode === "note" && record.envelope) {
          nextBody = await decryptText(record.envelope, password);
        } else if (record.mode === "properties" && record.properties) {
          for (const [key, envelope] of Object.entries(record.properties)) nextFrontmatter[key] = JSON.parse(await decryptText(envelope, password));
        } else throw new Error("Unsupported Aegis record.");
        const next = serializeMarkdown(nextFrontmatter, nextBody);
        await this.atomicChange(file, original, next, !batch);
        if (!batch) new import_obsidian10.Notice("Aegis: note unlocked.");
        return { path: file.path, original, resulting: next };
      } catch (error) {
        diagnostics.failure("main.caught_25", error);
        notifyFailure(error);
        return null;
      }
    } catch (diagnosticError16) {
      (_f = (_e = diagnostics) == null ? void 0 : _e.failure) == null ? void 0 : _f.call(_e, "main.unlockCurrentNote", diagnosticError16);
      throw diagnosticError16;
    } finally {
      diagnosticEnd16();
    }
  }
  async unlockSelectedNotes(files) {
    if (this.selectionInFlight || this.activeProgress) {
      new import_obsidian10.Notice("Aegis: a note batch is already running.");
      return;
    }
    this.selectionInFlight = true;
    const entries = [];
    let failed = 0, skipped = 0;
    let progress;
    try {
      const candidates = [];
      for (const file of files) {
        try {
          if (asRecord(parseMarkdown(await this.app.vault.read(file)).frontmatter[AEGIS_KEY])) candidates.push(file);
          else skipped++;
        } catch (e) {
          failed++;
        }
      }
      if (!candidates.length) {
        new import_obsidian10.Notice(`Aegis: no locked selected notes; ${skipped} skipped, ${failed} failed.`);
        return;
      }
      if (this.settings.reviewBeforeApply && !await new ConfirmModal(this.app, "Review selected-note unlock", `${candidates.length} locked notes will be decrypted. Unlocked notes are skipped; all successful changes can be rolled back together.`, "Continue").waitForResult()) return;
      const password = await this.passwordForUnlock();
      if (!password) return;
      progress = new ProgressModal(this.app, candidates.length);
      this.activeProgress = progress;
      if (this.support.automaticWindowsEnabled()) progress.open();
      for (let index = 0; index < candidates.length; index++) {
        if (progress.cancelled) break;
        progress.update(index, candidates[index].path);
        const entry = await this.unlockCurrentNote(candidates[index], { password });
        if (entry) entries.push(entry);
        else failed++;
      }
      new import_obsidian10.Notice(`Aegis: unlocked ${entries.length} note(s), ${skipped} skipped, ${failed} failed${progress.cancelled ? "; cancelled before the remaining notes" : ""}.`);
    } catch (error) {
      notifyFailure(error);
    } finally {
      if (entries.length) this.undoRecord = { createdAt: Date.now(), entries };
      progress == null ? void 0 : progress.close();
      this.activeProgress = void 0;
      this.selectionInFlight = false;
    }
  }
  async lockAllNotes(selected) {
    var _a, _b, _c, _d, _e, _f;
    const diagnosticEnd17 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "main.lockAllNotes")) != null ? _c : (() => {
    });
    if (this.selectionInFlight || this.activeProgress) {
      diagnosticEnd17();
      new import_obsidian10.Notice("Aegis: a note batch is already running.");
      return;
    }
    this.selectionInFlight = true;
    try {
      try {
        const files = selected != null ? selected : this.app.vault.getMarkdownFiles();
        const candidates = [];
        for (const file of files) {
          const content = await this.app.vault.read(file);
          if (!asRecord(parseMarkdown(content).frontmatter[AEGIS_KEY])) candidates.push(file);
        }
        if (!candidates.length) {
          new import_obsidian10.Notice("Aegis: no unlocked Markdown notes found.");
          return;
        }
        if (this.settings.reviewBeforeApply && !await new ConfirmModal(this.app, "Review lock-all operation", `${candidates.length} Markdown notes will be encrypted. Each file is checked for sync conflicts and verified before replacement.`, "Continue").waitForResult()) return;
        const password = await this.passwordForNewEncryption();
        if (!password) return;
        const progress = new ProgressModal(this.app, candidates.length);
        this.activeProgress = progress;
        if (this.support.automaticWindowsEnabled()) progress.open();
        else new import_obsidian10.Notice("Aegis: locking notes.");
        await new Promise((resolve) => window.setTimeout(diagnostics.wrap("main.timer_26", resolve), 0));
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
            diagnostics.failure("main.caught_27", error);
            new import_obsidian10.Notice(`Aegis skipped ${file.path}: ${error instanceof Error ? error.message : "operation failed"}`);
          }
        }
        progress.update(entries.length, progress.cancelled ? "Cancelled" : "Complete");
        progress.close();
        this.activeProgress = void 0;
        if (entries.length) this.undoRecord = { createdAt: Date.now(), entries };
        new import_obsidian10.Notice(`Aegis: locked ${entries.length} note(s)${progress.cancelled ? " before cancellation" : ""}.`);
      } catch (error) {
        diagnostics.failure("main.caught_28", error);
        (_d = this.activeProgress) == null ? void 0 : _d.close();
        this.activeProgress = void 0;
        notifyFailure(error);
      }
    } catch (diagnosticError17) {
      (_f = (_e = diagnostics) == null ? void 0 : _e.failure) == null ? void 0 : _f.call(_e, "main.lockAllNotes", diagnosticError17);
      throw diagnosticError17;
    } finally {
      this.selectionInFlight = false;
      diagnosticEnd17();
    }
  }
  async exportEncryptedBackup(file = this.currentFile()) {
    var _a, _b, _c, _d, _e;
    const diagnosticEnd18 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "main.exportEncryptedBackup")) != null ? _c : (() => {
    });
    try {
      if (!file || !isMarkdown(file)) {
        new import_obsidian10.Notice("Aegis: open a Markdown note first.");
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
        if (await this.app.vault.adapter.read(backupPath) !== backupResult) throw new Error("The backup could not be confirmed. Check the backup folder before retrying. Its credits are still reserved.");
        const committed = await (reservation == null ? void 0 : reservation.commit());
        if ((committed == null ? void 0 : committed.kind) === "pending") new import_obsidian10.Notice("Encrypted backup saved. Its charge is awaiting confirmation.");
        new import_obsidian10.Notice(`Aegis: encrypted backup written to ${backupPath}.`);
      } catch (error) {
        diagnostics.failure("main.caught_29", error);
        notifyFailure(error);
      }
    } catch (diagnosticError18) {
      (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "main.exportEncryptedBackup", diagnosticError18);
      throw diagnosticError18;
    } finally {
      diagnosticEnd18();
    }
  }
  async rollbackLastOperation() {
    var _a, _b, _c, _d, _e;
    const diagnosticEnd19 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "main.rollbackLastOperation")) != null ? _c : (() => {
    });
    try {
      const record = this.undoRecord;
      if (!(record == null ? void 0 : record.entries.length)) {
        new import_obsidian10.Notice("Aegis: no changes are available to restore in this session.");
        return;
      }
      if (this.settings.reviewBeforeApply && !await new ConfirmModal(this.app, "Roll back last Aegis operation", `Restore ${record.entries.length} original note(s)? Aegis will refuse if any file changed since the operation.`, "Roll back").waitForResult()) return;
      let restored = 0;
      const remaining = [];
      for (const entry of record.entries) {
        const file = this.app.vault.getAbstractFileByPath(entry.path);
        if (!(file instanceof import_obsidian10.TFile)) {
          remaining.push(entry);
          continue;
        }
        try {
          await this.atomicChange(file, entry.resulting, entry.original, false);
          restored++;
        } catch (caughtError30) {
          diagnostics.failure("main.caught_31", caughtError30);
          remaining.push(entry);
          new import_obsidian10.Notice(`Aegis: rollback refused for ${entry.path} because it changed.`);
        }
      }
      this.undoRecord = remaining.length ? { ...record, entries: remaining } : void 0;
      new import_obsidian10.Notice(`Aegis: rolled back ${restored} note(s)${remaining.length ? `; ${remaining.length} still available to retry` : ""}.`);
    } catch (diagnosticError19) {
      (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "main.rollbackLastOperation", diagnosticError19);
      throw diagnosticError19;
    } finally {
      diagnosticEnd19();
    }
  }
  async atomicChange(file, expected, next, recordUndo = true) {
    var _a, _b, _c, _d, _e;
    const diagnosticEnd20 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "main.atomicChange")) != null ? _c : (() => {
    });
    try {
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
        diagnostics.failure("main.caught_32", error);
        if (await this.app.vault.adapter.exists(tempPath)) await this.app.vault.adapter.remove(tempPath).catch((rejectedError3) => {
          diagnostics.failure("main.rejected_4", rejectedError3);
          return void 0;
        });
        throw error;
      }
    } catch (diagnosticError20) {
      (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "main.atomicChange", diagnosticError20);
      throw diagnosticError20;
    } finally {
      diagnosticEnd20();
    }
  }
  async applyProtectionChange(file, original, next, reservation, successNotice, recordUndo = true) {
    var _a, _b, _c, _d, _e;
    const diagnosticEnd21 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "main.applyProtectionChange")) != null ? _c : (() => {
    });
    try {
      try {
        if (reservation.markWriting && !await reservation.markWriting([{ path: file.path, before: await digest(original), after: await digest(next) }])) return true;
        await this.atomicChange(file, original, next, recordUndo);
        const result = await reservation.commit();
        if (result.kind === "insufficient") {
          try {
            await this.atomicChange(file, next, original, false);
          } catch (rollbackError) {
            diagnostics.failure("main.caught_33", rollbackError);
            throw new Error(`Aegis could not confirm the protection charge or restore the note safely: ${rollbackError instanceof Error ? rollbackError.message : "rollback failed"}`);
          }
          new import_obsidian10.Notice("Aegis: no purchased use was available; the note was left unchanged.");
          return false;
        }
        if (successNotice) {
          new import_obsidian10.Notice(result.kind === "pending" ? `${successNotice} Billing will retry the purchased-use charge.` : successNotice);
        }
        return true;
      } catch (error) {
        diagnostics.failure("main.caught_34", error);
        await reservation.rollback();
        throw error;
      }
    } catch (diagnosticError21) {
      (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "main.applyProtectionChange", diagnosticError21);
      throw diagnosticError21;
    } finally {
      diagnosticEnd21();
    }
  }
};
