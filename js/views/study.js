/**
 * NEXUS OS — Study Session View
 * SM-2 SRS review with 3D flip
 */

let session = { cards: [], index: 0, correct: 0 };

export async function renderStudy(container, deckId) {
  showLoader("LOADING DECK");
  try {
    const data = await api(`/api/v1/flashcards/decks/${deckId}`);
    // Only due cards, fallback to all
    const due = data.cards.filter((c) => !c.due_date || new Date(c.due_date) <= new Date());
    session = { cards: due.length ? due : data.cards, index: 0, correct: 0, deckId };

    if (session.cards.length === 0) {
      container.innerHTML = `
        <div class="max-w-lg mx-auto px-4 py-16 text-center">
          <div class="nx-card p-8 text-nx-text-muted">Ce deck est vide.</div>
          <button onclick="location.hash='#/academics/flashcards'" class="nx-btn nx-btn-secondary mt-4">← RETOUR</button>
        </div>`;
      return;
    }
    renderCard(container);
  } catch (e) {
    toast("Erreur: " + e.message, "error");
    location.hash = "/academics/flashcards";
  } finally {
    hideLoader();
  }
}

function renderCard(container) {
  const { cards, index } = session;
  const card = cards[index];
  const pct = Math.round((index / cards.length) * 100);

  container.innerHTML = `
    <div class="max-w-lg mx-auto px-4 py-6 pb-24">
      <div class="flex items-center justify-between mb-4">
        <button onclick="location.hash='#/academics/flashcards'" class="nx-btn nx-btn-ghost">← QUIT</button>
        <div class="font-mono text-xs text-nx-text-sec">${index + 1} / ${cards.length}</div>
      </div>

      <div class="nx-progress mb-6">
        <div class="nx-progress-fill" style="width:${pct}%"></div>
      </div>

      <!-- 3D CARD -->
      <div class="nx-flip-scene h-64 mb-6">
        <div class="nx-flip-card" id="flip-card">
          <div class="nx-flip-face flex-col text-center">
            <div class="font-mono text-xs tracking-widest text-nx-cyan mb-3">QUESTION</div>
            <div class="text-lg font-medium px-2">${escapeHtml(card.front)}</div>
            <div class="absolute bottom-4 text-nx-text-muted text-xs font-mono">tap to flip</div>
          </div>
          <div class="nx-flip-face nx-flip-back flex-col text-center">
            <div class="font-mono text-xs tracking-widest text-nx-red mb-3">RÉPONSE</div>
            <div class="text-base px-2 whitespace-pre-wrap">${escapeHtml(card.back)}</div>
          </div>
        </div>
      </div>

      <!-- SRS BUTTONS (visible after flip) -->
      <div id="srs-buttons" class="hidden flex gap-2">
        <button class="nx-srs-btn nx-srs-again" data-rating="again">😵 AGAIN</button>
        <button class="nx-srs-btn nx-srs-hard" data-rating="hard">😬 HARD</button>
        <button class="nx-srs-btn nx-srs-good" data-rating="good">🙂 GOOD</button>
        <button class="nx-srs-btn nx-srs-easy" data-rating="easy">😎 EASY</button>
      </div>
    </div>
  `;

  const flipCard = document.getElementById("flip-card");
  const srsButtons = document.getElementById("srs-buttons");
  let flipped = false;

  flipCard.addEventListener("click", () => {
    flipped = !flipped;
    flipCard.classList.toggle("flipped", flipped);
    srsButtons.classList.toggle("hidden", !flipped);
  });

  srsButtons.querySelectorAll(".nx-srs-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      showLoader("SAVING");
      try {
        await api(`/api/v1/flashcards/${card.id}/review`, {
          method: "POST",
          body: JSON.stringify({ rating: btn.dataset.rating }),
        });
        if (btn.dataset.rating === "good" || btn.dataset.rating === "easy") session.correct++;
      } catch (e) {
        toast("Erreur review: " + e.message, "error");
      } finally {
        hideLoader();
      }

      session.index++;
      if (session.index >= session.cards.length) {
        renderSessionEnd(container);
      } else {
        renderCard(container);
      }
    });
  });
}

function renderSessionEnd(container) {
  const acc = Math.round((session.correct / session.cards.length) * 100);
  container.innerHTML = `
    <div class="max-w-lg mx-auto px-4 py-20 text-center">
      <div class="nx-card-elevated p-8 score-pop">
        <div class="font-mono text-xs tracking-widest text-nx-cyan mb-2">SESSION COMPLETE</div>
        <div class="text-5xl font-bold mb-2 ${acc >= 70 ? "text-nx-green" : acc >= 40 ? "text-nx-amber" : "text-nx-red"}"
             style="letter-spacing:-0.03em">${acc}%</div>
        <div class="text-nx-text-sec text-sm mb-6">${session.correct} / ${session.cards.length} correct</div>
        <div class="flex gap-3 justify-center">
          <button onclick="location.hash='#/academics/flashcards'" class="nx-btn nx-btn-primary">DONE</button>
          <button onclick="renderStudyAgain()" class="nx-btn nx-btn-secondary">RESTART</button>
        </div>
      </div>
    </div>
  `;
  // Expose restart
  window.renderStudyAgain = () => {
    session.index = 0;
    session.correct = 0;
    renderCard(container);
  };
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
