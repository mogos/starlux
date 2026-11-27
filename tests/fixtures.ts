import type { PhysicsInput } from "../ss/physics/simulator.ss.ts";
import type { DomHost } from "../src/dom/controller.ts";

export const input: PhysicsInput = {
  targetX: 12, targetY: 12, neighborHomeX: 28, neighborHomeY: 23, pushActive: true,
  field: { x: 8, y: 9, edge: true, corner: true, enabled: true },
  bounds: { enabled: true, minX: 0, maxX: 180, minY: 0, maxY: 140 },
};

class TrackedTarget extends EventTarget {
  readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean) {
    super.addEventListener(type, listener, options);
    if (listener === null) return;
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean) {
    super.removeEventListener(type, listener, options);
    if (listener !== null) this.listeners.get(type)?.delete(listener);
  }

  get count() {
    return Array.from(this.listeners.values()).reduce((sum, listeners) => sum + listeners.size, 0);
  }
}

class FakePane extends TrackedTarget {
  capture: number | undefined;
  setPointerCapture(pointerId: number) { this.capture = pointerId; }
  hasPointerCapture(pointerId: number) { return this.capture === pointerId; }
  releasePointerCapture() { this.capture = undefined; }
}

export function fakeDom() {
  const pane = new FakePane();
  const document = Object.assign(new TrackedTarget(), { hidden: false });
  const window = new TrackedTarget();
  const media = Object.assign(new TrackedTarget(), { matches: false });
  const scheduled = new Map<number, FrameRequestCallback>();
  const cancelled: FrameRequestCallback[] = [];
  let time = 0;
  let serial = 0;
  const host: DomHost = {
    window, document, reducedMotion: media,
    now: () => time,
    requestFrame(callback) {
      const handle = ++serial;
      scheduled.set(handle, callback);
      return handle;
    },
    cancelFrame(handle) {
      const callback = scheduled.get(handle);
      if (callback !== undefined) cancelled.push(callback);
      scheduled.delete(handle);
    },
  };
  return {
    host, window, document, media, scheduled, cancelled, pane,
    element: pane as unknown as HTMLElement,
    listenerCount: () => pane.count + document.count + window.count + media.count,
    pointer(type: string, x: number, y: number, pointerId = 7) {
      const event = new Event(type);
      Object.defineProperties(event, {
        timeStamp: { value: time }, pointerId: { value: pointerId }, button: { value: 0 },
        isPrimary: { value: true }, clientX: { value: x }, clientY: { value: y },
      });
      (type === "pointerdown" ? pane : window).dispatchEvent(event);
    },
    advance(milliseconds: number) {
      const stop = time + milliseconds;
      // Advance browser refresh independently of the controller's queue.
      while (time < stop) {
        time = Math.min(stop, time + 1000 / 60);
        const pending = [...scheduled];
        for (const [id, callback] of pending) {
          if (scheduled.delete(id)) callback(time);
        }
      }
    },
  };
}
