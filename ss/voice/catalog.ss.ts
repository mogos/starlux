// Pure 4-target Starscript Voice Style Catalog (all 28 styles across 5 families).
// Zero runtime dependencies; TS, Rust, WASM, C17 identical.

export const VOICE_STYLE_COUNT = 28;

export const PRIM_KIND_DOT = 0;
export const PRIM_KIND_BAR = 1;
export const PRIM_KIND_RIBBON = 2;
export const PRIM_KIND_RADIAL = 3;
export const PRIM_KIND_FIELD = 4;

export type VoiceStyleMeta = {
  readonly id: number;
  readonly slug: string;
  readonly name: string;
  readonly family: string;
  readonly semanticDescription: string;
  readonly minWidthPx: number;
  readonly compactSafe: boolean;
  readonly primitiveKind: number;
  readonly primitiveCount: number;
};

export function getVoiceStyleMeta(id: number): VoiceStyleMeta {
  // Family A: Cadence & Dots (0..5)
  if (id === 0) return { id: 0, slug: "amber-bead-cadence", name: "Amber Bead Cadence", family: "cadence-dots", semanticDescription: "Canonical 12-bead warm amber cadence undulating in organic syllabic arch", minWidthPx: 140, compactSafe: true, primitiveKind: PRIM_KIND_DOT, primitiveCount: 12 };
  if (id === 1) return { id: 1, slug: "sol-dot-constellation", name: "Sol Dot Constellation", family: "cadence-dots", semanticDescription: "16 golden-angle Fibonacci constellation dots breathing with 8-band vocal energy", minWidthPx: 120, compactSafe: true, primitiveKind: PRIM_KIND_DOT, primitiveCount: 16 };
  if (id === 2) return { id: 2, slug: "braille-cadence-matrix", name: "Braille Cadence Matrix", family: "cadence-dots", semanticDescription: "3x8 tactile Braille-inspired cadence dots lit by spectral tiers", minWidthPx: 128, compactSafe: true, primitiveKind: PRIM_KIND_DOT, primitiveCount: 24 };
  if (id === 3) return { id: 3, slug: "pendulum-pearls", name: "Pendulum Pearls", family: "cadence-dots", semanticDescription: "10 phase-coupled pendulum pearls swinging vertically with spring damping", minWidthPx: 120, compactSafe: true, primitiveKind: PRIM_KIND_DOT, primitiveCount: 10 };
  if (id === 4) return { id: 4, slug: "horizon-spark-ticks", name: "Horizon Spark Ticks", family: "cadence-dots", semanticDescription: "16 crisp horizon spark ticks flaring upward on syllable onsets", minWidthPx: 140, compactSafe: true, primitiveKind: PRIM_KIND_DOT, primitiveCount: 16 };
  if (id === 5) return { id: 5, slug: "morse-ember-pulse", name: "Morse Ember Pulse", family: "cadence-dots", semanticDescription: "12 horizontal dot-dash ember pulses modulated by zero-crossing cadence", minWidthPx: 140, compactSafe: true, primitiveKind: PRIM_KIND_DOT, primitiveCount: 12 };

  // Family B: Harmonic Bars & Acoustic EQ (6..11)
  if (id === 6) return { id: 6, slug: "sunlit-eq-bars", name: "Sunlit EQ Bars", family: "harmonic-bars", semanticDescription: "16 warm sunlit equalizer bars interpolated across the 8 Goertzel vocal bands", minWidthPx: 140, compactSafe: true, primitiveKind: PRIM_KIND_BAR, primitiveCount: 16 };
  if (id === 7) return { id: 7, slug: "glass-prism-columns", name: "Glass Prism Columns", family: "harmonic-bars", semanticDescription: "12 optical starlight-glass columns with center specular warmth gradient", minWidthPx: 136, compactSafe: true, primitiveKind: PRIM_KIND_BAR, primitiveCount: 12 };
  if (id === 8) return { id: 8, slug: "mirror-horizon-eq", name: "Mirror Horizon EQ", family: "harmonic-bars", semanticDescription: "16 symmetric bars mirrored above and below the vocal horizon", minWidthPx: 140, compactSafe: true, primitiveKind: PRIM_KIND_BAR, primitiveCount: 16 };
  if (id === 9) return { id: 9, slug: "kinetic-spring-pillars", name: "Kinetic Spring Pillars", family: "harmonic-bars", semanticDescription: "10 broad kinetic pillars absorbing onset impulse with spring rebound", minWidthPx: 128, compactSafe: true, primitiveKind: PRIM_KIND_BAR, primitiveCount: 10 };
  if (id === 10) return { id: 10, slug: "stepped-telemetry-vu", name: "Stepped Telemetry VU", family: "harmonic-bars", semanticDescription: "24 precision stepped VU telemetry blocks in 8 columns by 3 amplitude tiers", minWidthPx: 140, compactSafe: true, primitiveKind: PRIM_KIND_BAR, primitiveCount: 24 };
  if (id === 11) return { id: 11, slug: "slit-aperture-bars", name: "Slit Aperture Bars", family: "harmonic-bars", semanticDescription: "14 razor-thin optical slit bars expanding outward from the center axis", minWidthPx: 132, compactSafe: true, primitiveKind: PRIM_KIND_BAR, primitiveCount: 14 };

  // Family C: Organic Waves & Ribbons (12..17)
  if (id === 12) return { id: 12, slug: "solar-filament-ribbon", name: "Solar Filament Ribbon", family: "waves-ribbons", semanticDescription: "24 luminous solar filament control nodes weaving multi-harmonic voice waves", minWidthPx: 160, compactSafe: true, primitiveKind: PRIM_KIND_RIBBON, primitiveCount: 24 };
  if (id === 13) return { id: 13, slug: "liquid-mercury-wave", name: "Liquid Mercury Wave", family: "waves-ribbons", semanticDescription: "24 dense fluid wave crests driven by low formant swell and crisp overtones", minWidthPx: 160, compactSafe: true, primitiveKind: PRIM_KIND_RIBBON, primitiveCount: 24 };
  if (id === 14) return { id: 14, slug: "calligraphic-twin-wave", name: "Calligraphic Twin Wave", family: "waves-ribbons", semanticDescription: "24 counter-phase calligraphic ribbon nodes with variable stroke pressure", minWidthPx: 160, compactSafe: false, primitiveKind: PRIM_KIND_RIBBON, primitiveCount: 24 };
  if (id === 15) return { id: 15, slug: "whisper-dunes", name: "Whisper Dunes", family: "waves-ribbons", semanticDescription: "20 calm low-frequency acoustic dune contours ideal for quiet listening", minWidthPx: 150, compactSafe: true, primitiveKind: PRIM_KIND_RIBBON, primitiveCount: 20 };
  if (id === 16) return { id: 16, slug: "dual-helix-lissajous", name: "Dual Helix Lissajous", family: "waves-ribbons", semanticDescription: "24 braided double-helix Lissajous nodes oscillating in 3:2 vocal ratio", minWidthPx: 160, compactSafe: false, primitiveKind: PRIM_KIND_RIBBON, primitiveCount: 24 };
  if (id === 17) return { id: 17, slug: "horizon-breath-line", name: "Horizon Breath Line", family: "waves-ribbons", semanticDescription: "20 minimalist taut string nodes bowing softly with each spoken phrase", minWidthPx: 140, compactSafe: true, primitiveKind: PRIM_KIND_RIBBON, primitiveCount: 20 };

  // Family D: Radial, Corona & Orbital (18..22)
  if (id === 18) return { id: 18, slug: "sun-corona-ring", name: "Sun Corona Ring", family: "radial-corona", semanticDescription: "24 amber solar corona perimeter flares reacting to live spectral harmonics", minWidthPx: 112, compactSafe: true, primitiveKind: PRIM_KIND_RADIAL, primitiveCount: 24 };
  if (id === 19) return { id: 19, slug: "concentric-acoustic-ripples", name: "Concentric Acoustic Ripples", family: "radial-corona", semanticDescription: "12 expanding concentric acoustic pressure rings launched by syllable onsets", minWidthPx: 112, compactSafe: true, primitiveKind: PRIM_KIND_RADIAL, primitiveCount: 12 };
  if (id === 20) return { id: 20, slug: "sunburst-spokes", name: "Sunburst Spokes", family: "radial-corona", semanticDescription: "16 radial sunburst spokes extending proportionally to vocal band energy", minWidthPx: 112, compactSafe: true, primitiveKind: PRIM_KIND_RADIAL, primitiveCount: 16 };
  if (id === 21) return { id: 21, slug: "orbital-eclipse-arcs", name: "Orbital Eclipse Arcs", family: "radial-corona", semanticDescription: "12 curved orbital eclipse arcs precessing at state-specific angular velocity", minWidthPx: 120, compactSafe: false, primitiveKind: PRIM_KIND_RADIAL, primitiveCount: 12 };
  if (id === 22) return { id: 22, slug: "chladni-resonance-ring", name: "Chladni Resonance Ring", family: "radial-corona", semanticDescription: "24 standing-wave Chladni nodal ring points sculpted by harmonic mode number", minWidthPx: 120, compactSafe: false, primitiveKind: PRIM_KIND_RADIAL, primitiveCount: 24 };

  // Family E: Volumetric, Optical & Material Fields (23..27)
  if (id === 23) return { id: 23, slug: "ferrofluid-amber-blob", name: "Ferrofluid Amber Blob", family: "optical-fields", semanticDescription: "20 sculpted ferrofluid amber contour lobes spiking along spectral peaks", minWidthPx: 120, compactSafe: false, primitiveKind: PRIM_KIND_FIELD, primitiveCount: 20 };
  if (id === 24) return { id: 24, slug: "caustic-light-band", name: "Caustic Light Band", family: "optical-fields", semanticDescription: "18 refracted optical caustic focal nodes shimmering across a dark trough", minWidthPx: 150, compactSafe: true, primitiveKind: PRIM_KIND_FIELD, primitiveCount: 18 };
  if (id === 25) return { id: 25, slug: "ember-spark-swarm", name: "Ember Spark Swarm", family: "optical-fields", semanticDescription: "20 buoyant amber ember sparks lifted by onset transients and speech energy", minWidthPx: 140, compactSafe: false, primitiveKind: PRIM_KIND_FIELD, primitiveCount: 20 };
  if (id === 26) return { id: 26, slug: "waterfall-spectrogram", name: "Waterfall Spectrogram", family: "optical-fields", semanticDescription: "24 three-depth rolling waterfall spectrogram tiles across 8 vocal bands", minWidthPx: 148, compactSafe: true, primitiveKind: PRIM_KIND_FIELD, primitiveCount: 24 };
  return { id: 27, slug: "crystalline-chime-petals", name: "Crystalline Chime Petals", family: "optical-fields", semanticDescription: "16 symmetric 8-fold crystalline optical petals blooming on speech and confirm", minWidthPx: 120, compactSafe: true, primitiveKind: PRIM_KIND_FIELD, primitiveCount: 16 };
}

export function findVoiceStyleBySlug(slug: string): number {
  for (let i = 0; i < 28; i++) {
    if (getVoiceStyleMeta(i).slug === slug) {
      return i;
    }
  }
  return -1;
}

export function getAllVoiceStyles(): readonly VoiceStyleMeta[] {
  const out: VoiceStyleMeta[] = [];
  for (let i = 0; i < 28; i++) {
    out.push(getVoiceStyleMeta(i));
  }
  return out;
}
