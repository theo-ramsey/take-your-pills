// Records from the phone's (or computer's) microphone. Used by Gloria's screen and Bonnie's page.

export const canRecord = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

/**
 * Starts recording right away (asks for the microphone the first time).
 * Returns { startedAt, finish(), cancel() }. finish() stops and resolves to { blob, seconds, mime }.
 * Throws if the microphone isn't allowed.
 */
export async function startRecording({ maxSeconds = 15 * 60, onTick, onAutoStop } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  // iPhones record audio/mp4, which every browser can play; use it wherever it's offered.
  const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  recorder.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
  const startedAt = Date.now();
  let timer;
  const stopped = new Promise((resolve) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      clearInterval(timer);
      resolve();
    };
  });
  recorder.start(1000);

  let result;
  const finish = () => {
    result ||= (async () => {
      const seconds = (Date.now() - startedAt) / 1000;
      if (recorder.state !== 'inactive') recorder.stop();
      await stopped;
      const type = recorder.mimeType || mime || 'audio/mp4';
      return { blob: new Blob(chunks, { type }), seconds, mime: type.split(';')[0] };
    })();
    return result;
  };
  const cancel = () => {
    if (recorder.state !== 'inactive') recorder.stop();
  };
  timer = setInterval(() => {
    const s = (Date.now() - startedAt) / 1000;
    onTick?.(s);
    if (s >= maxSeconds) finish().then((r) => onAutoStop?.(r));
  }, 500);
  return { startedAt, finish, cancel };
}

export const MIC_HELP =
  'The microphone is not allowed. When the phone asks, tap Allow. ' +
  'If it does not ask: open Settings → Apps → Safari → Microphone → Allow, then try again.';

/** "Nov 20, 2:22 PM" */
export function noteStamp(iso) {
  const d = new Date(iso);
  const h = d.getHours();
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
