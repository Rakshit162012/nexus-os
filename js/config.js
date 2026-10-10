/**
 * NEXUS OS — Frontend Configuration
 * Connects the UI to your live backend + Supabase
 * (Helpers are attached to window so ALL modules can use them)
 */

(function () {
  const BACKEND_URL = "https://nexus-os-backend-445137667521.europe-west1.run.app";
  const SUPABASE_URL = "https://dgsiaxrwwqugedlsfxno.supabase.co";
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
    // Voice recording (Firefox-safe) → backend → Groq Whisper
  window.recordVoice = function (onResult) {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      toast("Micro non supporté sur ce navigateur", "error", 4000);
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus") ? "audio/ogg;codecs=opus" : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      document.querySelectorAll(".nx-fab, #voice-btn").forEach((b) => b.classList.add("recording"));
      toast("🎤 Enregistrement... clique n'importe où pour arrêter", "info", 3000);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        document.querySelectorAll(".nx-fab, #voice-btn").forEach((b) => b.classList.remove("recording"));
        showLoader("TRANSCRIPTION");
        try {
          const blob = new Blob(chunks, { type: mime || "audio/webm" });
          const fd = new FormData();
          fd.append("file", blob, "voice.webm");
          const res = await fetch(window.APP_CONFIG.BACKEND_URL + "/api/v1/voice/transcribe", { method: "POST", body: fd });
          if (!res.ok) throw new Error("Transcription " + res.status);
          const data = await res.json();
          if (data.text) onResult(data.text);
          else toast("Rien entendu — réessaie", "error");
        } catch (e) {
          toast("Erreur: " + e.message, "error");
        } finally {
          hideLoader();
        }
      };
      rec.start();
      setTimeout(() => {
        const stopHandler = () => { if (rec.state === "recording") rec.stop(); document.removeEventListener("click", stopHandler); };
        document.addEventListener("click", stopHandler);
      }, 400);
    }).catch(() => toast("Accès micro refusé — autorise le micro dans Firefox", "error", 4000));
  };
    // Render markdown-lite + LaTeX for chat bubbles
  window.mdToHtml = function (text) {
    const esc = (s) => { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; };
    let t = esc(text);
    t = t.replace(/\$\$([\s\S]*?)\$\$/g, '<div class="nx-math">$1</div>');
    t = t.replace(/\$([^$\n]+)\$/g, '<code class="nx-inline-math">$1</code>');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-nx-cyan font-semibold">$1</strong>');
    t = t.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    t = t.replace(/`([^`]+)`/g, '<code class="nx-inline-math">$1</code>');
    t = t.replace(/^### (.*)$/gm, '<div class="font-bold mt-2 mb-1 text-nx-red">$1</div>');
    t = t.replace(/^- (.*)$/gm, '<div class="pl-3">• $1</div>');
    t = t.replace(/^\d+\. (.*)$/gm, '<div class="pl-3">$1</div>');
    return t.replace(/\n/g, "<br>");
  };

  // Strip markdown/LaTeX so TTS reads clean natural text
  window.cleanForSpeech = function (text) {
    return text
      .replace(/\$\$[\s\S]*?\$\$/g, " une formule mathématique. ")
      .replace(/\$([^$]+)\$/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*\n]+)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/^#+\s*/gm, "")
      .replace(/[_~]/g, "")
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, ", ");
  };
})();
