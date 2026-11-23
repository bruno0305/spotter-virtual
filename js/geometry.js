/* Spotter Virtual · geometria das articulações
 * Os pontos chegam normalizados (0 a 1). Multiplicamos pela largura e altura
 * do quadro para medir ângulos em pixels reais, sem distorção.
 */
SV.geometry = (() => {
  const DEG = 180 / Math.PI;

  function visible(point, min = 0.55) {
    return Boolean(point) && (point.visibility ?? 1) >= min &&
      point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
  }

  /* Ângulo no vértice b formado por a-b-c, em graus (0 a 180). Retorna null se os segmentos forem curtos demais. */
  function angle(a, b, c, w, h) {
    const x1 = (a.x - b.x) * w, y1 = (a.y - b.y) * h;
    const x2 = (c.x - b.x) * w, y2 = (c.y - b.y) * h;
    if (Math.min(Math.hypot(x1, y1), Math.hypot(x2, y2)) < 4) return null;
    return Math.atan2(Math.abs(x1 * y2 - y1 * x2), x1 * x2 + y1 * y2) * DEG;
  }

  /* Inclinação do segmento from→to em relação à vertical para cima (0 = vertical). */
  function leanFromVertical(from, to, w, h) {
    const dx = (to.x - from.x) * w, dy = (from.y - to.y) * h;
    if (Math.hypot(dx, dy) < 4) return null;
    return Math.abs(Math.atan2(dx, dy) * DEG);
  }

  /* Índices das articulações nomeadas para um lado do corpo (0 = esquerdo, 1 = direito). */
  function sideIndex(name, side) {
    const base = SV.JOINTS[name];
    return name === 'nose' ? base : base + side;
  }

  /* Escolhe o lado mais visível e calcula todas as métricas usadas pelo exercício. */
  function measure(config, landmarks, w, h) {
    const sides = [0, 1].map(side => {
      const pts = config.primary.map(name => landmarks[sideIndex(name, side)]);
      const ok = pts.every(p => visible(p));
      const score = ok ? Math.min(...pts.map(p => p.visibility ?? 1)) : -1;
      return { side, pts, ok, score };
    }).filter(s => s.ok).sort((a, b) => b.score - a.score);

    if (!sides.length) return { status: 'hidden' };
    const { side, pts } = sides[0];
    const primary = angle(pts[0], pts[1], pts[2], w, h);
    if (primary === null) return { status: 'flat' };

    const get = name => landmarks[sideIndex(name, side)];
    const metrics = { status: 'ok', side, primary, pts };
    const shoulder = get('shoulder'), hip = get('hip'), knee = get('knee'), ankle = get('ankle');
    const elbow = get('elbow'), wrist = get('wrist');

    if (visible(shoulder) && visible(hip)) {
      const lean = leanFromVertical(hip, shoulder, w, h);
      if (lean !== null) metrics.torsoLean = lean;
    }
    if (visible(elbow) && visible(wrist)) {
      const tilt = leanFromVertical(elbow, wrist, w, h);
      if (tilt !== null) metrics.forearmTilt = tilt;
    }
    if (visible(hip) && visible(knee) && visible(ankle)) {
      const k = angle(hip, knee, ankle, w, h);
      if (k !== null) metrics.knee = k;
    }
    return metrics;
  }

  return { visible, angle, leanFromVertical, measure, sideIndex };
})();
