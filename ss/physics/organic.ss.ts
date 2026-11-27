import { atan2_64, clamp, clamp01, finiteBound, sin64, cos64 } from "./math.ss.ts";
import type { SpatialPhysicsConfig } from "../lux/knobs.ss.ts";

export type PoseInput = {
  readonly vx: number;
  readonly vy: number;
  readonly cornerTorque: number;
  readonly dragging: boolean;
  readonly frostedGlass: boolean;
  readonly allow3dTiltOnGlass: boolean;
  readonly focused: boolean;
  readonly minimizeU: number;
  readonly dockDx: number;
  readonly dockDy: number;
};

export type WindowPose = {
  readonly tiltX: number;
  readonly tiltY: number;
  readonly bankZ: number;
  readonly yawRadians: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly translateX: number;
  readonly translateY: number;
  readonly translateZ: number;
  readonly perspectivePx: number;
  readonly rimScaleCompensation: number;
  readonly contentOpacity: number;
  readonly glassOpacity: number;
  readonly sheen: number;
  readonly dockImpulse: number;
};

export function windowPose(input: PoseInput, knobs: SpatialPhysicsConfig): WindowPose {
  const vx = finiteBound(input.vx, 12000);
  const vy = finiteBound(input.vy, 12000);
  const u = clamp01(input.minimizeU);
  const perspective = knobs.perspectivePx;
  let tiltX = 0;
  let tiltY = 0;
  let bankZ = 0;
  let yaw = 0;
  let scaleX = 1;
  let scaleY = 1;
  let dx = 0;
  let dy = 0;
  let z = 0;
  let content = 1;
  let glass = 1;
  let sheen = 0;
  let impulse = 0;

  if (knobs.enableOrganicTilt) {
    const tiltScale = knobs.tiltVelocityScale;
    if (!input.frostedGlass || input.allow3dTiltOnGlass) {
      tiltX = finiteBound(-vy * tiltScale, knobs.tiltMaxDegX);
      tiltY = finiteBound(vx * tiltScale, knobs.tiltMaxDegY);
      if (input.dragging) z = knobs.dragLiftZPx;
      else if (!input.focused) z = knobs.focusRecedeZPx;
    }
    bankZ = finiteBound(input.cornerTorque + vx * tiltScale * 0.25, knobs.bankMaxDegZ);
    yaw = atan2_64(vy, vx);
  }
  if (knobs.enableInertialSquash) {
    const stretch = clamp((Math.abs(vx) - Math.abs(vy)) / knobs.squashVelocityDiv,
      -knobs.squashMaxRatio, knobs.squashMaxRatio);
    scaleX += stretch;
    scaleY -= stretch;
  }
  if (knobs.enableEmptyGlassMinimize && u > 0) {
    content = clamp01(1 - u / knobs.minimizeContentClearEnd);
    glass = clamp01((1 - u) / (1 - knobs.minimizeGlassFadeStart));
    const along = finiteBound(input.dockDx, 10000000);
    const across = finiteBound(input.dockDy, 10000000);
    const span = Math.sqrt(along * along + across * across);
    if (span > 0) {
      const bend = clamp(span / knobs.arcCurvatureRadiusPx, 0, 1.5707963267948966);
      const bow = span * (1 - cos64(bend)) * 0.25 * sin64(3.141592653589793 * u);
      dx = along * u - across / span * bow;
      dy = across * u + along / span * bow;
    }
    scaleX *= 1 - 0.82 * u;
    scaleY *= 1 - 0.82 * u;
    const clearStart = knobs.minimizeContentClearStart;
    if (u >= clearStart && u < 1) {
      sheen = knobs.sheenSweepIntensity * sin64(3.141592653589793 * (u - clearStart) / (1 - clearStart));
    }
  }
  if (knobs.enableDockImpulse && u >= 1) {
    impulse = knobs.dockImpulseScale;
  }
  let rim = 1;
  if (knobs.enableSpecularRim) {
    rim = (perspective - z) / (perspective * Math.sqrt(scaleX * scaleY));
  }

  return {
    tiltX: tiltX, tiltY: tiltY, bankZ: bankZ, yawRadians: yaw, scaleX: scaleX, scaleY: scaleY,
    translateX: dx, translateY: dy, translateZ: z, perspectivePx: perspective, rimScaleCompensation: rim,
    contentOpacity: content, glassOpacity: glass, sheen: sheen, dockImpulse: impulse,
  };
}
