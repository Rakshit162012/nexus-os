/**
 * NEXUS OS — Dashboard View
 * Greeting · Quick Capture · Due Cards · Streaks · Recent Notes
 */

import { getState, loadNotes, loadDueCards, loadDecks } from "../store.js";
import { navigate } from "../router.js";

export async function renderDashboard(container) {
  await Promise.all([loadNotes(), loadDueCards(), loadDecks()]);
  const { notes, dueCards, decks } = getState();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "BONJOUR" : hour < 18 ? "BON APRÈS-MIDI" : "BONSOIR";
  const dateStr = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const totalCards = decks.reduce((sum, d) => sum + (d.card_count || 0), 0);
  const recentNotes = notes.slice(0, 3);

  container.innerHTML = `
    <div class="max-w-6xl mx-auto px-4 py-6 pb-24 md:pb-8">

      <!-- GREETING -->
      <div class="nx-card p-6 mb-6 relative overflow-hidden">
        <div class="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10 pointer-events-none"
             style="background: radial-gradient(circle, #ff1a1a 0%, transparent 70%)"></div>
        <div class="text-nx-cyan font-mono text-xs tracking-widest mb-1">${greeting},</div>
        <h1 class="text-3xl md:text-4xl font-bold tracking-tight mb-1" style="letter-spacing:-0.03em">
          ${APP_CONFIG.USER_NAME}
        </h1>
        <div class="text-nx-text-sec text-sm capitalize">${dateStr}</div>
      </div>

      <!-- STATS ROW -->
      <div class="grid grid-cols-3 gap-3 mb-6">
        <div class="nx-card p-4 text-center cursor-pointer" onclick="location.hash='#/academics/flashcards'">
          <div class="text-2xl font-bold text-nx-red">${dueCards.length}</div>
          <div class="text-nx-text-sec text-xs font-mono mt-1">DUE CARDS</div>
        </div>
        <div class="nx-card p-4 text-center cursor-pointer" onclick="location.hash='#/academics'">
          <div class="text-2xl font-bold text-nx-cyan">${notes.length}</div>
          <div class="text-nx-text-sec text-xs font-mono mt-1">NOTES</div>
        </div>
        <div class="nx-card p-4 text-center cursor-pointer" onclick="location.hash='#/academics/flashcards'">
          <div class="text-2xl font-bold nx-streak">${totalCards}</div>
          <div class="text-nx-text-sec text-xs font-mono mt-1">CARDS</div>
        </div>
      </div>

      <!-- QUICK CAPTURE -->
      <div class="nx-card-elevated p-5 mb-6">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-2 h-2 rounded-full bg-nx-red animate-pulse"></div>
          <div class="font-mono text-xs tracking-widest text-nx-red">QUICK CAPTURE</div>
        </div>
        <textarea id="qc-text" rows="4" class="nx-input mb-3 resize-none"
          placeholder="Colle ton cours, transcript ou notes ici..."></textarea>
        <div class="flex flex-wrap gap-2 mb-3">
          <select id="qc-subject" class="nx-input" style="width:auto; padding:0.5rem 0.8rem; font-size:0.85rem">
            <option value="">Auto-détecter matière</option>
            ${APP_CONFIG.SUBJECTS.map((s) => `<option value="${s.code}">${s.name}</option>`).join("")}
          </select>
        </div>
        <button id="qc-submit" class="nx-btn nx-btn-primary w-full animate-pulse-glow">PROCESS</button>
      </div>

      <!-- RECENT NOTES -->
      <div class="mb-2 font-mono text-xs tracking-widest text-nx-text-sec">RECENT NOTES</div>
      <div class="space-y-3">
        ${recentNotes.length === 0 ? `
          <div class="nx-card p-6 text-center text-nx-text-muted text-sm">
            Aucune note encore. Colle ton premier cours ci-dessus.
          </div>` :
          recentNotes.map((n) => `
          <div class="nx-card p-4 cursor-pointer" onclick="location.hash='#/academics'">
            <div class="flex items-center gap-2 mb-1">
              <span class="dot dot-${n.subject || "default"}"></span>
              <span class="font-mono text-xs text-nx-text-sec capitalize">${n.subject || "general"}</span>
              <span class="nx-badge ml-auto">${n.difficulty || "medium"}</span>
            </div>
            <div class="font-medium">${escapeHtml(n.title || "Sans titre")}</div>
            <div class="text-nx-text-muted text-xs mt-1 line-clamp-1">${escapeHtml(n.summary || "")}</div>
          </div>`).join("")}
      </div>
    </div>
  `;

  // Wire up PROCESS button
  document.getElementById("qc-submit").addEventListener("click", submitTranscript);
}

async function submitTranscript() {
  const text = document.getElementById("qc-text").value.trim();
  const subject = document.getElementById("qc-subject").value;

  if (text.length < 10) {
    toast("Texte trop court (min 10 caractères)", "error");
    return;
  }

  const btn = document.getElementById("qc-submit");
  btn.disabled = true;
  showLoader("AGENT WORKING");
  try {
    const result = await api("/api/v1/transcripts/", {
      method: "POST",
      body: JSON.stringify({ raw_text: text, subject_hint: subject || null }),
    });
    if (result.success) {
      toast(`Note créée: ${result.note?.title || "OK"}`, "success");
      document.getElementById("qc-text").value = "";
      await loadNotes();
      navigate("/academics");
    } else {
      toast("Erreur agent: " + (result.error || "inconnue"), "error", 5000);
    }
  } catch (e) {
    toast("Erreur: " + e.message, "error", 5000);
  } finally {
    hideLoader();
    btn.disabled = false;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
