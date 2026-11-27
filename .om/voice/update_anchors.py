#!/usr/bin/env python3
"""Generate OM-ANCHORS/1 SHA-256 table for .om/voice/ pinned to a committed git SHA."""
import hashlib, json, subprocess, sys

sha = sys.argv[1] if len(sys.argv) > 1 else subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()

anchors = [
    ("starluxvoice.voice_state", "ss/voice/state.ss.ts", 16, 23, "VOICE_REST"),
    ("starluxvoice.wake_held", "ss/voice/state.ss.ts", 106, 108, "voiceHeldWakeTokens"),
    ("starluxvoice.settled", "ss/voice/state.ss.ts", 157, 162, "settledAtRest"),
    ("starluxvoice.idle_ticks", "ss/voice/state.ss.ts", 165, 188, "idleSkippedTicks"),
    ("starluxvoice.reduced_motion", "ss/voice/state.ss.ts", 191, 256, "reducedMotion"),
    ("starluxvoice.phase_moved", "ss/voice/state.ss.ts", 282, 287, "voiceStatePhaseRate"),
    ("starluxvoice.vad_state", "ss/voice/signal.ss.ts", 168, 184, "vadActive"),
    ("starluxvoice.vad_hangover", "ss/voice/signal.ss.ts", 168, 184, "vadHangoverFrames"),
    ("starluxvoice.enable_reduced", "ss/voice/state.ss.ts", 191, 256, "reducedMotion"),
    ("starluxvoice.enter_listen", "ss/voice/state.ss.ts", 258, 266, "acquireWake"),
    ("starluxvoice.enter_speak", "ss/voice/state.ss.ts", 258, 266, "acquireWake"),
    ("starluxvoice.enter_error", "ss/voice/state.ss.ts", 258, 266, "acquireWake"),
    ("starluxvoice.step_active_motion", "ss/voice/state.ss.ts", 282, 287, "voiceStatePhaseRate"),
    ("starluxvoice.step_active_reduced", "ss/voice/state.ss.ts", 191, 256, "reducedMotion"),
    ("starluxvoice.vad_mid_band_hold", "ss/voice/signal.ss.ts", 168, 184, "vadHangoverFrames"),
    ("starluxvoice.vad_silence_close", "ss/voice/signal.ss.ts", 168, 184, "vadHangoverFrames"),
    ("starluxvoice.request_rest", "ss/voice/state.ss.ts", 289, 302, "settleRestFrames"),
    ("starluxvoice.settle_to_idle", "ss/voice/state.ss.ts", 289, 302, "releaseWake"),
    ("starluxvoice.idle_poll", "ss/voice/state.ss.ts", 165, 188, "idleSkippedTicks"),
    ("starluxvoice.rest_zero_idle_ticks", ".om/voice/RULESET.md", 9, 9, "When the voice state machine is settled at rest, zero WakeTokens are held and zero idle ticks advance."),
    ("starluxvoice.active_state_holds_wake", ".om/voice/RULESET.md", 14, 14, "Any full-motion active non-rest voice state holds an active WakeToken until settled back to rest."),
    ("starluxvoice.reduced_motion_freezes_phase", ".om/voice/RULESET.md", 19, 19, "When reducedMotion is enabled, oscillation phase never advances across active frames and static frames hold zero WakeTokens."),
    ("starluxvoice.vad_hysteresis_no_premature_drop", ".om/voice/RULESET.md", 24, 24, "An active VAD gate never drops prematurely while hangover frames remain in the hysteresis band."),
]

def slice_sha256(commit_sha: str, path: str, start: int, end: int) -> str:
    content = subprocess.check_output(["git", "show", f"{commit_sha}:{path}"], text=True)
    lines = content.splitlines()
    chunk = "\n".join(lines[start - 1 : end])
    return hashlib.sha256(chunk.encode("utf-8")).hexdigest()

out = [
    "# Starlux Voice OM Source Anchors",
    "",
    "Author: MOGOS Collective",
    "",
    f"Pinned source: `{sha}`. Structured OM-ANCHORS/1 rows bind StarluxVoice states, actions, and claims to `ss/voice/` and `.om/voice/RULESET.md`.",
    "",
    "| Model element | Citation | Quote |",
    "| --- | --- | --- |",
]
for elem, path, s, e, quote in anchors:
    out.append(f"| {elem} | `{path}:{s}-{e}` | {quote} |")

out += [
    "",
    "## Structured source anchors (OM-ANCHORS/1)",
    "",
    f"code_sha: {sha}",
    "",
    "| Model element | File | Start line | End line | SHA-256 |",
    "| --- | --- | ---: | ---: | --- |",
]
for elem, path, s, e, _ in anchors:
    h = slice_sha256(sha, path, s, e)
    out.append(f"| {elem} | {path} | {s} | {e} | {h} |")

open(".om/voice/ANCHORS.md", "w").write("\n".join(out) + "\n")
om_json = json.load(open(".om/voice/OM.json"))
om_json["code_sha"] = sha
open(".om/voice/OM.json", "w").write(json.dumps(om_json, indent=2) + "\n")
print(f"Updated .om/voice/ANCHORS.md and .om/voice/OM.json pinned to {sha} ({len(anchors)} anchors)")
