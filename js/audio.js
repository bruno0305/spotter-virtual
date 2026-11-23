/* Spotter Virtual · voz e sinais sonoros
 * Correções de postura têm prioridade: interrompem o que estiver sendo falado.
 * A contagem de repetições entra na fila normal.
 */
SV.audio = (() => {
  const NUMBERS = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez',
    'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove', 'vinte'];
  let voiceOn = true;
  let beepOn = true;
  let ctx = null;
  let ptVoice = null;
  let lastPriority = -Infinity;

  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const voices = speechSynthesis.getVoices();
    ptVoice = voices.find(v => v.lang === 'pt-BR') || voices.find(v => v.lang?.startsWith('pt')) || null;
  }
  if ('speechSynthesis' in window) {
    pickVoice();
    speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
  }

  function say(text, { priority = false } = {}) {
    if (!voiceOn || !('speechSynthesis' in window)) return;
    const now = performance.now();
    if (priority) {
      // Evita metralhar correções: no máximo uma a cada 1,8 s.
      if (now - lastPriority < 1800) return;
      lastPriority = now;
      speechSynthesis.cancel();
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR';
    if (ptVoice) u.voice = ptVoice;
    u.rate = 1.08;
    speechSynthesis.speak(u);
  }

  function number(n) {
    return NUMBERS[n] || String(n);
  }

  /* Bipes curtos com Web Audio (funcionam mesmo com a voz desligada). */
  function tone(kind) {
    if (!beepOn) return;
    try {
      ctx ||= new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      const shapes = {
        rep: [[880, 0, 0.09]],
        done: [[660, 0, 0.12], [880, 0.13, 0.12], [1100, 0.26, 0.18]],
        warn: [[300, 0, 0.16], [240, 0.18, 0.2]],
        tick: [[1000, 0, 0.05]]
      }[kind] || [];
      for (const [freq, at, dur] of shapes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = kind === 'warn' ? 'square' : 'sine';
        osc.frequency.value = freq;
        const t = ctx.currentTime + at;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(kind === 'warn' ? 0.08 : 0.18, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      }
    } catch { /* áudio indisponível: segue sem bipe */ }
  }

  function stop() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  return {
    say, number, tone, stop,
    set voice(v) { voiceOn = v; if (!v) stop(); },
    set beep(v) { beepOn = v; }
  };
})();
