/* =========================================================
   SaverIoFlow — Premium + Friction Ledger Layer (offline-first)
   Routes:
     #/pricing, #/unlock, #/friction
   Exposes globals:
     isPremium(), caps(), requirePremium(), clearLicense()
     svfPromptFriction(ctx), svfRecordFriction(entry), svfGetFrictionStats(days)
   No backend. No external libs. Uses WebCrypto (ECDSA P-256).
   ========================================================= */

(() => {
  "use strict";

  // -----------------------------
  // Storage keys (separate, safe)
  // -----------------------------
  const LICENSE_KEY = "saverioflow_license_v2";         // NEW (WebCrypto-based)
  const FRICTION_KEY = "saverioflow_friction_v1";       // Ledger data

  // -----------------------------
  // License verification key (PUBLIC)
  // -----------------------------
  // Replace with your public JWK (P-256). Example shape:
  // {"kty":"EC","crv":"P-256","x":"...","y":"...","ext":true}
  const LICENSE_PUB_JWK = {
    kty: "EC",
    crv: "P-256",
    x: "REPLACE_ME",
    y: "REPLACE_ME",
    ext: true
  };

  // -----------------------------
  // Free caps
  // -----------------------------
  const FREE_CAPS = {
    goals: 5,
    todayTasks: 25,
    dialogueDepthDeep: false,
    export: false,
    week: false,
    flow: false,
    frictionAnalytics: false
  };

  // -----------------------------
  // Small utils
  // -----------------------------
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
    const b64 = cleaned.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((cleaned.length + 3) % 4);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function u8ToB64url(u8) {
    let bin = "";
    for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function jsonParseSafe(s, fallback) {
    try { return JSON.parse(s); } catch { return fallback; }
  }

  function readLicense() {
    return jsonParseSafe(localStorage.getItem(LICENSE_KEY) || "null", null);
  }

  function writeLicense(obj) {
    localStorage.setItem(LICENSE_KEY, JSON.stringify(obj));
  }

  function clearLicense() {
    localStorage.removeItem(LICENSE_KEY);
    if (isLayerRoute()) renderLayerRoute();
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
        flow: true,
        frictionAnalytics: true
      };
    }
    return FREE_CAPS;
  }

  // -----------------------------
  // WebCrypto license verification
  // Token format:
  //   svf2.<payload_b64url>.<sig_b64url>
  // payload JSON example:
  //   {"v":2,"plan":"annual","iat":..., "exp":... or null, "kid":"2026-01"}
  // signature: ECDSA P-256 / SHA-256 (DER encoded; WebCrypto compatible)
  // -----------------------------
  async function verifyLicenseToken(token) {
    const parts = String(token || "").trim().split(".");
    if (parts.length !== 3 || parts[0] !== "svf2") {
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

    if (!payload || payload.v !== 2 || !payload.plan) {
      return { ok: false, reason: "Invalid payload." };
    }
    if (payload.exp && nowUnix() > payload.exp) {
      return { ok: false, reason: "License expired." };
    }

    if (!window.crypto?.subtle) {
      return { ok: false, reason: "WebCrypto unavailable in this browser." };
    }

    let pubKey;
    try {
      pubKey = await crypto.subtle.importKey(
        "jwk",
        LICENSE_PUB_JWK,
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["verify"]
      );
    } catch {
      return { ok: false, reason: "Invalid public key (JWK)." };
    }

    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pubKey,
      sigBytes,
      payloadBytes
    );

    if (!ok) return { ok: false, reason: "Signature invalid." };
    return { ok: true, payload };
  }

  // -----------------------------
  // Quiet modal bridge (uses app modal if available)
  // -----------------------------
  function openQuietModal({ title, body, actions }) {
    if (typeof window.openModal === "function" && typeof window.closeModal === "function") {
      window.openModal({ title, body, actions });
      return;
    }
    // Fallback overlay
    const existing = $("#svfModal");
    if (existing) existing.remove();

    const el = document.createElement("div");
    el.id = "svfModal";
    el.innerHTML = `
      <div class="svf-modal-backdrop" role="dialog" aria-modal="true">
        <div class="svf-modal">
          <div class="svf-modal-title">${escapeHtml(title)}</div>
          <div class="svf-modal-body">${body}</div>
          <div class="svf-modal-actions">
            ${(actions || []).map((a, idx) =>
              `<button class="btn ${a.primary ? "gold" : ""}" data-idx="${idx}">${escapeHtml(a.label)}</button>`
            ).join("")}
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    el.querySelectorAll("button[data-idx]").forEach(btn => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-idx"));
        const a = actions[i];
        el.remove();
        a?.onClick?.();
      });
    });
  }

  function requirePremium(featureName, onAllowed) {
    if (isPremium()) return onAllowed?.();

    openQuietModal({
      title: "Premium",
      body: `
        <p class="muted"><strong>${escapeHtml(featureName)}</strong> is part of Premium.</p>
        <p class="muted">Offline-first. No accounts. Unlock with a license.</p>
      `,
      actions: [
        { label: "Enter license", primary: true, onClick: () => { window.location.hash = "#/unlock"; } },
        { label: "Not now", onClick: () => {} }
      ]
    });
  }

  // -----------------------------
  // Illustrations (inline SVG strings)
  // -----------------------------
  function svgOrbit() {
    return `
<svg class="illu illu-orbit" viewBox="0 0 120 120" aria-hidden="true">
  <defs>
    <linearGradient id="svf_g1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="rgba(212,175,55,0.9)"/>
      <stop offset="1" stop-color="rgba(212,175,55,0.2)"/>
    </linearGradient>
  </defs>
  <circle cx="60" cy="60" r="22" fill="none" stroke="url(#svf_g1)" stroke-width="2"/>
  <ellipse cx="60" cy="60" rx="44" ry="18" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/>
  <ellipse cx="60" cy="60" rx="18" ry="44" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="1.5"/>
  <circle cx="96" cy="60" r="2.8" fill="rgba(212,175,55,0.9)"/>
</svg>`;
  }

  function svgMonolith() {
    return `
<svg class="illu illu-monolith" viewBox="0 0 120 120" aria-hidden="true">
  <path d="M44 22h32v76H44z" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>
  <path d="M48 28h24v64H48z" fill="rgba(212,175,55,0.06)" stroke="rgba(212,175,55,0.30)" stroke-width="1.5"/>
  <path d="M44 22h32" stroke="rgba(212,175,55,0.35)" stroke-width="2"/>
</svg>`;
  }

  function svgLedger() {
    return `
<svg class="illu illu-ledger" viewBox="0 0 120 120" aria-hidden="true">
  <rect x="28" y="20" width="64" height="80" rx="6"
        fill="rgba(255,255,255,0.04)"
        stroke="rgba(255,255,255,0.14)" stroke-width="2"/>
  <line x1="38" y1="38" x2="82" y2="38"
        stroke="rgba(212,175,55,0.5)" stroke-width="2"/>
  <line x1="38" y1="54" x2="82" y2="54"
        stroke="rgba(255,255,255,0.18)" stroke-width="2"/>
  <line x1="38" y1="70" x2="70" y2="70"
        stroke="rgba(255,255,255,0.12)" stroke-width="2"/>
</svg>`;
  }

  // -----------------------------
  // Friction Ledger (data)
  // -----------------------------
  // entry: {ts, date, goalId?, taskId?, goalLabel?, taskLabel?, type, note?}
  function readFriction() {
    return jsonParseSafe(localStorage.getItem(FRICTION_KEY) || "[]", []);
  }

  function writeFriction(arr) {
    localStorage.setItem(FRICTION_KEY, JSON.stringify(arr));
  }

  function svfRecordFriction(entry) {
    const e = entry || {};
    const ts = e.ts || Date.now();
    const date = e.date || new Date(ts).toISOString().slice(0,10);

    const item = {
      ts,
      date,
      goalId: e.goalId || null,
      taskId: e.taskId || null,
      goalLabel: e.goalLabel || null,
      taskLabel: e.taskLabel || null,
      type: e.type || "unknown",
      note: e.note || null
    };

    const arr = readFriction();
    arr.push(item);

    // keep last ~1500 entries (safe cap)
    if (arr.length > 1500) arr.splice(0, arr.length - 1500);

    writeFriction(arr);
    return item;
  }

  function svfGetFrictionStats(days = 14) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const items = readFriction().filter(x => (x.ts || 0) >= cutoff);

    const byType = {};
    for (const it of items) byType[it.type] = (byType[it.type] || 0) + 1;

    const total = items.length || 1;
    const rows = Object.entries(byType)
      .map(([type, count]) => ({ type, count, pct: Math.round((count / total) * 100) }))
      .sort((a,b) => b.count - a.count);

    return { days, total: items.length, rows, items };
  }

  // Prompt friction (quiet, 1-click)
  function svfPromptFriction(ctx = {}) {
    const options = [
      { k: "uncertainty", label: "Unklarheit" },
      { k: "fatigue", label: "Erschöpfung" },
      { k: "distraction", label: "Ablenkung" },
      { k: "resistance", label: "Widerstand" },
      { k: "no_value", label: "Kein echter Wert" },
      { k: "external", label: "Externe Umstände" },
      { k: "overshot", label: "Überschätzt" },
      { k: "not_mine", label: "Nicht mein Ziel" }
    ];

    const title = "Friction";
    const taskLine = ctx.taskLabel ? `<p class="muted"><strong>${escapeHtml(ctx.taskLabel)}</strong></p>` : "";
    const hint = `<p class="muted">What stood in the way? One signal is enough.</p>`;

    openQuietModal({
      title,
      body: `${taskLine}${hint}
        <div class="svf-choice-grid">
          ${options.map(o => `<button class="svf-choice" data-k="${o.k}">${escapeHtml(o.label)}</button>`).join("")}
        </div>
        <p class="muted svf-small">Stored locally. No judgment. Just pattern.</p>
      `,
      actions: [
        { label: "Skip", onClick: () => {} }
      ]
    });

    // attach events to choice buttons
    setTimeout(() => {
      document.querySelectorAll(".svf-choice[data-k]").forEach(btn => {
        btn.addEventListener("click", () => {
          const type = btn.getAttribute("data-k");
          svfRecordFriction({
            type,
            goalId: ctx.goalId || null,
            taskId: ctx.taskId || null,
            goalLabel: ctx.goalLabel || null,
            taskLabel: ctx.taskLabel || null
          });
          if (typeof window.closeModal === "function") window.closeModal();
          const m = $("#svfModal"); if (m) m.remove();
        });
      });
    }, 0);
  }

  // -----------------------------
  // Layer UI (routes)
  // -----------------------------
  function isLayerRoute() {
    const h = window.location.hash || "#/start";
    return h === "#/pricing" || h === "#/unlock" || h === "#/friction";
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
          <div class="svf-head-left">
            ${svgOrbit()}
            <div>
              <h1>Pricing</h1>
              <p class="muted">Quiet, transparent. Offline-first. No accounts.</p>
            </div>
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
              <li>Friction capture (basic)</li>
            </ul>
            <a class="btn" href="#/start">Open app</a>
          </div>

          <div class="svf-card svf-card-gold">
            <div class="svf-badge">Most chosen</div>
            <div class="svf-illu-top">${svgMonolith()}</div>
            <h3>Premium Annual</h3>
            <p class="muted">Deep dialogue, exports, premium drops — plus Friction Analytics.</p>
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
                <li><strong>Friction Ledger analytics</strong></li>
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
          <div class="svf-row" style="justify-content:space-between;">
            <div>
              <h3>Status</h3>
              ${
                premium
                  ? `<p class="muted">Premium active <span class="svf-pill">${escapeHtml(plan)}</span></p>`
                  : `<p class="muted">Free mode. Enter a license to unlock Premium.</p>`
              }
            </div>
            <div class="svf-row">
              <a class="btn" href="#/friction">Friction Ledger</a>
              ${
                premium
                  ? `<button class="btn" id="svfRemove">Remove license</button>`
                  : `<a class="btn gold" href="#/unlock">Enter license</a>`
              }
            </div>
          </div>
          ${
            premium
              ? `<pre class="svf-code">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>`
              : ``
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
          <div class="svf-head-left">
            ${svgMonolith()}
            <div>
              <h1>Unlock</h1>
              <p class="muted">Enter a license token. Verified offline.</p>
            </div>
          </div>
          <div class="svf-head-actions">
            <a class="btn" href="#/pricing">Back</a>
          </div>
        </div>

        <div class="svf-card">
          <label class="svf-label">License token</label>
          <textarea id="svfLicenseInput" class="svf-textarea" rows="3" placeholder="svf2.…"></textarea>

          <div class="svf-row">
            <button class="btn gold" id="svfVerify">Verify & Save</button>
            <a class="btn" href="#/pricing">Pricing</a>
          </div>

          <p class="muted svf-small">Stored locally (localStorage). No account. No network required.</p>
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

  function renderFriction() {
    const premium = isPremium();
    const stats14 = svfGetFrictionStats(14);
    const top = stats14.rows[0];

    const typeLabel = (k) => ({
      uncertainty: "Unklarheit",
      fatigue: "Erschöpfung",
      distraction: "Ablenkung",
      resistance: "Widerstand",
      no_value: "Kein echter Wert",
      external: "Externe Umstände",
      overshot: "Überschätzt",
      not_mine: "Nicht mein Ziel",
      unknown: "Unklar"
    }[k] || k);

    const insightLine = (() => {
      if (!stats14.total) return "No friction recorded yet. That can be good — or invisible.";
      if (!top) return "Patterns appear with time.";
      if (top.type === "uncertainty") return "This looks less like discipline — and more like clarity.";
      if (top.type === "fatigue") return "Energy is a constraint. Treat it like one.";
      if (top.type === "distraction") return "Attention leaks are structural, not moral.";
      if (top.type === "resistance") return "Resistance can be a signal: a conflict, or a false goal.";
      return "The system reveals where reality pushes back.";
    })();

    const rows = stats14.rows.slice(0, premium ? 8 : 3);

    return `
      <div class="svf-view">
        <div class="svf-head">
          <div class="svf-head-left">
            ${svgLedger()}
            <div>
              <h1>Friction Ledger</h1>
              <p class="muted">A quiet mirror of what repeatedly stands in the way.</p>
            </div>
          </div>
          <div class="svf-head-actions">
            <a class="btn" href="#/start">Back</a>
            <a class="btn" href="#/pricing">Pricing</a>
          </div>
        </div>

        <div class="svf-card">
          <div class="svf-row" style="justify-content:space-between;">
            <div>
              <h3>Last 14 days</h3>
              <p class="muted">${escapeHtml(insightLine)}</p>
            </div>
            <div class="svf-metric">
              <div class="svf-metric-n">${stats14.total}</div>
              <div class="muted svf-small">signals</div>
            </div>
          </div>

          <div class="svf-bars">
            ${
              rows.length
                ? rows.map(r => `
                  <div class="svf-bar-row">
                    <div class="svf-bar-label">${escapeHtml(typeLabel(r.type))}</div>
                    <div class="svf-bar">
                      <div class="svf-bar-fill" style="width:${Math.min(100, Math.max(4, r.pct))}%"></div>
                    </div>
                    <div class="svf-bar-num muted">${r.pct}%</div>
                  </div>
                `).join("")
                : `<p class="muted">No entries yet. When you skip a task, record one signal.</p>`
            }
          </div>

          ${
            premium
              ? `<div class="svf-hr"></div>
                 <div class="svf-row" style="justify-content:space-between;">
                   <div>
                     <h3>Recent entries</h3>
                     <p class="muted">Not advice. Just evidence.</p>
                   </div>
                   <button class="btn" id="svfClearFriction">Clear ledger</button>
                 </div>
                 <div class="svf-entries">
                   ${stats14.items.slice(-16).reverse().map(it => `
                     <div class="svf-entry">
                       <div class="svf-entry-top">
                         <div class="svf-entry-type">${escapeHtml(typeLabel(it.type))}</div>
                         <div class="muted svf-small">${escapeHtml(it.date)}</div>
                       </div>
                       ${it.taskLabel ? `<div class="svf-entry-task">${escapeHtml(it.taskLabel)}</div>` : ""}
                       ${it.goalLabel ? `<div class="muted svf-small">${escapeHtml(it.goalLabel)}</div>` : ""}
                     </div>
                   `).join("")}
                 </div>`
              : `<div class="svf-hr"></div>
                 <p class="muted">
                   Premium unlocks pattern depth (more categories, longer history, recent-entry view).
                 </p>
                 <a class="btn gold" href="#/unlock">Unlock Premium</a>`
          }
        </div>

        <div class="svf-card svf-card-subtle">
          <h3>Capture a signal</h3>
          <p class="muted">Try it once. When you skip a task, record one friction. Three seconds.</p>
          <button class="btn" id="svfTryFriction">Record a friction</button>
        </div>
      </div>
    `;
  }

  function renderLayerRoute() {
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
        btn.onclick = async () => {
          const token = ($("#svfLicenseInput")?.value || "").trim();
          const res = await verifyLicenseToken(token);

          if (!res.ok) {
            openQuietModal({
              title: "Could not verify",
              body: `<p class="muted">${escapeHtml(res.reason)}</p>`,
              actions: [{ label: "OK", primary: true, onClick: () => {} }]
            });
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

    if (h === "#/friction") {
      root.innerHTML = renderFriction();

      const tryBtn = $("#svfTryFriction");
      if (tryBtn) tryBtn.onclick = () => svfPromptFriction({ taskLabel: "Example task" });

      const clearBtn = $("#svfClearFriction");
      if (clearBtn) {
        clearBtn.onclick = () => {
          requirePremium("Friction analytics", () => {
            localStorage.removeItem(FRICTION_KEY);
            renderLayerRoute();
          });
        };
      }
      return;
    }
  }

  // Run AFTER your app’s router; we only override our routes
  function onRouteChange() {
    if (!isLayerRoute()) return;
    setTimeout(renderLayerRoute, 0);
  }

  window.addEventListener("hashchange", onRouteChange);
  onRouteChange();

  // -----------------------------
  // Expose globals for your app
  // -----------------------------
  window.isPremium = isPremium;
  window.caps = caps;
  window.requirePremium = requirePremium;
  window.clearLicense = clearLicense;

  window.svfRecordFriction = svfRecordFriction;
  window.svfPromptFriction = svfPromptFriction;
  window.svfGetFrictionStats = svfGetFrictionStats;

})();
