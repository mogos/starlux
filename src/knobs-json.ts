import { clampSpatialKnobs, defaultSpatialKnobs } from "../ss/lux/knobs.ss.ts";
import type { SpatialPhysicsConfig } from "../ss/lux/knobs.ss.ts";

export function serializeKnobsJson(knobs: SpatialPhysicsConfig): string {
  return JSON.stringify(clampSpatialKnobs(knobs));
}

export function parseKnobsJson(text: string): SpatialPhysicsConfig {
  const input: unknown = JSON.parse(text);
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Spatial knobs must be a JSON object");
  }
  const record = input as Record<string, unknown>;
  const defaults = defaultSpatialKnobs();
  const values: Record<string, number | boolean> = {};
  for (const [key, fallback] of Object.entries(defaults)) {
    const value = Object.hasOwn(record, key) ? record[key] : undefined;
    if (value === undefined) values[key] = fallback;
    else if (typeof value === "number" && typeof fallback === "number") values[key] = value;
    else if (typeof value === "boolean" && typeof fallback === "boolean") values[key] = value;
    else throw new TypeError(`Invalid spatial knob: ${key}`);
  }
  return clampSpatialKnobs(values as SpatialPhysicsConfig);
}
