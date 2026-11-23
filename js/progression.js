/* Spotter Virtual · gestão automática de carga
 *
 * Regra de dupla progressão, usada de forma ilustrativa no MVP:
 *  - Entre séries: se a série ficou muito abaixo da meta (< 75% das repetições),
 *    a carga da próxima série cai 10%. Caso contrário, mantém.
 *  - Entre treinos: se todas as séries bateram a meta com qualidade >= 85%,
 *    a carga sobe o incremento do exercício. Se alguma série falhou, segue a
 *    carga reduzida. Se bateu a meta com muitas correções, mantém e prioriza técnica.
 * As sugestões não substituem a orientação de um profissional.
 */
SV.progression = (() => {
  const QUALITY_TO_PROGRESS = 85;
  const roundHalf = kg => Math.round(kg * 2) / 2;
  const fmt = kg => kg.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' kg';

  /* Carga da próxima série dentro do mesmo treino. */
  function nextSet(load, set) {
    const minimum = Math.ceil(set.target * 0.75);
    if (load > 0 && set.reps < minimum) {
      const next = Math.max(0, roundHalf(load * 0.9));
      return { load: next, changed: true, reason: `Só ${set.reps} de ${set.target}. Carga ajustada para ${fmt(next)} na próxima série.` };
    }
    return { load, changed: false, reason: null };
  }

  /* Sugestão para o próximo treino, a partir de todas as séries. */
  function nextWorkout(config, sets) {
    const done = sets.filter(s => s.reps > 0 || s.partials > 0);
    if (!done.length) return null;
    const lastLoad = sets[sets.length - 1].load;
    const firstLoad = sets[0].load;
    const attempts = done.reduce((a, s) => a + s.reps + s.partials, 0);
    const clean = done.reduce((a, s) => a + s.cleanReps, 0);
    const quality = attempts ? Math.round(clean / attempts * 100) : 0;
    const allHit = sets.every(s => s.reps >= s.target);
    const reduced = lastLoad < firstLoad;

    if (firstLoad === 0) {
      return { load: 0, delta: 0, kind: 'hold', quality,
        reason: 'Treino sem carga, só para teste. Informe a carga real para o Spotter calcular a progressão.' };
    }
    if (allHit && quality >= QUALITY_TO_PROGRESS) {
      const load = Math.min(500, lastLoad + config.increment);
      return { load, delta: load - lastLoad, kind: 'up', quality,
        reason: `Todas as séries completas com ${quality}% de qualidade. Suba ${fmt(config.increment)} no próximo treino.` };
    }
    if (reduced) {
      return { load: lastLoad, delta: lastLoad - firstLoad, kind: 'down', quality,
        reason: `A carga de ${fmt(firstLoad)} ficou pesada hoje. Comece o próximo treino com ${fmt(lastLoad)}.` };
    }
    if (allHit) {
      return { load: lastLoad, delta: 0, kind: 'hold', quality,
        reason: `Meta batida, mas com ${100 - quality}% das repetições corrigidas. Mantenha a carga e priorize a técnica.` };
    }
    return { load: lastLoad, delta: 0, kind: 'hold', quality,
      reason: 'Algumas séries ficaram abaixo da meta. Mantenha a carga até completar todas.' };
  }

  return { nextSet, nextWorkout, fmt, QUALITY_TO_PROGRESS };
})();
