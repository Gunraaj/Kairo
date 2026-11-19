/**
 * Keeps a display from dimming or sleeping while the timer is on screen. Two independent
 * measures, because support differs by device (a Chromecast's browser engine may ignore either):
 *  1. The Screen Wake Lock API, re-requested whenever the page becomes visible again.
 *  2. A muted, looping video fed by a tiny canvas that changes every few seconds. Playing media
 *     counts as activity for most screensavers and idle timers.
 * Google TV's own screensaver ("ambient mode") is a device setting that web pages cannot always
 * override, so the TV menu also tells people where to turn it off.
 */

type WakeLockSentinel = { release: () => Promise<void>; addEventListener: (type: 'release', fn: () => void) => void };
type WakeLockApi = { request: (type: 'screen') => Promise<WakeLockSentinel> };

export const startKeepAwake = (): (() => void) => {
  if (typeof document === 'undefined') return () => undefined;
  let stopped = false;
  let lock: WakeLockSentinel | null = null;

  const acquire = async () => {
    const api = (navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock;
    if (!api || stopped || document.visibilityState !== 'visible' || lock) return;
    try {
      lock = await api.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } catch { /* not allowed on this device */ }
  };
  const onVisible = () => { void acquire(); };
  document.addEventListener('visibilitychange', onVisible);
  void acquire();

  let video: HTMLVideoElement | null = null;
  let tick: number | undefined;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    const capture = (canvas as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream }).captureStream;
    if (ctx && capture) {
      const draw = () => { ctx.fillStyle = `rgb(${(Date.now() / 1000) % 2 < 1 ? 1 : 0},0,0)`; ctx.fillRect(0, 0, 16, 16); };
      draw();
      video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute('aria-hidden', 'true');
      video.style.cssText = 'position:fixed;width:2px;height:2px;opacity:0.01;pointer-events:none;bottom:0;right:0';
      video.srcObject = capture.call(canvas, 2);
      document.body.appendChild(video);
      void video.play().catch(() => undefined);
      tick = window.setInterval(draw, 4000);
    }
  } catch { /* video keep-alive unsupported */ }

  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisible);
    void lock?.release().catch(() => undefined);
    lock = null;
    if (tick) window.clearInterval(tick);
    if (video) { video.pause(); video.srcObject = null; video.remove(); }
  };
};
