export type LuxEventKind =
  "IMPULSE" | "SNAP_ENGAGE" | "SNAP_RELEASE" | "BOUNDARY_HIT" | "SETTLE" | "VOICE_LEVEL" | "OS_STATE_CHANGE";
export type LuxEvent = {
  readonly kind: LuxEventKind;
  readonly timeUs: number;
  readonly intensity: number;
  readonly subject: number;
};
export type LuxEventQueue = {
  readonly pending: readonly LuxEvent[];
  readonly draining: boolean;
  readonly dropped: number;
};
export type EventRead = { readonly queue: LuxEventQueue; readonly event: LuxEvent; readonly ready: boolean };

export function maxEvents(): number { return 16; }

export function createEventQueue(): LuxEventQueue {
  return { pending: [], draining: false, dropped: 0 };
}

export function enqueueEvent(queue: LuxEventQueue, event: LuxEvent): LuxEventQueue {
  if (queue.pending.length >= maxEvents()) {
    return { pending: queue.pending, draining: queue.draining, dropped: queue.dropped + 1 };
  }
  const next: LuxEvent[] = [];
  for (let i = 0; i < 16; i++) {
    if (i >= queue.pending.length) break;
    const pending = queue.pending[i];
    if (pending !== undefined) next.push(pending);
  }
  next.push(event);
  return { pending: next, draining: queue.draining, dropped: queue.dropped };
}

export function beginEventDrain(queue: LuxEventQueue): LuxEventQueue {
  if (queue.draining || queue.pending.length === 0) return queue;
  return { pending: queue.pending, draining: true, dropped: queue.dropped };
}

export function nextEvent(queue: LuxEventQueue): EventRead {
  const first = queue.pending[0];
  if (!queue.draining || first === undefined) {
    const empty: LuxEvent = { kind: "SETTLE", timeUs: 0, intensity: 0, subject: 0 };
    return { queue: { pending: queue.pending, draining: false, dropped: queue.dropped }, event: empty, ready: false };
  }
  const next: LuxEvent[] = [];
  for (let i = 1; i < 16; i++) {
    if (i >= queue.pending.length) break;
    const event = queue.pending[i];
    if (event !== undefined) next.push(event);
  }
  return { queue: { pending: next, draining: true, dropped: queue.dropped }, event: first, ready: true };
}

export function stopEventDrain(queue: LuxEventQueue): LuxEventQueue {
  if (queue.pending.length === 0) return { pending: [], draining: false, dropped: queue.dropped };
  return { pending: [], draining: false, dropped: queue.dropped + queue.pending.length };
}
