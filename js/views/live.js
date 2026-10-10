/**
 * NEXUS OS — SOCRATES LIVE (Gemini Live API)
 * Desktop Chrome: full duplex voice. Mobile: push-to-talk via Whisper.
 */

let session = null;
let connected = false;
let connecting = false;
let micStream = null, micCtx = null, processor = null;
let outCtx = null, nextPlayTime = 0, activeSources = [];
let aiBubbleEl = null, userBubbleEl = null;
let mobRec = null, mobChunks = [];
const BUFFER_TARGET = 0.35;

const LIVE_PROMPT = `You are Socrates, the voice tutor inside NEXUS OS, speaking with Rakshit, a Seconde student at CSI Europole Grenoble (British Section, BFI). Subjects: Maths, Physique-Chimie, SES. You are warm, sharp, use analogies, and speak naturally — like a smart friend, not a textbook. Match the user's language (French or English, whichever they use). Keep responses concise (2-5 sentences) unless asked for depth.`;

export async function renderLive(container) {
  container.innerHTML = `
  <div class="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-10 flex flex-col items-center" style="min-height:80vh">

    <div class="text-center mb-6">
      <h1 class="text-2xl font-bold tracking-tight">SOCRATES <span class="text-nx-red">LIVE</span></h1>
            <div class="text-nx-text-muted text-xs font-mono">GEMINI 3.8 LIVE · REAL-TIME VOICE · INTERRUPTIBLE</div>
      <button id="change-key" class="nx-btn nx-btn-ghost mt-2" style="padding:0.3rem 0.8rem;font-size:0.65rem">🔑 CHANGE KEY</button>
    </div>
    ${navigator.userAgent.includes("Firefox") && !isMobileDevice() ? `
    <div class="nx-card p-3 mb-5 w-full max-w-md text-center" style="border-color:rgba(255,170,0,0.4)">
      <div class="text-nx-amber text-xs font-mono">⚠ Firefox détecté — le mode voix peut grésiller.<br>Utilise <b>Chrome</b> pour une voix parfaite (le chat texte marche partout).</div>
    </div>` : ""}

    <!-- One-time key entry -->
    <div id="key-gate" class="nx-card p-5 mb-6 w-full max-w-md ${localStorage.getItem("nexus_live_key") ? "hidden" : ""}">
      <div class="font-mono text-xs tracking-widest text-nx-amber mb-2">🔑 LIVE API KEY REQUIRED</div>
      <div class="text-nx-text-muted text-xs mb-3">Paste your Gemini Live key once — stored in this browser only.</div>
      <input id="live-key-input" type="password" class="nx-input mb-2" placeholder="AQ....">
      <button id="save-key-btn" class="nx-btn nx-btn-primary w-full">SAVE KEY</button>
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

    <div id="live-transcript" class="w-full space-y-4"></div>
  </div>`;

  document.getElementById("save-key-btn")?.addEventListener("click", () => {
    const v = document.getElementById("live-key-input").value.trim();
    if (v.length < 20) { toast("Clé trop courte", "error"); return; }
    localStorage.setItem("nexus_live_key", v);
    document.getElementById("key-gate").classList.add("hidden");
    toast("Clé sauvegardée · se termine par …" + v.slice(-6), "success");
  });

    document.getElementById("change-key")?.addEventListener("click", () => {
    document.getElementById("key-gate").classList.remove("hidden");
    window.scrollTo(0, 0);
  });
  
  const orb = document.getElementById("live-orb");
  if (isMobileDevice()) {
    orb.addEventListener("touchstart", startMobileRecord);
    orb.addEventListener("touchend", stopMobileRecord);
    orb.addEventListener("mousedown", startMobileRecord);
    orb.addEventListener("mouseup", stopMobileRecord);
    setStatus("Tap orb to connect · then HOLD orb while talking");
  } else {
    orb.addEventListener("click", () => { connected ? disconnect() : connect(); });
  }
  window.addEventListener("hashchange", () => { if (connected) disconnect(); });
}

/* ---------- helpers ---------- */

function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/* ---------- connection ---------- */

async function connect() {
  if (connecting || connected) return;
  connecting = true;
  const key = localStorage.getItem("nexus_live_key") || "";
  if (!key) {
    document.getElementById("key-gate")?.classList.remove("hidden");
    setStatus("ENTRE TA CLÉ LIVE D'ABORD");
    return;
  }

  // iOS unlock: create + resume audio synchronously inside the tap
  if (!outCtx) outCtx = new AudioContext({ sampleRate: 24000 });
  outCtx.resume();
  const unlockBuf = outCtx.createBuffer(1, 1, 22050);
  const unlockSrc = outCtx.createBufferSource();
  unlockSrc.buffer = unlockBuf;
  unlockSrc.connect(outCtx.destination);
  unlockSrc.start(0);

  const voice = document.getElementById("live-voice").value;
  setStatus("CONNECTING…");
  try {
    const { GoogleGenAI, Modality } = await import("https://esm.run/@google/genai@1.16.0");
    const ai = new GoogleGenAI({ apiKey: key });

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
                        onclose: (e) => {
          connecting = false;
          if (connected) disconnect(true);
          setStatus("CLOSED code=" + (e?.code ?? "?") + " reason=" + (e?.reason || "none").slice(0, 60));
        },
      },
    });

    if (isMobileDevice()) {
      connected = true;
      setOrb(true);
      setStatus("● LIVE — MAINTIENS l'orb pour parler");
    } else {
      await startMic();
      connected = true;
      setOrb(true);
      setStatus("● LIVE — parle librement · clique pour couper");
    }
    } catch (e) {
    setStatus("CONNEXION ÉCHOUÉE: " + e.message);
    toast("Live: " + e.message, "error", 5000);
  }
  connecting = false;
}

async function startMic() {
  micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  micCtx = new AudioContext();
  micCtx.resume();
  const src = micCtx.createMediaStreamSource(micStream);
  processor = micCtx.createScriptProcessor(4096, 1, 1);
  const mute = micCtx.createGain();
  mute.gain.value = 0;
  src.connect(processor);
  processor.connect(mute);
  mute.connect(micCtx.destination);
  processor.onaudioprocess = (e) => {
    if (!connected || !session) return;
    const raw = e.inputBuffer.getChannelData(0);
    const pcm16 = downsampleTo16k(raw, micCtx.sampleRate);
    session.sendRealtimeInput({
      audio: { data: toBase64(pcm16), mimeType: "audio/pcm;rate=16000" },
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
  try { if (mobRec && mobRec.state === "recording") mobRec.stop(); } catch (e) {}
  stopPlayback();
  setOrb(false);
  setStatus(silent ? "SESSION TERMINÉE" : "DÉCONNECTÉ · tape pour relancer");
  aiBubbleEl = null;
  userBubbleEl = null;
}

/* ---------- mobile push-to-talk ---------- */

async function startMobileRecord(e) {
  e.preventDefault();
  if (!connected) { connect(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mobRec = new MediaRecorder(stream);
    mobChunks = [];
    mobRec.ondataavailable = (ev) => mobChunks.push(ev.data);
    mobRec.start();
    document.getElementById("live-orb").style.transform = "scale(1.15)";
    setStatus("● ENREGISTREMENT… relâche pour envoyer");
  } catch (err) { setStatus("MIC: " + err.message); }
}

async function stopMobileRecord() {
  if (!mobRec || mobRec.state !== "recording") return;
  document.getElementById("live-orb").style.transform = "";
  mobRec.onstop = async () => {
    mobRec.stream.getTracks().forEach((t) => t.stop());
    setStatus("TRANSCRIPTION…");
    try {
      const blob = new Blob(mobChunks, { type: mobRec.mimeType || "audio/webm" });
      const fd = new FormData();
      fd.append("file", blob, "voice.webm");
      const res = await fetch(window.APP_CONFIG.BACKEND_URL + "/api/v1/voice/transcribe",
        { method: "POST", body: fd });
      const data = await res.json();
      if (!data.text) { setStatus("Rien entendu — réessaie"); mobRec = null; return; }
      makeBubble("user").textContent = data.text;
      session.send({ text: data.text });
      setStatus("● LIVE — Socrates répond…");
    } catch (err) { setStatus("ERREUR: " + err.message); }
    mobRec = null;
  };
  mobRec.stop();
}

/* ---------- live messages ---------- */

function onLiveMessage(msg) {
  const sc = msg.serverContent;
  if (!sc) return;

  if (sc.interrupted) {
    stopPlayback();
    aiBubbleEl = null;
  }

  const audio = sc.audioOutput?.audio?.data || sc.modelTurn?.parts?.[0]?.inlineData?.data;
  if (audio) playAudio(audio);

  if (sc.outputTranscription?.text) {
    if (!aiBubbleEl) aiBubbleEl = makeBubble("assistant");
    aiBubbleEl.textContent += sc.outputTranscription.text;
    scrollDown();
  }
  if (sc.turnComplete) aiBubbleEl = null;

  if (sc.inputTranscription?.text) {
    userBubbleEl = makeBubble("user");
    userBubbleEl.textContent = sc.inputTranscription.text;
    scrollDown();
  }
}

/* ---------- audio ---------- */

function playAudio(b64) {
  if (!outCtx) outCtx = new AudioContext({ sampleRate: 24000 });
  if (outCtx.state === "suspended") outCtx.resume();

  const f32 = base64ToFloat32(b64);
  if (!f32.length) return;

  const rate = outCtx.sampleRate;
  let samples = f32;
  if (rate !== 24000) {
    const ratio = rate / 24000;
    samples = new Float32Array(Math.floor(f32.length * ratio));
    for (let i = 0; i < samples.length; i++) samples[i] = f32[Math.floor(i / ratio)];
  }

  const buf = outCtx.createBuffer(1, samples.length, rate);
  buf.getChannelData(0).set(samples);
  const src = outCtx.createBufferSource();
  src.buffer = buf;
  src.connect(outCtx.destination);

  const now = outCtx.currentTime;
  if (nextPlayTime < now - 1.0) nextPlayTime = now + BUFFER_TARGET;
  if (nextPlayTime < now) nextPlayTime = now + 0.02;
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

function downsampleTo16k(f32, inRate) {
  if (inRate === 16000) return floatTo16(f32);
  const ratio = inRate / 16000;
  const outLen = Math.floor(f32.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const idx = i * ratio;
    const i0 = Math.floor(idx);
    const i1 = Math.min(i0 + 1, f32.length - 1);
    const frac = idx - i0;
    const s = f32[i0] * (1 - frac) + f32[i1] * frac;
    out[i] = Math.max(-1, Math.min(1, s)) * 32767;
  }
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

/* ---------- UI ---------- */

function makeBubble(role) {
  const box = document.getElementById("live-transcript");
  const div = document.createElement("div");
  const isUser = role === "user";
  div.className = `max-w-[85%] px-4 py-3 text-sm whitespace-pre-wrap animate-fade-in-up ${
    isUser ? "ml-auto bg-nx-red text-nx-bg font-medium" : "mr-auto nx-card"}`;
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
