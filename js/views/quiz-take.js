/**
 * NEXUS OS — Quiz Take View
 * One question at a time, instant feedback with explanations
 */

let quizSession = { quiz: null, questions: [], index: 0, correct: 0, answers: [] };

export async function renderQuizTake(container, quizId) {
  showLoader("LOADING QUIZ");
  try {
    const data = await api(`/api/v1/quizzes/${quizId}`);
    quizSession = {
      quiz: data.quiz,
      questions: data.questions,
      index: 0, correct: 0, answers: [],
    };
    renderQuestion(container);
  } catch (e) {
    toast("Erreur: " + e.message, "error");
    location.hash = "/academics/quizzes";
  } finally {
    hideLoader();
  }
}

function renderQuestion(container) {
  const { questions, index } = quizSession;
  const q = questions[index];
  const pct = Math.round((index / questions.length) * 100);

  const isMcq = q.question_type === "mcq" && q.options && q.options.length > 0;

  container.innerHTML = `
    <div class="max-w-2xl mx-auto px-4 py-6 pb-24">
      <div class="flex items-center justify-between mb-4">
        <button onclick="location.hash='#/academics/quizzes'" class="nx-btn nx-btn-ghost">← QUIT</button>
        <div class="font-mono text-xs text-nx-text-sec">${index + 1} / ${questions.length}</div>
      </div>

      <div class="nx-progress mb-6">
        <div class="nx-progress-fill" style="width:${pct}%"></div>
      </div>

      <div class="nx-card-elevated p-6 mb-4">
        <div class="font-mono text-xs tracking-widest text-nx-cyan mb-3">
          ${isMcq ? "QCM" : q.question_type === "problem" ? "PROBLEM" : "QUESTION OUVERTE"}
          <span class="nx-badge ml-2">${q.difficulty || "medium"}</span>
        </div>
        <div class="text-lg font-medium mb-2">${escapeHtml(q.question_text)}</div>
        ${q.concept_tested ? `<div class="text-nx-text-muted text-xs">Concept: ${escapeHtml(q.concept_tested)}</div>` : ""}
      </div>

      ${isMcq ? `
        <div class="space-y-2" id="options">
          ${q.options.map((opt) => `
            <button class="nx-option" data-answer="${escapeHtml(opt)}">${escapeHtml(opt)}</button>
          `).join("")}
        </div>
      ` : `
        <textarea id="open-answer" rows="3" class="nx-input mb-3 resize-none"
          placeholder="Ta réponse..."></textarea>
        <button id="submit-open" class="nx-btn nx-btn-primary w-full">SUBMIT</button>
      `}

      <!-- Feedback (hidden) -->
      <div id="feedback" class="hidden mt-4 nx-card p-4"></div>

      <button id="next-btn" class="hidden nx-btn nx-btn-secondary w-full mt-4">NEXT →</button>
    </div>
  `;

  if (isMcq) {
    container.querySelectorAll(".nx-option").forEach((btn) => {
      btn.addEventListener("click", () => handleAnswer(container, q, btn.dataset.answer, btn));
    });
  } else {
    container.getElementById("submit-open").addEventListener("click", () => {
      const val = container.getElementById("open-answer").value.trim();
      if (val) handleAnswer(container, q, val, null);
    });
  }
}

async function handleAnswer(container, q, userAnswer, btnEl) {
  const isMcq = q.question_type === "mcq";
  let correct = false;

  if (isMcq) {
    const correctLetter = (q.correct_answer || "").trim().toLowerCase();
    const userNorm = userAnswer.trim().toLowerCase();
    // Match by letter ("b") or full text
    correct = userNorm === correctLetter ||
              userNorm === correctLetter.replace(/^[a-d][.)]\s*/, "") ||
              userNorm === (q.correct_answer || "").trim().toLowerCase();
  } else {
    correct = userAnswer.trim().toLowerCase() === (q.correct_answer || "").trim().toLowerCase();
  }

  quizSession.answers.push({ question_id: q.id, answer: userAnswer, time_seconds: 0 });
  if (correct) quizSession.correct++;

  // UI feedback
  if (isMcq && btnEl) {
    container.querySelectorAll(".nx-option").forEach((b) => { b.disabled = true; });
    btnEl.classList.add(correct ? "correct" : "wrong");
    // Also highlight the correct one
    if (!correct) {
      container.querySelectorAll(".nx-option").forEach((b) => {
        const bLetter = b.dataset.answer.trim().toLowerCase().replace(/^[a-d][.)]\s*/, "");
        const cLetter = (q.correct_answer || "").trim().toLowerCase().replace(/^[a-d][.)]\s*/, "");
        if (bLetter === cLetter || b.dataset.answer.trim().toLowerCase() === (q.correct_answer || "").trim().toLowerCase()) {
          b.classList.add("correct");
        }
      });
    }
  }

  const fb = container.querySelector("#feedback");
  fb.className = `mt-4 nx-card p-4 ${correct ? "border-nx-green" : "border-nx-red"}`;
  fb.innerHTML = `
    <div class="font-mono text-sm mb-2 ${correct ? "text-nx-green" : "text-nx-red"} score-pop">
      ${correct ? "✓ CORRECT" : "✗ WRONG"}
    </div>
    <div class="text-sm text-nx-text-sec whitespace-pre-wrap">${escapeHtml(q.explanation || "")}</div>
  `;
  fb.classList.remove("hidden");

  const next = container.querySelector("#next-btn");
  next.classList.remove("hidden");
  if (quizSession.index === quizSession.questions.length - 1) next.textContent = "FINISH →";
  next.addEventListener("click", async () => {
    quizSession.index++;
    if (quizSession.index >= quizSession.questions.length) {
      await finishQuiz(container);
    } else {
      renderQuestion(container);
    }
  }, { once: true });
}

async function finishQuiz(container) {
  showLoader("GRADING");
  try {
    const result = await api(`/api/v1/quizzes/${quizSession.quiz.id}/attempt`, {
      method: "POST",
      body: JSON.stringify({ answers: quizSession.answers }),
    });
    renderResults(container, result);
  } catch (e) {
    toast("Erreur: " + e.message, "error");
    renderResults(container, { score: 0, correct: 0, total: quizSession.questions.length, weaknesses: [] });
  } finally {
    hideLoader();
  }
}

function renderResults(container, result) {
  const score = result.score || 0;
  container.innerHTML = `
    <div class="max-w-lg mx-auto px-4 py-16 text-center">
      <div class="nx-card-elevated p-8 score-pop">
        <div class="font-mono text-xs tracking-widest text-nx-cyan mb-2">QUIZ COMPLETE</div>
        <div class="text-6xl font-bold mb-2 ${score >= 70 ? "text-nx-green" : score >= 40 ? "text-nx-amber" : "text-nx-red"}"
             style="letter-spacing:-0.03em">${score}%</div>
        <div class="text-nx-text-sec text-sm mb-4">${result.correct || 0} / ${result.total || 0} correct</div>
        ${result.weaknesses && result.weaknesses.length ? `
          <div class="mt-4 text-left">
            <div class="font-mono text-xs tracking-widest text-nx-red mb-2">WEAKNESSES</div>
            ${result.weaknesses.map((w) => `<span class="nx-badge nx-badge-red mr-1">${escapeHtml(w)}</span>`).join("")}
          </div>` : `
          <div class="text-nx-green font-mono text-xs mt-4">✓ NO WEAKNESSES DETECTED</div>`}
        <div class="flex gap-3 justify-center mt-6">
          <button onclick="location.hash='#/academics/quizzes'" class="nx-btn nx-btn-primary">DONE</button>
          <button onclick="location.reload()" class="nx-btn nx-btn-secondary">RETRY</button>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
