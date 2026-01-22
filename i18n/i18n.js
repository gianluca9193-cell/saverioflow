/* SaverIoFlow i18n runtime (no build tools)
   - Priority: ?lang=xx -> localStorage -> navigator.language -> 'en'
   - Applies: [data-i18n], [data-i18n-html], [data-i18n-placeholder], [data-i18n-title], [data-i18n-aria]
   - RTL: auto for Arabic (ar)
*/

(function () {
  const SUPPORTED = ["en", "de", "es", "it", "ar"];
  const DEFAULT_LANG = "en";
  const STORAGE_KEY = "sif.lang";

  function normalizeLang(code) {
    if (!code) return "";
    const lc = String(code).toLowerCase().trim();
    // accept 'de-DE' => 'de'
    const base = lc.split("-")[0];
    if (SUPPORTED.includes(lc)) return lc;
    if (SUPPORTED.includes(base)) return base;
    return "";
  }

  function getLangFromQuery() {
    try {
      const url = new URL(window.location.href);
      return normalizeLang(url.searchParams.get("lang"));
    } catch (_) {
      return "";
    }
  }

  function getLangFromStorage() {
    try {
      return normalizeLang(localStorage.getItem(STORAGE_KEY));
    } catch (_) {
      return "";
    }
  }

  function getLangFromBrowser() {
    const nav = navigator.language || (navigator.languages && navigator.languages[0]) || "";
    return normalizeLang(nav);
  }

  function getDict(lang) {
    // Dictionaries are loaded as globals: window.SIF_I18N_EN etc.
    const key = "SIF_I18N_" + lang.toUpperCase();
    return window[key] || null;
  }

  function setDocumentDirection(lang) {
    const isRTL = lang === "ar";
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", isRTL ? "rtl" : "ltr");
    document.documentElement.classList.toggle("rtl", isRTL);
  }

  function translateDom(dict, fallbackDict) {
    const nodes = document.querySelectorAll("[data-i18n], [data-i18n-html], [data-i18n-placeholder], [data-i18n-title], [data-i18n-aria]");
    nodes.forEach((el) => {
      // text content
      const kText = el.getAttribute("data-i18n");
      if (kText) {
        const val = dict?.[kText] ?? fallbackDict?.[kText];
        if (typeof val === "string") el.textContent = val;
      }

      // innerHTML (use carefully)
      const kHtml = el.getAttribute("data-i18n-html");
      if (kHtml) {
        const val = dict?.[kHtml] ?? fallbackDict?.[kHtml];
        if (typeof val === "string") el.innerHTML = val;
      }

      // placeholder
      const kPh = el.getAttribute("data-i18n-placeholder");
      if (kPh) {
        const val = dict?.[kPh] ?? fallbackDict?.[kPh];
        if (typeof val === "string") el.setAttribute("placeholder", val);
      }

      // title tooltip
      const kTitle = el.getAttribute("data-i18n-title");
      if (kTitle) {
        const val = dict?.[kTitle] ?? fallbackDict?.[kTitle];
        if (typeof val === "string") el.setAttribute("title", val);
      }

      // aria-label
      const kAria = el.getAttribute("data-i18n-aria");
      if (kAria) {
        const val = dict?.[kAria] ?? fallbackDict?.[kAria];
        if (typeof val === "string") el.setAttribute("aria-label", val);
      }
    });
  }

  function pickInitialLang() {
    return (
      getLangFromQuery() ||
      getLangFromStorage() ||
      getLangFromBrowser() ||
      DEFAULT_LANG
    );
  }

  function applyLanguage(lang) {
    const finalLang = normalizeLang(lang) || DEFAULT_LANG;
    const dict = getDict(finalLang);
    const fallback = getDict(DEFAULT_LANG);

    setDocumentDirection(finalLang);
    translateDom(dict, fallback);

    // remember choice
    try { localStorage.setItem(STORAGE_KEY, finalLang); } catch (_) {}

    // notify app code if it cares
    window.dispatchEvent(new CustomEvent("sif:lang-changed", { detail: { lang: finalLang }}));
  }

  // public API
  window.SIF_I18N = {
    supported: SUPPORTED.slice(),
    getCurrent() {
      return normalizeLang(getLangFromStorage()) || pickInitialLang();
    },
    set(lang) {
      applyLanguage(lang);
    },
    init() {
      applyLanguage(pickInitialLang());
    }
  };
})();
