/* Spotter Virtual · câmera e modelo de pose (MediaPipe Pose Landmarker)
 * O modelo roda no próprio navegador (edge). O vídeo não é gravado nem enviado.
 */
SV.camera = (() => {
  const BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21';
  const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
  let modelPromise;

  function loadModel() {
    if (!modelPromise) {
      modelPromise = (async () => {
        const { FilesetResolver, PoseLandmarker } = await import(BASE + '/vision_bundle.mjs');
        const vision = await FilesetResolver.forVisionTasks(BASE + '/wasm');
        return PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL },
          runningMode: 'VIDEO',
          numPoses: 1
        });
      })().catch(error => { modelPromise = undefined; throw error; });
    }
    return modelPromise;
  }

  function withTimeout(promise, ms) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms); })
    ]).finally(() => clearTimeout(timer));
  }

  /* Abre câmera + modelo. onStatus recebe mensagens de progresso.
     Retorna { stream, model } ou lança um erro com .stage = 'support' | 'camera' | 'model'. */
  async function open(onStatus) {
    if (!navigator.mediaDevices?.getUserMedia) {
      const e = new Error('Sem suporte'); e.stage = 'support'; throw e;
    }
    onStatus('Autorize o acesso à câmera no navegador.');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } }
      });
    } catch (err) {
      err.stage = 'camera'; throw err;
    }
    onStatus('Carregando o modelo de pose. Aguarde alguns segundos.');
    try {
      const model = await withTimeout(loadModel(), 25000);
      return { stream, model };
    } catch (err) {
      stream.getTracks().forEach(t => t.stop());
      if (err.message === 'timeout') modelPromise = undefined;
      err.stage = 'model'; throw err;
    }
  }

  /* Loop de análise: chama onFrame(landmarks, w, h, now) ~15 vezes por segundo. */
  function run(video, stream, model, { onFrame, onEnded, onError }) {
    let raf = 0, previous = -1, last = -Infinity, alive = true;
    function frame(now) {
      if (!alive) return;
      if (stream.getVideoTracks().every(t => t.readyState === 'ended')) { alive = false; onEnded(); return; }
      try {
        if (video.readyState >= 2 && previous !== video.currentTime && now - last >= 65) {
          previous = video.currentTime;
          last = now;
          const { landmarks } = model.detectForVideo(video, now);
          onFrame(landmarks[0] || [], video.videoWidth, video.videoHeight, now);
        }
      } catch (err) {
        alive = false; onError(err); return;
      }
      if (alive) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }

  return { loadModel, open, run };
})();
