import { magneticEdgeZone, magneticMonitorHandoff, magneticPresetSlot, magneticZoneRect } from "../ss/magnetic_layout.ss.ts";
import { planMagneticNeighbors } from "../ss/magnetic_neighbors.ss.ts";
import { magneticFrameFlat } from "../ss/magnetic_abi.ss.ts";
import {
  createMagneticWindow, magneticAudit, magneticPickup, magneticPose, magneticSnapAnomaly,
  magneticVisibility, retargetMagneticWindow, stepMagneticWindow,
} from "../ss/magnetic_tiling.ss.ts";

export function main(dtUs: number): readonly number[] {
  let state = createMagneticWindow({ x: 45, y: 60, w: 480, h: 310 }, false);
  const dock = { x: 530, y: 860, z: 60, size: 44 };
  let pose = magneticPose(state, dock);
  const trace: number[] = [];
  let anomalies = 0;
  for (let i = 0; i < 560; i++) {
    if (i === 0) state = retargetMagneticWindow(state, { x: 73, y: 120, w: 550, h: 420 }, 0.52, 1, false, false);
    if (i === 36) state = magneticPickup(state, true, 1);
    if (i === 55) state = magneticPickup(state, false, 0);
    if (i === 70 || i === 290) state = magneticVisibility(state, true);
    if (i === 165 || i === 430) state = magneticVisibility(state, false);
    const next = stepMagneticWindow(state, dtUs);
    state = next.state;
    const prev = pose;
    pose = magneticPose(state, dock);
    if (magneticSnapAnomaly(prev, pose, dtUs)) anomalies += 1;
    trace.push(pose.cx);
    trace.push(pose.cy);
    trace.push(pose.z);
    trace.push(pose.sx);
    trace.push(pose.sy);
    trace.push(pose.glass);
    trace.push(pose.content);
    trace.push(pose.sheen);
    trace.push(pose.pulse);
    trace.push(pose.vx);
    trace.push(pose.vy);
    trace.push(next.absorb ? 1 : 0);
    trace.push(next.release ? 1 : 0);
  }
  trace.push(magneticAudit(state, pose, anomalies));
  const screen = { x: 0, y: 0, w: 1440, h: 900 };
  const otherScreen = { x: 1440, y: 0, w: 1000, h: 900 };
  trace.push(magneticMonitorHandoff(screen, otherScreen, 1455, 500, 24) ? 1 : 0);
  trace.push(magneticMonitorHandoff(screen, otherScreen, 1470, 500, 24) ? 1 : 0);
  trace.push(magneticEdgeZone(screen, 720, 15, 0, 1));
  for (let z = 1; z <= 15; z++) {
    const rect = magneticZoneRect(screen, z);
    trace.push(rect.x);
    trace.push(rect.y);
    trace.push(rect.w);
    trace.push(rect.h);
    const push = planMagneticNeighbors(screen, z, [
      { id: 1, rect: { x: 100, y: 80, w: 440, h: 480 } },
      { id: 2, rect: { x: 240, y: 160, w: 440, h: 500 } },
      { id: 3, rect: { x: 780, y: 120, w: 400, h: 720 } },
    ]);
    trace.push(push.length);
    for (let n = 0; n < 3; n++) {
      const p = push[n];
      if (p === undefined) break;
      trace.push(p.id);
      trace.push(p.rect.x);
      trace.push(p.rect.y);
      trace.push(p.rect.w);
      trace.push(p.rect.h);
    }
  }
  for (let p = 1; p <= 8; p++) {
    for (let i = 0; i < 7; i++) {
      const rect = magneticPresetSlot(screen, p, i, 7);
      trace.push(rect.x);
      trace.push(rect.y);
      trace.push(rect.w);
      trace.push(rect.h);
    }
  }
  const input: number[] = [];
  for (let i = 0; i < 76; i++) input.push(0);
  input[4] = 480;
  input[5] = 310;
  input[10] = 530;
  input[11] = 860;
  input[12] = 60;
  input[13] = 44;
  const frame = magneticFrameFlat(input);
  trace.push(frame.length);
  for (let i = 0; i < 93; i++) trace.push(frame[i] ?? -999);

  return trace;
}
