import {
  magneticContains, magneticIntersection, magneticRectDistance, magneticStrip, magneticZoneRect,
} from "./magnetic_layout.ss.ts";
import type { MagneticRect } from "./magnetic_tiling.ss.ts";

export type MagneticNeighbor = { readonly id: number; readonly rect: MagneticRect };
type Placement = {
  readonly id: number; readonly rect: MagneticRect; readonly slot: number;
};

function complement(space: MagneticRect, zone: number): readonly MagneticRect[] {
  if (zone === 1 || zone === 2 || zone === 3 || zone === 4) {
    const a = zone === 1 ? 6 : zone === 2 || zone === 4 ? 5 : 7;
    const b = zone === 1 || zone === 3 ? 8 : zone === 2 ? 7 : 6;
    return [magneticZoneRect(space, a), magneticZoneRect(space, b)];
  }
  if (zone >= 5 && zone <= 8) {
    const cells: MagneticRect[] = [];
    for (let i = 5; i <= 8; i++) {
      if (i !== zone) cells.push(magneticZoneRect(space, i));
    }
    return cells;
  }
  if (zone === 9) return [magneticZoneRect(space, 13)];
  if (zone === 10) return [magneticZoneRect(space, 9), magneticZoneRect(space, 11)];
  if (zone === 11) return [magneticZoneRect(space, 12)];
  if (zone === 12) return [magneticZoneRect(space, 11)];
  if (zone === 13) return [magneticZoneRect(space, 9)];
  return [];
}

export function planMagneticNeighbors(
  space: MagneticRect, zone: number, neighbors: readonly MagneticNeighbor[],
): readonly MagneticNeighbor[] {
  const slots = complement(space, zone);
  const results: MagneticNeighbor[] = [];
  if (slots.length === 0) return results;
  const target = magneticZoneRect(space, zone);
  const displaced: MagneticNeighbor[] = [];
  const placements: Placement[] = [];
  const loads = [0, 0, 0];
  const changed = [0, 0, 0];

  for (let i = 0; i < 128; i++) {
    if (i >= neighbors.length) break;
    const n = neighbors[i];
    if (n === undefined) continue;
    if (magneticIntersection(target, n.rect) > 0) {
      displaced.push(n);
      continue;
    }
    let largest = 0;
    let selected = -1;
    for (let c = 0; c < 3; c++) {
      const slot = slots[c];
      if (slot === undefined) break;
      if (magneticContains(slot, n.rect.x + n.rect.w / 2, n.rect.y + n.rect.h / 2)) {
        selected = c;
        break;
      }
      const overlap = magneticIntersection(slot, n.rect);
      if (overlap > largest) { largest = overlap; selected = c; }
    }
    if (selected >= 0) {
      placements.push({ id: n.id, rect: n.rect, slot: selected });
      loads[selected] = (loads[selected] ?? 0) + 1;
    }
  }
  if (displaced.length === 1 && placements.length === 0 && zone <= 4) {
    const n = displaced[0];
    if (n !== undefined) {
      const other = zone % 2 === 0 ? zone - 1 : zone + 1;
      return [{ id: n.id, rect: magneticZoneRect(space, other) }];
    }
  }

  // Largest intersection gets first choice. Prefer the least occupied cell, then proximity.
  const assigned: number[] = [];
  for (let i = 0; i < 128; i++) {
    if (i >= displaced.length) break;
    assigned.push(0);
  }
  for (let i = 0; i < 128; i++) {
    if (i >= displaced.length) break;
    let largest = -1;
    let selected = -1;
    for (let j = 0; j < 128; j++) {
      if (j >= displaced.length) break;
      const n = displaced[j];
      if (n === undefined || assigned[j] === 1) continue;
      const area = magneticIntersection(n.rect, target);
      if (area > largest) { largest = area; selected = j; }
    }
    const n = displaced[selected];
    if (n === undefined) break;
    assigned[selected] = 1;
    let best = 0;
    let bestLoad = 129;
    let bestDist = 0;
    for (let c = 0; c < 3; c++) {
      const slot = slots[c];
      if (slot === undefined) break;
      const count = loads[c] ?? 0;
      const distance = magneticRectDistance(n.rect, slot);
      if (count < bestLoad || (count === bestLoad && distance < bestDist)) {
        best = c; bestLoad = count; bestDist = distance;
      }
    }
    placements.push({ id: n.id, rect: n.rect, slot: best });
    loads[best] = bestLoad + 1;
    changed[best] = 1;
  }

  // An occupant spanning cells joins any affected cell's reflow through its own slot.
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < 128; i++) {
      if (i >= placements.length) break;
      const n = placements[i];
      if (n === undefined || changed[n.slot] === 1) continue;
      for (let c = 0; c < 3; c++) {
        const slot = slots[c];
        if (slot === undefined) break;
        if (changed[c] === 1 && magneticIntersection(slot, n.rect) > 0) changed[n.slot] = 1;
      }
    }
  }

  for (let i = 0; i < 128; i++) {
    if (i >= placements.length) break;
    const n = placements[i];
    if (n === undefined || changed[n.slot] !== 1) continue;
    const slot = slots[n.slot];
    if (slot === undefined) continue;
    const horizontal = slot.w >= slot.h;
    const center = horizontal ? n.rect.x + n.rect.w / 2 : n.rect.y + n.rect.h / 2;
    let rank = 0;
    for (let j = 0; j < 128; j++) {
      if (j >= placements.length) break;
      const other = placements[j];
      if (other === undefined || other.slot !== n.slot) continue;
      const at = horizontal ? other.rect.x + other.rect.w / 2 : other.rect.y + other.rect.h / 2;
      if (at < center || (at === center && j < i)) rank += 1;
    }
    results.push({ id: n.id, rect: magneticStrip(slot, rank, loads[n.slot] ?? 1, horizontal) });
  }
  return results;
}
