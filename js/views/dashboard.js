/**
 * NEXUS OS — Dashboard v2 (Cyberpunk Command Center)
 * Matches approved mockup: hero · widgets · weekly bars · weakness map · activity
 */

import { getState, loadNotes, loadDueCards, loadDecks, loadQuizzes } from "../store.js";
import { navigate } from "../router.js";

const QUOTE = "Discipline is the bridge between goals and accomplishment.";

export async function renderDashboard(container) {
  await Promise.all([loadNotes(), loadDueCards(), loadDecks(), loadQuizzes()]);
  const { notes, dueCards, decks, quizzes } = getState();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "BONJOUR" : hour < 18 ? "BON APRÈS-MIDI" : "BONSOIR";
  const dateStr = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // --- Real data derivations ---
  const totalCards = decks.reduce((s, d) => s + (d.card_count || 0), 0);
  // Study streak: consecutive days (ending today/yesterday) with any activity
  const activeDays = new Set(notes.map((n) => (n.created_at || "").slice(0, 10)));
  let streak = 0;
  const d = new Date();
  if (!activeDays.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1); // grace: streak counts if yesterday active
  while (activeDays.has(d.toISOString().slice(0, 10))) { streak++; d.setDate(d.getDate() - 1); }
  // Subject distribution (proxy for weekly overview until focus sessions exist)
  const subjCount = {};
  notes.forEach((n) => { const s = n.subject || "general"; subjCount[s] = (subjCount[s] || 0) + 1; });
  const topSubjects = Object.entries(subjCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const maxCount = topSubjects.length ? topSubjects[0][1] : 1;
  const subjColors = { "maths": "", "physique-chimie": "cyan", "francais": "" };
  const barClass = (s) => s === "physique-chimie" ? "cyan" : s === "ll-anglais" ? "green" : "";

  const recent = [...notes]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 4);

  container.innerHTML = `
  <div class="max-w-6xl mx-auto px-4 py-5 pb-24 md:pb-10">

    <!-- ===== HERO ===== -->
    <div class="nx-hero p-6 mb-5 relative overflow-hidden">
      <div class="flex justify-between items-start">
        <div>
          <div class="text-nx-cyan font-mono text-xs tracking-[0.25em] mb-1">${greeting},</div>
          <h1 class="text-3xl md:text-4xl font-bold tracking-tight leading-none" style="letter-spacing:-0.03em">${APP_CONFIG.USER_NAME}</h1>
          <div class="text-nx-text-sec text-sm mt-1 capitalize">${dateStr}</div>
          <div class="text-nx-text-muted text-xs italic mt-3 max-w-md">"${QUOTE}"</div>
        </div>
        <!-- Weather: static until weather API integrated (Phase 4) -->
        <div class="text-right hidden sm:block">
          <div class="text-3xl">☀️</div>
          <div class="text-nx-cyan text-xl font-bold">24°C</div>
          <div class="text-nx-text-muted text-xs">Cloudy</div>
        </div>
      </div>
    </div>

    <!-- ===== WIDGET ROW ===== -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">

      <div class="nx-card p-4">
        <div class="flex items-center gap-2 mb-3">
          <span class="w-2 h-2 rounded-full bg-nx-red animate-pulse"></span>
          <span class="font-mono text-xs tracking-widest text-nx-red">TODAY'S FOCUS</span>
        </div>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between items-center">
            <span class="flex items-center gap-2"><span class="text-nx-green">☑</span> Flashcards: ${dueCards.length} due</span>
            <span class="font-mono text-xs text-nx-text-muted">${dueCards.length} due</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="flex items-center gap-2"><span class="text-nx-green">☑</span> Notes library</span>
            <span class="font-mono text-xs text-nx-text-muted">${notes.length}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="flex items-center gap-2"><span class="text-nx-green">☑</span> Quizzes ready</span>
            <span class="font-mono text-xs text-nx-text-muted">${quizzes.length}</span>
          </div>
        </div>
      </div>

      <div class="nx-card p-4">
        <div class="font-mono text-xs tracking-widest text-nx-amber mb-3">⏰ UPCOMING</div>
        <div class="space-y-3 text-sm">
          <div class="cursor-pointer" onclick="location.hash='#/academics/quizzes'">
            <div class="text-nx-amber font-medium">DST Maths dans 5 jours</div>
            <div class="text-nx-text-muted text-xs">Deadline tracker arrives in Life OS phase</div>
          </div>
          <div>
            <div class="text-nx-cyan font-medium">Exposé Français Friday</div>
            <div class="text-nx-text-muted text-xs">Preparation due</div>
          </div>
        </div>
      </div>

      <div class="nx-card p-4">
        <div class="font-mono text-xs tracking-widest text-nx-red mb-3">🔥 STREAKS</div>
        <div class="flex items-center gap-4">
          <div class="text-5xl">🔥</div>
          <div>
            <div class="text-2xl font-bold nx-streak">Study: ${streak} day${streak > 1 ? "s" : ""}</div>
            <div class="text-nx-text-muted text-xs">Keep the fire.</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== WEEKLY OVERVIEW ===== -->
    <div class="nx-card p-5 mb-5">
      <div class="font-mono text-xs tracking-widest text-nx-text-sec mb-4">📊 WEEKLY OVERVIEW</div>
      ${topSubjects.length === 0 ? `
        <div class="text-nx-text-muted text-sm">No activity yet — paste your first lesson below.</div>
      ` : `
      <div class="grid md:grid-cols-3 gap-5">
        ${topSubjects.map(([subj, count]) => `
          <div>
            <div class="flex justify-between text-xs mb-1">
              <span class="capitalize">${subjName(subj)}</span>
              <span class="font-mono text-nx-text-sec">${count} note${count > 1 ? "s" : ""}</span>
            </div>
            <div class="nx-progress">
              <div class="nx-progress-fill ${barClass(subj)}" style="width:${Math.round((count / maxCount) * 100)}%"></div>
            </div>
          </div>`).join("")}
      </div>
      <div class="flex gap-6 mt-4 pt-3 border-t border-[rgba(255,26,26,0.1)] text-xs font-mono">
        <span class="text-nx-text-sec">Total: <span class="text-nx-red font-bold">${notes.length}</span> notes</span>
        <span class="text-nx-text-sec">Cards: <span class="text-nx-cyan font-bold">${totalCards}</span></span>
        <span class="text-nx-text-sec ml-auto">Goal: <span class="text-nx-amber">10 notes/week</span></span>
      </div>`}
    </div>

    <!-- ===== QUICK CAPTURE ===== -->
    <div class="nx-card-elevated p-5 mb-5 nx-glow-border">
      <div class="flex items-center gap-2 mb-3">
        <span class="w-2 h-2 rounded-full bg-nx-red animate-pulse"></span>
        <span class="font-mono text-xs tracking-widest text-nx-red">QUICK CAPTURE</span>
      </div>
      <textarea id="qc-text" rows="3" class="nx-input mb-3 resize-none"
        placeholder="Paste your transcript, notes, or text here..."></textarea>
      <div class="flex flex-wrap gap-2 items-center">
        <select id="qc-subject" class="nx-input" style="width:auto; padding:0.45rem 0.8rem; font-size:0.8rem">
          <option value="">Auto-detect subject</option>
          ${APP_CONFIG.SUBJECTS.map((s) => `<option value="${s.code}">${s.name}</option>`).join("")}
        </select>
        <button id="qc-submit" class="nx-btn nx-btn-primary flex-1 animate-pulse-glow">PROCESS ➤</button>
      </div>
      <div class="text-nx-text-muted text-xs mt-2">AI will extract key points, flashcards, and action items.</div>
    </div>

    <!-- ===== WEAKNESS MAP + RECENT ACTIVITY ===== -->
    <div class="grid md:grid-cols-2 gap-4">

      <div class="nx-card p-5">
        <div class="flex items-center justify-between mb-3">
          <span class="font-mono text-xs tracking-widest text-nx-text-sec">🎯 WEAKNESS MAP</span>
          <span class="flex gap-3 text-[10px] font-mono">
            <span><span class="dot" style="background:var(--success)"></span> Master</span>
            <span><span class="dot" style="background:var(--warning)"></span> Developing</span>
            <span><span class="dot" style="background:var(--accent-primary)"></span> Struggling</span>
          </span>
        </div>
        <div class="nx-skilltree">
          <div class="nx-node nx-node-master">MECHANICS</div>
          <div class="nx-node-row">
            <div class="nx-node nx-node-master">KINEMATICS</div>
            <div class="nx-node nx-node-struggle">DYNAMICS</div>
          </div>
          <div class="nx-node-row">
            <div class="nx-node nx-node-master nx-node-sm">Forces</div>
            <div class="nx-node nx-node-dev nx-node-sm">Momentum</div>
            <div class="nx-node nx-node-struggle nx-node-sm">Energy</div>
            <div class="nx-node nx-node-dev nx-node-sm">Rotation</div>
          </div>
        </div>
        <div class="text-nx-text-muted text-[10px] mt-3 font-mono">Demo tree — populates from quiz weaknesses as you complete quizzes.</div>
      </div>

      <div class="nx-card p-5">
        <div class="flex items-center justify-between mb-3">
          <span class="font-mono text-xs tracking-widest text-nx-text-sec">📰 RECENT ACTIVITY</span>
          <span class="text-nx-green text-xs">● live</span>
        </div>
        <div class="space-y-3">
          ${recent.length === 0 ? `<div class="text-nx-text-muted text-sm">No activity yet.</div>` :
            recent.map((n) => `
            <div class="flex gap-3 cursor-pointer group" onclick="location.hash='#/academics'">
              <div class="w-8 h-8 rounded-lg bg-nx-elevated border border-[rgba(255,26,26,0.2)] flex items-center justify-center flex-shrink-0 group-hover:border-nx-red transition-colors">
                <span class="dot dot-${n.subject || "default"}"></span>
              </div>
              <div class="min-w-0">
                <div class="text-sm truncate">${escapeHtml(n.title || "Sans titre")}</div>
                <div class="text-nx-text-muted text-xs">${timeAgo(n.created_at)} — Note created</div>
              </div>
            </div>`).join("")}
        </div>
      </div>
    </div>
  </div>`;

  document.getElementById("qc-submit").addEventListener("click", submitTranscript);
}

/* ---------- helpers (unchanged logic) ---------- */

async function submitTranscript() {
  const text = document.getElementById("qc-text").value.trim();
  const subject = document.getElementById("qc-subject").value;
  if (text.length < 10) { toast("Texte trop court (min 10 caractères)", "error"); return; }
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

function subjName(code) {
  const s = APP_CONFIG.SUBJECTS.find((x) => x.code === code);
  return s ? s.name : code;
}

function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)}min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)}h`;
  return `il y a ${Math.floor(s / 86400)}j`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
