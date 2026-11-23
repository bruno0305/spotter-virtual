/* Spotter Virtual · demonstração sem câmera
 * Gera poses sintéticas (vista lateral) para os três exercícios, incluindo
 * repetições com erro, para mostrar as correções do Spotter na apresentação.
 * Coordenadas em um quadro de 960 x 600, normalizadas para 0 a 1.
 */
SV.simulator = (() => {
  const W = 960, H = 600;
  const CYCLE = 2400;          // duração de uma repetição simulada (ms)
  const RAD = Math.PI / 180;

  /* Monta a pose para um ângulo-alvo da articulação principal.
     error: null | 'posture'. ascending/travel: fase da repetição (para o erro do terra). */
  function pose(kind, degrees, { error = null, ascending = false, travel = 0, depth = 0 } = {}) {
    const bend = (180 - degrees) * RAD;
    const p = [];
    const set = (id, x, y) => { p[id] = { x: x / W, y: y / H, visibility: 1 }; };
    const offset = (id, from, x, y) => set(id, p[from].x * W + x, p[from].y * H + y);

    if (kind === 'bench') {
      // Banco fixo. O cotovelo desce em direção aos pés; o antebraço fica vertical
      // (ou inclina, no erro de punho desalinhado).
      set(11, 390, 340);
      set(23, 552, 355);
      set(25, 625, 366);
      set(27, 595, 507);
      offset(13, 11, 88 * Math.sin(bend), -88 * Math.cos(bend));
      const tilt = error === 'posture' ? 38 * depth * RAD : 0;
      offset(15, 13, -85 * Math.sin(tilt), -85 * Math.cos(tilt));
      set(0, 342, 335);
    } else if (kind === 'deadlift') {
      // A flexão do quadril se divide entre coxa e tronco. No erro, a coxa e a
      // canela ficam verticais cedo na subida: o quadril sobe antes do peito.
      const k = error === 'posture' && ascending ? Math.min(1, travel / 0.35) : 0;
      const thighTilt = bend * 0.40 * (1 - k);
      const torsoTilt = bend - thighTilt;
      const shinTilt = bend * 0.21 * (1 - k);
      set(27, 480, 507);
      offset(25, 27, 120 * Math.sin(shinTilt), -120 * Math.cos(shinTilt));
      offset(23, 25, -127 * Math.sin(thighTilt), -127 * Math.cos(thighTilt));
      offset(11, 23, 154 * Math.sin(torsoTilt), -154 * Math.cos(torsoTilt));
      const barX = 535;
      const reach = Math.min(212, Math.abs(barX - p[11].x * W));
      const armDrop = Math.sqrt(212 ** 2 - reach ** 2);
      set(15, barX, p[11].y * H + armDrop);
      set(13, (p[11].x * W + barX) / 2, p[11].y * H + armDrop / 2);
      offset(0, 11, 40 * Math.sin(torsoTilt) + 5, -40 * Math.cos(torsoTilt));
    } else {
      // Agachamento: pés fixos, joelhos à frente, quadril para trás e para baixo.
      // No erro, o tronco inclina muito mais.
      const shinTilt = bend * 0.26;
      const thighTilt = bend - shinTilt;
      const torsoTilt = bend * (error === 'posture' ? 0.78 : 0.46);
      set(27, 500, 507);
      offset(25, 27, 122 * Math.sin(shinTilt), -122 * Math.cos(shinTilt));
      offset(23, 25, -132 * Math.sin(thighTilt), -132 * Math.cos(thighTilt));
      offset(11, 23, 154 * Math.sin(torsoTilt), -154 * Math.cos(torsoTilt));
      offset(13, 11, -43, 59);
      offset(15, 11, -16, 3);
      offset(0, 11, 38 * Math.sin(torsoTilt) + 6, -38 * Math.cos(torsoTilt));
    }
    return p;
  }

  /* Roteiro de cada repetição conforme o cenário. */
  function repType(scenario, cycle) {
    if (scenario === 'coach') {
      if (cycle === 0) return 'partial';
      if (cycle === 1) return 'posture';
    }
    return 'good';
  }

  /* Calcula a pose do instante `elapsed` (ms) da demonstração. */
  function frameAt(config, scenario, elapsed) {
    const high = 174;
    const low = config.key === 'deadlift' ? 60 : config.enter - 19;
    const [from, to] = config.order[0] === 'exit' ? [high, low] : [low, high];
    const partialTo = (config.partial + config[config.order[1]]) / 2;

    const cycle = Math.floor(elapsed / CYCLE);
    const ratio = (elapsed % CYCLE) / CYCLE;
    const type = repType(scenario, cycle);
    // Pausa curta nas pontas e movimento suave (cosseno) no meio.
    const travel = ratio < 0.1 || ratio >= 0.9 ? 0 : (1 - Math.cos((ratio - 0.1) / 0.8 * 2 * Math.PI)) / 2;
    const goal = type === 'partial' ? partialTo : to;
    const degrees = from + (goal - from) * travel;
    const depth = Math.abs(degrees - high) / Math.abs(high - low);
    return pose(config.key, degrees, {
      error: type === 'posture' ? 'posture' : null,
      ascending: ratio < 0.5,
      travel,
      depth
    });
  }

  /* Desenha chão, banco e anilha para dar contexto visual à demonstração. */
  function drawEquipment(ctx, kind, p) {
    const x = id => p[id].x * W;
    const y = id => p[id].y * H;
    ctx.fillStyle = '#3a4552';
    ctx.fillRect(160, 525, 640, 3);
    ctx.fillStyle = '#9aa6b2';
    ctx.fillRect(x(27) - 14, 513, 49, 12);
    if (kind === 'bench') {
      ctx.fillStyle = '#3f4a57';
      ctx.fillRect(303, 371, 290, 13);
      ctx.fillRect(329, 384, 12, 141);
      ctx.fillRect(552, 384, 12, 141);
    }
    ctx.fillStyle = '#4b5a6b';
    ctx.strokeStyle = '#6b7b8d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x(15), y(15), kind === 'deadlift' ? 54 : 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  return { W, H, CYCLE, pose, frameAt, drawEquipment };
})();
