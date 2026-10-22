"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// publish/src/matomo-client.js
var require_matomo_client = __commonJS({
  "publish/src/matomo-client.js"(exports, module2) {
    "use strict";
    (function(root, factory) {
      const api2 = factory();
      if (typeof module2 === "object" && module2.exports) module2.exports = api2;
      else root.TutivSoftMatomo = api2;
    })(globalThis, function() {
      "use strict";
      const actions = { feature: ["started", "completed", "failed"], onboarding: ["started", "completed"], ai: ["completed", "failed"], billing: ["checkout_opened"], error: ["operation_failed"], game: ["level_started", "level_completed", "level_failed"] };
      class MatomoClient2 {
        constructor(config, dependencies = {}) {
          this.config = config;
          this.enabled = config.enabled !== false;
          this.storage = dependencies.storage;
          this.send = dependencies.send;
          this.visitor = "";
          this.lastScreen = "";
          this.busy = false;
          this.initializing = null;
          this.transportPending = false;
        }
        get configured() {
          return this.enabled && Number.isInteger(this.config.siteId) && this.config.siteId > 1 && /^[a-z][a-z0-9_]{0,63}$/.test(this.config.product);
        }
        initialize() {
          if (!this.initializing) this.initializing = this.initializeOnce();
          return this.initializing;
        }
        async initializeOnce() {
          var _a, _b;
          if (!this.configured) return;
          try {
            const key = "matomo.v1." + this.config.product;
            this.visitor = await ((_a = this.storage) == null ? void 0 : _a.get(key)) || "";
            if (!/^[a-f0-9]{16}$/.test(this.visitor)) {
              const bytes = new Uint8Array(8);
              crypto.getRandomValues(bytes);
              this.visitor = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
              await ((_b = this.storage) == null ? void 0 : _b.set(key, this.visitor));
            }
          } catch (_) {
            this.enabled = false;
          }
        }
        screen(name) {
          if (!this.configured || !this.visitor) return Promise.resolve();
          if (!(this.config.screens || ["home", "settings", "login", "onboarding"]).includes(name) || name === this.lastScreen) return Promise.resolve();
          this.lastScreen = name;
          return this.track({ action_name: name }, name);
        }
        event(category, action, name, value) {
          if (!Object.prototype.hasOwnProperty.call(actions, category) || !actions[category].includes(action) || !(this.config.features || []).includes(name)) return Promise.resolve();
          if (value !== void 0 && (!Number.isFinite(value) || value < 0 || value > 864e5)) return Promise.resolve();
          return this.track({ e_c: category, e_a: action, e_n: name, ...value === void 0 ? {} : { e_v: String(value) } }, "feature");
        }
        async track(fields, screen) {
          if (!this.configured || !this.visitor || this.busy || this.transportPending) return;
          this.busy = true;
          const body = new URLSearchParams({ idsite: String(this.config.siteId), rec: "1", apiv: "1", _id: this.visitor, url: "https://tutivsoft.com/analytics/apps/" + this.config.product + "/" + (this.config.platform || "web") + "/" + screen, ...fields }).toString();
          const controller = new AbortController();
          let timer;
          try {
            let request;
            if (this.send) {
              this.transportPending = true;
              request = Promise.resolve().then(() => this.send(body));
              request = request.then(() => {
                this.transportPending = false;
              }, () => {
                this.transportPending = false;
              });
            } else request = fetch("https://atcdn.cyou/matomo.php", { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" }, credentials: "omit", referrerPolicy: "no-referrer", redirect: "error", signal: controller.signal });
            await Promise.race([request, new Promise((resolve) => {
              timer = setTimeout(() => {
                controller.abort();
                resolve();
              }, 5e3);
            })]);
          } catch (_) {
          } finally {
            clearTimeout(timer);
            this.busy = false;
          }
        }
      }
      function localStorageAdapter2(storage) {
        return { get: async (k) => storage.getItem(k), set: async (k, v) => storage.setItem(k, v) };
      }
      return { MatomoClient: MatomoClient2, localStorageAdapter: localStorageAdapter2 };
    });
  }
});

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
        const recover = (error) => {
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
          return isPromise(result) ? result.catch(recover) : result;
        } catch (error) {
          return recover(error);
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

// publish/src/billing-checkout.ts
var billing_checkout_exports = {};
__export(billing_checkout_exports, {
  cancelAccountCheckout: () => cancelAccountCheckout,
  openAccountCheckout: () => openAccountCheckout,
  openAccountCheckoutByPrice: () => openAccountCheckoutByPrice,
  prepareAccountCheckout: () => prepareAccountCheckout,
  recoverAccountCheckout: () => recoverAccountCheckout,
  resumeAccountCheckout: () => resumeAccountCheckout
});
function legacyPending(host) {
  return ["pendingPriceCheckout", "pendingPaddleCheckout", "previewPendingCheckout"].some((key) => !!host.state[key]) || !!host.state.pendingAccountCheckout && host.state.pendingAccountCheckout.version !== 2;
}
async function send(host, path, body) {
  const originalOwner = owner(host);
  const request = () => !host.state.billingAccountLinked || owner(host) !== originalOwner ? Promise.resolve({ status: 401 }) : (0, import_obsidian4.requestUrl)({
    url: `${CONSTANCE_API}${path}`,
    method: body ? "POST" : "GET",
    throw: false,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${host.state.billingAccessToken}` },
    ...body ? { body: JSON.stringify(body) } : {}
  });
  let response = await request();
  if (response.status === 401 && await host.refreshSession()) response = await request();
  return response;
}
function prepareAccountCheckout(host) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i;
  const purchase = host.state.pendingAccountCheckout;
  if (!purchase) return;
  const previous = preparations.get(host.state);
  if (previous) {
    previous.stop = true;
    clearTimeout(previous.timer);
    clearTimeout(previous.expiry);
    clearInterval(previous.displayTimer);
  }
  const preparation = { key: purchase.key, started: Date.now(), stop: false };
  preparations.set(host.state, preparation);
  const root = host.preparationRoot;
  (_a = root == null ? void 0 : root.querySelector(".checkout-preparation")) == null ? void 0 : _a.remove();
  const panel = root == null ? void 0 : root.createDiv({ cls: "checkout-preparation checkout-progress" });
  const progress = (_b = panel == null ? void 0 : panel.createEl) == null ? void 0 : _b.call(panel, "progress");
  progress == null ? void 0 : progress.setAttribute("aria-label", "Purchase in progress");
  progress == null ? void 0 : progress.setAttribute("max", "3");
  const steps = (_c = panel == null ? void 0 : panel.createEl) == null ? void 0 : _c.call(panel, "p", { text: "1. Open checkout / 2. Complete payment / 3. Verify access", cls: "checkout-progress-steps" });
  let message = "Please wait while we prepare your secure payment link. Checkout will open automatically. You can cancel this purchase below.";
  let checkButton, cancelButton;
  const feedback = panel ? new import_obsidian4.Setting(panel).setName("Preparing your payment") : void 0;
  const refreshMessage = () => {
    const seconds = Math.max(0, Math.floor((Date.now() - preparation.started) / 1e3));
    feedback == null ? void 0 : feedback.setDesc(`${message} Elapsed: ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}.`);
  };
  feedback == null ? void 0 : feedback.descEl.setAttribute("role", "status");
  feedback == null ? void 0 : feedback.descEl.setAttribute("aria-live", "polite");
  feedback == null ? void 0 : feedback.addButton((button) => {
    checkButton = button;
    button.setButtonText("Check payment").onClick(async () => {
      button.setDisabled(true);
      try {
        await recoverAccountCheckout(host, false);
        if (!host.state.pendingAccountCheckout) finish(completedMessage());
        else {
          message = "Purchase status checked. We will keep checking for confirmation.";
          refreshMessage();
        }
      } catch (error) {
        diagnostics.failure("billing-checkout.check-view", error);
        message = "Could not check payment yet. Your purchase is saved. Try Check payment again.";
        refreshMessage();
      } finally {
        button.setDisabled(!host.state.pendingAccountCheckout);
      }
    });
  }).addButton((button) => {
    cancelButton = button;
    button.setButtonText("Cancel current purchase").onClick(async () => {
      button.setDisabled(true);
      message = "Checking your purchase and requesting cancellation. Please wait.";
      refreshMessage();
      try {
        await cancelAccountCheckout(host);
        const pending = host.state.pendingAccountCheckout;
        if (!pending) finish(completedMessage());
        else {
          message = pending.cancelRequested ? "Cancellation requested. Checking every 5 seconds for confirmation." : pending.status === "paid" ? "Payment received. Waiting for your balance update. Do not pay again." : "Cancellation is not confirmed yet. We will keep checking your original purchase.";
          refreshMessage();
        }
      } catch (error) {
        diagnostics.failure("billing-checkout.cancel-view", error);
        finish("Cancellation could not be confirmed. Your purchase is saved. Use Check payment before buying again.", true);
      } finally {
        button.setDisabled(!host.state.pendingAccountCheckout || !!host.state.pendingAccountCheckout.cancelRequested || host.state.pendingAccountCheckout.status === "paid");
      }
    });
  });
  const finish = (text, canRetry = false) => {
    preparation.stop = true;
    clearTimeout(preparation.timer);
    clearTimeout(expiry);
    clearInterval(preparation.displayTimer);
    preparations.delete(host.state);
    message = text;
    refreshMessage();
    const completed = host.state.lastAccountCheckoutResult;
    if (progress) {
      if ((completed == null ? void 0 : completed.key) === preparation.key && completed.email === owner(host) && completed.fulfilled) {
        progress.value = 3;
        progress.setAttribute("aria-label", "Purchase complete");
      } else progress.hidden = true;
    }
    if (checkButton) checkButton.setDisabled(!host.state.pendingAccountCheckout);
    if (cancelButton) cancelButton.setDisabled(!host.state.pendingAccountCheckout || !!host.state.pendingAccountCheckout.cancelRequested || host.state.pendingAccountCheckout.status === "paid");
    resumeAccountCheckout(host);
  };
  refreshMessage();
  preparation.displayTimer = setInterval(() => {
    if ((panel == null ? void 0 : panel.isConnected) === false) {
      clearInterval(preparation.displayTimer);
      return;
    }
    refreshMessage();
  }, 1e3);
  (_e = (_d = preparation.displayTimer).unref) == null ? void 0 : _e.call(_d);
  (_f = panel == null ? void 0 : panel.scrollIntoView) == null ? void 0 : _f.call(panel, { block: "nearest" });
  const completedMessage = () => {
    const result = host.state.lastAccountCheckoutResult;
    if ((result == null ? void 0 : result.key) === preparation.key && result.email === owner(host)) {
      feedback == null ? void 0 : feedback.setName(result.fulfilled ? "Purchase complete" : "Purchase closed");
      return result.fulfilled ? "Payment confirmed. Your balance has been updated. You can use your purchased credits now." : `Purchase ${result.status}. Check your balance before buying again.`;
    }
    return "Purchase status updated. Check your account balance.";
  };
  const tick = async () => {
    var _a2, _b2;
    if (preparation.stop) return;
    const pending = host.state.pendingAccountCheckout;
    if (!pending) {
      finish(completedMessage());
      return;
    }
    if (pending.key !== preparation.key || pending.email !== owner(host) || !host.state.billingAccountLinked) {
      finish("Connect the purchasing account to check this payment.");
      return;
    }
    if (!running.has(host.state)) {
      const work = recoverAccountCheckout(host);
      running.set(host.state, work);
      try {
        await work;
      } catch (error) {
        diagnostics.failure("billing-checkout.prepare", error);
        message = "The payment service is taking longer. Your original purchase is saved. Please wait or cancel below.";
        refreshMessage();
      } finally {
        if (running.get(host.state) === work) running.delete(host.state);
      }
    }
    if (preparation.stop) return;
    const current = host.state.pendingAccountCheckout;
    if (!current) {
      finish(completedMessage());
      return;
    }
    if (current.key !== preparation.key || current.email !== owner(host) || !host.state.billingAccountLinked) {
      finish("Connect the purchasing account to check this payment.");
      return;
    }
    if (progress) {
      if (current.opened || current.status === "paid") progress.value = current.status === "paid" ? 2 : 1;
      else progress.removeAttribute("value");
    }
    feedback == null ? void 0 : feedback.setName(current.cancelRequested ? "Confirming cancellation" : current.status === "paid" ? "Verifying your payment" : current.opened ? "Waiting for payment confirmation" : "Preparing your payment");
    message = current.cancelRequested ? "Cancellation requested. Checking every 5 seconds for confirmation." : current.status === "paid" ? "Payment received. Waiting for your balance update. Do not pay again." : current.opened ? "Complete payment in your browser. We check every 5 seconds and will show when your balance is updated. Do not pay again." : "Preparing your payment link. Checking every 5 seconds. You can cancel below.";
    refreshMessage();
    if (cancelButton) cancelButton.setDisabled(!!current.cancelRequested || current.status === "paid");
    const remaining = 3e5 - (Date.now() - preparation.started);
    if (remaining <= 0) {
      finish("Confirmation is taking longer than five minutes. Use Check payment to continue checking this purchase. Do not pay again.", true);
      return;
    }
    if (remaining <= 2e3) return;
    preparation.timer = setTimeout(tick, Math.min(5e3, remaining));
    (_b2 = (_a2 = preparation.timer).unref) == null ? void 0 : _b2.call(_a2);
  };
  const expiry = setTimeout(() => finish("Confirmation is taking longer than five minutes. Use Check payment to continue checking this purchase. Do not pay again.", true), 3e5);
  preparation.expiry = expiry;
  (_g = expiry.unref) == null ? void 0 : _g.call(expiry);
  preparation.timer = setTimeout(tick, 3e3);
  (_i = (_h = preparation.timer).unref) == null ? void 0 : _i.call(_h);
}
function resumeAccountCheckout(host) {
  var _a;
  const pending = host.state.pendingAccountCheckout;
  if (!pending || legacyPending(host) || !host.state.billingAccountLinked || pending.email !== owner(host) || timers.has(host.state) || preparations.has(host.state)) return;
  const timer = setTimeout(() => {
    timers.delete(host.state);
    if (running.has(host.state)) {
      resumeAccountCheckout(host);
      return;
    }
    const operation = recoverAccountCheckout(host);
    running.set(host.state, operation);
    void operation.catch((error) => diagnostics.failure("billing-checkout.recover", error)).finally(() => {
      running.delete(host.state);
      resumeAccountCheckout(host);
    });
  }, 6e4);
  timers.set(host.state, timer);
  (_a = timer.unref) == null ? void 0 : _a.call(timer);
}
async function recoverAccountCheckout(host, allowOpen = true, createOnly = false) {
  var _a, _b, _c, _d, _e;
  const pending = host.state.pendingAccountCheckout;
  if (!pending || legacyPending(host) || !host.state.billingAccountLinked || pending.email !== owner(host)) return;
  const current = () => host.state.pendingAccountCheckout === pending && pending.email === owner(host) && host.state.billingAccountLinked;
  await host.persist();
  if (!current()) return;
  let response;
  if (!pending.checkoutId) {
    response = await send(host, "/checkouts", { app_id: host.appId, offer_code: pending.plan, retry_key: pending.key, return_url: null });
    const data2 = (_a = response.json) == null ? void 0 : _a.data;
    const rejected = [
      "offer_unavailable",
      "payment_provider_disabled",
      "new_sales_disabled",
      "owner_membership_required",
      "account_unavailable",
      "merchant_not_qualified",
      "country_not_qualified",
      "currency_not_qualified",
      "return_url_not_allowed",
      "provider_price_unavailable",
      "provider_price_readback_unavailable",
      "provider_grant_mapping_unavailable"
    ];
    if (current() && rejected.includes((_c = (_b = response.json) == null ? void 0 : _b.error) == null ? void 0 : _c.code)) {
      host.state.pendingAccountCheckout = null;
      await host.persist();
      new import_obsidian4.Notice("This offer is unavailable. Refresh the plans and choose an available offer.");
      return;
    }
    if (!current() || response.status !== 202 || !validCheckout(data2, host, pending)) return;
    pending.checkoutId = data2.checkout_id;
    await host.persist();
  }
  if (createOnly) return;
  response = await send(host, `/checkouts/${encodeURIComponent(pending.checkoutId)}`);
  const data = (_d = response.json) == null ? void 0 : _d.data;
  if (!current() || response.status !== 200 || !validCheckout(data, host, pending) || data.checkout_id !== pending.checkoutId) return;
  pending.status = data.status;
  pending.cancelRequested = ((_e = data.checkout_instructions) == null ? void 0 : _e.cancellation_requested) === true;
  await host.persist();
  if (!current()) return;
  if (data.fulfillment_status === "fulfilled") {
    await host.syncBalance();
    if (!current()) return;
    host.state.lastAccountCheckoutResult = { key: pending.key, email: pending.email, status: data.status, fulfilled: true };
    host.state.pendingAccountCheckout = null;
    await host.persist();
  } else if (["cancelled", "canceled", "failed", "expired", "voided", "rejected", "declined"].includes(data.status)) {
    host.state.lastAccountCheckoutResult = { key: pending.key, email: pending.email, status: data.status, fulfilled: false };
    host.state.pendingAccountCheckout = null;
    await host.persist();
  } else if (allowOpen && data.status !== "paid" && !pending.cancelRequested && typeof data.checkout_url === "string" && /^https:\/\//.test(data.checkout_url) && !pending.opened) {
    window.open(data.checkout_url, "_blank", "noopener");
    pending.opened = true;
    await host.persist();
  }
}
function validCheckout(data, host, pending) {
  var _a;
  return (data == null ? void 0 : data.app_id) === host.appId && ((_a = data == null ? void 0 : data.offer) == null ? void 0 : _a.code) === pending.plan && typeof (data == null ? void 0 : data.checkout_id) === "string" && !!data.checkout_id;
}
async function openAccountCheckout(host, plan) {
  if (running.has(host.state)) return running.get(host.state);
  if (!host.state.billingAccountLinked) {
    new import_obsidian4.Notice("Connect your account first.");
    return;
  }
  if (legacyPending(host)) {
    new import_obsidian4.Notice("An older purchase is unresolved. Connect its account and contact support before another purchase.");
    return;
  }
  let saved = host.state.pendingAccountCheckout;
  if (saved && saved.email !== owner(host)) {
    new import_obsidian4.Notice("Connect the account that owns the pending purchase first.");
    return;
  }
  const operation = (async () => {
    if (saved && saved.plan !== plan) {
      try {
        await recoverAccountCheckout(host, false);
      } catch (error) {
        diagnostics.failure("billing-checkout.refresh", error);
      }
      saved = host.state.pendingAccountCheckout;
      if (saved) {
        new import_obsidian4.Notice("A purchase is still pending. Use Cancel current purchase, then wait for confirmation before choosing another pack.");
        resumeAccountCheckout(host);
        return;
      }
    }
    host.state.pendingAccountCheckout = saved || { version: 2, key: `checkout_${globalThis.crypto.randomUUID()}`, plan, email: owner(host), startedAt: Date.now() };
    if (saved) saved.opened = false;
    prepareAccountCheckout(host);
    try {
      await recoverAccountCheckout(host, true, true);
    } catch (error) {
      diagnostics.failure("billing-checkout.open", error);
      new import_obsidian4.Notice("Checkout is still being confirmed. Retry the same purchase to recover it safely.");
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
async function cancelAccountCheckout(host) {
  if (running.has(host.state)) {
    await running.get(host.state);
  }
  if (!host.state.billingAccountLinked) {
    new import_obsidian4.Notice("Connect your account first.");
    return;
  }
  if (legacyPending(host)) {
    new import_obsidian4.Notice("An older purchase needs account support before it can be cancelled.");
    return;
  }
  const operation = (async () => {
    try {
      await recoverAccountCheckout(host, false);
      const pending = host.state.pendingAccountCheckout;
      if (!pending) {
        new import_obsidian4.Notice("Purchase status updated. You can choose another pack.");
        return;
      }
      if (!pending.checkoutId || pending.email !== owner(host)) {
        new import_obsidian4.Notice("Purchase confirmation is pending. Check status again shortly.");
        return;
      }
      const response = await send(host, `/checkouts/${encodeURIComponent(pending.checkoutId)}/cancel`, {});
      if (response.status !== 200) {
        new import_obsidian4.Notice("Checkout could not be cancelled yet. Check purchase status before trying again.");
        return;
      }
      await recoverAccountCheckout(host, false);
      new import_obsidian4.Notice(host.state.pendingAccountCheckout ? "Cancellation requested. Constance will confirm it before another purchase can start." : "Purchase status updated. You can choose another pack.");
    } catch (error) {
      diagnostics.failure("billing-checkout.cancel", error);
      new import_obsidian4.Notice("Cancellation is still being confirmed. Your purchase is retained; check status again shortly.");
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
var import_obsidian4, running, timers, owner, preparations, openAccountCheckoutByPrice;
var init_billing_checkout = __esm({
  "publish/src/billing-checkout.ts"() {
    "use strict";
    init_diagnostics();
    import_obsidian4 = require("obsidian");
    init_constance_v2();
    running = /* @__PURE__ */ new WeakMap();
    timers = /* @__PURE__ */ new WeakMap();
    owner = (host) => host.state.billingEmail.trim().toLowerCase();
    preparations = /* @__PURE__ */ new WeakMap();
    openAccountCheckoutByPrice = openAccountCheckout;
  }
});

// publish/src/constance-v2.ts
var constance_v2_exports = {};
__export(constance_v2_exports, {
  BILLING_UNIT: () => BILLING_UNIT,
  CONSTANCE_API: () => CONSTANCE_API,
  accountBalance: () => accountBalance,
  syncEntitlements: () => syncEntitlements
});
function accountBalance(data, appId) {
  const balances = data == null ? void 0 : data.balances;
  if ((data == null ? void 0 : data.app_id) !== appId || !Number.isSafeInteger(data.revision) || data.revision < 0 || !Array.isArray(balances)) throw new Error("Account balance could not be verified.");
  const rows = balances.filter((row2) => (row2 == null ? void 0 : row2.unit) === BILLING_UNIT);
  if (rows.length !== 1) throw new Error("Account balance could not be verified.");
  const row = rows[0];
  if (![row.free_remaining, row.free_held, row.paid_balance, row.paid_held, row.spendable, row.deficit].every(Number.isSafeInteger) || [row.free_remaining, row.free_held, row.paid_held, row.spendable, row.deficit].some((n) => n < 0) || row.free_held > row.free_remaining) throw new Error("Account balance could not be verified.");
  const free = Math.max(0, row.free_remaining - row.free_held);
  const paid = Math.max(0, row.paid_balance - row.paid_held);
  if (row.spendable !== free + paid) throw new Error("Account balance could not be verified.");
  return { ...data, free_usage: { remaining: row.deficit ? 0 : free }, credits: { balance: row.deficit ? 0 : paid, total_available: row.deficit ? 0 : paid } };
}
function syncEntitlements(state, persist) {
  const previous = balanceLocks.get(state) || Promise.resolve();
  const operation = previous.catch(() => {
  }).then(() => syncEntitlementsInternal(state, persist));
  balanceLocks.set(state, operation);
  return operation.finally(() => {
    if (balanceLocks.get(state) === operation) balanceLocks.delete(state);
  });
}
async function syncEntitlementsInternal(state, persist) {
  var _a, _b, _c;
  const { requestAuthenticatedBilling: requestAuthenticatedBilling2 } = await Promise.resolve().then(() => (init_constance_account(), constance_account_exports));
  if (!state.billingAccountLinked) throw new Error("Connect your account first.");
  const { resumeAccountCheckout: resumeAccountCheckout2 } = await Promise.resolve().then(() => (init_billing_checkout(), billing_checkout_exports));
  const { refreshBillingSession: refreshBillingSession2 } = await Promise.resolve().then(() => (init_constance_account(), constance_account_exports));
  resumeAccountCheckout2({ state, appId: "aegis-note-locker", installationId: state.constanceDeviceId || state.deviceId, persist, syncBalance: () => syncEntitlements(state, persist), refreshSession: () => refreshBillingSession2(state, persist) });
  const originalOwner = state.billingEmail.trim().toLowerCase();
  const response = await requestAuthenticatedBilling2(state, persist, { url: CONSTANCE_API + "/billing/entitlements/me?app_id=aegis-note-locker", method: "GET", throw: false });
  if (response.status !== 200 || !state.billingAccountLinked || state.billingEmail.trim().toLowerCase() !== originalOwner) throw new Error("Balance refresh is pending. Reconnect or try again.");
  const data = accountBalance((_a = response.json) == null ? void 0 : _a.data, "aegis-note-locker");
  state.freeUsesUsed = Math.max(0, 5 - data.free_usage.remaining);
  state.purchasedUses = data.credits.balance;
  await persist();
  if (!state.billingAccountLinked || state.billingEmail.trim().toLowerCase() !== originalOwner) throw new Error("Account changed while saving balance.");
  const ack = await requestAuthenticatedBilling2(state, persist, { url: CONSTANCE_API + "/billing/sync", method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ app_id: "aegis-note-locker", revision: data.revision }), throw: false });
  if (ack.status !== 200 || !Number.isSafeInteger((_c = (_b = ack.json) == null ? void 0 : _b.data) == null ? void 0 : _c.recorded_revision) || ack.json.data.recorded_revision < data.revision) throw new Error("Balance saved. Server acknowledgement is pending.");
  return data;
}
var CONSTANCE_API, BILLING_UNIT, balanceLocks;
var init_constance_v2 = __esm({
  "publish/src/constance-v2.ts"() {
    "use strict";
    CONSTANCE_API = "https://app.tutivsoft.com/api/v2";
    BILLING_UNIT = "protection_operations";
    balanceLocks = /* @__PURE__ */ new WeakMap();
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
function applySettingsLayout(root, appId, appVersion) {
  var _a, _b;
  if (root.querySelector(":scope > .ui-settings-section")) return;
  root.addClass("ui-settings-layout", "aegis-note-locker-settings");
  const nodes = Array.from(root.children);
  const account = nodes.find((node) => node.classList.contains("constance-account-billing-section"));
  let accountCard;
  if (account) {
    account.addClass("ui-settings-section", "ui-section-billing");
    const heading = account.querySelector(":scope > h3");
    heading == null ? void 0 : heading.addClass("ui-section-heading");
    if (heading) heading.textContent = "Account";
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
      billingContext = /^(?:Billing(?: & usage)?|Credits & billing)$/i.test(name);
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
      if (node.tagName === "P") {
        node.addClass("ui-billing-summary");
        if (billingContext && !/summary/.test(node.className.replace(/ui-billing-summary/g, ""))) node.addClass("ui-credit-usage");
      }
      continue;
    }
    billingContext = false;
    current || (current = makeSection(root, "Everyday settings"));
    current.appendChild(node);
    if (node.tagName === "P") node.addClass("ui-section-note");
  }
  root.querySelectorAll('[class*="summary"]').forEach((summary) => {
    if (!Array.from(summary.classList).some((cls) => cls !== "ui-billing-summary" && cls !== "ui-credit-usage" && /(?:credit|balance|billing|usage).*summary/.test(cls))) return;
    summary.classList.remove("ui-credit-usage");
    if (accountCard && !accountCard.contains(summary)) accountCard.appendChild(summary);
  });
  const packs = accountCard == null ? void 0 : accountCard.querySelector(".ui-billing-packs");
  let purchaseSection;
  if (packs) {
    const purchaseCard = makeSection(root, "Buy credits", "billing");
    accountCard == null ? void 0 : accountCard.querySelectorAll(".ui-credit-usage").forEach((note) => purchaseCard.appendChild(note));
    purchaseCard.appendChild(packs);
    purchaseSection = purchaseCard.parentElement;
    account == null ? void 0 : account.after(purchaseSection);
  }
  if (viewSection) {
    if (purchaseSection) purchaseSection.after(viewSection);
    else if (account) account.after(viewSection);
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
  if (appVersion) root.createEl("footer", { text: `Version ${appVersion}`, cls: "setting-item-description" });
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
      return ((_c = (_b = (_a2 = diagnostics) == null ? void 0 : _a2.request) == null ? void 0 : _b.call(_a2, "network.account-guidance.renderAccountGuidance", import_obsidian5.requestUrl, { url: `https://app.tutivsoft.com/api/v2/billing/policy?app_id=${encodeURIComponent(host.appId)}`, method: "GET", throw: false })) != null ? _c : (0, import_obsidian5.requestUrl)({ url: `https://app.tutivsoft.com/api/v2/billing/policy?app_id=${encodeURIComponent(host.appId)}`, method: "GET", throw: false })).then((response) => {
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
var import_obsidian5;
var init_account_guidance = __esm({
  "publish/src/account-guidance.ts"() {
    "use strict";
    init_diagnostics();
    import_obsidian5 = require("obsidian");
  }
});

// publish/src/constance-account.ts
var constance_account_exports = {};
__export(constance_account_exports, {
  CONSTANCE_ACCOUNT_BASE_URL: () => CONSTANCE_ACCOUNT_BASE_URL,
  activeBillingToken: () => activeBillingToken,
  addBillingAccountSettings: () => addBillingAccountSettings,
  authenticatedBillingRequest: () => authenticatedBillingRequest,
  billingRequest: () => billingRequest,
  claimAccountFreeUsage: () => claimAccountFreeUsage,
  clearBillingSession: () => clearBillingSession,
  createAuthenticatedCheckout: () => createAuthenticatedCheckout,
  ensureBillingAccessToken: () => ensureBillingAccessToken,
  pollAuthenticatedCheckout: () => pollAuthenticatedCheckout,
  refreshBillingAccessToken: () => refreshBillingAccessToken,
  refreshBillingSession: () => refreshBillingSession,
  registerBillingAccount: () => registerBillingAccount,
  registerBillingPersister: () => registerBillingPersister,
  requestAuthenticatedBilling: () => requestAuthenticatedBilling,
  showAccountWelcome: () => showAccountWelcome,
  signInBillingAccount: () => signInBillingAccount,
  signOutBillingAccount: () => signOutBillingAccount,
  spendAccountCredits: () => spendAccountCredits,
  validateBillingSession: () => validateBillingSession,
  verifyBillingAccount: () => verifyBillingAccount,
  verifyBillingAccountRegistration: () => verifyBillingAccountRegistration
});
async function connectWithinDeadline(state, operation, refresh) {
  if (pendingConnections.has(state)) throw new Error("account_connection_pending");
  pendingConnections.add(state);
  const request = Promise.resolve().then(operation);
  const finish = () => {
    pendingConnections.delete(state);
    try {
      refresh();
    } catch (_) {
    }
  };
  request.then(finish, finish);
  let timer;
  try {
    await Promise.race([request, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("account_connection_pending")), 15e3);
    })]);
  } finally {
    if (timer !== void 0) clearTimeout(timer);
  }
}
function errorDetail(response, fallback) {
  var _a, _b;
  const payload = ((_a = response.json) == null ? void 0 : _a.error) || ((_b = response.json) == null ? void 0 : _b.data) || response.json;
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
async function authenticate(mode, email, password, appId) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const action = mode === "connect" ? "login" : mode;
  const response = await (0, import_obsidian6.requestUrl)({
    url: `${CONSTANCE_API}/auth/${action}`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, app_id: appId, ...action === "login" ? { mode: "customer" } : {} }),
    throw: false
  });
  if (response.status < 200 || response.status >= 300) {
    const error = new ConstanceAccountError(errorDetail(response, "Could not connect your account. Try again."), response.status);
    error.code = ((_b = (_a = response.json) == null ? void 0 : _a.error) == null ? void 0 : _b.code) || ((_d = (_c = response.json) == null ? void 0 : _c.detail) == null ? void 0 : _d.code) || ((_g = (_f = (_e = response.json) == null ? void 0 : _e.data) == null ? void 0 : _f.detail) == null ? void 0 : _g.code);
    if (mode === "connect" && error.code === "invalid_credentials") return authenticate("register", email, password, appId);
    throw error;
  }
  if (action === "register" && response.status === 202) return { verificationRequired: true };
  const data = (_h = response.json) == null ? void 0 : _h.data;
  if ((data == null ? void 0 : data.access_token) && (data == null ? void 0 : data.refresh_token)) return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
  throw new Error("Could not sign in. Try connecting again.");
}
async function linkInstallation(adapter, token) {
  var _a, _b, _c, _d;
  const state = adapter.state;
  const owner3 = state.billingEmail.trim().toLowerCase();
  const current = () => state.billingAccessToken === token && state.billingEmail.trim().toLowerCase() === owner3;
  if (!current()) throw new Error("Account connection changed.");
  if (state.billingV2InstallationOwner && state.billingV2InstallationId && state.billingV2InstallationToken) {
    state.billingV2Installations || (state.billingV2Installations = {});
    state.billingV2Installations[state.billingV2InstallationOwner] = { id: state.billingV2InstallationId, token: state.billingV2InstallationToken };
  }
  if (state.billingV2InstallationOwner !== owner3) {
    const saved = (_a = state.billingV2Installations) == null ? void 0 : _a[owner3];
    state.billingV2InstallationId = saved == null ? void 0 : saved.id;
    state.billingV2InstallationToken = saved == null ? void 0 : saved.token;
    state.billingV2InstallationOwner = owner3;
  }
  if (!state.billingV2InstallationId || !state.billingV2InstallationToken) {
    const created = await (0, import_obsidian6.requestUrl)({ url: `${CONSTANCE_API}/public/installations`, method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ app_id: adapter.appId }), throw: false });
    const data = (_b = created.json) == null ? void 0 : _b.data;
    if (created.status !== 201 || !(data == null ? void 0 : data.installation_id) || !(data == null ? void 0 : data.installation_token)) throw new ConstanceAccountError(errorDetail(created, "Could not register this installation."), created.status);
    if (!current()) throw new Error("Account connection changed.");
    state.billingV2InstallationId = String(data.installation_id);
    state.billingV2InstallationToken = String(data.installation_token);
    state.billingV2InstallationOwner = owner3;
    await adapter.persist();
  }
  await adapter.persist();
  if (!current()) throw new Error("Account connection changed.");
  const response = await (0, import_obsidian6.requestUrl)({
    url: `${CONSTANCE_API}/billing/installations/link`,
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ installation_id: state.billingV2InstallationId, token: state.billingV2InstallationToken }),
    throw: false
  });
  if (response.status < 200 || response.status >= 300) throw new ConstanceAccountError(errorDetail(response, "Could not connect this installation."), response.status);
  if (((_d = (_c = response.json) == null ? void 0 : _c.data) == null ? void 0 : _d.linked) !== true || response.json.data.installation_id !== state.billingV2InstallationId) throw new Error("Installation ownership could not be verified.");
}
async function signInBillingAccount(adapter, password, mode) {
  var _a, _b, _c, _d, _e;
  const diagnosticEnd4 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "constance-account.signInBillingAccount")) != null ? _c : (() => {
  });
  try {
    const email = adapter.state.billingEmail.trim().toLowerCase();
    const journalState = adapter.state;
    const owner3 = String(journalState.pendingBillingOwnerEmail || "").toLowerCase();
    if (owner3 && owner3 !== email) throw new Error(`A pending action belongs to ${owner3}. Connect that account to resume it first.`);
    const unfinished = (journalState.operationJournal || []).filter((item) => ["requesting", "reserved", "writing", "verified", "uncertain_released"].includes(item.state));
    if (unfinished.some((item) => item.account !== email)) throw new Error("A saved conversion belongs to another account. Connect that account first.");
    const pending = [journalState.pendingAccountCheckout, journalState.pendingPriceCheckout, journalState.pendingPaddleCheckout, journalState.previewPendingCheckout, ...journalState.pendingSpendEvents || []].filter(Boolean);
    if (pending.some((item) => String(item.owner || item.email || journalState.billingV2InstallationOwner || email).trim().toLowerCase() !== email)) throw new Error("A pending action belongs to another account. Connect that account first.");
    if (!email || !email.includes("@")) throw new Error("Enter a valid email address.");
    if (Array.from(password).length < 1 || Array.from(password).length > 256) throw new Error("Enter a password of up to 256 characters. New accounts require at least 12 characters.");
    if (!adapter.installationId) throw new Error("The plugin is still starting. Try again shortly.");
    const result = await authenticate(mode, email, password, adapter.appId);
    if (!result.accessToken) {
      clearBillingSession(adapter.state);
      adapter.state.billingEmail = email;
      adapter.state.billingAccountLinked = false;
      adapter.state.billingRegistrationPending = true;
      await adapter.persist();
      throw new Error("Registered but not logged in. Check your email, click the confirmation link, then sign in here.");
    }
    await completeBillingSignIn(adapter, email, result);
  } catch (diagnosticError4) {
    (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "constance-account.signInBillingAccount", diagnosticError4);
    throw diagnosticError4;
  } finally {
    diagnosticEnd4();
  }
}
async function completeBillingSignIn(adapter, email, session) {
  var _a, _b, _c, _d, _e;
  const diagnosticEnd5 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "constance-account.completeBillingSignIn")) != null ? _c : (() => {
  });
  try {
    if (!session.accessToken || !session.refreshToken) throw new Error("Could not complete sign-in. Try connecting again.");
    adapter.state.billingEmail = email;
    adapter.state.billingAccessToken = session.accessToken;
    adapter.state.billingRefreshToken = session.refreshToken;
    adapter.state.billingAccessTokenExpiresAt = Date.now() + (session.expiresIn || 900) * 1e3;
    adapter.state.billingAccountLinked = false;
    adapter.state.billingRegistrationPending = false;
    await adapter.persist();
    if (adapter.state.billingAccessToken !== session.accessToken || adapter.state.billingEmail !== email) throw new Error("Account connection changed. Connect again.");
    await linkAuthenticatedInstallation(adapter, session.accessToken);
    if (adapter.state.billingAccessToken !== session.accessToken || adapter.state.billingEmail !== email) throw new Error("Account connection changed. Connect again.");
    adapter.state.billingAccountLinked = true;
    await adapter.persist();
    await adapter.syncBalance();
  } catch (diagnosticError5) {
    (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "constance-account.completeBillingSignIn", diagnosticError5);
    throw diagnosticError5;
  } finally {
    diagnosticEnd5();
  }
}
async function verifyBillingAccount(adapter, verificationToken) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
  const diagnosticEnd6 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "constance-account.verifyBillingAccount")) != null ? _c : (() => {
  });
  try {
    const token = verificationToken.trim();
    if (!token) throw new Error("Enter the verification code from your email.");
    const response = await ((_f = (_e = (_d = diagnostics) == null ? void 0 : _d.request) == null ? void 0 : _e.call(_d, "network.constance-account.verifyBillingAccount", import_obsidian6.requestUrl, {
      url: `${CONSTANCE_API}/auth/verify`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      throw: false
    })) != null ? _f : (0, import_obsidian6.requestUrl)({
      url: `${CONSTANCE_API}/auth/verify`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      throw: false
    }));
    if (response.status < 200 || response.status >= 300) {
      throw new ConstanceAccountError(errorDetail(response, `Your account could not be verified. Try connecting again.`), response.status);
    }
    if (((_h = (_g = response.json) == null ? void 0 : _g.data) == null ? void 0 : _h.verified) !== true) throw new Error("Email verification could not be confirmed.");
    clearBillingSession(adapter.state);
    adapter.state.billingRegistrationPending = false;
    await adapter.persist();
    new import_obsidian6.Notice("Email verified. Connect again to sign in.");
  } catch (diagnosticError6) {
    (_j = (_i = diagnostics) == null ? void 0 : _i.failure) == null ? void 0 : _j.call(_i, "constance-account.verifyBillingAccount", diagnosticError6);
    throw diagnosticError6;
  } finally {
    diagnosticEnd6();
  }
}
function clearBillingSession(input, _persist) {
  const state = "state" in input ? input.state : input;
  state.billingAccessToken = "";
  state.billingRefreshToken = "";
  state.billingAccessTokenExpiresAt = 0;
  state.billingAccountLinked = false;
}
async function refreshBillingSession(state, persist = async () => {
}) {
  var _a, _b, _c, _d, _e;
  const diagnosticEnd7 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "constance-account.refreshBillingSession")) != null ? _c : (() => {
  });
  try {
    if (!state.billingRefreshToken) return false;
    const pendingRefresh = refreshes.get(state);
    if (pendingRefresh) return await pendingRefresh;
    const originalToken = state.billingRefreshToken;
    const refreshInFlight = (async () => {
      var _a2, _b2, _c2, _d2, _e2, _f, _g, _h, _i, _j, _k, _l, _m, _n;
      const diagnosticEnd8 = (_c2 = (_b2 = (_a2 = diagnostics) == null ? void 0 : _a2.start) == null ? void 0 : _b2.call(_a2, "constance-account.background.8317")) != null ? _c2 : (() => {
      });
      try {
        let response;
        try {
          response = await ((_f = (_e2 = (_d2 = diagnostics) == null ? void 0 : _d2.request) == null ? void 0 : _e2.call(_d2, "network.constance-account.refreshBillingSession", import_obsidian6.requestUrl, { url: `${CONSTANCE_API}/auth/refresh`, method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: originalToken }), throw: false })) != null ? _f : (0, import_obsidian6.requestUrl)({ url: `${CONSTANCE_API}/auth/refresh`, method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: originalToken }), throw: false }));
        } catch (caughtError2) {
          diagnostics.failure("constance-account.caught_3", caughtError2);
          return false;
        }
        if (state.billingRefreshToken !== originalToken) return false;
        if (response.status === 401 || response.status === 403) {
          clearBillingSession(state);
          await persist();
          return false;
        }
        if (response.status < 200 || response.status >= 300) return false;
        const access = String(((_h = (_g = response.json) == null ? void 0 : _g.data) == null ? void 0 : _h.access_token) || "");
        const refresh = String(((_j = (_i = response.json) == null ? void 0 : _i.data) == null ? void 0 : _j.refresh_token) || "");
        if (!access || !refresh) {
          clearBillingSession(state);
          await persist();
          return false;
        }
        state.billingAccessToken = access;
        state.billingRefreshToken = refresh;
        state.billingAccessTokenExpiresAt = Date.now() + (Number((_l = (_k = response.json) == null ? void 0 : _k.data) == null ? void 0 : _l.expires_in) || 900) * 1e3;
        await persist();
        return true;
      } catch (diagnosticError8) {
        (_n = (_m = diagnostics) == null ? void 0 : _m.failure) == null ? void 0 : _n.call(_m, "constance-account.background.8317", diagnosticError8);
        throw diagnosticError8;
      } finally {
        diagnosticEnd8();
      }
    })();
    refreshes.set(state, refreshInFlight);
    try {
      return await refreshInFlight;
    } finally {
      refreshes.delete(state);
    }
  } catch (diagnosticError7) {
    (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "constance-account.refreshBillingSession", diagnosticError7);
    throw diagnosticError7;
  } finally {
    diagnosticEnd7();
  }
}
async function requestAuthenticatedBilling(state, persist, options = void 0) {
  var _a, _b, _c, _d, _e;
  if (!options) {
    options = persist;
    persist = async () => {
    };
  }
  const diagnosticEnd9 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "constance-account.requestAuthenticatedBilling")) != null ? _c : (() => {
  });
  try {
    if (state.billingRefreshToken && (!state.billingAccessToken || Date.now() >= Number(state.billingAccessTokenExpiresAt || 0) - 6e4)) {
      if (!await refreshBillingSession(state, persist) && state.billingRefreshToken) return { status: 503 };
    }
    const send2 = () => {
      var _a2, _b2, _c2;
      return (_c2 = (_b2 = (_a2 = diagnostics) == null ? void 0 : _a2.request) == null ? void 0 : _b2.call(_a2, "network.constance-account.requestAuthenticatedBilling", import_obsidian6.requestUrl, { ...options, headers: { ...options.headers || {}, Authorization: `Bearer ${state.billingAccessToken}` }, throw: false })) != null ? _c2 : (0, import_obsidian6.requestUrl)({ ...options, headers: { ...options.headers || {}, Authorization: `Bearer ${state.billingAccessToken}` }, throw: false });
    };
    if (!state.billingAccessToken) return { status: 401 };
    let response = await send2();
    if (response.status === 401 && state.billingRefreshToken) {
      if (await refreshBillingSession(state, persist)) response = await send2();
      else if (state.billingRefreshToken) return { status: 503 };
    }
    return await response;
  } catch (diagnosticError9) {
    (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "constance-account.requestAuthenticatedBilling", diagnosticError9);
    throw diagnosticError9;
  } finally {
    diagnosticEnd9();
  }
}
async function createAuthenticatedCheckout(adapter, planCode, idempotencyKey) {
  var _a, _b, _c, _d, _e, _f, _g;
  const diagnosticEnd10 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "constance-account.createAuthenticatedCheckout")) != null ? _c : (() => {
  });
  try {
    if (!adapter.state.billingAccessToken || !adapter.state.billingAccountLinked) return { kind: "auth-required" };
    const pending = adapter.state.pendingAccountCheckout;
    if ((pending == null ? void 0 : pending.version) !== 2 || (pending == null ? void 0 : pending.key) !== idempotencyKey || (pending == null ? void 0 : pending.plan) !== planCode || (pending == null ? void 0 : pending.email) !== adapter.state.billingEmail.trim().toLowerCase()) return { kind: "fallback" };
    await adapter.persist();
    const response = await requestAuthenticatedBilling(adapter.state, adapter.persist, {
      url: `${CONSTANCE_API}/checkouts`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify({ app_id: adapter.appId, offer_code: planCode, retry_key: idempotencyKey, return_url: null }),
      throw: false
    });
    if (response.status === 401 || response.status === 403) return { kind: "auth-required" };
    if (response.status < 200 || response.status >= 300) return { kind: "fallback" };
    const data = (_d = response.json) == null ? void 0 : _d.data;
    const checkoutUrl = typeof (data == null ? void 0 : data.checkout_url) === "string" ? data.checkout_url : "";
    return (data == null ? void 0 : data.app_id) === adapter.appId && ((_e = data == null ? void 0 : data.offer) == null ? void 0 : _e.code) === planCode && (data == null ? void 0 : data.checkout_id) ? { kind: "ok", checkoutUrl, checkoutId: (data == null ? void 0 : data.checkout_id) ? String(data.checkout_id) : void 0 } : { kind: "fallback" };
  } catch (diagnosticError10) {
    (_g = (_f = diagnostics) == null ? void 0 : _f.failure) == null ? void 0 : _g.call(_f, "constance-account.createAuthenticatedCheckout", diagnosticError10);
    throw diagnosticError10;
  } finally {
    diagnosticEnd10();
  }
}
async function pollAuthenticatedCheckout(adapter, checkoutId) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
  const diagnosticEnd11 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "constance-account.pollAuthenticatedCheckout")) != null ? _c : (() => {
  });
  try {
    if (!adapter.state.billingAccessToken || !adapter.state.billingAccountLinked) return false;
    const response = await requestAuthenticatedBilling(adapter.state, adapter.persist, {
      url: `${CONSTANCE_API}/checkouts/${encodeURIComponent(checkoutId)}`,
      method: "GET",
      throw: false
    });
    return await (response.status >= 200 && response.status < 300 && ((_e = (_d = response.json) == null ? void 0 : _d.data) == null ? void 0 : _e.app_id) === adapter.appId && ((_g = (_f = response.json) == null ? void 0 : _f.data) == null ? void 0 : _g.checkout_id) === checkoutId && ((_i = (_h = response.json) == null ? void 0 : _h.data) == null ? void 0 : _i.fulfillment_status) === "fulfilled");
  } catch (diagnosticError11) {
    (_k = (_j = diagnostics) == null ? void 0 : _j.failure) == null ? void 0 : _k.call(_j, "constance-account.pollAuthenticatedCheckout", diagnosticError11);
    throw diagnosticError11;
  } finally {
    diagnosticEnd11();
  }
}
async function validateBillingSession(adapter) {
  var _a, _b, _c, _d, _e;
  const diagnosticEnd12 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "constance-account.validateBillingSession")) != null ? _c : (() => {
  });
  try {
    resumeAccountCheckout({ ...adapter, refreshSession: () => refreshBillingSession(adapter.state, adapter.persist) });
    const token = adapter.state.billingAccessToken;
    if (!token || !adapter.state.billingAccountLinked || !adapter.installationId) return false;
    const query = new URLSearchParams({ app_id: adapter.appId, installation_id: adapter.installationId });
    const response = await requestAuthenticatedBilling(adapter.state, adapter.persist, {
      url: `${CONSTANCE_API}/billing/entitlements/me?${query.toString()}`,
      method: "GET",
      throw: false
    });
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      clearBillingSession(adapter.state);
      await adapter.persist();
      return false;
    }
    return await (response.status >= 200 && response.status < 300);
  } catch (diagnosticError12) {
    (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "constance-account.validateBillingSession", diagnosticError12);
    throw diagnosticError12;
  } finally {
    diagnosticEnd12();
  }
}
async function claimAccountFreeUsage(..._args) {
  return { kind: "error" };
}
async function spendAccountCredits(..._args) {
  return { kind: "error" };
}
function addBillingAccountSettings(containerEl, adapter) {
  resumeAccountCheckout({ ...adapter, refreshSession: () => refreshBillingSession(adapter.state, adapter.persist) });
  let password = "";
  const section = containerEl.createDiv({ cls: "constance-account-billing-section" });
  if (!adapter.state.billingAccountLinked) renderAccountGuidance(section, { appId: adapter.appId, connected: Boolean(adapter.state.billingAccountLinked && adapter.state.billingAccessToken), defaultAllowance: 5, unit: "protection operations", workflow: "Start with 5 protection operations on your account. Free credits are used automatically before purchased credits." });
  section.createEl("h3", { text: "Account and billing" });
  const state = adapter.state;
  const accountStatus = adapter.state.billingAccountLinked ? `Signed in as ${adapter.state.billingEmail || "your account"}` : state.billingRegistrationPending ? `Registered as ${adapter.state.billingEmail} but not signed in. Check your email, click the confirmation link, then sign in here.` : "Not signed in.";
  if (!adapter.state.billingAccountLinked) {
    new import_obsidian6.Setting(section).setName("Email").setDesc("Use the email associated with your account and purchases.").addText((text) => text.setPlaceholder("you@example.com").setValue(adapter.state.billingEmail).setDisabled(adapter.state.billingAccountLinked).onChange(async (value) => {
      return diagnostics.guard("constance-account.control_4", async () => {
        var _a, _b, _c, _d, _e;
        const diagnosticEnd15 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "control.email.onChange")) != null ? _c : (() => {
        });
        try {
          const journalState = adapter.state;
          const hasPending = Object.entries(journalState).some(([key, value2]) => /^pending/i.test(key) && key !== "pendingBillingOwnerEmail" && !!value2 && (Array.isArray(value2) ? value2.length > 0 : typeof value2 === "object" ? Object.keys(value2).length > 0 : true));
          if (hasPending && !journalState.pendingBillingOwnerEmail) journalState.pendingBillingOwnerEmail = adapter.state.billingEmail;
          if (!hasPending) journalState.pendingBillingOwnerEmail = void 0;
          adapter.state.billingEmail = value.trim();
          await adapter.persist();
        } catch (diagnosticError15) {
          (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "control.email.onChange", diagnosticError15);
          throw diagnosticError15;
        } finally {
          diagnosticEnd15();
        }
      });
    }));
    new import_obsidian6.Setting(section).setName("Password").setDesc("Used to sign in and never saved by the plugin. New accounts require at least 12 characters.").addText((text) => {
      text.inputEl.type = "password";
      text.inputEl.maxLength = 256;
      text.setPlaceholder("Password").onChange((value) => {
        return diagnostics.guard("constance-account.control_5", () => {
          var _a;
          const diagnosticAction16 = () => {
            password = value;
          };
          return ((_a = diagnostics) == null ? void 0 : _a.run) ? diagnostics.run("control.19062.onChange", diagnosticAction16) : diagnosticAction16();
        });
      });
    });
  }
  new import_obsidian6.Setting(section).setName("Account").setDesc(accountStatus).addButton((button) => {
    if (adapter.state.billingAccountLinked) {
      button.buttonEl.remove();
      return;
    }
    button.setButtonText("Connect").setDisabled(adapter.state.billingAccountLinked).onClick(async () => {
      return diagnostics.guard("constance-account.control_6", async () => {
        var _a, _b, _c, _d, _e, _f, _g;
        const diagnosticEnd17 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "control.connect.onClick")) != null ? _c : (() => {
        });
        try {
          button.setDisabled(true);
          try {
            await connectWithinDeadline(adapter.state, () => signInBillingAccount(adapter, password, "connect"), () => {
              var _a2;
              return (_a2 = adapter.refresh) == null ? void 0 : _a2.call(adapter);
            });
            password = "";
            new import_obsidian6.Notice(adapter.state.billingRegistrationPending ? "Check your email and follow the verification link, then Connect again." : `Connected as ${adapter.state.billingEmail}.`);
            (_d = adapter.refresh) == null ? void 0 : _d.call(adapter);
          } catch (error) {
            diagnostics.failure("constance-account.caught_7", error);
            new import_obsidian6.Notice(error instanceof Error ? error.message : "Account connection failed. Try again.");
            (_e = adapter.refresh) == null ? void 0 : _e.call(adapter);
          } finally {
            button.setDisabled(adapter.state.billingAccountLinked || pendingConnections.has(adapter.state));
          }
        } catch (diagnosticError17) {
          (_g = (_f = diagnostics) == null ? void 0 : _f.failure) == null ? void 0 : _g.call(_f, "control.connect.onClick", diagnosticError17);
          throw diagnosticError17;
        } finally {
          diagnosticEnd17();
        }
      });
    });
  }).addButton((button) => {
    if (!adapter.state.billingAccountLinked) {
      button.buttonEl.remove();
      return;
    }
    button.setButtonText("Sign out").setDisabled(!adapter.state.billingAccessToken).onClick(async () => {
      return diagnostics.guard("constance-account.control_8", async () => {
        var _a, _b, _c, _d, _e, _f;
        const diagnosticEnd18 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "control.account.onClick")) != null ? _c : (() => {
        });
        try {
          const refreshToken = adapter.state.billingRefreshToken;
          const accessToken = adapter.state.billingAccessToken;
          clearBillingSession(adapter.state);
          state.billingRegistrationPending = false;
          await adapter.persist();
          if (refreshToken) void diagnostics.guard("constance-account.background_9", () => {
            var _a2, _b2, _c2;
            return ((_c2 = (_b2 = (_a2 = diagnostics) == null ? void 0 : _a2.request) == null ? void 0 : _b2.call(_a2, "network.constance-account.addBillingAccountSettings", import_obsidian6.requestUrl, { url: `${CONSTANCE_API}/auth/logout`, method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({}), throw: false })) != null ? _c2 : (0, import_obsidian6.requestUrl)({ url: `${CONSTANCE_API}/auth/logout`, method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({}), throw: false })).catch((rejectedError1) => {
              diagnostics.failure("constance-account.rejected_2", rejectedError1);
            });
          });
          new import_obsidian6.Notice("Signed out.");
          (_d = adapter.refresh) == null ? void 0 : _d.call(adapter);
        } catch (diagnosticError18) {
          (_f = (_e = diagnostics) == null ? void 0 : _e.failure) == null ? void 0 : _f.call(_e, "control.account.onClick", diagnosticError18);
          throw diagnosticError18;
        } finally {
          diagnosticEnd18();
        }
      });
    });
  });
  if (!adapter.state.billingAccountLinked) {
    for (const [purpose, name] of [["reset", "Forgot password?"], ["verify", "Resend verification email"]]) {
      new import_obsidian6.Setting(section).setName(name).addButton((button) => button.setButtonText("Send email").onClick(async () => {
        try {
          const response = await (0, import_obsidian6.requestUrl)({ url: `${CONSTANCE_API}/auth/recovery`, method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: adapter.state.billingEmail.trim(), purpose }), throw: false });
          if (response.status !== 202) throw new Error("Email could not be requested. Try again.");
          new import_obsidian6.Notice("If eligible, an email has been queued. Check your inbox and spam.");
        } catch (error) {
          diagnostics.failure("constance-account.recovery", error);
        }
      }));
    }
  }
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
  queueMicrotask(() => applySettingsLayout(containerEl, adapter.appId, adapter.appVersion));
}
async function showAccountWelcome(plugin, state, persist) {
  var _a, _b, _c, _d, _e;
  const diagnosticEnd20 = (_c = (_b = (_a = diagnostics) == null ? void 0 : _a.start) == null ? void 0 : _b.call(_a, "constance-account.showAccountWelcome")) != null ? _c : (() => {
  });
  try {
    const openSetup = () => {
      const settings = plugin.app.setting;
      settings.open();
      settings.openTabById(plugin.manifest.id);
    };
    plugin.addCommand({ id: "open-account-setup", name: "Get started: connect your account", callback: openSetup });
  } catch (diagnosticError20) {
    (_e = (_d = diagnostics) == null ? void 0 : _d.failure) == null ? void 0 : _e.call(_d, "constance-account.showAccountWelcome", diagnosticError20);
    throw diagnosticError20;
  } finally {
    diagnosticEnd20();
  }
}
async function activeBillingToken(adapter, force = false) {
  if (force || !adapter.state.billingAccessToken) await refreshBillingSession(adapter.state, adapter.persist);
  return adapter.state.billingAccessToken;
}
async function billingRequest(adapter, options) {
  var _a;
  const response = await requestAuthenticatedBilling(adapter.state, adapter.persist, options);
  if (response.status === 200 && options.url.includes("/billing/entitlements/me")) return { ...response, json: { data: accountBalance((_a = response.json) == null ? void 0 : _a.data, adapter.appId) } };
  return response;
}
async function signOutBillingAccount(adapter) {
  clearBillingSession(adapter.state);
  await adapter.persist();
}
async function registerBillingAccount(adapter, password) {
  await signInBillingAccount(adapter, password, "register");
}
function registerBillingPersister(_state, _persist) {
}
var import_obsidian6, pendingConnections, CONSTANCE_ACCOUNT_BASE_URL, ConstanceAccountError, refreshes, authenticatedBillingRequest, verifyBillingAccountRegistration, ensureBillingAccessToken, refreshBillingAccessToken;
var init_constance_account = __esm({
  "publish/src/constance-account.ts"() {
    "use strict";
    init_constance_v2();
    init_settings_layout();
    init_diagnostics();
    init_account_guidance();
    init_billing_checkout();
    import_obsidian6 = require("obsidian");
    pendingConnections = /* @__PURE__ */ new WeakSet();
    CONSTANCE_ACCOUNT_BASE_URL = "https://app.tutivsoft.com";
    ConstanceAccountError = class extends Error {
      constructor(message, status) {
        super(message);
        __publicField(this, "status");
        __publicField(this, "code");
        this.name = "ConstanceAccountError";
        this.status = status;
      }
    };
    refreshes = /* @__PURE__ */ new WeakMap();
    authenticatedBillingRequest = requestAuthenticatedBilling;
    verifyBillingAccountRegistration = verifyBillingAccount;
    ensureBillingAccessToken = activeBillingToken;
    refreshBillingAccessToken = refreshBillingSession;
  }
});

// publish/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => AegisNoteLockerPlugin
});
module.exports = __toCommonJS(main_exports);

// publish/src/matomo-plugin.ts
var import_obsidian = require("obsidian");
var import_matomo_client = __toESM(require_matomo_client());
var instances = /* @__PURE__ */ new WeakMap();
function initializeMatomo(plugin) {
  try {
    if (instances.has(plugin)) return;
    const client = new import_matomo_client.MatomoClient({ product: "obsidian_aegis_note_locker", siteId: 127, platform: "obsidian", features: ["note_protected"] }, {
      storage: (0, import_matomo_client.localStorageAdapter)(window.localStorage),
      send: async (body) => {
        await (0, import_obsidian.requestUrl)({ url: "https://atcdn.cyou/matomo.php", method: "POST", contentType: "application/x-www-form-urlencoded", body, throw: false });
      }
    });
    instances.set(plugin, client);
    plugin.register(() => {
      client.enabled = false;
      instances.delete(plugin);
    });
    void client.initialize().then(() => client.screen("home")).catch(() => {
    });
  } catch (_) {
  }
}

// publish/src/selection-scope.ts
var import_obsidian2 = require("obsidian");
function selectedFiles(entries, accepts) {
  const files = /* @__PURE__ */ new Map();
  const folders = /* @__PURE__ */ new Set();
  const visit = (entry) => {
    if (entry instanceof import_obsidian2.TFile) {
      if (accepts(entry) && !files.has(entry.path)) files.set(entry.path, entry);
    } else if (entry instanceof import_obsidian2.TFolder && !folders.has(entry.path)) {
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
        new import_obsidian2.Notice(`${config.name}: operation failed. Check the status and try again.`);
      }
    }));
  };
  if (config.folders) plugin.registerEvent(plugin.app.workspace.on("file-menu", (menu, entry) => {
    if (entry instanceof import_obsidian2.TFolder) add(menu, [entry]);
  }));
  if (config.multiple !== false) plugin.registerEvent(plugin.app.workspace.on("files-menu", add));
}

// publish/src/main.ts
init_diagnostics();
var import_obsidian12 = require("obsidian");

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
var import_obsidian3 = require("obsidian");
var AEGIS_KEY = "aegis";
function parseMarkdown(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter: {}, body: content, hasFrontmatter: false };
  const parsed = (0, import_obsidian3.parseYaml)(match[1]);
  return {
    frontmatter: parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {},
    body: content.slice(match[0].length),
    hasFrontmatter: true
  };
}
function serializeMarkdown(frontmatter, body) {
  if (Object.keys(frontmatter).length === 0) return body;
  const yaml = (0, import_obsidian3.stringifyYaml)(frontmatter).trimEnd();
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

// publish/src/native-operations.ts
var import_obsidian8 = require("obsidian");
init_diagnostics();
init_constance_account();
init_constance_v2();

// publish/src/billing-catalog.ts
init_diagnostics();
var import_obsidian7 = require("obsidian");
init_constance_account();
init_billing_checkout();
init_constance_v2();
function joinPublicPacks(products, appId) {
  if ((products == null ? void 0 : products.app_id) !== appId || !Array.isArray(products.offers)) return [];
  return products.offers.filter((offer) => (offer == null ? void 0 : offer.kind) === "credits").map((pack) => {
    var _a, _b;
    const priceId = typeof pack.code === "string" ? pack.code : "";
    const units = (_a = pack.grants) == null ? void 0 : _a.units, unit = (_b = pack.grants) == null ? void 0 : _b.unit;
    const available = !!priceId && unit === BILLING_UNIT && Number.isSafeInteger(units) && units > 0 && Number.isInteger(pack.currency_exponent) && pack.currency_exponent >= 0 && pack.currency_exponent <= 4 && Number.isSafeInteger(pack.amount) && pack.amount > 0 && typeof pack.currency === "string" && /^[A-Z]{3}$/.test(pack.currency);
    let amount = "";
    if (available) {
      try {
        amount = new Intl.NumberFormat(void 0, { style: "currency", currency: pack.currency }).format(pack.amount / 10 ** pack.currency_exponent);
      } catch (_) {
      }
    }
    return { pack, priceId, units, unit, amount, available: available && !!amount };
  });
}
function addLivePacks(root, host) {
  const checkoutHost = { ...host, preparationRoot: void 0, syncBalance: async () => {
    await host.syncBalance();
  }, refreshSession: () => refreshBillingSession(host.state, host.persist) };
  resumeAccountCheckout(checkoutHost);
  let selectedCurrency = "USD";
  let renderOffers = () => {
  };
  const section = root.createDiv({ cls: "ui-billing-packs" });
  new import_obsidian7.Setting(section).setName("Currency").addDropdown((dropdown) => {
    dropdown.addOption("USD", "USD");
    dropdown.setValue("USD").onChange((value) => {
      selectedCurrency = value;
      renderOffers();
    });
  });
  const status = section.createEl("p", { text: "Loading prices..." });
  const packs = section.createDiv();
  checkoutHost.preparationRoot = section.createDiv({ cls: "checkout-payment-status" });
  if (host.state.pendingAccountCheckout) prepareAccountCheckout(checkoutHost);
  void diagnostics.guard("billing-catalog.load", async () => {
    var _a;
    try {
      const response = await (0, import_obsidian7.requestUrl)({ url: `${CONSTANCE_API}/billing/offers?app_id=${encodeURIComponent(host.appId)}`, method: "GET", throw: false });
      if (response.status !== 200) throw new Error("Prices unavailable");
      const offers = joinPublicPacks((_a = response.json) == null ? void 0 : _a.data, host.appId);
      if (!offers.length) throw new Error("Prices unavailable");
      renderOffers = () => {
        packs.empty();
        const matching = offers.filter((offer) => offer.pack.currency === selectedCurrency);
        status.setText(matching.length ? "Applicable taxes are calculated at checkout." : "No packs available in this currency.");
        for (const { pack, priceId, units, unit, amount, available } of matching.sort((a, b) => a.units - b.units)) {
          new import_obsidian7.Setting(packs).setName(pack.name || "Credit offer").setDesc(`${pack.description ? pack.description.replace(/[.!?]$/, "") + ". " : ""}Applicable taxes are calculated at checkout.`).addButton((button) => button.setButtonText(available ? `Buy ${amount}` : "Pricing unavailable").setDisabled(!available || !host.state.billingAccountLinked).onClick(async () => {
            button.setDisabled(true);
            try {
              await openAccountCheckout(checkoutHost, priceId);
            } finally {
              button.setDisabled(!available || !host.state.billingAccountLinked);
            }
          }));
        }
      };
      renderOffers();
      if (!host.state.billingAccountLinked) status.setText("Connect your account above to buy credits. Applicable taxes are calculated at checkout.");
    } catch (error) {
      diagnostics.failure("billing-catalog.load", error);
      status.setText("Pricing temporarily unavailable. Refresh before buying.");
    }
  });
}

// publish/src/native-operations.ts
async function digest(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
}
function codePoints(value) {
  return Array.from(value).length;
}
function nativeCost(appId, d) {
  if (appId === "cairn-vault-linter") return Math.max(1, Math.ceil(d.files / 5), Math.ceil(d.edits / 20));
  if (appId === "meridian-timeline") return Math.max(1, Math.ceil(d.notes / 20));
  return 1;
}
function jobId() {
  return "v2native_" + crypto.randomUUID();
}
var pendingStates = ["requesting", "reserved", "writing", "verified", "uncertain_released"];
var owner2 = (host) => host.settings.billingEmail.trim().toLowerCase();
async function api(host, path, body) {
  var _a;
  const response = await requestAuthenticatedBilling(host.settings, () => host.persistNative(), {
    url: CONSTANCE_API + path,
    method: body === void 0 ? "GET" : "POST",
    throw: false,
    ...body === void 0 ? {} : { body: JSON.stringify(body) }
  });
  if (response.status < 200 || response.status >= 300 || !((_a = response.json) == null ? void 0 : _a.data)) throw new Error("Your account could not be verified. Your saved operation will be retried safely.");
  return response.json.data;
}
function validate(row, journal) {
  if ((row == null ? void 0 : row.app_id) !== journal.app_id || row.unit !== BILLING_UNIT || row.units !== journal.amount || typeof row.operation_id !== "string" || !row.operation_id || journal.operation_id && journal.operation_id !== row.operation_id || !["reserved", "committed", "released", "denied"].includes(row.state) || !Number.isSafeInteger(row.free_units) || !Number.isSafeInteger(row.paid_units) || row.free_units < 0 || row.paid_units < 0 || ["reserved", "committed"].includes(row.state) && row.free_units + row.paid_units !== journal.amount || journal.free_units >= 0 && (journal.free_units !== row.free_units || journal.paid_units !== row.paid_units)) throw new Error("The operation receipt did not match the saved conversion.");
  journal.operation_id = row.operation_id;
  journal.free_units = row.free_units;
  journal.paid_units = row.paid_units;
}
async function reserve(host, journal) {
  const row = await api(host, "/billing/operations", { app_id: journal.app_id, unit: BILLING_UNIT, units: journal.amount, retry_key: journal.event_id });
  if (owner2(host) !== journal.account || !host.settings.billingAccountLinked) throw new Error("The account changed during confirmation.");
  validate(row, journal);
  await host.persistNative();
  return row;
}
async function settle(host, journal, action) {
  if (owner2(host) !== journal.account || !host.settings.billingAccountLinked) throw new Error("Reconnect the original account.");
  if (!journal.operation_id) throw new Error("The saved operation has no verified identity.");
  const row = await api(host, "/billing/operations/" + encodeURIComponent(journal.operation_id) + "/" + action, {});
  if (owner2(host) !== journal.account || !host.settings.billingAccountLinked) throw new Error("The account changed during confirmation.");
  validate(row, journal);
  return row;
}
async function writesMatch(host, journal) {
  var _a;
  if (!((_a = journal.evidence) == null ? void 0 : _a.length)) return false;
  for (const evidence of journal.evidence) {
    try {
      const adapter = host.app.vault.adapter;
      const value = evidence.binary ? await adapter.readBinary(evidence.path) : await adapter.read(evidence.path);
      if (evidence.marker && typeof value === "string" && value.includes(evidence.marker)) continue;
      if (await digest(value) !== evidence.after) return false;
    } catch (_) {
      return false;
    }
  }
  return true;
}
async function recoverNative(host) {
  var _a;
  if (!host.settings.billingAccountLinked) return;
  for (const journal of host.settings.operationJournal || []) {
    if (journal.protocol !== "v2" || journal.account !== owner2(host) || !pendingStates.includes(journal.state)) continue;
    try {
      const row = journal.operation_id ? await api(host, "/billing/operations/" + encodeURIComponent(journal.operation_id)) : await reserve(host, journal);
      validate(row, journal);
      if (row.state === "committed" || row.state === "denied") journal.state = row.state;
      else if (row.state === "released") journal.state = ((_a = journal.evidence) == null ? void 0 : _a.length) ? "uncertain_released" : "released";
      else if (journal.state === "verified" || journal.state === "writing" && await writesMatch(host, journal)) {
        if ((await settle(host, journal, "commit")).state === "committed") journal.state = "committed";
      } else if (journal.state === "requesting") journal.state = "reserved";
      await host.persistNative();
    } catch (error) {
      diagnostics.failure("native.recover", error);
    }
  }
}
async function reserveLegacyNative(..._args) {
  new import_obsidian8.Notice("An older conversion is unresolved. Connect its original account and contact support before starting another conversion.");
  return null;
}
async function reserveNative(host, appId, eventId, source2, result, dimensions, reveal = false) {
  var _a, _b;
  try {
    const state = host.settings;
    if (!state.billingAccountLinked) throw new Error("Connect your account in plugin settings first.");
    await recoverNative(host);
    if (((_a = state.pendingSpendEvents) == null ? void 0 : _a.length) || ((_b = state.pendingFreeUsageEvents) == null ? void 0 : _b.length) || (state.operationJournal || []).some((j) => j.protocol !== "v2" && pendingStates.includes(j.state))) return reserveLegacyNative();
    const account = owner2(host), source_digest = await digest(source2), result_digest = await digest(result);
    let journal = (state.operationJournal || []).find((j) => j.event_id === eventId || j.protocol === "v2" && j.account === account && j.source_digest === source_digest && j.result_digest === result_digest && pendingStates.includes(j.state));
    if (journal && (journal.protocol !== "v2" || journal.account !== account || journal.app_id !== appId || journal.source_digest !== source_digest || journal.result_digest !== result_digest || JSON.stringify(journal.dimensions) !== JSON.stringify(dimensions))) throw new Error("The saved conversion belongs to another source or account.");
    if (!journal) {
      if ((state.operationJournal || []).some((j) => j.account === account && pendingStates.includes(j.state))) throw new Error("Recover the previous conversion before starting another one.");
      if (!eventId.startsWith("v2native_")) throw new Error("An older conversion cannot be replayed as a new operation.");
      journal = { protocol: "v2", event_id: eventId, app_id: appId, account, source_digest, result_digest, dimensions, amount: nativeCost(appId, dimensions), free_units: -1, paid_units: -1, state: "requesting" };
      state.operationJournal = [...state.operationJournal || [], journal];
      await host.persistNative();
    }
    if (["released", "uncertain_released", "denied"].includes(journal.state)) throw new Error("This conversion cannot be replayed. Check its saved output before trying again.");
    const retained = journal, row = await reserve(host, retained);
    if (!["reserved", "committed"].includes(row.state)) {
      retained.state = row.state;
      await host.persistNative();
      throw new Error("No conversion credit is available. Refresh your balance.");
    }
    if (!["writing", "verified", "committed"].includes(retained.state)) retained.state = row.state;
    await host.persistNative();
    const reservation = {
      source: row.paid_units ? "purchased" : "free",
      markWriting: async (evidence) => {
        var _a2;
        if (retained.state === "committed" && ((_a2 = retained.evidence) == null ? void 0 : _a2.length)) return false;
        if (retained.state !== "reserved") throw new Error("The conversion reservation is no longer writable.");
        retained.state = "writing";
        retained.evidence = evidence;
        await host.persistNative();
        return true;
      },
      commit: async () => {
        if (retained.state === "committed") return { kind: "committed" };
        if (retained.state !== "writing" && !reveal) throw new Error("The conversion has not been written.");
        if (!reveal && !await writesMatch(host, retained)) return { kind: "pending" };
        retained.state = "verified";
        await host.persistNative();
        try {
          if ((await settle(host, retained, "commit")).state !== "committed") return { kind: "pending" };
          retained.state = "committed";
          await host.persistNative();
          return { kind: "committed" };
        } catch (error) {
          diagnostics.failure("native.commit", error);
          return { kind: "pending" };
        }
      },
      rollback: async () => {
        if (retained.state !== "reserved") return;
        const row2 = await settle(host, retained, "release");
        retained.state = row2.state;
        await host.persistNative();
      }
    };
    if (reveal && (await reservation.commit()).kind !== "committed") throw new Error("Confirmation is pending.");
    return reservation;
  } catch (error) {
    diagnostics.failure("native.reserve", error);
    new import_obsidian8.Notice(error instanceof Error ? error.message : String(error));
    return null;
  }
}
async function renderNativePacks(container, host, appId, _buy) {
  addLivePacks(container, { appId, installationId: host.settings.constanceDeviceId, state: host.settings, persist: () => host.persistNative(), syncBalance: async () => {
    const { syncEntitlements: syncEntitlements2 } = await Promise.resolve().then(() => (init_constance_v2(), constance_v2_exports));
    await syncEntitlements2(host.settings, () => host.persistNative());
  } });
}

// publish/src/settings.ts
var import_obsidian9 = require("obsidian");

// publish/src/billing.ts
init_constance_v2();
init_diagnostics();
init_billing_checkout();
init_constance_account();

// publish/src/usage.ts
var DAILY_FREE_USES = 5;
function resetDailyUsageIfNeeded(state, date = /* @__PURE__ */ new Date()) {
  return state;
}
function remainingFreeUses(state, date = /* @__PURE__ */ new Date()) {
  const normalized = resetDailyUsageIfNeeded(state, date);
  return Math.max(0, DAILY_FREE_USES - normalized.freeUsesUsed);
}

// publish/src/billing.ts
init_constance_account();
var AEGIS_APP_ID = "aegis-note-locker";
function ensureDeviceId(plugin) {
  if (!plugin.settings.constanceDeviceId) {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    plugin.settings.constanceDeviceId = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return plugin.settings.constanceDeviceId;
}
async function syncBalance(plugin, strict = false) {
  var _a;
  await syncEntitlements(plugin.settings, () => plugin.saveSettings());
  (_a = plugin.refreshBillingSummary) == null ? void 0 : _a.call(plugin);
}
async function retryPendingProtectionCharges(plugin) {
  return;
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
var AegisSettingTab = class extends import_obsidian9.PluginSettingTab {
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
        new import_obsidian9.Setting(containerEl).setName("Settings mode").setDesc("Simple shows everyday controls. Advanced includes detailed behavior and troubleshooting.").addDropdown((dropdown) => dropdown.addOption("simple", "Simple").addOption("advanced", "Advanced \u2014 optional").setValue(this.plugin.settings.settingsMode).onChange(async (value) => {
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
        new import_obsidian9.Setting(containerEl).setName("Session password").setDesc("Set this once per Obsidian session so Lock, Unlock, and Backup run without password pop-ups. The password stays in memory only and is never saved to plugin data.").addText((text) => {
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
                new import_obsidian9.Notice("Enter a password to set it for this session.");
                passwordInput == null ? void 0 : passwordInput.inputEl.focus();
                return;
              }
              this.plugin.setSessionPassword(sessionPassword);
              sessionPassword = "";
              passwordInput == null ? void 0 : passwordInput.setValue("");
              new import_obsidian9.Notice("Aegis session password set.");
            };
            return ((_a3 = diagnostics) == null ? void 0 : _a3.run) ? diagnostics.run("control.session_password.onClick", diagnosticAction21) : diagnosticAction21();
          });
        }));
        diagnosticStage6();
        const diagnosticStage7 = (_t = (_s = (_r = diagnostics) == null ? void 0 : _r.start) == null ? void 0 : _s.call(_r, "settings.render.review_before_applying")) != null ? _t : (() => {
        });
        new import_obsidian9.Setting(containerEl).setName("Review before applying").setDesc("Review and confirm changes before applying them. Off by default.").addToggle((toggle) => toggle.setValue(this.plugin.settings.reviewBeforeApply).onChange(async (value) => {
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
          new import_obsidian9.Setting(containerEl).setName("Protected properties").setDesc("Comma or newline separated frontmatter property names to protect. Leave empty to protect every eligible property.").addTextArea((text) => text.setValue(this.plugin.settings.protectedProperties).onChange(async (value) => {
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
        new import_obsidian9.Setting(containerEl).setName("Billing").setHeading();
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
        if (this.plugin.protectionPreview) new import_obsidian9.Setting(containerEl).setName("Resume protection").setDesc("Continue with the preview saved in this session. Notes that changed since the preview will not be overwritten.").addButton((b) => b.setButtonText("Retry").onClick(() => {
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
        new import_obsidian9.Setting(containerEl).setName("Refresh balance").setDesc("Update your free and purchased credit balance. Unlocking, viewing, restoring, and exporting already protected content are free.").addButton((button) => button.setButtonText("Refresh").onClick(async () => {
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
                new import_obsidian9.Notice("Aegis: balance could not be refreshed. Check your connection and account, then retry.");
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
        if (this.plugin.settings.billingAccountLinked) void diagnostics.guard("settings.background_13", () => syncBalance(this.plugin).then(() => retryPendingProtectionCharges(this.plugin)).then(renderBalance).catch((rejectedError1) => {
          diagnostics.failure("settings.rejected_2", rejectedError1);
          balanceEl.setText("Balance unavailable. Use Refresh to retry; your saved balance is retained.");
        }));
        diagnosticStage16();
        const diagnosticStage17 = (_X = (_W = (_V = diagnostics) == null ? void 0 : _V.start) == null ? void 0 : _W.call(_V, "settings.render.session_timeout")) != null ? _X : (() => {
        });
        new import_obsidian9.Setting(containerEl).setName("Session timeout").setDesc("Minutes of inactivity before the password is cleared. Default: 15 minutes; enter it again to unlock later.").addDropdown((dropdown) => dropdown.addOption("5", "5 minutes \u2014 shorter sessions").addOption("15", "15 minutes \u2014 recommended").addOption("30", "30 minutes").addOption("60", "60 minutes").addOptions([5, 15, 30, 60].includes(this.plugin.settings.sessionTimeoutMinutes) ? {} : { [String(this.plugin.settings.sessionTimeoutMinutes)]: `${this.plugin.settings.sessionTimeoutMinutes} minutes \u2014 current` }).setValue(String(this.plugin.settings.sessionTimeoutMinutes)).onChange(async (value) => {
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
          new import_obsidian9.Setting(containerEl).setName("Encrypted backup folder").setDesc("Vault-relative folder used for user-requested encrypted exports.").addText((text) => text.setPlaceholder(".aegis-backups").setValue(this.plugin.settings.backupFolder).onChange(async (value) => {
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
          new import_obsidian9.Setting(containerEl).setName("Show status bar").setDesc("Show the current note's locked or unlocked state in the status bar.").addToggle((toggle) => toggle.setValue(this.plugin.settings.showStatusBar).onChange(async (value) => {
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
var import_obsidian10 = require("obsidian");
function safeError(error) {
  const message = error instanceof Error ? error.message : "The operation failed.";
  if (/password|decrypt|authentication|envelope|corrupt|tamper/i.test(message)) return "The password was incorrect or the encrypted record is damaged.";
  return message.replace(/[\r\n]+/g, " ").slice(0, 180);
}
var ConfirmModal = class extends import_obsidian10.Modal {
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
var ProgressModal = class extends import_obsidian10.Modal {
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
  new import_obsidian10.Notice(`Aegis: ${safeError(error)}`);
}

// publish/src/plugin-support.ts
init_diagnostics();
var import_obsidian11 = require("obsidian");
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
var DocumentationModal = class extends import_obsidian11.Modal {
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
      new import_obsidian11.Setting(this.contentEl).addButton((button) => button.setButtonText("Open account").setCta().onClick(diagnostics.wrap("plugin-support.control_2", settings))).addButton((button) => button.setButtonText("Lock current note").onClick(() => {
        return diagnostics.guard("plugin-support.control_3", () => {
          var _a, _b;
          const commands = this.app.commands;
          const command = "lock-current-note";
          const id = command === "command-palette:open" ? command : ((_a = this.plugin) == null ? void 0 : _a.manifest.id) + ":" + command;
          const available = (_b = commands == null ? void 0 : commands.executeCommandById) == null ? void 0 : _b.call(commands, id);
          if (available === false || !(commands == null ? void 0 : commands.executeCommandById)) new import_obsidian11.Notice("Open the command palette and choose " + this.docs.name + ". Check the selected note or attachment first.");
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
      new import_obsidian11.Setting(problems).addButton((button) => button.setButtonText("Open account").onClick(diagnostics.wrap("plugin-support.control_4", settings)));
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
      new import_obsidian11.Setting(containerEl).setName("Debug logging").setDesc("Record detailed activity logs for troubleshooting. Off by default.").addToggle((toggle) => toggle.setValue(this.debugEnabled()).onChange((value) => diagnostics.guard("plugin-support.control_7", () => this.setDebugLogging(value))));
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
          new import_obsidian11.Notice(this.docs.name + ": debug logging " + (this.debugEnabled() ? "enabled." : "disabled."));
        } catch (caughtError10) {
          diagnostics.failure("plugin-support.caught_11", caughtError10);
          new import_obsidian11.Notice(this.docs.name + ": could not save the logging setting. Try again.");
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
          new import_obsidian11.Notice("Could not save setup progress. Your existing data is unchanged; reopen Help to continue.");
        }));
      });
    });
  }
  notifyFailure(_stage) {
    const now = Date.now();
    if (now - this.lastFailureNotice < 5e3) return;
    this.lastFailureNotice = now;
    try {
      new import_obsidian11.Notice(this.docs.name + ": this action could not be completed. Try again or copy the diagnostic log for support.");
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
    new import_obsidian11.Setting(containerEl).setName("Show automatic windows").setDesc("Open queue, progress, result, and welcome windows automatically. Off by default; status messages remain visible.").addToggle((toggle) => toggle.setValue(this.automaticWindowsEnabled()).onChange(async (enabled2) => {
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
        new import_obsidian11.Notice("Could not save the automatic windows preference. Try again.");
      }
    }));
    new import_obsidian11.Setting(containerEl).setName("Help").setDesc("Get started, recover your account, or remove the plugin.").addButton((button) => button.setButtonText("Open Help").onClick(() => diagnostics.guard("plugin-support.control_16", () => new DocumentationModal(this.plugin.app, this.docs, this.plugin).open())));
  }
  addDiagnosticsSetting(containerEl) {
    new import_obsidian11.Setting(containerEl).setName("Diagnostics").setDesc("Copy up to the latest 1,000 events recorded by this plugin. Logs reset when the plugin reloads. Note contents, paths, credentials, and raw error messages are excluded.").addButton((button) => button.setButtonText("Copy full log").onClick(() => {
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
      new import_obsidian11.Notice(this.docs.name + ": copied " + snapshot.length + " log events" + omitted + ".");
    } catch (error) {
      diagnostics.failure("plugin-support.caught_22", error);
      this.error("diagnostics.copy_failed", error);
      new import_obsidian11.Notice(this.docs.name + ": could not copy the debug log.");
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
var AegisNoteLockerPlugin = class extends import_obsidian12.Plugin {
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
    initializeMatomo(this);
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
          new import_obsidian12.Notice("Aegis: cancelling the batch after the current note.");
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
            new import_obsidian12.Notice("Aegis: a lock batch is already running.");
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
    if (!(file instanceof import_obsidian12.TFile) || !isMarkdown(file)) return;
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
      new import_obsidian12.Notice("Aegis: set the session password in plugin settings before running this command.");
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
      new import_obsidian12.Notice("Aegis: set the session password in plugin settings before running this command.");
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
      new import_obsidian12.Notice("The password session expired. Enter your password again to unlock encrypted notes.");
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
        new import_obsidian12.Notice("No protection preview is open.");
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
        new import_obsidian12.Notice("Aegis: open a Markdown note first.");
        return;
      }
      try {
        const original = await this.app.vault.read(file);
        const parsed = parseMarkdown(original);
        if (asRecord(parsed.frontmatter[AEGIS_KEY])) {
          new import_obsidian12.Notice("Aegis: this note already has protected content.");
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
          new import_obsidian12.Notice("Your note is ready to encrypt. Keep this session open, sign in and verify your email in Settings, then choose Resume protection. Nothing has been saved.");
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
        new import_obsidian12.Notice("Aegis: open a Markdown note first.");
        return;
      }
      try {
        const original = await this.app.vault.read(file);
        const parsed = parseMarkdown(original);
        if (((_d = asRecord(parsed.frontmatter[AEGIS_KEY])) == null ? void 0 : _d.mode) === "note") {
          new import_obsidian12.Notice("Aegis: unlock the note body before protecting properties.");
          return;
        }
        const existing = asRecord(parsed.frontmatter[AEGIS_KEY]);
        const keys = topLevelPropertyNames(parsed.frontmatter).filter((key) => {
          var _a2;
          return !((_a2 = existing == null ? void 0 : existing.properties) == null ? void 0 : _a2[key]);
        });
        if (!keys.length) {
          new import_obsidian12.Notice("Aegis: this note has no top-level frontmatter properties.");
          return;
        }
        const configured = this.settings.protectedProperties.split(/[\n,]/).map((key) => key.trim()).filter(Boolean);
        const chosen = configured.length ? keys.filter((key) => configured.includes(key)) : keys;
        if (!chosen.length) {
          new import_obsidian12.Notice("Aegis: none of the configured frontmatter properties exist in this note.");
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
          new import_obsidian12.Notice("Your selected properties are ready to encrypt. Keep this session open, sign in and verify your email in Settings, then choose Resume protection. Nothing has been saved.");
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
        new import_obsidian12.Notice("Aegis: a note batch is already running.");
        return null;
      }
      if (!file || !isMarkdown(file)) {
        new import_obsidian12.Notice("Aegis: open a Markdown note first.");
        return null;
      }
      try {
        const original = await this.app.vault.read(file);
        const parsed = parseMarkdown(original);
        const record = asRecord(parsed.frontmatter[AEGIS_KEY]);
        if (!record) {
          new import_obsidian12.Notice("Aegis: this note is not locked.");
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
        if (!batch) new import_obsidian12.Notice("Aegis: note unlocked.");
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
      new import_obsidian12.Notice("Aegis: a note batch is already running.");
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
        new import_obsidian12.Notice(`Aegis: no locked selected notes; ${skipped} skipped, ${failed} failed.`);
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
      new import_obsidian12.Notice(`Aegis: unlocked ${entries.length} note(s), ${skipped} skipped, ${failed} failed${progress.cancelled ? "; cancelled before the remaining notes" : ""}.`);
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
      new import_obsidian12.Notice("Aegis: a note batch is already running.");
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
          new import_obsidian12.Notice("Aegis: no unlocked Markdown notes found.");
          return;
        }
        if (this.settings.reviewBeforeApply && !await new ConfirmModal(this.app, "Review lock-all operation", `${candidates.length} Markdown notes will be encrypted. Each file is checked for sync conflicts and verified before replacement.`, "Continue").waitForResult()) return;
        const password = await this.passwordForNewEncryption();
        if (!password) return;
        const progress = new ProgressModal(this.app, candidates.length);
        this.activeProgress = progress;
        if (this.support.automaticWindowsEnabled()) progress.open();
        else new import_obsidian12.Notice("Aegis: locking notes.");
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
            new import_obsidian12.Notice(`Aegis skipped ${file.path}: ${error instanceof Error ? error.message : "operation failed"}`);
          }
        }
        progress.update(entries.length, progress.cancelled ? "Cancelled" : "Complete");
        progress.close();
        this.activeProgress = void 0;
        if (entries.length) this.undoRecord = { createdAt: Date.now(), entries };
        new import_obsidian12.Notice(`Aegis: locked ${entries.length} note(s)${progress.cancelled ? " before cancellation" : ""}.`);
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
        new import_obsidian12.Notice("Aegis: open a Markdown note first.");
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
        if ((committed == null ? void 0 : committed.kind) === "pending") new import_obsidian12.Notice("Encrypted backup saved. Its charge is awaiting confirmation.");
        new import_obsidian12.Notice(`Aegis: encrypted backup written to ${backupPath}.`);
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
        new import_obsidian12.Notice("Aegis: no changes are available to restore in this session.");
        return;
      }
      if (this.settings.reviewBeforeApply && !await new ConfirmModal(this.app, "Roll back last Aegis operation", `Restore ${record.entries.length} original note(s)? Aegis will refuse if any file changed since the operation.`, "Roll back").waitForResult()) return;
      let restored = 0;
      const remaining = [];
      for (const entry of record.entries) {
        const file = this.app.vault.getAbstractFileByPath(entry.path);
        if (!(file instanceof import_obsidian12.TFile)) {
          remaining.push(entry);
          continue;
        }
        try {
          await this.atomicChange(file, entry.resulting, entry.original, false);
          restored++;
        } catch (caughtError30) {
          diagnostics.failure("main.caught_31", caughtError30);
          remaining.push(entry);
          new import_obsidian12.Notice(`Aegis: rollback refused for ${entry.path} because it changed.`);
        }
      }
      this.undoRecord = remaining.length ? { ...record, entries: remaining } : void 0;
      new import_obsidian12.Notice(`Aegis: rolled back ${restored} note(s)${remaining.length ? `; ${remaining.length} still available to retry` : ""}.`);
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
          new import_obsidian12.Notice("Aegis: no purchased use was available; the note was left unchanged.");
          return false;
        }
        if (successNotice) {
          new import_obsidian12.Notice(result.kind === "pending" ? `${successNotice} Billing will retry the purchased-use charge.` : successNotice);
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
