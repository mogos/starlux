import { beginEventDrain, createEventQueue, enqueueEvent, nextEvent, stopEventDrain } from "../ss/lux/events.ss.ts";
import type { LuxEvent } from "../ss/lux/events.ss.ts";

export function createLuxEventBus() {
  let queue = createEventQueue();
  const listeners = new Set<(event: LuxEvent) => void>();

  return {
    subscribe(listener: (event: LuxEvent) => void): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    publish(event: LuxEvent): void {
      queue = enqueueEvent(queue, event);
      if (queue.draining) return;
      queue = beginEventDrain(queue);
      const errors: unknown[] = [];
      try {
        for (let i = 0; i < 256; i++) {
          const next = nextEvent(queue);
          queue = next.queue;
          if (!next.ready) break;
          for (const listener of [...listeners]) {
            try {
              listener(next.event);
            } catch (error) {
              errors.push(error);
            }
          }
        }
      } finally {
        queue = stopEventDrain(queue);
      }
      if (errors.length > 0) throw new AggregateError(errors, "Lux event listeners failed");
    },
    clear(): void {
      listeners.clear();
      queue = { pending: [], draining: queue.draining, dropped: 0 };
    },
    dropped(): number { return queue.dropped; },
  };
}
