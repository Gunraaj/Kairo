/**
 * workerTimer.ts
 * Inline Web Worker clock that bypasses browser background tab throttling.
 * Unlike window.setInterval (which browsers throttle to 1s or freeze when hidden),
 * a Dedicated Worker maintains uninterrupted timing accuracy.
 */

export type WorkerTickHandler = () => void;

class WorkerTimerManager {
  private worker: Worker | null = null;
  private handlers = new Map<number, WorkerTickHandler>();
  private nextId = 1;

  constructor() {
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        const workerCode = `
          const intervals = new Map();
          self.onmessage = function(e) {
            const { action, id, ms } = e.data;
            if (action === 'start') {
              if (intervals.has(id)) clearInterval(intervals.get(id));
              const timer = setInterval(() => {
                self.postMessage({ id });
              }, ms);
              intervals.set(id, timer);
            } else if (action === 'stop') {
              if (intervals.has(id)) {
                clearInterval(intervals.get(id));
                intervals.delete(id);
              }
            } else if (action === 'clearAll') {
              intervals.forEach(t => clearInterval(t));
              intervals.clear();
            }
          };
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        this.worker = new Worker(url);
        URL.revokeObjectURL(url);

        this.worker.onmessage = (event: MessageEvent<{ id: number }>) => {
          const handler = this.handlers.get(event.data.id);
          handler?.();
        };
      } catch {
        this.worker = null;
      }
    }
  }

  setInterval(handler: WorkerTickHandler, ms: number): number {
    const id = this.nextId++;
    this.handlers.set(id, handler);

    if (this.worker) {
      this.worker.postMessage({ action: 'start', id, ms });
    } else {
      // Fallback if Worker is not allowed by environment/CSP or in Node.js
      const timerFn = typeof window !== 'undefined' ? window.setInterval : setInterval;
      const clearFn = typeof window !== 'undefined' ? window.clearInterval : clearInterval;
      const fallbackId = timerFn(handler, ms);
      this.handlers.set(id, () => {
        clearFn(fallbackId as unknown as number);
      });
    }

    return id;
  }

  clearInterval(id: number): void {
    const cleanup = this.handlers.get(id);
    this.handlers.delete(id);
    if (this.worker) {
      this.worker.postMessage({ action: 'stop', id });
    } else {
      cleanup?.();
    }
  }
}

export const workerTimer = new WorkerTimerManager();
