import { defaultSpatialKnobs } from "../ss/lux/knobs.ss.ts";
import { initialBody, launchBody, stepPhysics } from "../ss/physics/simulator.ss.ts";

export function main(dtUs: number): readonly number[] {
  const knobs = defaultSpatialKnobs();
  let state = launchBody(initialBody(-11, -8, 28, 23), -11, -8, 30, -15);
  const trace: number[] = [];
  for (let i = 0; i < 500; i++) {
    let goalX = 12;
    let goalY = 12;
    if (i >= 185 && i < 290) {
      goalX = 130;
      goalY = 90;
    }
    if (i === 185) state = launchBody(state, state.x, state.y, 1800, -650);
    state = stepPhysics(state, {
      targetX: goalX, targetY: goalY, neighborHomeX: 28, neighborHomeY: 23, pushActive: i < 120,
      field: { x: 8, y: 9, edge: true, corner: true, enabled: true },
      bounds: { enabled: true, minX: 0, maxX: 180, minY: 0, maxY: 140 },
    }, dtUs, knobs);
    trace.push(state.x);
    trace.push(state.y);
    trace.push(state.vx);
    trace.push(state.vy);
    trace.push(state.neighborX);
    trace.push(state.neighborY);
    trace.push(state.neighborVx);
    trace.push(state.neighborVy);
    trace.push(state.torque);
    trace.push(state.accumUs);
    let events = 0;
    if (state.snapped) events += 1;
    if (state.snapEngaged) events += 2;
    if (state.snapReleased) events += 4;
    if (state.boundaryHit) events += 8;
    if (state.resting) events += 16;
    trace.push(events);
  }
  return trace;
}
