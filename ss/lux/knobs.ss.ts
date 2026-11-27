import { clamp } from "../physics/math.ss.ts";

export type FeatureFlags = {
  readonly enableSprings: boolean;
  readonly enableMagnetism: boolean;
  readonly enableRubberBand: boolean;
  readonly enableOrganicTilt: boolean;
  readonly enableInertialSquash: boolean;
  readonly enableEmptyGlassMinimize: boolean;
  readonly enableDockImpulse: boolean;
  readonly enableCoupledNeighbors: boolean;
  readonly enableSpecularRim: boolean;
  readonly enableLivingBackdrop: boolean;
};

export type SpatialPhysicsConfig = {
  // Spring
  readonly springResponseMs: number;
  readonly springDampingRatio: number;
  readonly windowMass: number;
  readonly minimizeResponseMs: number;
  readonly minimizeDamping: number;
  readonly maximizeResponseMs: number;
  readonly settleVelocityEps: number;
  readonly settlePositionEps: number;
  // Magnetism
  readonly magnetRadiusPx: number;
  readonly magnetStrength: number;
  readonly magnetEdgeStrength: number;
  readonly magnetCornerBoost: number;
  readonly magnetBreakawayVel: number;
  readonly magnetSnapThresholdPx: number;
  readonly magnetGhostLeadMs: number;
  readonly magnetNeighborPush: number;
  // Rubber band
  readonly rubberConstant: number;
  readonly rubberMaxOverdragPx: number;
  readonly rubberReboundStiffness: number;
  readonly rubberReboundDamping: number;
  readonly rubberEdgeResistance: number;
  readonly rubberCornerTorque: number;
  // Organic pose
  readonly tiltMaxDegX: number;
  readonly tiltMaxDegY: number;
  readonly bankMaxDegZ: number;
  readonly tiltVelocityScale: number;
  readonly squashMaxRatio: number;
  readonly squashVelocityDiv: number;
  readonly dragLiftZPx: number;
  readonly dockImpulseScale: number;
  // Spatial, minimize, and thermal
  readonly minimizeContentClearStart: number;
  readonly minimizeContentClearEnd: number;
  readonly minimizeGlassFadeStart: number;
  readonly sheenSweepIntensity: number;
  readonly perspectivePx: number;
  readonly maxBackdropBlurPx: number;
  readonly ambientBackdropFpsCap: number;
  readonly thermalLodScale: number;
  // Physical LUX
  readonly settleHoldFrames: number;
  readonly flickDecelerationRate: number;
  readonly flickVelocityClampPxPerS: number;
  readonly snapHysteresisRatio: number;
  readonly arcCurvatureRadiusPx: number;
  readonly focusRecedeZPx: number;
  // Feature flags
  readonly enableSprings: boolean;
  readonly enableMagnetism: boolean;
  readonly enableRubberBand: boolean;
  readonly enableOrganicTilt: boolean;
  readonly enableInertialSquash: boolean;
  readonly enableEmptyGlassMinimize: boolean;
  readonly enableDockImpulse: boolean;
  readonly enableCoupledNeighbors: boolean;
  readonly enableSpecularRim: boolean;
  readonly enableLivingBackdrop: boolean;
};

export type SpatialPreset = "spatial-os" | "crisp-pro" | "organic-her" | "tactile-game" | "reduced-motion" | "off";

export function defaultSpatialKnobs(): SpatialPhysicsConfig {
  return {
    springResponseMs: 360,
    springDampingRatio: 0.8,
    windowMass: 1,
    minimizeResponseMs: 320,
    minimizeDamping: 0.94,
    maximizeResponseMs: 380,
    settleVelocityEps: 0.2,
    settlePositionEps: 0.02,
    magnetRadiusPx: 140,
    magnetStrength: 90,
    magnetEdgeStrength: 76,
    magnetCornerBoost: 1.35,
    magnetBreakawayVel: 1600,
    magnetSnapThresholdPx: 12,
    magnetGhostLeadMs: 38,
    magnetNeighborPush: 0.35,
    rubberConstant: 90,
    rubberMaxOverdragPx: 120,
    rubberReboundStiffness: 130,
    rubberReboundDamping: 24,
    rubberEdgeResistance: 0.8,
    rubberCornerTorque: 0.65,
    tiltMaxDegX: 8,
    tiltMaxDegY: 10,
    bankMaxDegZ: 4,
    tiltVelocityScale: 0.012,
    squashMaxRatio: 0.14,
    squashVelocityDiv: 5500,
    dragLiftZPx: 18,
    dockImpulseScale: 0.6,
    minimizeContentClearStart: 0,
    minimizeContentClearEnd: 0.2,
    minimizeGlassFadeStart: 0.56,
    sheenSweepIntensity: 0.75,
    perspectivePx: 1100,
    maxBackdropBlurPx: 16,
    ambientBackdropFpsCap: 15,
    thermalLodScale: 0.7,
    settleHoldFrames: 3,
    flickDecelerationRate: 0.998,
    flickVelocityClampPxPerS: 4500,
    snapHysteresisRatio: 1.35,
    arcCurvatureRadiusPx: 1800,
    focusRecedeZPx: -160,
    enableSprings: true,
    enableMagnetism: true,
    enableRubberBand: true,
    enableOrganicTilt: true,
    enableInertialSquash: true,
    enableEmptyGlassMinimize: true,
    enableDockImpulse: true,
    enableCoupledNeighbors: true,
    enableSpecularRim: true,
    enableLivingBackdrop: true,
  };
}

function knob(value: number, fallback: number, low: number, high: number): number {
  if (value !== value) return fallback;
  return clamp(value, low, high);
}

export function clampSpatialKnobs(config: SpatialPhysicsConfig): SpatialPhysicsConfig {
  const clearEnd = knob(config.minimizeContentClearEnd, 0.2, 0.001, 0.22);
  return {
    springResponseMs: knob(config.springResponseMs, 360, 40, 2000),
    springDampingRatio: knob(config.springDampingRatio, 0.8, 0.25, 4),
    windowMass: knob(config.windowMass, 1, 0.1, 20),
    minimizeResponseMs: knob(config.minimizeResponseMs, 320, 40, 2000),
    minimizeDamping: knob(config.minimizeDamping, 0.94, 0.25, 4),
    maximizeResponseMs: knob(config.maximizeResponseMs, 380, 40, 2000),
    settleVelocityEps: knob(config.settleVelocityEps, 0.2, 0.001, 10),
    settlePositionEps: knob(config.settlePositionEps, 0.02, 0.0001, 2),
    magnetRadiusPx: knob(config.magnetRadiusPx, 140, 8, 800),
    magnetStrength: knob(config.magnetStrength, 90, 0, 400),
    magnetEdgeStrength: knob(config.magnetEdgeStrength, 76, 0, 400),
    magnetCornerBoost: knob(config.magnetCornerBoost, 1.35, 0, 3),
    magnetBreakawayVel: knob(config.magnetBreakawayVel, 1600, 50, 12000),
    magnetSnapThresholdPx: knob(config.magnetSnapThresholdPx, 12, 1, 100),
    magnetGhostLeadMs: knob(config.magnetGhostLeadMs, 38, 0, 200),
    magnetNeighborPush: knob(config.magnetNeighborPush, 0.35, 0, 2),
    rubberConstant: knob(config.rubberConstant, 90, 1, 500),
    rubberMaxOverdragPx: knob(config.rubberMaxOverdragPx, 120, 0, 500),
    rubberReboundStiffness: knob(config.rubberReboundStiffness, 130, 0, 500),
    rubberReboundDamping: knob(config.rubberReboundDamping, 24, 0, 42),
    rubberEdgeResistance: knob(config.rubberEdgeResistance, 0.8, 0, 3),
    rubberCornerTorque: knob(config.rubberCornerTorque, 0.65, 0, 3),
    tiltMaxDegX: knob(config.tiltMaxDegX, 8, 0, 35),
    tiltMaxDegY: knob(config.tiltMaxDegY, 10, 0, 35),
    bankMaxDegZ: knob(config.bankMaxDegZ, 4, 0, 20),
    tiltVelocityScale: knob(config.tiltVelocityScale, 0.012, 0, 0.1),
    squashMaxRatio: knob(config.squashMaxRatio, 0.14, 0, 0.45),
    squashVelocityDiv: knob(config.squashVelocityDiv, 5500, 100, 20000),
    dragLiftZPx: knob(config.dragLiftZPx, 18, 0, 150),
    dockImpulseScale: knob(config.dockImpulseScale, 0.6, 0, 3),
    minimizeContentClearStart: knob(config.minimizeContentClearStart, 0, 0, clearEnd),
    minimizeContentClearEnd: clearEnd,
    minimizeGlassFadeStart: knob(config.minimizeGlassFadeStart, 0.56, 0.22, 0.95),
    sheenSweepIntensity: knob(config.sheenSweepIntensity, 0.75, 0, 1),
    perspectivePx: knob(config.perspectivePx, 1100, 200, 4000),
    maxBackdropBlurPx: knob(config.maxBackdropBlurPx, 16, 0, 16),
    ambientBackdropFpsCap: knob(config.ambientBackdropFpsCap, 15, 0, 15),
    thermalLodScale: knob(config.thermalLodScale, 0.7, 0, 1),
    settleHoldFrames: Math.floor(knob(config.settleHoldFrames, 3, 1, 8)),
    flickDecelerationRate: knob(config.flickDecelerationRate, 0.998, 0.985, 0.9995),
    flickVelocityClampPxPerS: knob(config.flickVelocityClampPxPerS, 4500, 500, 12000),
    snapHysteresisRatio: knob(config.snapHysteresisRatio, 1.35, 1.05, 2),
    arcCurvatureRadiusPx: knob(config.arcCurvatureRadiusPx, 1800, 800, 4000),
    focusRecedeZPx: knob(config.focusRecedeZPx, -160, -600, 0),
    enableSprings: config.enableSprings,
    enableMagnetism: config.enableMagnetism,
    enableRubberBand: config.enableRubberBand,
    enableOrganicTilt: config.enableOrganicTilt,
    enableInertialSquash: config.enableInertialSquash,
    enableEmptyGlassMinimize: config.enableEmptyGlassMinimize,
    enableDockImpulse: config.enableDockImpulse,
    enableCoupledNeighbors: config.enableCoupledNeighbors,
    enableSpecularRim: config.enableSpecularRim,
    enableLivingBackdrop: config.enableLivingBackdrop,
  };
}

export function spatialPreset(name: SpatialPreset): SpatialPhysicsConfig {
  const base = defaultSpatialKnobs();
  let springResponseMs = base.springResponseMs;
  let springDampingRatio = base.springDampingRatio;
  let tiltMaxDegX = base.tiltMaxDegX;
  let tiltMaxDegY = base.tiltMaxDegY;
  let squashMaxRatio = base.squashMaxRatio;
  let dragLiftZPx = base.dragLiftZPx;
  let magnetStrength = base.magnetStrength;
  let magnetNeighborPush = base.magnetNeighborPush;
  let dockImpulseScale = base.dockImpulseScale;
  let enableMagnetism = base.enableMagnetism;
  let enableRubberBand = base.enableRubberBand;
  let enableOrganicTilt = base.enableOrganicTilt;
  let enableInertialSquash = base.enableInertialSquash;
  let enableEmptyGlassMinimize = base.enableEmptyGlassMinimize;
  let enableDockImpulse = base.enableDockImpulse;
  let enableCoupledNeighbors = base.enableCoupledNeighbors;
  let enableSpecularRim = base.enableSpecularRim;
  let enableLivingBackdrop = base.enableLivingBackdrop;
  let enableSprings = base.enableSprings;
  if (name === "crisp-pro") {
    springResponseMs = 220;
    springDampingRatio = 1.08;
    tiltMaxDegX = 4;
    tiltMaxDegY = 5;
    squashMaxRatio = 0.07;
  }
  if (name === "organic-her") {
    springResponseMs = 470;
    springDampingRatio = 0.72;
    tiltMaxDegX = 11;
    tiltMaxDegY = 14;
    dragLiftZPx = 26;
  }
  if (name === "tactile-game") {
    springResponseMs = 180;
    springDampingRatio = 0.65;
    magnetStrength = 125;
    magnetNeighborPush = 0.6;
    dockImpulseScale = 0.9;
  }
  if (name === "reduced-motion") {
    springResponseMs = 160;
    springDampingRatio = 1.2;
    enableMagnetism = false;
    enableRubberBand = false;
    enableOrganicTilt = false;
    enableInertialSquash = false;
    enableEmptyGlassMinimize = false;
    enableDockImpulse = false;
    enableCoupledNeighbors = false;
    enableSpecularRim = false;
    enableLivingBackdrop = false;
  }
  if (name === "off") {
    enableSprings = false;
    enableMagnetism = false;
    enableRubberBand = false;
    enableOrganicTilt = false;
    enableInertialSquash = false;
    enableEmptyGlassMinimize = false;
    enableDockImpulse = false;
    enableCoupledNeighbors = false;
    enableSpecularRim = false;
    enableLivingBackdrop = false;
  }
  return {
    springResponseMs: springResponseMs,
    springDampingRatio: springDampingRatio,
    windowMass: base.windowMass,
    minimizeResponseMs: base.minimizeResponseMs,
    minimizeDamping: base.minimizeDamping,
    maximizeResponseMs: base.maximizeResponseMs,
    settleVelocityEps: base.settleVelocityEps,
    settlePositionEps: base.settlePositionEps,
    magnetRadiusPx: base.magnetRadiusPx,
    magnetStrength: magnetStrength,
    magnetEdgeStrength: base.magnetEdgeStrength,
    magnetCornerBoost: base.magnetCornerBoost,
    magnetBreakawayVel: base.magnetBreakawayVel,
    magnetSnapThresholdPx: base.magnetSnapThresholdPx,
    magnetGhostLeadMs: base.magnetGhostLeadMs,
    magnetNeighborPush: magnetNeighborPush,
    rubberConstant: base.rubberConstant,
    rubberMaxOverdragPx: base.rubberMaxOverdragPx,
    rubberReboundStiffness: base.rubberReboundStiffness,
    rubberReboundDamping: base.rubberReboundDamping,
    rubberEdgeResistance: base.rubberEdgeResistance,
    rubberCornerTorque: base.rubberCornerTorque,
    tiltMaxDegX: tiltMaxDegX,
    tiltMaxDegY: tiltMaxDegY,
    bankMaxDegZ: base.bankMaxDegZ,
    tiltVelocityScale: base.tiltVelocityScale,
    squashMaxRatio: squashMaxRatio,
    squashVelocityDiv: base.squashVelocityDiv,
    dragLiftZPx: dragLiftZPx,
    dockImpulseScale: dockImpulseScale,
    minimizeContentClearStart: base.minimizeContentClearStart,
    minimizeContentClearEnd: base.minimizeContentClearEnd,
    minimizeGlassFadeStart: base.minimizeGlassFadeStart,
    sheenSweepIntensity: base.sheenSweepIntensity,
    perspectivePx: base.perspectivePx,
    maxBackdropBlurPx: base.maxBackdropBlurPx,
    ambientBackdropFpsCap: base.ambientBackdropFpsCap,
    thermalLodScale: base.thermalLodScale,
    settleHoldFrames: base.settleHoldFrames,
    flickDecelerationRate: base.flickDecelerationRate,
    flickVelocityClampPxPerS: base.flickVelocityClampPxPerS,
    snapHysteresisRatio: base.snapHysteresisRatio,
    arcCurvatureRadiusPx: base.arcCurvatureRadiusPx,
    focusRecedeZPx: base.focusRecedeZPx,
    enableSprings: enableSprings,
    enableMagnetism: enableMagnetism,
    enableRubberBand: enableRubberBand,
    enableOrganicTilt: enableOrganicTilt,
    enableInertialSquash: enableInertialSquash,
    enableEmptyGlassMinimize: enableEmptyGlassMinimize,
    enableDockImpulse: enableDockImpulse,
    enableCoupledNeighbors: enableCoupledNeighbors,
    enableSpecularRim: enableSpecularRim,
    enableLivingBackdrop: enableLivingBackdrop,
  };
}
