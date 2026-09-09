/**
 * NEXUS OS — App Shell
 * Desktop sidebar · Mobile bottom nav · Voice mic · Router init
 */

import { initRouter } from "./router.js";

const NAV_ITEMS = [
  { id: "dashboard", hash: "#/dashboard", icon: "⌂", label: "HOME" },
  { id: "academics", hash: "#/academics", icon: "✎", label: "NOTES" },
  { id: "flashcards", hash: "#/academics/flashcards", icon: "▤", label: "CARDS", nav: "flashcards" },
  { id: "quizzes", hash: "#/academics/quizzes", icon: "?", label: "QUIZ", nav: "quizzes" },
];

function renderShell() {
  const app = document.getElementById("app");

  // ===== DESKTOP SIDEBAR =====
  const sidebar = document.createElement("aside");
  sidebar.className = "hidden md:flex flex-col fixed left-0 top-0 h-full w-56 bg-nx-surface border-r border-[rgba(255,26,26,0.15)] p-4 z-40";
  sidebar.innerHTML = `
    <div class="flex items-center gap-2 mb-8 px-2">
      <div class="w-8 h-8 rounded-lg bg-nx-red flex items-center justify-center font-bold text-nx-bg text-lg"
           style="box-shadow:0 0 14px rgba(255,26,26,0.5)">N</div>
      <div>
        <div class="font-bold tracking-tight" style="letter-spacing:-0.03em">NEXUS OS</div>
        <div class="font-mono text-[10px] text-nx-text-muted tracking-widest">v2.0 · HERMES</div>
      </div>
    </div>
    <nav class="flex-1 space-y-1">
      ${NAV_ITEMS.map((n) => `
        <a href="${n.hash}" data-nav="${n.nav || n.id}" class="nx-sidebar-item">
          <span class="text-base w-5 text-center">${n.icon}</span>${n.label}
        </a>`).join("")}
    </nav>
    <div class="mt-auto px-2">
      <button id="mic-btn-desktop" class="nx-btn nx-btn-secondary w-full" title="Parler à NEXUS">🎤 VOICE</button>
    </div>
  `;

  // ===== MOBILE BOTTOM NAV =====
  const bottomNav = document.createElement("nav");
  bottomNav.className = "md:hidden fixed bottom-0 left-0 right-0 bg-nx-surface border-t border-[rgba(255,26,26,0.15)] z-40 flex px-2 pb-safe";
  bottomNav.innerHTML = NAV_ITEMS.map((n) => `
    <a href="${n.hash}" data-nav="${n.nav || n.id}" class="nx-nav-item">
      <span class="text-xl">${n.icon}</span>${n.label}
    </a>`).join("");

  // ===== FLOATING MIC (mobile) =====
  const fab = document.createElement("button");
  fab.id = "mic-btn-mobile";
  fab.className = "nx-fab md:hidden fixed bottom-20 right-4 z-40";
  fab.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0a0000" stroke-width="2.5">
    <rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 19v3"/>
  </svg>`;

  // Insert shell around #view
  const view = document.getElementById("view");
  app.insertBefore(sidebar, view);
  app.appendChild(bottomNav);
  app.appendChild(fab);

  // Spacing for fixed elements
  view.classList.add("md:ml-56");

  // ===== VOICE (Web Speech — browser native, no API key) =====
  const micHandler = setupVoice();
  document.getElementById("mic-btn-mobile").addEventListener("click", micHandler);
  document.getElementById("mic-btn-desktop").addEventListener("click", micHandler);
}

function setupVoice() {
  return () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast("Voice non supporté sur ce navigateur — utilise Chrome", "error", 4000);
      return;
    }
    const rec = new SR();
    rec.lang = "fr-FR";
    rec.interimResults = false;

    const btns = [
      document.getElementById("mic-btn-mobile"),
      document.getElementById("mic-btn-desktop"),
    ].filter(Boolean);
    btns.forEach((b) => b.classList.add("recording"));
    toast("🎤 J'écoute...", "info", 2000);

    rec.onresult = (event) => {
      const text = event.results[0][0].transcript;
      // If on dashboard, fill quick capture; otherwise save and go
      const qc = document.getElementById("qc-text");
      if (qc) {
        qc.value = text;
        toast("Transcription ajoutée au Quick Capture", "success");
      } else {
        sessionStorage.setItem("voice-draft", text);
        location.hash = "/dashboard";
        setTimeout(() => {
          const el = document.getElementById("qc-text");
          if (el) el.value = text;
        }, 400);
        toast("Transcription ajoutée", "success");
      }
    };
    rec.onend = () => btns.forEach((b) => b.classList.remove("recording"));
    rec.onerror = () => {
      btns.forEach((b) => b.classList.remove("recording"));
      toast("Erreur micro", "error");
    };
    rec.start();
  };
}

// ===== BOOT =====
renderShell();
initRouter();
