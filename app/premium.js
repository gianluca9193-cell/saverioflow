/* =========================================================
   SaverIoFlow — Premium Layer (offline-first, no backend)
   Adds routes: #/pricing and #/unlock
   Exposes globals: isPremium(), caps(), requirePremium(), clearLicense()
   ========================================================= */

(() => {
  "use strict";

  // --- Config ---
  const LICENSE_KEY = "saverioflow_license_v1";

  // Put your Ed25519 public key here (base64url or base64)
  // Example: "m3c..."; keep private key offline.
  const LICENSE_PUBKEY_B64 = "REPLACE_WITH_PUBLIC_KEY_BASE64URL_OR_BASE64";

  // Free caps (used by caps())
  const FREE_CAPS = {
    goals: 5,
    todayTasks: 25,
    dialogueDepthDeep: false,
    export: false,
    week: false,
    flow: false
  };

  // --- Helpers ---
  const $ = (sel) => document.querySelector(sel);

  function nowUnix() { return Math.floor(Date.now() / 1000); }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function b64urlToU8(b64url) {
    const cleaned = String(b64url || "").trim();
    const b64 = cleaned
      .replace(/-/g, "+")
      .replace(/_/g, "/") + "===".slice((cleaned.length + 3) % 4);

    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function readLicense() {
    try { return JSON.parse(localStorage.getItem(LICENSE_KEY) || "null"); }
    catch { return null; }
  }

  function writeLicense(obj) {
    localStorage.setItem(LICENSE_KEY, JSON.stringify(obj));
  }

  function clearLicense() {
    localStorage.removeItem(LICENSE_KEY);
    // re-render if we're on pricing/unlock
    if (isPremiumRoute()) renderPremiumRoute();
  }

  function isPremium() {
    const lic = readLicense();
    if (!lic || !lic.verified || !lic.payload) return false;
    if (lic.payload.exp && nowUnix() > lic.payload.exp) return false;
    return true;
  }

  function caps() {
    if (isPremium()) {
      return {
        goals: 999,
        todayTasks: 999,
        dialogueDepthDeep: true,
        export: true,
        week: true,
        flow: true
      };
    }
    return FREE_CAPS;
  }

  function verifyLicenseToken(token) {
    // token: svf1.<payload_b64url>.<sig_b64url>
    const parts = String(token || "").trim().split(".");
    if (parts.length !== 3 || parts[0] !== "svf1") {
      return { ok: false, reason: "Invalid token format." };
    }

    let payloadBytes, sigBytes, payload;
    try {
      payloadBytes = b64urlToU8(parts[1]);
      sigBytes = b64urlToU8(parts[2]);
      payload = JSON.parse(new TextDecoder().decode(payloadBytes));
    } catch {
      return { ok: false, reason: "Unreadable payload." };
    }

    if (!payload || payload.v !== 1 || !payload.plan) {
      return { ok: false, reason: "Invalid payload." };
    }
    if (payload.exp && nowUnix() > payload.exp) {
      return { ok: false, reason: "License expired." };
    }

    if (!window.nacl?.sign?.detached?.verify) {
      return { ok: false, reason: "Signature verifier missing (tweetnacl)." };
    }

    let pubKey;
    try {
      // accept base64url or base64
      const norm = LICENSE_PUBKEY_B64
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
      pubKey = b64urlToU8(norm);
    } catch {
      return { ok: false, reason: "Invalid public key." };
    }

    const ok = window.nacl.sign.detached.verify(payloadBytes, sigBytes, pubKey);
    if (!ok) return { ok: false, reason: "Signature invalid." };

    return { ok: true, payload };
  }

  // Quiet modal fallback (uses app modal if available; otherwise simple overlay)
  function requirePremium(featureName, onAllowed) {
    if (isPremium()) return onAllowed?.();

    // If app provides openModal/closeModal/navigate, use them.
    if (typeof window.openModal === "function" && typeof window.closeModal === "function") {
      window.openModal({
        title: "Premium",
        body: `
          <p class="muted"><strong>${escapeHtml(featureName)}</strong> is part of Premium.</p>
          <p class="muted">Offline-first. No accounts. Unlock with a license.</p>
        `,
        actions: [
          { label: "Enter license", primary: true, onClick: () => { window.closeModal(); window.location.hash = "#/unlock"; } },
          { label: "Not now", onClick: () => window.closeModal() }
        ]
      });
      return;
    }

    // Minimal overlay modal if app modal not present.
    const existing = $("#svfModal");
    if (existing) existing.remove();

    const el = document.createElement("div");
    el.id = "svfModal";
    el.innerHTML = `
      <div class="svf-modal-backdrop" role="dialog" aria-modal="true">
        <div class="svf-modal">
          <div class="svf-modal-title">Premium</div>
          <div class="svf-modal-body">
            <p class="muted"><strong>${escapeHtml(featureName)}</strong> is part of Premium.</p>
            <p class="muted">Offline-first. No accounts. Unlock with a license.</p>
          </div>
          <div class="svf-modal-actions">
            <button class="btn gold" id="svfGoUnlock">Enter license</button>
            <button class="btn" id="svfClose">Not now</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(el);

    $("#svfGoUnlock").onclick = () => { el.remove(); window.location.hash = "#/unlock"; };
    $("#svfClose").onclick = () => el.remove();
  }

  // --- Rendering (only for our two routes) ---
  function isPremiumRoute() {
    const h = window.location.hash || "#/start";
    return h === "#/pricing" || h === "#/unlock";
  }

  function ensureAppRoot() {
    const root = $("#app");
    if (root) return root;

    const div = document.createElement("div");
    div.id = "app";
    document.body.appendChild(div);
    return div;
  }

  function renderPricing() {
    const premium = isPremium();
    const payload = readLicense()?.payload || null;
    const plan = premium ? (payload?.plan || "premium") : null;

    return `
      <div class="svf-view">
        <div class="svf-head">
          <div>
            <h1>Pricing</h1>
            <p class="muted">Quiet, transparent. Offline-first. No accounts.</p>
          </div>
          <div class="svf-head-actions">
            <a class="btn" href="#/start">Back</a>
          </div>
        </div>

        <div class="svf-cards">
          <div class="svf-card">
            <h3>Free</h3>
            <p class="muted">Core structure for focus and results.</p>
            <div class="svf-hr"></div>
            <ul class="svf-list">
              <li>Discover journey</li>
              <li>Goals, milestones, actions</li>
              <li>Today focus + tasks</li>
              <li>Dialogue (Light/Standard)</li>
            </ul>
            <a class="btn" href="#/start">Open app</a>
          </div>

          <div class="svf-card svf-card-gold">
            <div class="svf-badge">Most chosen</div>
            <h3>Premium Annual</h3>
            <p class="muted">Deep dialogue, exports, premium drops.</p>
            <div class="svf-price-row">
              <div class="svf-price">€49</div>
              <div class="muted">/year</div>
            </div>
            <a class="btn gold" href="#/unlock">Unlock</a>
            <details class="svf-details">
              <summary>Premium features</summary>
              <ul class="svf-list">
                <li>Dialogue: Deep + extended lenses</li>
                <li>Export sessions (Text/Markdown)</li>
                <li>More capacity (goals/tasks)</li>
                <li>Backup/Restore (local file)</li>
                <li>Week + Flow drops</li>
              </ul>
            </details>
          </div>

          <div class="svf-card">
            <h3>Premium Lifetime</h3>
            <p class="muted">One-time. Own the system.</p>
            <div class="svf-price-row">
              <div class="svf-price">€149</div>
            </div>
            <a class="btn" href="#/unlock">Unlock</a>
            <details class="svf-details">
              <summary>Notes</summary>
              <p class="muted">Stored locally on this device. Your data stays yours.</p>
            </details>
          </div>
        </div>

        <div class="svf-card svf-card-subtle">
          <h3>Status</h3>
          ${
            premium
              ? `<p class="muted">Premium active <span class="svf-pill">${escapeHtml(plan)}</span></p>
                 <pre class="svf-code">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
                 <button class="btn" id="svfRemove">Remove license</button>`
              : `<p class="muted">Free mode. Enter a license to unlock Premium.</p>
                 <a class="btn gold" href="#/unlock">Enter license</a>`
          }
        </div>
      </div>
    `;
  }

  function renderUnlock() {
    const premium = isPremium();
    const payload = readLicense()?.payload || null;

    return `
      <div class="svf-view">
        <div class="svf-head">
          <div>
            <h1>Unlock</h1>
            <p class="muted">Enter a license token. Verified offline.</p>
          </div>
          <div class="svf-head-actions">
            <a class="btn" href="#/pricing">Back</a>
          </div>
        </div>

        <div class="svf-card">
          <label class="svf-label">License token</label>
          <textarea id="svfLicenseInput" class="svf-textarea" rows="3" placeholder="svf1.…"></textarea>

          <div class="svf-row">
            <button class="btn gold" id="svfVerify">Verify & Save</button>
            <a class="btn" href="#/pricing">Pricing</a>
          </div>

          <p class="muted svf-small">
            Stored locally (localStorage). No account. No network required.
          </p>
        </div>

        ${
          premium
            ? `<div class="svf-card svf-card-subtle">
                 <h3>Active</h3>
                 <p class="muted">Premium is active on this device.</p>
                 <pre class="svf-code">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
                 <button class="btn" id="svfRemove2">Remove license</button>
               </div>`
            : ``
        }
      </div>
    `;
  }

  function renderPremiumRoute() {
    const root = ensureAppRoot();
    const h = window.location.hash || "#/start";

    if (h === "#/pricing") {
      root.innerHTML = renderPricing();
      const rm = $("#svfRemove");
      if (rm) rm.onclick = () => clearLicense();
      return;
    }

    if (h === "#/unlock") {
      root.innerHTML = renderUnlock();

      const btn = $("#svfVerify");
      if (btn) {
        btn.onclick = () => {
          const token = ($("#svfLicenseInput")?.value || "").trim();
          const res = verifyLicenseToken(token);

          if (!res.ok) {
            requirePremium(res.reason || "Could not verify license", () => {});
            // requirePremium shows modal; but we want a precise error modal
            // If you prefer, replace with window.alert.
            if (!window.openModal) {
              alert(res.reason);
            }
            return;
          }

          writeLicense({
            verified: true,
            verifiedAt: nowUnix(),
            payload: res.payload,
            token
          });

          window.location.hash = "#/pricing";
        };
      }

      const rm2 = $("#svfRemove2");
      if (rm2) rm2.onclick = () => clearLicense();

      return;
    }
  }

  // Ensure our render runs AFTER your app router (we override only these routes)
  function onRouteChange() {
    if (!isPremiumRoute()) return;
    setTimeout(renderPremiumRoute, 0);
  }

  window.addEventListener("hashchange", onRouteChange);
  // initial
  onRouteChange();

  // Expose globals for your existing app to call later (gating hooks)
  window.isPremium = isPremium;
  window.caps = caps;
  window.requirePremium = requirePremium;
  window.clearLicense = clearLicense;

})();
