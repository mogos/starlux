import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  type AudioContextLike,
  type AudioHostScheduler,
  StarluxAudioHost,
  audioCeilingS16,
  buildButtonPressRecipe,
  cueIdBySlug,
} from "../src/audio/index.ts";

const ROOT = path.resolve(import.meta.dir, "..");
const MODEL = path.join(ROOT, ".om/audio/starlux_audio.om");
const TWINS_DIR = path.join(ROOT, ".om/audio/twins");

function runOm(args: readonly string[]) {
  const proc = Bun.spawnSync(["om", ...args], { cwd: ROOT });
  return {
    exitCode: proc.exitCode,
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
  };
}

async function replayActionsAgainstRuntime(actions: readonly string[]) {
  let now = 0;
  let ctxState: "suspended" | "running" | "closed" = "suspended";
  const timers = new Map<number, { atUs: number; cb: () => void }>();
  let tid = 1;
  const scheduler: AudioHostScheduler = {
    nowUs: () => now,
    setTimer(delayMs, cb) {
      const id = tid++;
      timers.set(id, { atUs: now + delayMs * 1000, cb });
      return id;
    },
    clearTimer(id) { timers.delete(id); },
    createContext(sampleRate): AudioContextLike {
      ctxState = "suspended";
      return {
        get state() { return ctxState; },
        sampleRate,
        async resume() { if (ctxState === "suspended") ctxState = "running"; },
        async suspend() { if (ctxState === "running") ctxState = "suspended"; },
        async close() { ctxState = "closed"; },
      };
    },
  };
  const host = new StarluxAudioHost({ scheduler, lingerUs: 1600000 });
  const l = new Float32Array(128);
  const r = new Float32Array(128);
  let reduced = false;
  let seq = 1;
  const trace: { action: string }[] = [];
  const btn = buildButtonPressRecipe();

  for (const act of actions) {
    switch (act) {
      case "opt_in":
        expect(host.enableFromTrustedGesture({ isTrusted: true }, true)).toBe(true);
        break;
      case "mute":
        host.mute();
        await host.flushLifecycle();
        break;
      case "unmute":
        host.unmute();
        break;
      case "toggle_reduced":
        reduced = !reduced;
        break;
      case "post_info": {
        now += 500000;
        const res = host.dispatchPlan(btn.arena, btn.fx, {
          event: { kind: "IMPULSE", timeUs: now, intensity: 0.8, subject: seq },
          transition: "down",
          serial: seq++,
          epoch: 1,
          rect: { x: 100, y: 100, w: 120, h: 48 },
          viewport: { x: 0, y: 0, w: 1440, h: 900 },
          vxPxS: 0,
          vyPxS: 0,
          material: 0,
          rate100: 100,
          thermalTier: 0,
          motionPolicy: reduced ? 1 : 0,
          audioOptIn: true,
          sessionActivated: true,
          muted: false,
          hapticOptIn: false,
          hapticAvailable: false,
          functionalAudio: true,
          originFrame: 0,
          seed: 7,
        });
        await host.flushLifecycle();
        if (reduced && res.audio.length > 0) {
          expect(res.audio[0]!.gainQ15).toBeLessThanOrEqual(16384);
        }
        break;
      }
      case "post_kinetic":
        if (!reduced) {
          host.submitCue(cueIdBySlug("control.hover"), { subject: seq++ });
          await host.flushLifecycle();
        }
        break;
      case "post_steal":
        host.submitCue(cueIdBySlug("control.press"), { subject: seq++ });
        await host.flushLifecycle();
        break;
      case "render":
        host.pumpQuantum(l, r, 128);
        expect(host.metrics().peakHoldS16).toBeLessThanOrEqual(audioCeilingS16());
        expect(host.metrics().activeVoices).toBeLessThanOrEqual(6);
        break;
      case "voice_end":
        for (let i = 0; i < 60 && host.metrics().activeVoices > 0; i++) {
          host.pumpQuantum(l, r, 128);
        }
        break;
      case "release":
        for (let i = 0; i < 60 && host.metrics().heldTokens > 0; i++) {
          host.pumpQuantum(l, r, 128);
        }
        expect(host.metrics().heldTokens).toBe(0);
        break;
      case "linger_expire":
        now += 1600000;
        for (const [id, t] of [...timers.entries()]) {
          if (t.atUs <= now) {
            timers.delete(id);
            t.cb();
          }
        }
        await host.flushLifecycle();
        expect(host.metrics().suspended).toBe(true);
        break;
      default:
        throw new Error(`Unknown OM action: ${act}`);
    }
    trace.push({ action: act });
  }
  host.dispose();
  return trace;
}

describe("@mogos/starlux/audio Formal OM Verification", () => {
  test("starlux_audio.om is CLOSED with 6 HOLDS claims, 0 VACUOUS, 0 INCOMPLETE", () => {
    const res = runOm(["check", MODEL, "--json"]);
    expect(res.exitCode).toBe(0);
    const data = JSON.parse(res.stdout);
    expect(data.verdict).toBe("CLOSED");
    expect(data.semantic_result.completeness.status).toBe("CLOSED");
    expect(data.vacuous_claims).toEqual([]);
    expect(data.claims.length).toBe(6);
    for (const c of data.claims) {
      expect(c.status).toBe("HOLDS");
      expect(c.guard_echo).toBe(false);
    }
  });

  test("all 6 broken twins exit 2 on their named claim", () => {
    const expected: readonly [string, string][] = [
      ["a001-idle-run.om", "audio_idle_suspends"],
      ["a002-limiter-bypass.om", "peak_below_ceiling"],
      ["a003-hard-steal.om", "zero_click_discontinuity"],
      ["a004-no-cap.om", "polyphony_bounded"],
      ["a005-ungated-post.om", "mute_and_gesture_gated"],
      ["a006-reduced-full.om", "reduced_motion_attenuated"],
    ];
    for (const [file, claim] of expected) {
      const twinPath = path.join(TWINS_DIR, file);
      const res = runOm(["check", twinPath, "--stop-at-first", "--json"]);
      expect(res.exitCode).toBe(2);
      const data = JSON.parse(res.stdout);
      expect(data.counterexample.claim).toBe(claim);
    }
  });

  test("live runtime trace conforms to starlux_audio.om (om conform exit 0)", async () => {
    const actions = [
      "opt_in",
      "post_info",
      "render",
      "voice_end",
      "release",
      "linger_expire",
      "toggle_reduced",
      "post_info",
      "render",
      "mute",
      "linger_expire",
      "unmute",
      "toggle_reduced",
      "post_kinetic",
      "render",
      "voice_end",
      "release",
      "linger_expire",
    ];
    const trace = await replayActionsAgainstRuntime(actions);
    const work = mkdtempSync(path.join(tmpdir(), "starlux-audio-om-"));
    try {
      const tracePath = path.join(work, "audio-runtime.jsonl");
      writeFileSync(tracePath, trace.map((row) => JSON.stringify(row)).join("\n") + "\n");
      const conf = runOm(["conform", MODEL, tracePath, "--json"]);
      expect(conf.exitCode).toBe(0);
      const parsed = JSON.parse(conf.stdout);
      expect(parsed.operation_status).toBe("CONFORMING");
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });
});
