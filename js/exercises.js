/* Spotter Virtual · definição dos exercícios do MVP
 *
 * Cada exercício descreve:
 *  - primary: as 3 articulações cujo ângulo conta a repetição (vértice no meio);
 *  - enter/exit/partial: limites angulares (graus) da repetição;
 *  - order: posição inicial e posição final da repetição;
 *  - increment: quanto a carga sobe quando a execução está sólida;
 *  - rules: correções de postura avaliadas durante a série.
 *
 * Os limites são experimentais e servem para demonstração (sem validação biomecânica).
 * Índices de articulação seguem o MediaPipe Pose (lado esquerdo; o direito é +1).
 */
window.SV = window.SV || {};

SV.JOINTS = { nose: 0, shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27 };

SV.EXERCISES = {
  squat: {
    key: 'squat',
    name: 'Agachamento livre',
    short: 'Agachamento',
    joint: 'joelho',
    primary: ['hip', 'knee', 'ankle'],
    enter: 108, exit: 155, partial: 136,
    order: ['exit', 'enter'],          // começa em pé (estendido) e desce
    eccentricOnOutbound: true,         // a descida acontece na ida
    increment: 2.5,
    defaultLoad: 40,
    framing: 'Câmera de lado, na altura do quadril. Quadril, joelho e tornozelo precisam aparecer.',
    rules: [
      {
        id: 'torso',
        label: 'tronco inclinado',
        // Inclinação do tronco em relação à vertical durante a repetição.
        when: 'rep',
        test: m => m.torsoLean !== undefined && m.torsoLean > 58,
        cue: 'Peito aberto. Seu tronco inclinou demais para a frente.'
      }
    ],
    partialCue: 'Desça mais. A repetição ficou curta e não contou.'
  },
  bench: {
    key: 'bench',
    name: 'Supino',
    short: 'Supino',
    joint: 'cotovelo',
    primary: ['shoulder', 'elbow', 'wrist'],
    enter: 102, exit: 150, partial: 130,
    order: ['exit', 'enter'],
    eccentricOnOutbound: true,
    increment: 2,
    defaultLoad: 30,
    framing: 'Câmera de lado, na altura do banco. Ombro, cotovelo e punho precisam aparecer.',
    rules: [
      {
        id: 'wrist',
        label: 'punho desalinhado',
        // Antebraço deve ficar perto da vertical na parte baixa do movimento.
        when: 'rep',
        test: (m, cfg) => m.forearmTilt !== undefined && m.primary < cfg.partial && m.forearmTilt > 25,
        cue: 'Alinhe o punho sobre o cotovelo ao descer a barra.'
      }
    ],
    partialCue: 'Leve a barra até perto do peito. Essa não contou.'
  },
  deadlift: {
    key: 'deadlift',
    name: 'Levantamento terra',
    short: 'Terra',
    joint: 'quadril',
    primary: ['shoulder', 'hip', 'knee'],
    enter: 119, exit: 155, partial: 140,
    order: ['enter', 'exit'],          // começa flexionado e sobe até travar o quadril
    eccentricOnOutbound: false,
    increment: 2.5,
    defaultLoad: 50,
    framing: 'Câmera de lado. Ombro, quadril, joelho e tornozelo precisam aparecer.',
    rules: [
      {
        id: 'hips',
        label: 'quadril subiu primeiro',
        // Só na subida: joelho quase estendido com o quadril ainda muito flexionado.
        // (Na descida, levar o quadril para trás com o joelho estendido é o padrão correto.)
        when: 'outbound',
        test: m => m.knee !== undefined && m.knee > 160 && m.primary < 130,
        cue: 'Suba quadril e peito juntos. O quadril subiu antes.'
      }
    ],
    partialCue: 'Estenda o quadril por completo no topo. Essa não contou.'
  }
};

/* Descida mais rápida que isso (segundos) gera o aviso de ritmo. */
SV.MIN_ECCENTRIC = 0.4;
