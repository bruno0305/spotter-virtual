/* Spotter Virtual · gráfico de evolução de carga (SVG, sem bibliotecas)
 * Linha = carga usada em cada treino. Cor do ponto = qualidade da execução.
 * Ponto tracejado no fim = carga sugerida para o próximo treino.
 */
SV.charts = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const qualityColor = q => q === null || q === undefined ? '#a3adba' : q >= 85 ? '#5ee6a0' : q >= 60 ? '#ffb547' : '#ff6b6b';

  function el(name, attrs = {}, text) {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function niceStep(range) {
    const raw = range / 4;
    const pow = 10 ** Math.floor(Math.log10(raw || 1));
    return [1, 2, 2.5, 5, 10].map(m => m * pow).find(s => s >= raw) || raw;
  }

  /* points: [{label, load, quality}] em ordem cronológica; next: carga sugerida ou null */
  function loadChart(container, points, next) {
    container.replaceChildren();
    if (!points.length) return;
    const W = Math.round(Math.max(340, Math.min(720, container.clientWidth || 720))), H = W < 500 ? 220 : 250, L = 46, R = 40, T = 24, B = 40;
    const loads = points.map(p => p.load).concat(next != null ? [next] : []);
    let min = Math.min(...loads), max = Math.max(...loads);
    if (max - min < 4) { min -= 2; max += 2; }
    const step = niceStep(max - min);
    min = Math.max(0, Math.floor(min / step) * step);
    max = Math.ceil(max / step) * step;
    const count = points.length + (next != null ? 1 : 0);
    const x = i => L + (count === 1 ? (W - L - R) / 2 : i * (W - L - R) / (count - 1));
    const y = v => T + (1 - (v - min) / (max - min || 1)) * (H - T - B);

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Carga por treino' });
    const defs = el('defs');
    const grad = el('linearGradient', { id: 'area', x1: 0, y1: 0, x2: 0, y2: 1 });
    grad.append(el('stop', { offset: '0%', 'stop-color': '#d7fa70', 'stop-opacity': '.22' }));
    grad.append(el('stop', { offset: '100%', 'stop-color': '#d7fa70', 'stop-opacity': '0' }));
    defs.append(grad);
    svg.append(defs);

    const grid = el('g', { class: 'grid' });
    for (let v = min; v <= max + 1e-9; v += step) {
      grid.append(el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v) }));
      grid.append(el('text', { x: L - 8, y: y(v) + 4, 'text-anchor': 'end' }, v.toLocaleString('pt-BR') + ''));
    }
    grid.append(el('text', { x: 4, y: 14 }, 'kg'));
    svg.append(grid);

    const coords = points.map((p, i) => [x(i), y(p.load)]);
    const line = coords.map((c, i) => (i ? 'L' : 'M') + c[0].toFixed(1) + ' ' + c[1].toFixed(1)).join(' ');
    if (coords.length > 1) {
      svg.append(el('path', { d: `${line} L${coords.at(-1)[0]} ${H - B} L${coords[0][0]} ${H - B} Z`, fill: 'url(#area)' }));
    }
    svg.append(el('path', { d: line, fill: 'none', stroke: '#d7fa70', 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));

    if (next != null) {
      const nx = x(points.length), ny = y(next);
      const [lx, ly] = coords.at(-1);
      svg.append(el('path', { d: `M${lx} ${ly} L${nx} ${ny}`, stroke: '#d7fa70', 'stroke-width': 2.5, 'stroke-dasharray': '6 6', fill: 'none' }));
      svg.append(el('circle', { cx: nx, cy: ny, r: 7, fill: '#0d1014', stroke: '#d7fa70', 'stroke-width': 2.5 }));
      svg.append(el('text', { x: nx - 12, y: ny - 12, 'text-anchor': 'end', style: 'fill:#d7fa70;font-weight:700' }, next.toLocaleString('pt-BR') + ' kg'));
      svg.append(el('text', { x: nx, y: H - B + 20, 'text-anchor': 'middle', style: 'fill:#d7fa70' }, 'próximo'));
    }

    const labelEvery = Math.ceil(points.length / Math.max(3, Math.floor(W / 90)));
    points.forEach((p, i) => {
      const [cx, cy] = coords[i];
      const dot = el('circle', { cx, cy, r: 6, fill: qualityColor(p.quality), stroke: '#0d1014', 'stroke-width': 2 });
      dot.append(el('title', {}, `${p.label}: ${p.load} kg · qualidade ${p.quality ?? '—'}%`));
      svg.append(dot);
      if (i % labelEvery === 0 || i === points.length - 1) {
        svg.append(el('text', { x: cx, y: H - B + 20, 'text-anchor': 'middle' }, p.label));
      }
    });

    container.append(svg);
    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    legend.innerHTML = [['#5ee6a0', 'qualidade ≥ 85%'], ['#ffb547', '60 a 84%'], ['#ff6b6b', 'abaixo de 60%'], [null, 'carga sugerida']]
      .map(([c, t]) => c ? `<span><i style="background:${c}"></i>${t}</span>` : `<span><i class="ring"></i>${t}</span>`).join('');
    container.append(legend);
  }

  return { loadChart, qualityColor };
})();
