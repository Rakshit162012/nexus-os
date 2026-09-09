/**
 * NEXUS OS — Flashcards View
 * Deck list with mastery + Study Now
 */

import { getState, loadDecks, loadDueCards } from "../store.js";

export async function renderFlashcards(container) {
  await Promise.all([loadDecks(), loadDueCards()]);
  const { decks, dueCards } = getState();

  // Count due per deck
  const dueByDeck = {};
  dueCards.forEach((c) => { dueByDeck[c.deck_id] = (dueByDeck[c.deck_id] || 0) + 1; });

  container.innerHTML = `
    <div class="max-w-6xl mx-auto px-4 py-6 pb-24 md:pb-8">
      <div class="flex items-center justify-between mb-5">
        <h1 class="text-2xl font-bold tracking-tight">FLASHCARDS</h1>
        <span class="nx-badge ${dueCards.length > 0 ? "nx-badge-red" : "nx-badge-green"}">
          ${dueCards.length} due today
        </span>
      </div>

      <div class="grid md:grid-cols-2 gap-3">
        ${decks.length === 0 ? `
          <div class="nx-card p-8 text-center text-nx-text-muted md:col-span-2">
            Aucun deck. Ouvre une note et clique GENERATE FLASHCARDS.
          </div>` :
          decks.map((d) => {
            const due = dueByDeck[d.id] || 0;
            const mastery = d.mastery_average || 0;
            const pct = Math.min(100, Math.round(mastery * 100));
            return `
            <div class="nx-card p-5">
              <div class="flex items-center gap-2 mb-2">
                <span class="dot dot-${d.subject || "default"}"></span>
                <span class="font-mono text-xs text-nx-text-sec capitalize">${d.subject || ""}</span>
                ${due > 0 ? `<span class="nx-badge nx-badge-red ml-auto">${due} due</span>` : ""}
              </div>
              <div class="font-medium mb-1">${escapeHtml(d.name)}</div>
              <div class="text-nx-text-muted text-xs mb-3">${d.card_count || 0} cartes</div>
              <div class="flex items-center gap-2 mb-3">
                <div class="nx-progress flex-1">
                  <div class="nx-progress-fill ${pct > 70 ? "green" : ""}" style="width:${pct}%"></div>
                </div>
                <span class="font-mono text-xs text-nx-text-sec">${pct}%</span>
              </div>
              <button class="nx-btn ${due > 0 ? "nx-btn-primary" : "nx-btn-secondary"} w-full study-btn"
                data-id="${d.id}" ${due === 0 && (d.card_count || 0) === 0 ? "disabled" : ""}>
                ${due > 0 ? "STUDY NOW" : "STUDY"}
              </button>
            </div>`;
          }).join("")}
      </div>
    </div>
  `;

  container.querySelectorAll(".study-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      location.hash = `/study/${btn.dataset.id}`;
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
