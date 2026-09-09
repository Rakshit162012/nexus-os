/**
 * NEXUS OS — Frontend Configuration
 * Connects the UI to your live backend + Supabase
 * (Helpers are attached to window so ALL modules can use them)
 */

(function () {
  const BACKEND_URL = "https://nexus-os-backend-445137667521.europe-west1.run.app";
  const SUPABASE_URL = "https://yptgmzbpzeetthgxqmga.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnc2lheHJ3d3F1Z2VkbHNmeG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NzQxNjAsImV4cCI6MjEwNDE1MDE2MH0.vrZ9csldDptljSD6gOEvDPqwKK31JQvwdDgCbU1gqw8";

  window.APP_CONFIG = {
    BACKEND_URL,
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    APP_NAME: "NEXUS OS",
    VERSION: "2.0.0",
    USER_NAME: "Rakshit",
    SUBJECTS: [
      { code: "maths", name: "Mathématiques" },
      { code: "physique-chimie", name: "Physique-Chimie" },
      { code: "ses", name: "SES" },
      { code: "francais", name: "Français" },
      { code: "ll-anglais", name: "LL Anglais" },
      { code: "hg-dnl", name: "HG DNL" },
      { code: "svt", name: "SVT" },
      { code: "snt", name: "SNT" },
      { code: "eps", name: "EPS" },
      { code: "emc", name: "EMC" },
    ],
  };

  window.api = async function (endpoint, options = {}) {
    const res = await fetch(window.APP_CONFIG.BACKEND_URL + endpoint, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "API error " + res.status);
    }
    return res.json();
  };

  window.showLoader = function (text = "PROCESSING") {
    document.getElementById("loader-text").textContent = text;
    document.getElementById("loader").classList.remove("hidden");
  };

  window.hideLoader = function () {
    document.getElementById("loader").classList.add("hidden");
  };

  window.toast = function (message, type = "info", duration = 3000) {
    const el = document.getElementById("toast");
    el.textContent = message;
    el.className =
      "fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg font-mono text-sm border " +
      type;
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), duration);
  };
})();
