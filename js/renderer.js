/* Spotter Virtual · desenho do esqueleto sobre o vídeo
 * Destaca a articulação analisada com o arco do ângulo. Quando há uma
 * correção ativa, a articulação fica laranja para reforçar o aviso visual.
 */
SV.renderer = (() => {
  const EDGES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
  const ACCENT = '#d7fa70';
  const WARN = '#ffb547';
  const { visible } = SV.geometry;

  function draw(canvas, landmarks, w, h, { simulated = false, kind, metrics, warning = false } = {}) {
    const ctx = canvas.getContext('2d');
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.clearRect(0, 0, w, h);
    if (!landmarks || !landmarks.length) return;
    if (simulated) SV.simulator.drawEquipment(ctx, kind, landmarks);

    const lw = Math.max(3, w / 200);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(215, 250, 112, .85)';
    ctx.lineWidth = lw;
    for (const [a, b] of EDGES) {
      const p = landmarks[a], q = landmarks[b];
      if (!visible(p) || !visible(q)) continue;
      ctx.beginPath();
      ctx.moveTo(p.x * w, p.y * h);
      ctx.lineTo(q.x * w, q.y * h);
      ctx.stroke();
    }

    if (simulated) {
      // Cabeça estilizada na simulação.
      const head = landmarks[0], shoulder = landmarks[11];
      ctx.beginPath();
      ctx.moveTo(shoulder.x * w, shoulder.y * h);
      ctx.lineTo(head.x * w, head.y * h);
      ctx.stroke();
      ctx.fillStyle = '#e9ede4';
      ctx.beginPath();
      ctx.arc(head.x * w, head.y * h, 21, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#f3f5ee';
    landmarks.forEach((p, i) => {
      if (!visible(p) || (simulated && i === 0)) return;
      if (!simulated && i < 11) return; // rosto não interessa para a análise
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, Math.max(3.5, w / 170), 0, Math.PI * 2);
      ctx.fill();
    });

    if (metrics && metrics.status === 'ok') drawAngle(ctx, metrics, w, h, warning, lw);
  }

  function drawAngle(ctx, metrics, w, h, warning, lw) {
    const [a, b, c] = metrics.pts;
    const bx = b.x * w, by = b.y * h;
    const a1 = Math.atan2(a.y * h - by, a.x * w - bx);
    const a2 = Math.atan2(c.y * h - by, c.x * w - bx);
    let diff = a2 - a1;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    const r = Math.max(26, w / 22);
    const color = warning ? WARN : ACCENT;

    ctx.fillStyle = warning ? 'rgba(255,181,71,.22)' : 'rgba(215,250,112,.18)';
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.arc(bx, by, r, a1, a1 + diff, diff < 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw * 0.8;
    ctx.beginPath();
    ctx.arc(bx, by, r, a1, a1 + diff, diff < 0);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(bx, by, Math.max(6, w / 110), 0, Math.PI * 2);
    ctx.fill();

    // Rótulo com o ângulo, do lado oposto ao arco.
    const mid = a1 + diff / 2 + Math.PI;
    const label = Math.round(metrics.primary) + '°';
    const fs = Math.max(14, w / 40);
    ctx.font = `800 ${fs}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lx = bx + Math.cos(mid) * r * 1.5, ly = by + Math.sin(mid) * r * 1.5;
    ctx.fillStyle = 'rgba(13,16,20,.75)';
    const tw = ctx.measureText(label).width + 12;
    ctx.fillRect(lx - tw / 2, ly - fs * 0.7, tw, fs * 1.4);
    ctx.fillStyle = color;
    ctx.fillText(label, lx, ly);
  }

  function clear(canvas) {
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }

  return { draw, clear };
})();
