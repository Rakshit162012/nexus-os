/**
 * NEXUS OS — Socrates Chat View
 * Text + voice input (browser STT) + spoken replies (TTS toggle)
 */

let speakEnabled = true;

export async function renderTutor(container) {
  container.innerHTML = `
    <div class="max-w-3xl mx-auto px-4 py-5 pb-24 md:pb-10 flex flex-col" style="min-height:80vh">

      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">SOCRATES</h1>
          <div class="text-nx-text-muted text-xs font-mono">AI TUTOR · HERMES-CONTEXT AWARE</div>
        </div>
        <div class="flex gap-2">
          <button id="tts-toggle" class="nx-btn nx-btn-ghost" style="padding:0.4rem 0.8rem">🔊 ON</button>
          <button id="clear-chat" class="nx-btn nx-btn-ghost" style="padding:0.4rem 0.8rem">🗑</button>
        </div>
      </div>

      <!-- Messages -->
      <div id="chat-box" class="flex-1 space-y-4 overflow-y-auto mb-4 pr-1" style="max-height:60vh"></div>

      <!-- Typing indicator -->
      <div id="typing" class="hidden mb-4">
        <div class="nx-card p-3 inline-block">
          <span class="inline-block w-2 h-2 rounded-full bg-nx-red animate-bounce" style="animation-delay:0ms"></span>
          <span class="inline-block w-2 h-2 rounded-full bg-nx-red animate-bounce mx-1" style="animation-delay:150ms"></span>
          <span class="inline-block w-2 h-2 rounded-full bg-nx-red animate-bounce" style="animation-delay:300ms"></span>
        </div>
      </div>

      <!-- Input row -->
      <div class="nx-card-elevated p-3 flex gap-2 items-end">
        <button id="voice-btn" class="nx-fab" style="width:44px;height:44px;flex-shrink:0" title="Parler">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0a0000" stroke-width="2.5">
            <rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 19v3"/>
          </svg>
        </button>
        <textarea id="chat-input" rows="1" class="nx-input resize-none flex-1"
          placeholder="Demande n'importe quoi à Socrates..." style="min-height:44px"></textarea>
        <button id="send-btn" class="nx-btn nx-btn-primary" style="padding:0.7rem 1.2rem">➤</button>
      </div>
      <div class="text-nx-text-muted text-[10px] font-mono mt-2 text-center">
        Socrates connaît tes notes, tes quiz et tes faiblesses.
      </div>
    </div>
  `;

  document.getElementById("send-btn").addEventListener("click", () => send());
  document.getElementById("chat-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
  document.getElementById("tts-toggle").addEventListener("click", toggleTts);
  document.getElementById("clear-chat").addEventListener("click", clearChat);
  document.getElementById("voice-btn").addEventListener("click", voiceInput);

  await loadHistory();
}

/* ---------- logic ---------- */

async function loadHistory() {
  try {
    const data = await api("/api/v1/tutor/history");
    const box = document.getElementById("chat-box");
    box.innerHTML = "";
    (data.messages || []).forEach((m) => addBubble(m.role, m.content, false));
    scrollBottom();
  } catch (e) { console.error("history:", e); }
}

async function send() {
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  addBubble("user", text, false);
  showTyping(true);
  try {
    const result = await api("/api/v1/tutor/chat", {
      method: "POST",
      body: JSON.stringify({ message: text }),
    });
    showTyping(false);
    addBubble("assistant", result.reply, speakEnabled);
  } catch (e) {
    showTyping(false);
    toast("Erreur: " + e.message, "error");
  }
}

function addBubble(role, content, speak) {
  const box = document.getElementById("chat-box");
  const isUser = role === "user";
  const wrap = document.createElement("div");
  wrap.className = `flex ${isUser ? "justify-end" : "justify-start"} animate-fade-in-up`;
  wrap.innerHTML = `
    <div class="${isUser
      ? "bg-nx-red text-nx-bg font-medium"
      : "nx-card text-nx-text"} max-w-[85%] px-4 py-3 text-sm whitespace-pre-wrap"
      style="border-radius:${isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px"};line-height:1.6">
      ${escapeHtml(content)}
    </div>`;
  box.appendChild(wrap);
  scrollBottom();
  if (!isUser && speak) speakText(content);
}

function showTyping(on) {
  document.getElementById("typing").classList.toggle("hidden", !on);
  scrollBottom();
}

function scrollBottom() {
  const box = document.getElementById("chat-box");
  if (box) box.scrollTop = box.scrollHeight;
}

function toggleTts() {
  speakEnabled = !speakEnabled;
  document.getElementById("tts-toggle").textContent = speakEnabled ? "🔊 ON" : "🔇 OFF";
  if (!speakEnabled) window.speechSynthesis.cancel();
}

function speakText(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const clean = text.replace(/\$\$?.*?\$\$?/g, "").slice(0, 500);
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = "fr-FR";
  u.rate = 1.0;
  u.pitch = 0.95;
  const voices = window.speechSynthesis.getVoices();
  const fr = voices.find((v) => v.lang.startsWith("fr"));
  if (fr) u.voice = fr;
  window.speechSynthesis.speak(u);
}

function voiceInput() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast("Voice non supporté — utilise Chrome", "error"); return; }
  const rec = new SR();
  rec.lang = "fr-FR";
  const btn = document.getElementById("voice-btn");
  btn.classList.add("recording");
  toast("🎤 J'écoute...", "info", 2000);
  rec.onresult = (e) => {
    document.getElementById("chat-input").value = e.results[0][0].transcript;
  };
  rec.onend = () => btn.classList.remove("recording");
  rec.onerror = () => { btn.classList.remove("recording"); toast("Erreur micro", "error"); };
  rec.start();
}

async function clearChat() {
  try {
    await api("/api/v1/tutor/history", { method: "DELETE" });
    document.getElementById("chat-box").innerHTML = "";
    toast("Conversation effacée", "success");
  } catch (e) { toast("Erreur: " + e.message, "error"); }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
