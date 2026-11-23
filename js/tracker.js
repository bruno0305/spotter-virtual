/* Spotter Virtual · contador de repetições e correções de postura
 *
 * Máquina de estados de uma repetição:
 *   waiting   → aguardando o atleta chegar na posição inicial
 *   outbound  → saiu da posição inicial (ex.: descendo no agachamento)
 *   returning → chegou na posição final e está voltando
 * Uma repetição conta quando o atleta volta à posição inicial depois de passar
 * pela posição final. Se voltar sem chegar lá, é uma repetição parcial (não conta).
 *
 * O tracker não fala nem desenha: ele emite eventos e o app decide o que fazer.
 */
SV.createTracker = function createTracker(config, target, events = {}) {
  const emit = (name, ...args) => events[name] && events[name](...args);
  const [start, end] = config.order;
  const extendedStart = start === 'exit';

  const state = {
    phase: 'waiting',
    smoothed: undefined,
    excursion: false,
    leftAt: null,          // momento em que saiu da posição inicial
    extreme: null,         // ângulo mais profundo da repetição
    extremeAt: null,
    repIssues: new Set(),  // correções já dadas nesta repetição
    activeIssueUntil: 0,
    // Totais da série
    reps: 0,
    partials: 0,
    cleanReps: 0,
    issues: {},            // contagem por tipo de correção
    eccentrics: [],        // duração das descidas (s)
    done: false
  };

  function positionOf(deg) {
    if (deg <= config.enter) return 'enter';
    if (deg >= config.exit) return 'exit';
    return 'middle';
  }

  function resetRep() {
    state.excursion = false;
    state.leftAt = null;
    state.extreme = null;
    state.extremeAt = null;
    state.repIssues = new Set();
  }

  function flag(id, label, cue, now) {
    if (state.repIssues.has(id)) return;
    state.repIssues.add(id);
    state.issues[id] = (state.issues[id] || 0) + 1;
    state.activeIssueUntil = now + 1500;
    emit('issue', { id, label, cue });
  }

  /* 'rep' = vale durante a repetição inteira; 'outbound' = só na ida. */
  function checkRules(m, now, phase) {
    for (const rule of config.rules) {
      const applies = rule.when === 'rep' || rule.when === phase;
      if (applies && rule.test(m, config)) flag(rule.id, rule.label, rule.cue, now);
    }
  }

  function trackExtreme(deg, now) {
    const deeper = state.extreme === null || (extendedStart ? deg < state.extreme : deg > state.extreme);
    if (deeper) { state.extreme = deg; state.extremeAt = now; }
  }

  /* Recebe as métricas de um quadro (já medidas) e o tempo em ms. */
  function push(raw, now) {
    if (state.done) return;
    // Suavização exponencial para reduzir o tremor da detecção.
    state.smoothed = state.smoothed === undefined ? raw.primary : state.smoothed * 0.45 + raw.primary * 0.55;
    const m = { ...raw, primary: state.smoothed };
    const deg = m.primary;
    const position = positionOf(deg);

    if (state.phase === 'waiting') {
      if (position === start) {
        state.phase = 'outbound';
        resetRep();
        emit('ready');
      }
      return m;
    }

    if (state.phase === 'outbound') {
      if (position !== start && state.leftAt === null) state.leftAt = now;
      if (state.leftAt !== null) trackExtreme(deg, now);
      state.excursion ||= extendedStart ? deg <= config.partial : deg >= config.partial;

      checkRules(m, now, 'outbound');

      if (position === end) {
        state.phase = 'returning';
        return m;
      }
      if (position === start) {
        if (state.excursion) {
          state.partials++;
          state.issues.partial = (state.issues.partial || 0) + 1;
          state.activeIssueUntil = now + 1500;
          emit('partial', { id: 'partial', label: 'amplitude parcial', cue: config.partialCue });
          resetRep();
        } else {
          // Pequena oscilação perto da posição inicial: a tentativa continua.
          state.leftAt = null;
          state.extreme = null;
          state.extremeAt = null;
        }
      }
      return m;
    }

    // returning
    trackExtreme(deg, now);
    checkRules(m, now, 'returning');
    if (position === start) {
      state.reps++;
      let eccentric = null;
      if (config.eccentricOnOutbound && state.leftAt !== null && state.extremeAt !== null) {
        eccentric = (state.extremeAt - state.leftAt) / 1000;
        if (eccentric > 0.05) state.eccentrics.push(eccentric);
        if (eccentric > 0.05 && eccentric < SV.MIN_ECCENTRIC) {
          flag('tempo', 'descida rápida', 'Controle a descida na próxima repetição.', now);
        }
      }
      const clean = state.repIssues.size === 0;
      if (clean) state.cleanReps++;
      state.phase = 'outbound';
      const issues = [...state.repIssues];
      resetRep();
      emit('rep', { count: state.reps, clean, issues, eccentric });
      if (state.reps >= target) {
        state.done = true;
        emit('complete');
      }
    }
    return m;
  }

  /* Articulações saíram do quadro: volta a aguardar a posição inicial. */
  function lost() {
    if (state.phase !== 'waiting') emit('lost');
    state.phase = 'waiting';
    state.smoothed = undefined;
    resetRep();
  }

  function summary() {
    const attempts = state.reps + state.partials;
    const quality = attempts ? Math.round(state.cleanReps / attempts * 100) : null;
    const corrections = Object.values(state.issues).reduce((a, b) => a + b, 0);
    const ecc = state.eccentrics.length
      ? state.eccentrics.reduce((a, b) => a + b, 0) / state.eccentrics.length : null;
    return {
      reps: state.reps, target, partials: state.partials, cleanReps: state.cleanReps,
      issues: { ...state.issues }, corrections, quality, eccentric: ecc
    };
  }

  return {
    push, lost, summary,
    get phase() { return state.phase; },
    get reps() { return state.reps; },
    get issueActive() { return performance.now() < state.activeIssueUntil; }
  };
};
