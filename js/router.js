/**
 * NEXUS OS — Hash Router
 * Routes: #/dashboard  #/academics  #/academics/notes  #/academics/flashcards  #/academics/quizzes  #/study/:deckId  #/quiz/:quizId
 */

import { setState } from "./store.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderNotes } from "./views/notes.js";
import { renderFlashcards } from "./views/flashcards.js";
import { renderQuizzes } from "./views/quizzes.js";
import { renderStudy } from "./views/study.js";
import { renderQuizTake } from "./views/quiz-take.js";

const routes = {
  dashboard: renderDashboard,
  academics: renderNotes,
  flashcards: renderFlashcards,
  quizzes: renderQuizzes,
};

export function navigate(hash) {
  window.location.hash = hash;
}

export function getRoute() {
  const hash = window.location.hash.replace("#/", "") || "dashboard";
  const parts = hash.split("/");
  return { view: parts[0], param: parts[1] || null, sub: parts[2] || null };
}

export async function render() {
  const { view, param, sub } = getRoute();
  const container = document.getElementById("view");
  container.classList.remove("animate-fade-in-up");
  void container.offsetWidth; // restart animation
  container.classList.add("animate-fade-in-up");

  setState({ currentView: view });

  try {
    if (view === "dashboard" || view === "") {
      await renderDashboard(container);
    } else if (view === "academics" && param === "flashcards") {
      await renderFlashcards(container);
    } else if (view === "academics" && param === "quizzes") {
      await renderQuizzes(container);
    } else if (view === "study" && param) {
      await renderStudy(container, param);
    } else if (view === "quiz" && param) {
      await renderQuizTake(container, param);
    } else if (view === "academics") {
      await renderNotes(container);
    } else {
      await renderDashboard(container);
    }
  } catch (e) {
    console.error("Render error:", e);
    container.innerHTML = `
      <div class="p-8 text-center">
        <div class="text-nx-red font-mono text-lg mb-2">SYSTEM FAULT</div>
        <div class="text-nx-text-sec text-sm">${e.message}</div>
      </div>`;
  }

  // Update nav active states
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.classList.toggle("active", el.dataset.nav === view);
  });
}

export function initRouter() {
  window.addEventListener("hashchange", render);
  render();
}
