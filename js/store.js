/**
 * NEXUS OS — Reactive Store
 * Single source of truth for app state
 */

const state = {
  user: null,
  currentView: "dashboard",
  transcripts: [],
  notes: [],
  decks: [],
  dueCards: [],
  quizzes: [],
  isLoading: false,
};

const listeners = [];

export function getState() {
  return state;
}

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i > -1) listeners.splice(i, 1);
  };
}

// Data loaders — fetch from backend and update state
export async function loadNotes() {
  try {
    const data = await api("/api/v1/notes/");
    setState({ notes: data.notes || [] });
  } catch (e) {
    console.error("loadNotes:", e);
  }
}

export async function loadDecks() {
  try {
    const data = await api("/api/v1/flashcards/decks");
    setState({ decks: data.decks || [] });
  } catch (e) {
    console.error("loadDecks:", e);
  }
}

export async function loadDueCards() {
  try {
    const data = await api("/api/v1/flashcards/due");
    setState({ dueCards: data.due_cards || [] });
  } catch (e) {
    console.error("loadDueCards:", e);
  }
}

export async function loadQuizzes() {
  try {
    const data = await api("/api/v1/quizzes/");
    setState({ quizzes: data.quizzes || [] });
  } catch (e) {
    console.error("loadQuizzes:", e);
  }
}
