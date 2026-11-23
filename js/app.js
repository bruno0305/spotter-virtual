/* Spotter Virtual · fluxo do treino e interface
 *
 * Treino = várias séries do mesmo exercício.
 *   configurar → série 1 → descanso → série 2 → ... → resumo + carga do próximo treino
 * A fonte dos movimentos pode ser a câmera (MediaPipe) ou a demonstração simulada.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const ui = {
    stage: $('stage'), camera: $('camera'), canvas: $('drawing'), mode: $('mode'), setChip: $('set-chip'),
    hudReps: $('hud-reps'), reps: $('reps'), repsTarget: $('reps-target'), placeholder: $('placeholder'),
    rest: $('rest'), restTime: $('rest-time'), restNext: $('rest-next'), skipRest: $('skip-rest'), endWorkoutRest: $('end-workout-rest'),
    cue: $('cue'), feedback: $('feedback'), angle: $('angle'), metric: $('metric'), quality: $('quality'),
    alerts: $('alerts'), alertsDetail: $('alerts-detail'), tempo: $('tempo'),
    finish: $('finish'), endWorkout: $('end-workout'),
    settings: $('settings'), exercisePick: document.querySelector('.exercise-pick'),
    load: $('load'), target: $('target'), sets: $('sets'), restSeconds: $('rest-seconds'),
    loadBadge: $('load-badge'), framing: $('framing'), start: $('start'), demo: $('demo'),
    voice: $('voice'), beep: $('beep'), scenario: $('demo-scenario'),
    result: $('result'), resultTitle: $('result-title'), setList: $('set-list'), nextLoad: $('next-load'),
    heroDemo: $('hero-demo'),
    evoTabs: $('evo-tabs'), kpis: $('kpis'), chart: $('chart'), evoEmpty: $('evo-empty'), seed: $('seed'),
    history: $('history'), historyWrap: $('history-wrap'), empty: $('empty'),
    exportBtn: $('export'), clearBtn: $('clear'), storageNote: $('storage-note')
  };

  const MODE_SIM = 'Simulação';
  const MODE_CAM = 'Câmera ao vivo';
  const DEMO_REST = 6;
  const fmtKg = SV.progression.fmt;

  let workout = null;   // treino em andamento
  let session = null;   // série em andamento
  let restTimer = null;
  let evoExercise = 'squat';
  let loadTouched = false;

  /* ---------- utilidades de interface ---------- */
  const selectedExercise = () => ui.settings.elements.exercise.value;

  function cue(text, tone = 'info') {
    ui.feedback.textContent = text;
    ui.cue.dataset.tone = tone;
  }

  function lockSetup(locked) {
    ui.exercisePick.disabled = locked;
    for (const c of [ui.load, ui.target, ui.sets, ui.restSeconds, ui.start, ui.demo, ui.scenario, ui.heroDemo]) c.disabled = locked;
    ui.finish.disabled = !locked;
    ui.endWorkout.disabled = !locked;
  }

  function resetLiveStats() {
    ui.reps.value = 0;
    ui.angle.value = '—';
    ui.quality.value = '—';
    ui.alerts.value = 0;
    ui.alertsDetail.textContent = 'postura, amplitude, ritmo';
    ui.tempo.value = '—';
  }

  function updateLiveStats() {
    if (!session) return;
    const s = session.tracker.summary();
    ui.quality.value = s.quality === null ? '—' : s.quality + '%';
    ui.alerts.value = s.corrections;
    const labels = { partial: 'amplitude', torso: 'tronco', wrist: 'punho', hips: 'quadril', tempo: 'ritmo' };
    const parts = Object.entries(s.issues).map(([k, v]) => `${v} ${labels[k] || k}`);
    ui.alertsDetail.textContent = parts.length ? parts.join(' · ') : 'nenhuma até agora';
    ui.tempo.value = s.eccentric ? s.eccentric.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' s' : '—';
  }

  function bumpReps() {
    ui.hudReps.classList.remove('bump');
    void ui.hudReps.offsetWidth; // reinicia a animação
    ui.hudReps.classList.add('bump');
  }

  /* ---------- exercício e carga sugerida ---------- */
  function applyExercise() {
    const config = SV.EXERCISES[selectedExercise()];
    ui.framing.textContent = config.framing;
    ui.metric.textContent = config.joint;
    loadTouched = false;
    const suggestion = SV.storage.suggestion(config.key);
    if (suggestion) {
      ui.load.value = suggestion.load;
      const delta = suggestion.load - suggestion.from;
      const change = delta > 0 ? ` (+${fmtKg(delta)})` : delta < 0 ? ` (${fmtKg(delta)})` : '';
      ui.loadBadge.textContent = `Carga sugerida pelo Spotter com base no último treino: ${fmtKg(suggestion.load)}${change}.`;
      ui.loadBadge.classList.remove('manual');
    } else {
      ui.load.value = config.defaultLoad;
      ui.loadBadge.textContent = 'Primeiro treino deste exercício: comece com uma carga confortável. Depois o Spotter sugere a próxima.';
      ui.loadBadge.classList.add('manual');
    }
    ui.loadBadge.hidden = false;
  }

  function validInputs() {
    for (const input of [ui.load, ui.target, ui.sets, ui.restSeconds]) {
      if (!input.checkValidity()) { input.reportValidity(); return false; }
    }
    return true;
  }

  /* ---------- treino ---------- */
  function startWorkout(mode) {
    if (workout || !validInputs()) return;
    const config = SV.EXERCISES[selectedExercise()];
    workout = {
      mode, config,
      target: ui.target.valueAsNumber,
      totalSets: ui.sets.valueAsNumber,
      rest: mode === MODE_SIM ? Math.min(DEMO_REST, ui.restSeconds.valueAsNumber) : ui.restSeconds.valueAsNumber,
      load: ui.load.valueAsNumber,
      scenario: ui.scenario.value,
      results: [],
      stream: null, model: null
    };
    ui.result.hidden = true;
    lockSetup(true);
    ui.repsTarget.textContent = workout.target;
    // No celular o monitor fica abaixo da configuração: rola até ele.
    if (window.matchMedia('(max-width: 960px)').matches) ui.stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (mode === MODE_SIM) {
      startSet();
    } else {
      openCamera();
    }
  }

  async function openCamera() {
    const current = workout;
    ui.mode.textContent = 'Preparando câmera';
    ui.finish.textContent = 'Cancelar';
    try {
      const { stream, model } = await SV.camera.open(text => cue(text));
      if (workout !== current) { stream.getTracks().forEach(t => t.stop()); return; }
      current.stream = stream;
      current.model = model;
      ui.camera.srcObject = stream;
      await ui.camera.play();
      if (workout !== current) return;
      ui.camera.hidden = false;
      startSet();
    } catch (err) {
      if (workout !== current) return;
      const messages = {
        support: 'Abra pelo link HTTPS ou por localhost para usar a câmera. A demonstração funciona em qualquer lugar.',
        model: 'O modelo de pose não carregou. Verifique a internet ou use a demonstração.',
        camera: 'Não foi possível abrir a câmera. Confira a permissão, feche outros apps de vídeo ou use a demonstração.'
      };
      cancelWorkout(messages[err.stage] || messages.camera);
    }
  }

  function startSet() {
    clearRest();
    const w = workout;
    const number = w.results.length + 1;
    const tracker = SV.createTracker(w.config, w.target, trackerEvents());
    session = { tracker, number, load: w.load, stop: null, startedAt: performance.now() };
    resetLiveStats();
    ui.placeholder.hidden = true;
    ui.hudReps.hidden = false;
    ui.setChip.hidden = false;
    ui.setChip.textContent = `Série ${number} de ${w.totalSets} · ${fmtKg(w.load)}`;
    ui.mode.textContent = w.mode;
    ui.mode.classList.toggle('live', w.mode === MODE_CAM);
    ui.finish.textContent = 'Encerrar série';
    ui.finish.disabled = false;

    const intro = w.config.order[0] === 'exit'
      ? 'Fique na posição inicial, com o corpo estendido.'
      : 'Fique na posição inicial, com o quadril flexionado.';
    cue(`Série ${number}: ${w.target} repetições com ${fmtKg(w.load)}. ${intro}`);
    SV.audio.say(number === 1 ? `Série ${number}. ${w.target} repetições. Pode começar.` : `Série ${number}. Vamos lá.`);

    if (w.mode === MODE_SIM) runDemo(); else runCamera();
  }

  function trackerEvents() {
    return {
      ready() {
        cue('Posição inicial detectada. Pode começar.', 'ok');
      },
      issue({ cue: text }) {
        cue(text, 'warn');
        SV.audio.tone('warn');
        SV.audio.say(text, { priority: true });
        updateLiveStats();
      },
      partial({ cue: text }) {
        cue(text, 'warn');
        SV.audio.tone('warn');
        SV.audio.say(text, { priority: true });
        updateLiveStats();
      },
      rep({ count, clean }) {
        ui.reps.value = count;
        bumpReps();
        SV.audio.tone('rep');
        const left = workout.target - count;
        if (clean) cue(left > 0 ? `Repetição ${count}. Boa execução! Faltam ${left}.` : `Repetição ${count}. Boa execução!`, 'ok');
        else cue(`Repetição ${count} registrada com correção.`, 'warn');
        if (left > 0) SV.audio.say(SV.audio.number(count));
        updateLiveStats();
      },
      complete() {
        // Aguarda o quadro atual terminar antes de encerrar.
        setTimeout(() => finishSet(false), 0);
      },
      lost() {
        cue('Ajuste o enquadramento: as articulações saíram do quadro.', 'info');
      }
    };
  }

  /* Processa um quadro (da câmera ou da simulação). */
  function analyze(landmarks, w, h, now, simulated) {
    if (!session) return;
    const config = workout.config;
    const metrics = SV.geometry.measure(config, landmarks, w, h);
    let shown = metrics;
    if (metrics.status === 'ok') {
      shown = session.tracker.push(metrics, now) || metrics;
      ui.angle.value = Math.round(shown.primary) + '°';
    } else {
      ui.angle.value = '—';
      session.tracker.lost();
      if (landmarks.length) {
        cue(metrics.status === 'flat' ? 'Fique de lado para a câmera medir o ângulo.' : 'Ajuste o enquadramento para mostrar as articulações.');
      } else {
        cue('Nenhuma pessoa detectada. Afaste o celular até o corpo inteiro aparecer.');
      }
    }
    // O quadro acompanha o formato do vídeo (retrato no celular, paisagem no notebook).
    const ratio = `${w} / ${h}`;
    if (w && h && ui.stage.style.aspectRatio !== ratio) ui.stage.style.aspectRatio = ratio;
    SV.renderer.draw(ui.canvas, landmarks, w, h, {
      simulated, kind: config.key, metrics: shown, warning: session?.tracker.issueActive
    });
  }

  function runDemo() {
    const current = session;
    const config = workout.config;
    // No cenário com correções, a 1ª série tem erros e as seguintes mostram o atleta já corrigido.
    const scenario = current.number === 1 ? workout.scenario : 'clean';
    const t0 = performance.now() + 500;
    let raf = 0;
    const frame = now => {
      if (session !== current) return;
      const elapsed = Math.max(0, now - t0);
      const landmarks = SV.simulator.frameAt(config, scenario, elapsed);
      analyze(landmarks, SV.simulator.W, SV.simulator.H, now, true);
      if (session === current) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    current.stop = () => cancelAnimationFrame(raf);
  }

  function runCamera() {
    const current = session;
    const w = workout;
    current.stop = SV.camera.run(ui.camera, w.stream, w.model, {
      onFrame: (landmarks, vw, vh, now) => { if (session === current) analyze(landmarks, vw, vh, now, false); },
      onEnded: () => { finishSet(true, true); cue('A câmera foi desconectada. Treino encerrado.'); },
      onError: () => { finishSet(true, true); cue('A análise da câmera foi interrompida. A demonstração continua disponível.'); }
    });
  }

  /* Encerra a série atual. manual = usuário clicou; endAll = encerrar o treino inteiro. */
  function finishSet(manual, endAll = false) {
    if (!session) {
      if (workout && endAll) finishWorkout();
      return;
    }
    const current = session;
    session = null;
    current.stop && current.stop();
    SV.renderer.clear(ui.canvas);
    ui.angle.value = '—';

    const summary = current.tracker.summary();
    const attempted = summary.reps > 0 || summary.partials > 0;
    if (attempted || !manual) {
      workout.results.push({ ...summary, load: current.load, set: current.number });
    }

    if (!workout.results.length) {
      cancelWorkout(manual ? 'Treino cancelado antes da primeira repetição.' : 'Treino encerrado.');
      return;
    }

    SV.audio.tone('done');
    const remaining = workout.totalSets - workout.results.length;
    if (endAll || remaining <= 0 || !attempted) {
      finishWorkout();
      return;
    }

    const last = workout.results.at(-1);
    const next = SV.progression.nextSet(workout.load, last);
    workout.load = next.load;
    workout.pendingReason = next.reason;
    startRest(last);
  }

  /* ---------- descanso entre séries ---------- */
  function startRest(last) {
    const w = workout;
    let left = w.rest;
    ui.rest.hidden = false;
    ui.hudReps.hidden = true;
    ui.finish.disabled = true;
    ui.mode.classList.remove('live');
    ui.mode.textContent = 'Descanso';
    const nextNumber = w.results.length + 1;
    ui.restNext.textContent = `Próxima: série ${nextNumber} de ${w.totalSets} · ${w.target} reps com ${fmtKg(w.load)}`;
    const quality = last.quality === null ? '' : `, ${last.quality}% de qualidade`;
    cue(w.pendingReason || `Série ${last.set} concluída: ${last.reps} de ${last.target} repetições${quality}.`, w.pendingReason ? 'warn' : 'ok');
    SV.audio.say(`Série ${last.set} concluída. ${w.pendingReason ? w.pendingReason + ' ' : ''}Descanse ${left} segundos.`);

    const render = () => {
      ui.restTime.value = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    };
    render();
    restTimer = setInterval(() => {
      left--;
      render();
      if (left === 10 && w.rest > 15) SV.audio.say('Dez segundos.');
      if (left > 0 && left <= 3) SV.audio.tone('tick');
      if (left <= 0) {
        clearRest();
        if (workout === w) startSet();
      }
    }, 1000);
  }

  function clearRest() {
    clearInterval(restTimer);
    restTimer = null;
    ui.rest.hidden = true;
  }

  /* ---------- fim do treino ---------- */
  function stopStream() {
    if (workout?.stream) workout.stream.getTracks().forEach(t => t.stop());
    ui.camera.pause();
    ui.camera.srcObject = null;
    ui.camera.hidden = true;
  }

  function resetStage() {
    clearRest();
    stopStream();
    SV.renderer.clear(ui.canvas);
    ui.placeholder.hidden = false;
    ui.stage.style.aspectRatio = '';
    ui.hudReps.hidden = true;
    ui.setChip.hidden = true;
    ui.mode.textContent = 'Em espera';
    ui.mode.classList.remove('live');
    ui.finish.textContent = 'Encerrar série';
    lockSetup(false);
  }

  function cancelWorkout(message) {
    if (session) { session.stop && session.stop(); session = null; }
    resetStage();
    workout = null;
    cue(message, 'info');
  }

  function finishWorkout() {
    const w = workout;
    resetStage();
    workout = null;
    const next = SV.progression.nextWorkout(w.config, w.results);
    const totalReps = w.results.reduce((a, s) => a + s.reps, 0);
    const record = {
      id: 'w-' + Date.now(),
      date: new Date().toISOString(),
      exercise: w.config.key,
      mode: w.mode,
      sets: w.results,
      load: w.results[0].load,
      quality: next ? next.quality : null,
      next
    };
    SV.storage.addWorkout(record);
    ui.storageNote.hidden = SV.storage.available;

    // Resumo
    ui.resultTitle.textContent = `Resumo · ${w.config.name}`;
    ui.setList.replaceChildren(...w.results.map(s => {
      const li = document.createElement('li');
      const left = document.createElement('span');
      left.innerHTML = `<b>Série ${s.set}</b> · ${s.reps}/${s.target} reps · ${fmtKg(s.load)}`;
      const right = document.createElement('span');
      right.className = 'q ' + (s.quality === null ? '' : s.quality >= 85 ? 'good' : s.quality >= 60 ? 'mid' : 'bad');
      right.textContent = s.quality === null ? '—' : `${s.quality}%`;
      li.append(left, right);
      return li;
    }));
    ui.nextLoad.className = 'next-load ' + (next?.kind || 'hold');
    ui.nextLoad.innerHTML = '';
    if (next) {
      const label = document.createElement('small');
      label.textContent = 'Carga sugerida para o próximo treino';
      const strong = document.createElement('strong');
      strong.textContent = fmtKg(next.load) + (next.delta > 0 ? `  ▲ ${fmtKg(next.delta)}` : next.delta < 0 ? `  ▼ ${fmtKg(Math.abs(next.delta))}` : '');
      const p = document.createElement('p');
      p.textContent = next.reason;
      ui.nextLoad.append(label, strong, p);
    }
    ui.result.hidden = false;

    cue(`Treino concluído: ${totalReps} repetições em ${w.results.length} série(s). Resultado salvo.`, 'ok');
    SV.audio.say(next && next.load > 0
      ? `Treino concluído. Próximo treino: ${next.load.toLocaleString('pt-BR')} quilos.`
      : 'Treino concluído.');

    applyExercise();
    evoExercise = w.config.key;
    renderEvolution();
    ui.result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ---------- evolução e histórico ---------- */
  const dateLabel = w => w.date
    ? new Date(w.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    : (w.label || '').slice(0, 5);

  function renderEvolution() {
    for (const tab of ui.evoTabs.querySelectorAll('button')) {
      tab.setAttribute('aria-selected', String(tab.dataset.ex === evoExercise));
    }
    const config = SV.EXERCISES[evoExercise];
    const list = SV.storage.workouts.filter(w => w.exercise === evoExercise)
      .slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const has = list.length > 0;
    ui.evoEmpty.hidden = has;
    ui.kpis.hidden = !has;
    ui.chart.hidden = !has;

    if (has) {
      const last = list.at(-1);
      const suggestion = SV.storage.suggestion(evoExercise);
      const recent = list.slice(-5).filter(w => w.quality !== null);
      const avgQ = recent.length ? Math.round(recent.reduce((a, w) => a + w.quality, 0) / recent.length) : null;
      const reps = list.reduce((a, w) => a + w.sets.reduce((b, s) => b + s.reps, 0), 0);
      const first = list[0].load;
      const gain = last.load - first;
      const kpi = (label, value, cls = '') => `<div><small>${label}</small><b class="${cls}">${value}</b></div>`;
      ui.kpis.innerHTML =
        kpi('Carga atual', fmtKg(last.load)) +
        kpi('Próxima sugerida', suggestion ? fmtKg(suggestion.load) : '—', suggestion && suggestion.load > last.load ? 'up' : '') +
        kpi('Qualidade média (5 últimos)', avgQ === null ? '—' : avgQ + '%') +
        kpi(`Evolução em ${list.length} ${list.length === 1 ? 'treino' : 'treinos'}`, (gain >= 0 ? '+' : '') + fmtKg(gain) + ` · ${reps} reps`, gain > 0 ? 'up' : '');
      SV.charts.loadChart(ui.chart,
        list.map(w => ({ label: dateLabel(w), load: w.load, quality: w.quality })),
        suggestion ? suggestion.load : null);
      ui.chart.setAttribute('aria-label', `Carga por treino no ${config.name}`);
    }
    renderHistory();
  }

  function renderHistory() {
    const all = SV.storage.workouts;
    ui.history.replaceChildren();
    ui.empty.hidden = all.length > 0;
    ui.historyWrap.hidden = all.length === 0;
    for (const w of all) {
      const row = ui.history.insertRow();
      const reps = w.sets.reduce((a, s) => a + s.reps, 0);
      const target = w.sets.reduce((a, s) => a + s.target, 0);
      const cells = [
        w.date ? new Date(w.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : w.label,
        SV.EXERCISES[w.exercise]?.name || w.exercise,
        w.mode,
        w.sets.length,
        `${reps}/${target}`,
        fmtKg(w.load),
        w.quality === null || w.quality === undefined ? '—' : w.quality + '%',
        w.next ? fmtKg(w.next.load) : '—'
      ];
      cells.forEach((value, i) => {
        const cell = row.insertCell();
        cell.textContent = value;
        if (i === 6 && w.quality != null) cell.className = 'q ' + (w.quality >= 85 ? 'good' : w.quality >= 60 ? 'mid' : 'bad');
      });
    }
  }

  function exportCSV() {
    const blob = new Blob(['﻿' + SV.storage.toCSV()], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'spotter-virtual-historico.csv';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  let clearArmed = null;
  function clearHistory() {
    if (!clearArmed) {
      ui.clearBtn.textContent = 'Confirmar: apagar tudo';
      ui.clearBtn.classList.add('danger');
      clearArmed = setTimeout(disarmClear, 4000);
      return;
    }
    disarmClear();
    SV.storage.clear();
    applyExercise();
    renderEvolution();
  }
  function disarmClear() {
    clearTimeout(clearArmed);
    clearArmed = null;
    ui.clearBtn.textContent = 'Limpar histórico';
    ui.clearBtn.classList.remove('danger');
  }

  /* ---------- eventos ---------- */
  ui.settings.addEventListener('submit', e => { e.preventDefault(); startWorkout(MODE_CAM); });
  ui.demo.addEventListener('click', () => startWorkout(MODE_SIM));
  ui.heroDemo.addEventListener('click', () => {
    document.getElementById('treinar').scrollIntoView({ behavior: 'smooth' });
    startWorkout(MODE_SIM);
  });
  ui.exercisePick.addEventListener('change', applyExercise);
  ui.load.addEventListener('input', () => {
    if (loadTouched) return;
    loadTouched = true;
    ui.loadBadge.textContent = 'Carga ajustada manualmente. O Spotter volta a sugerir depois deste treino.';
    ui.loadBadge.classList.add('manual');
  });
  ui.finish.addEventListener('click', () => {
    if (session) finishSet(true);
    else if (workout && !workout.results.length) cancelWorkout('Treino cancelado.');
  });
  ui.endWorkout.addEventListener('click', () => {
    if (!workout) return;
    if (session) finishSet(true, true);
    else if (workout.results.length) finishWorkout();
    else cancelWorkout('Treino cancelado.');
  });
  ui.skipRest.addEventListener('click', () => { if (workout && !session) startSet(); });
  ui.endWorkoutRest.addEventListener('click', () => { if (workout && !session) finishWorkout(); });
  ui.voice.addEventListener('change', () => { SV.audio.voice = ui.voice.checked; });
  ui.beep.addEventListener('change', () => { SV.audio.beep = ui.beep.checked; });
  ui.evoTabs.addEventListener('click', e => {
    const btn = e.target.closest('button[data-ex]');
    if (!btn) return;
    evoExercise = btn.dataset.ex;
    renderEvolution();
  });
  ui.seed.addEventListener('click', () => { SV.storage.seed(); applyExercise(); renderEvolution(); });
  ui.exportBtn.addEventListener('click', exportCSV);
  ui.clearBtn.addEventListener('click', clearHistory);
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderEvolution, 200); });
  window.addEventListener('pagehide', () => { if (workout) cancelWorkout('Treino interrompido.'); });

  // Expõe o estado para depuração no console.
  SV.app = { get workout() { return workout; }, get session() { return session; } };

  ui.storageNote.hidden = SV.storage.available;
  applyExercise();
  renderEvolution();
})();
