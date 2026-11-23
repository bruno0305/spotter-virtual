/* Spotter Virtual · histórico salvo no navegador (localStorage)
 * Nada sai do aparelho. Se o navegador bloquear o armazenamento,
 * o histórico fica só na memória da aba.
 */
SV.storage = (() => {
  const KEY = 'spotter-virtual-v2';
  const LEGACY_KEY = 'spotter-virtual-mvp-v1';
  const MAX = 60;
  let data = { workouts: [], suggestions: {} };
  let available = true;

  function read() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved && Array.isArray(saved.workouts)) {
        data = { workouts: saved.workouts, suggestions: saved.suggestions || {} };
      } else {
        migrateLegacy();
      }
    } catch {
      available = false;
    }
  }

  /* Converte o histórico da versão anterior (uma linha por série). */
  function migrateLegacy() {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]');
    if (!Array.isArray(legacy) || !legacy.length) return;
    const byName = Object.fromEntries(Object.values(SV.EXERCISES).map(e => [e.name, e.key]));
    data.workouts = legacy.filter(e => byName[e.exercise]).map((e, i) => ({
      id: 'legacy-' + i,
      date: null,
      label: e.when,
      exercise: byName[e.exercise],
      mode: e.mode,
      sets: [{ reps: e.reps, target: e.reps, partials: 0, cleanReps: Math.max(0, e.reps - e.alerts), load: e.load, corrections: e.alerts, issues: {} }],
      load: e.load,
      quality: e.reps ? Math.round(Math.max(0, e.reps - e.alerts) / e.reps * 100) : null,
      next: null
    }));
    write();
  }

  function write() {
    data.workouts = data.workouts.slice(0, MAX);
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      available = true;
    } catch {
      available = false;
    }
  }

  function addWorkout(workout) {
    data.workouts.unshift(workout);
    if (workout.next) {
      data.suggestions[workout.exercise] = { load: workout.next.load, from: workout.load, date: workout.date };
    }
    write();
  }

  function clear() {
    data = { workouts: [], suggestions: {} };
    write();
  }

  /* Gera 6 treinos de exemplo por exercício, nas últimas 3 semanas, para a apresentação. */
  function seed() {
    const plans = {
      squat: { start: 40, step: 2.5, q: [72, 80, 88, 91, 86, 94] },
      bench: { start: 30, step: 2, q: [65, 78, 90, 83, 92, 95] },
      deadlift: { start: 50, step: 2.5, q: [70, 86, 89, 76, 90, 93] }
    };
    const now = Date.now();
    const day = 86400000;
    const workouts = [];
    for (const [key, plan] of Object.entries(plans)) {
      const config = SV.EXERCISES[key];
      let load = plan.start;
      plan.q.forEach((quality, i) => {
        const target = 8;
        const sets = [0, 1, 2].map(() => {
          const reps = target;
          const attempts = reps + (quality < 80 ? 1 : 0);
          const cleanReps = Math.round(attempts * quality / 100);
          return { reps, target, partials: attempts - reps, cleanReps, load, corrections: attempts - cleanReps, issues: {}, eccentric: 0.9 + i * 0.05 };
        });
        const next = SV.progression.nextWorkout(config, sets);
        workouts.push({
          id: `seed-${key}-${i}`,
          date: new Date(now - (21 - i * 3.5) * day - (key === 'bench' ? 3 : key === 'deadlift' ? 6 : 0) * 3600000).toISOString(),
          exercise: key, mode: 'Exemplo', sets, load, quality: next.quality, next
        });
        load = next.load;
      });
      data.suggestions[key] = { load, from: workouts[workouts.length - 1].load, date: workouts[workouts.length - 1].date };
    }
    workouts.sort((a, b) => b.date.localeCompare(a.date));
    data.workouts = workouts.concat(data.workouts.filter(w => w.mode !== 'Exemplo'));
    write();
  }

  function toCSV() {
    const head = ['data', 'exercicio', 'modo', 'series', 'repeticoes', 'carga_kg', 'qualidade_pct', 'correcoes', 'proxima_carga_kg'];
    const rows = data.workouts.map(w => [
      w.date || w.label || '',
      SV.EXERCISES[w.exercise]?.name || w.exercise,
      w.mode,
      w.sets.length,
      w.sets.reduce((a, s) => a + s.reps, 0),
      w.load,
      w.quality ?? '',
      w.sets.reduce((a, s) => a + (s.corrections || 0), 0),
      w.next ? w.next.load : ''
    ]);
    return [head, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
  }

  read();
  return {
    get workouts() { return data.workouts; },
    get available() { return available; },
    suggestion: key => data.suggestions[key] || null,
    addWorkout, clear, seed, toCSV
  };
})();
