/**
 * NEXUS OS — Notes View
 * Cornell note list + full note display + generate flashcards/quiz
 */

import { getState, loadNotes } from "../store.js";

export async function renderNotes(container, noteId = null) {
  await loadNotes();
  const { notes } = getState();

  if (noteId) {
    renderNoteDetail(container, noteId);
    return;
  }

  container.innerHTML = `
    <div class="max-w-6xl mx-auto px-4 py-6 pb-24 md:pb-8">
      <div class="flex items-center justify-between mb-5">
        <h1 class="text-2xl font-bold tracking-tight">NOTES</h1>
        <span class="nx-badge nx-badge-cyan">${notes.length} total</span>
      </div>

      <!-- Subject filter -->
      <div class="flex gap-2 overflow-x-auto pb-3 mb-4" style="scrollbar-width:none">
        <button class="nx-btn nx-btn-primary filter-btn" data-subj="">Tous</button>
        ${APP_CONFIG.SUBJECTS.map((s) => `
          <button class="nx-btn nx-btn-ghost filter-btn" data-subj="${s.code}">${s.name}</button>
        `).join("")}
      </div>

      <div id="notes-list" class="space-y-3"></div>
    </div>
  `;

  const renderList = (filter) => {
    const filtered = filter ? notes.filter((n) => n.subject === filter) : notes;
    const list = document.getElementById("notes-list");
    list.innerHTML = filtered.length === 0
      ? `<div class="nx-card p-8 text-center text-nx-text-muted">Aucune note. Retourne au dashboard pour en créer une.</div>`
      : filtered.map((n) => `
        <div class="nx-card p-4 cursor-pointer note-item" data-id="${n.id}">
          <div class="flex items-center gap-2 mb-1">
            <span class="dot dot-${n.subject || "default"}"></span>
            <span class="font-mono text-xs text-nx-text-sec capitalize">${n.subject || "general"}</span>
            <span class="text-nx-text-muted text-xs ml-auto">${new Date(n.created_at).toLocaleDateString("fr-FR")}</span>
          </div>
          <div class="font-medium">${escapeHtml(n.title || "Sans titre")}</div>
          <div class="text-nx-text-muted text-sm mt-1 line-clamp-2">${escapeHtml(n.summary || "")}</div>
          <div class="flex gap-2 mt-3">
            <button class="nx-btn nx-btn-ghost gen-flash" data-id="${n.id}" style="padding:0.3rem 0.8rem; font-size:0.65rem">FLASHCARDS</button>
            <button class="nx-btn nx-btn-ghost gen-quiz" data-id="${n.id}" style="padding:0.3rem 0.8rem; font-size:0.65rem">QUIZ</button>
          </div>
        </div>
      `).join("");

    // Click card -> detail
    list.querySelectorAll(".note-item").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.classList.contains("gen-flash") || e.target.classList.contains("gen-quiz")) return;
        renderNoteDetail(container, el.dataset.id);
      });
    });
    // Generate buttons
    list.querySelectorAll(".gen-flash").forEach((btn) =>
      btn.addEventListener("click", () => generateFromNote(btn.dataset.id, "flashcards")));
    list.querySelectorAll(".gen-quiz").forEach((btn) =>
      btn.addEventListener("click", () => generateFromNote(btn.dataset.id, "quiz")));
  };

  renderList("");

  container.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".filter-btn").forEach((b) => {
        b.classList.remove("nx-btn-primary");
        b.classList.add("nx-btn-ghost");
      });
      btn.classList.remove("nx-btn-ghost");
      btn.classList.add("nx-btn-primary");
      renderList(btn.dataset.subj);
    });
  });
}

function renderNoteDetail(container, noteId) {
  const note = getState().notes.find((n) => n.id === noteId);
  if (!note) { renderNotes(container); return; }

  container.innerHTML = `
    <div class="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-8">
      <button onclick="location.hash='#/academics'" class="nx-btn nx-btn-ghost mb-4">← RETOUR</button>

      <div class="flex items-start gap-2 mb-1 flex-wrap">
        <span class="dot dot-${note.subject || "default"} mt-2"></span>
        <h1 class="text-2xl font-bold tracking-tight flex-1">${escapeHtml(note.title || "Sans titre")}</h1>
        <span class="nx-badge nx-badge-red">${escapeHtml(note.subject || "")}</span>
      </div>
      <div class="text-nx-text-muted text-sm mb-5">${escapeHtml(note.topic || "")}</div>

      <!-- CORNELL LAYOUT -->
      <div class="grid md:grid-cols-3 gap-4 mb-4">
        <div class="nx-card-elevated p-4 md:col-span-1">
          <div class="font-mono text-xs tracking-widest text-nx-cyan mb-3">CUE</div>
          <div class="text-sm text-nx-text-sec whitespace-pre-wrap">${escapeHtml(note.cue_column || "")}</div>
        </div>
        <div class="nx-card-elevated p-4 md:col-span-2">
          <div class="font-mono text-xs tracking-widest text-nx-red mb-3">NOTES</div>
          <div class="text-sm whitespace-pre-wrap">${escapeHtml(note.notes_column || "")}</div>
        </div>
      </div>

      <!-- SUMMARY -->
      <div class="nx-card p-4 mb-5">
        <div class="font-mono text-xs tracking-widest text-nx-amber mb-2">SUMMARY</div>
        <div class="text-sm text-nx-text-sec">${escapeHtml(note.summary || "")}</div>
      </div>

      <!-- ACTIONS -->
      <div class="flex flex-wrap gap-3">
        <button class="nx-btn nx-btn-primary gen-flash-detail" data-id="${note.id}">GENERATE FLASHCARDS</button>
        <button class="nx-btn nx-btn-secondary gen-quiz-detail" data-id="${note.id}">GENERATE QUIZ</button>
      </div>
    </div>
  `;

  container.querySelector(".gen-flash-detail").addEventListener("click", (e) => generateFromNote(e.target.dataset.id, "flashcards"));
  container.querySelector(".gen-quiz-detail").addEventListener("click", (e) => generateFromNote(e.target.dataset.id, "quiz"));
}

async function generateFromNote(noteId, type) {
  showLoader(type === "flashcards" ? "BUILDING DECK" : "BUILDING QUIZ");
  try {
    const result = await api(`/api/v1/notes/${noteId}/${type}`, { method: "POST" });
    if (result.success) {
      toast(type === "flashcards"
        ? `${result.cards_generated} cartes créées`
        : `${result.questions_generated} questions créées`, "success");
      location.hash = type === "flashcards" ? "/academics/flashcards" : "/academics/quizzes";
    } else {
      toast("Erreur: " + (result.detail || "inconnue"), "error", 5000);
    }
  } catch (e) {
    toast("Erreur: " + e.message, "error", 5000);
  } finally {
    hideLoader();
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
