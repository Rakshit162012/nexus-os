/**
 * NEXUS OS — SOCRATES LIVE (Gemini Live API)
 * Real-time bidirectional voice: native neural audio, streaming, barge-in.
 */

let session = null;
let connected = false;
let micStream = null, micCtx = null, processor = null;
let outCtx = null, nextPlayTime = 0, activeSources = [];
let aiBubbleEl = null, userBubbleEl = null;

const LIVE_PROMPT = `You are Socrates, the voice tutor inside NEXUS OS, speaking with Rakshit, a Seconde student at CSI Europole Grenoble (British Section, BFI). Subjects: Maths, Physique-Chimie, SES. You are warm, sharp, use analogies, and speak naturally — like a smart friend, not a textbook. Match the user's language (French or English, whichever they use). Keep responses concise (2-5 sentences) unless asked for depth.`;

export async function renderLive(container) {
  container.innerHTML = `
  <div class="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-10 flex flex-col items-center" style="min-height:80vh">

    <div class="text-center mb-6">
      <h1 class="text-2xl font-bold tracking-tight">SOCRATES <span class="text-nx-red">LIVE</span></h1>
      <div class="text-nx-text-muted text-xs font-mono">GEMINI 3.8 LIVE · REAL-TIME VOICE · INTERRUPTIBLE</div>
    </div>

    <!-- Voice picker -->
    <select id="live-voice" class="nx-input mb-8" style="width:auto;padding:0.4rem 0.9rem;font-size:0.8rem">
      ${["Puck","Charon","Kore","Fenrir","Aoede","Leda","Orus"].map(v =>
        `<option ${v === "Puck" ? "selected" : ""}>${v}</option>`).join("")}
    </select>

    <!-- Orb -->
    <button id="live-orb" class="relative w-36 h-36 rounded-full mb-6 transition-all"
      style="background:radial-gradient(circle at 35% 35%, #ff4d4d, #b30000 60%, #4d0000);
             box-shadow:0 0 40px rgba(255,26,26,0.4);border:2px solid rgba(255,26,26,0.6)">
      <span id="orb-label" class="font-mono text-xs tracking-widest text-nx-bg font-bold">CONNECT</span>
    </button>

    <div id="live-status" class="font-mono text-xs text-nx-text-sec mb-8">Tap to connect · allow microphone</div>

    <!-- Transcript -->
    <div id="live-transcript" class="w-full space-y-4"></div>
  </div>`;

  document.getElementById("live-orb").addEventListener("click", () => {
    connected ? disconnect() : connect();
  });
  window.addEventListener("hashchange", () => { if (connected) disconnect(); });
}

/* ---------- connection ---------- */

async function connect() {
  const voice = document.getElementById("live-voice").value;
  setStatus("CONNECTING…");
  try {
    const { GoogleGenAI, Modality } = await import("https://esm.run/@google/genai@1.16.0");
    const ai = new GoogleGenAI({ apiKey: APP_CONFIG.LIVE_KEY });

    session = await ai.live.connect({
      model: APP_CONFIG.LIVE_MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: LIVE_PROMPT,
        outputAudioTranscription: {},
        inputAudioTranscription: {},
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
      callbacks: {
        onmessage: onLiveMessage,
        onerror: (e) => setStatus("ERROR: " + (e?.message || JSON.stringify(e)).slice(0, 80)),
        onclose: () => { if (connected) disconnect(true); },
      },
    });

    await startMic();
    connected = true;
    setOrb(true);
    setStatus("● LIVE — parle librement · clique pour couper");
  } catch (e) {
    setStatus("CONNEXION ÉCHOUÉE: " + e.message);
    toast("Live: " + e.message, "error", 5000);
  }
}

async function startMic() {
  micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  micCtx = new AudioContext({ sampleRate: 16000 });
  const src = micCtx.createMediaStreamSource(micStream);
  processor = micCtx.createScriptProcessor(4096, 1, 1);
  const mute = micCtx.createGain();
  mute.gain.value = 0; // prevent mic playback echo
  src.connect(processor);
  processor.connect(mute);
  mute.connect(micCtx.destination);
  processor.onaudioprocess = (e) => {
    if (!connected || !session) return;
    const pcm = floatTo16(e.inputBuffer.getChannelData(0));
    session.sendRealtimeInput({
      audio: { data: toBase64(pcm), mimeType: "audio/pcm;rate=16000" },
    });
  };
}

function disconnect(silent) {
  connected = false;
  try { session?.close(); } catch (e) {}
  session = null;
  micStream?.getTracks().forEach((t) => t.stop());
  micCtx?.close().catch(() => {});
  processor = null;
  stopPlayback();
  setOrb(false);
  setStatus(silent ? "SESSION TERMINÉE" : "DÉCONNECTÉ · tape pour relancer");
  aiBubbleEl = null;
  userBubbleEl = null;
}

/* ---------- live messages ---------- */

function onLiveMessage(msg) {
  const sc = msg.serverContent;
  if (!sc) return;

  // User interrupted the model → cut audio immediately (barge-in)
  if (sc.interrupted) {
    stopPlayback();
    if (aiBubbleEl) aiBubbleEl = null;
  }

  // Model audio → speaker
  const audio = sc.audioOutput?.audio?.data;
  if (audio) playAudio(audio);

  // Model transcript → streaming bubble
  if (sc.outputTranscription?.text) {
    if (!aiBubbleEl) aiBubbleEl = makeBubble("assistant");
    aiBubbleEl.textContent += sc.outputTranscription.text;
    scrollDown();
  }
  if (sc.turnComplete) aiBubbleEl = null;

  // User speech transcript → user bubble
  if (sc.inputTranscription?.text) {
    userBubbleEl = makeBubble("user");
    userBubbleEl.textContent = sc.inputTranscription.text;
    scrollDown();
  }
}

/* ---------- audio helpers ---------- */

function playAudio(b64) {
  if (!outCtx) outCtx = new AudioContext({ sampleRate: 24000 });
  const f32 = base64ToFloat32(b64);
  if (!f32.length) return;
  const buf = outCtx.createBuffer(1, f32.length, 24000);
  buf.getChannelData(0).set(f32);
  const src = outCtx.createBufferSource();
  src.buffer = buf;
  src.connect(outCtx.destination);
  const now = outCtx.currentTime;
  if (nextPlayTime < now) nextPlayTime = now + 0.05;
  src.start(nextPlayTime);
  nextPlayTime += buf.duration;
  activeSources.push(src);
  src.onended = () => { activeSources = activeSources.filter((s) => s !== src); };
}

function stopPlayback() {
  activeSources.forEach((s) => { try { s.stop(); } catch (e) {} });
  activeSources = [];
  nextPlayTime = 0;
}

function floatTo16(f32) {
  const out = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) out[i] = Math.max(-1, Math.min(1, f32[i])) * 32767;
  return out;
}

function toBase64(i16) {
  const bytes = new Uint8Array(i16.buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToFloat32(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const i16 = new Int16Array(bytes.buffer);
  const f32 = new Float32Array(i16.length);
  for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 32768;
  return f32;
}

/* ---------- UI helpers ---------- */

function makeBubble(role) {
  const box = document.getElementById("live-transcript");
  const div = document.createElement("div");
  const isUser = role === "user";
  div.className = `max-w-[85%] px-4 py-3 text-sm whitespace-pre-wrap animate-fade-in-up ${
    isUser
      ? "ml-auto bg-nx-red text-nx-bg font-medium"
      : "mr-auto nx-card"}`;
  div.style.borderRadius = isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px";
  box.appendChild(div);
  return div;
}

function setOrb(on) {
  const orb = document.getElementById("live-orb");
  document.getElementById("orb-label").textContent = on ? "LIVE" : "CONNECT";
  orb.style.boxShadow = on
    ? "0 0 60px rgba(255,26,26,0.8), 0 0 120px rgba(255,26,26,0.4)"
    : "0 0 40px rgba(255,26,26,0.4)";
  orb.style.animation = on ? "pulseGlow 1.5s infinite" : "none";
}

function setStatus(t) {
  const el = document.getElementById("live-status");
  if (el) el.textContent = t;
}

function scrollDown() {
  const box = document.getElementById("live-transcript");
  if (box) box.scrollTop = box.scrollHeight;
}
