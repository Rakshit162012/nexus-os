/**
 * NEXUS OS — Quizzes View
 * Quiz list with weakness indicators
 */

import { getState, loadQuizzes } from "../store.js";

export async function renderQuizzes(container) {
  await loadQuizzes();
  const { quizzes } = getState();

  container.innerHTML = `
    <div class="max-w-6xl mx-auto px-4 py-6 pb-24 md:pb-8">
      <div class="flex items-center justify-between mb-5">
        <h1 class="text-2xl font-bold tracking-tight">QUIZZES</h1>
        <span class="nx-badge nx-badge-cyan">${quizzes.length} total</span>
      </div>

      <div class="space-y-3">
        ${quizzes.length === 0 ? `
          <div class="nx-card p-8 text-center text-nx-text-muted">
            Aucun quiz. Ouvre une note et clique GENERATE QUIZ.
          </div>` :
          quizzes.map((q) => `
          <div class="nx-card p-4 cursor-pointer quiz-item" data-id="${q.id}">
            <div class="flex items-center gap-2 mb-1">
              <span class="dot dot-${q.subject || "default"}"></span>
              <span class="font-mono text-xs text-nx-text-sec capitalize">${q.subject || ""}</span>
              <span class="text-nx-text-muted text-xs ml-auto">${new Date(q.created_at).toLocaleDateString("fr-FR")}</span>
            </div>
            <div class="font-medium">${escapeHtml(q.title)}</div>
            <div class="text-nx-text-muted text-xs mt-1">${q.question_count || 0} questions</div>
            <button class="nx-btn nx-btn-primary mt-3 w-full" style="padding:0.4rem">TAKE QUIZ</button>
          </div>`).join("")}
      </div>
    </div>
  `;

  container.querySelectorAll(".quiz-item").forEach((el) => {
    el.addEventListener("click", () => {
      location.hash = `/quiz/${el.dataset.id}`;
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
