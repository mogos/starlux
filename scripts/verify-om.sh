#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
proof="$(mktemp -d)"
trap 'rm -rf "$proof"' EXIT

# 1. Core starlux + magnetic OM project
om check om/.om --json > "$proof/project.json"
om cite om/.om --json > "$proof/citations.json"
bun -e '
  import assert from "node:assert/strict";
  const result = await Bun.file(process.argv[1]).json();
  const citations = await Bun.file(process.argv[2]).json();
  assert.equal(citations.operation_status, "CITATIONS_RESOLVED");
  assert.equal(result.operation_status, "PROJECT_CLOSED");
  assert.deepEqual(result.models.map((model) => model.name), ["starlux", "magnetic"]);
  for (const model of result.models) {
    assert.equal(model.verdict, "CLOSED");
    assert.equal(model.semantic_result.completeness.status, "CLOSED");
    assert.deepEqual(model.vacuous_claims, []);
    assert.equal(model.claims.length, model.name === "magnetic" ? 7 : 5);
    assert.ok(model.claims.every((claim) => claim.status === "HOLDS" && !claim.guard_echo));
    console.log(`OM ${model.name} CLOSED | ${model.distinct} reachable states | ${model.claims.length} claims | 0 VACUOUS | 0 INCOMPLETE`);
  }
' "$proof/project.json" "$proof/citations.json"

receipts=()
for model in om/twins/*.om; do
  receipt="$proof/$(basename "$model" .om).json"
  status=0
  om check "$model" --stop-at-first --json > "$receipt" || status=$?
  if [[ "$status" -ne 2 ]]; then
    printf 'Expected exit 2 for %s, got %s\n' "$model" "$status" >&2
    exit 1
  fi
  printf 'OM twin %s exit=%s\n' "$(basename "$model")" "$status"
  receipts+=("$receipt")
done
bun tests/om-replay.ts "${receipts[@]}"
bun tests/magnetic-om-replay.ts om/.om/magnetic.om "$proof"

# 2. Light OM project (.om/light) + 6 twins
om check .om/light --json > "$proof/light-project.json"
bun -e '
  import assert from "node:assert/strict";
  const result = await Bun.file(process.argv[1]).json();
  assert.equal(result.operation_status, "PROJECT_CLOSED");
  const [model] = result.models;
  assert.equal(model.verdict, "CLOSED");
  assert.equal(model.semantic_result.completeness.status, "CLOSED");
  assert.deepEqual(model.vacuous_claims, []);
  assert.equal(model.claims.length, 6);
  assert.ok(model.claims.every((claim) => claim.status === "HOLDS" && !claim.guard_echo));
  console.log(`OM ${model.name} CLOSED | ${model.distinct} reachable states | ${model.claims.length} claims | 0 VACUOUS | 0 INCOMPLETE`);
' "$proof/light-project.json"

for model in .om/light/twins/*.om; do
  receipt="$proof/light-$(basename "$model" .om).json"
  status=0
  om check "$model" --stop-at-first --json > "$receipt" || status=$?
  if [[ "$status" -ne 2 ]]; then
    printf 'Expected exit 2 for %s, got %s\n' "$model" "$status" >&2
    exit 1
  fi
  printf 'OM light twin %s exit=%s\n' "$(basename "$model")" "$status"
done

# 3. Voice OM project (.om/voice) + citations + 4 twins + runtime trace conformance
om check .om/voice --json > "$proof/voice-project.json"
om cite .om/voice --json > "$proof/voice-citations.json"
bun -e '
  import assert from "node:assert/strict";
  const result = await Bun.file(process.argv[1]).json();
  const citations = await Bun.file(process.argv[2]).json();
  assert.equal(citations.operation_status, "CITATIONS_RESOLVED");
  assert.equal(result.operation_status, "PROJECT_CLOSED");
  const [model] = result.models;
  assert.equal(model.verdict, "CLOSED");
  assert.equal(model.semantic_result.completeness.status, "CLOSED");
  assert.deepEqual(model.vacuous_claims, []);
  assert.equal(model.claims.length, 4);
  assert.ok(model.claims.every((claim) => claim.status === "HOLDS" && !claim.guard_echo));
  console.log(`OM ${model.name} CLOSED | ${model.distinct} reachable states | ${model.claims.length} claims | 0 VACUOUS | 0 INCOMPLETE`);
' "$proof/voice-project.json" "$proof/voice-citations.json"

for model in .om/voice/twins/*.om; do
  receipt="$proof/voice-$(basename "$model" .om).json"
  status=0
  om check "$model" --stop-at-first --json > "$receipt" || status=$?
  if [[ "$status" -ne 2 ]]; then
    printf 'Expected exit 2 for %s, got %s\n' "$model" "$status" >&2
    exit 1
  fi
  printf 'OM voice twin %s exit=%s\n' "$(basename "$model")" "$status"
done

bun -e '
  import { writeFileSync } from "node:fs";
  import { main } from "./tests/voice-om-trace.ss.ts";
  globalThis.budget = () => {};
  writeFileSync(process.argv[1], main(0) + "\n");
' "$proof/voice-trace.jsonl"
om conform .om/voice/starluxvoice.om "$proof/voice-trace.jsonl" --json > "$proof/voice-conform.json"
bun -e '
  import assert from "node:assert/strict";
  const conf = await Bun.file(process.argv[1]).json();
  assert.equal(conf.operation_status, "CONFORMING");
  console.log("OM starluxvoice runtime trace CONFORMING");
' "$proof/voice-conform.json"

# 4. Audio OM model (.om/audio/starlux_audio.om) + 6 twins
om check .om/audio/starlux_audio.om --json > "$proof/audio-model.json"
bun -e '
  import assert from "node:assert/strict";
  const model = await Bun.file(process.argv[1]).json();
  assert.equal(model.verdict, "CLOSED");
  assert.equal(model.semantic_result.completeness.status, "CLOSED");
  assert.deepEqual(model.vacuous_claims, []);
  assert.equal(model.claims.length, 6);
  assert.ok(model.claims.every((claim) => claim.status === "HOLDS" && !claim.guard_echo));
  console.log(`OM ${model.name} CLOSED | ${model.distinct} reachable states | ${model.claims.length} claims | 0 VACUOUS | 0 INCOMPLETE`);
' "$proof/audio-model.json"

for model in .om/audio/twins/*.om; do
  receipt="$proof/audio-$(basename "$model" .om).json"
  status=0
  om check "$model" --stop-at-first --json > "$receipt" || status=$?
  if [[ "$status" -ne 2 ]]; then
    printf 'Expected exit 2 for %s, got %s\n' "$model" "$status" >&2
    exit 1
  fi
  printf 'OM audio twin %s exit=%s\n' "$(basename "$model")" "$status"
done

# 5. Wallpaper OM models (.om/wallpaper: wake, codec_light, memory) + 6 twins
om check .om/wallpaper --json > "$proof/wallpaper-project.json"
bun -e '
  import assert from "node:assert/strict";
  const project = await Bun.file(process.argv[1]).json();
  assert.equal(project.operation_status, "PROJECT_CLOSED");
  assert.equal(project.models.length, 3);
  let totalClaims = 0;
  let totalStates = 0;
  for (const model of project.models) {
    assert.equal(model.verdict, "CLOSED");
    assert.equal(model.semantic_result.completeness.status, "CLOSED");
    assert.deepEqual(model.vacuous_claims, []);
    assert.ok(model.claims.every((claim) => claim.status === "HOLDS" && !claim.guard_echo));
    totalClaims += model.claims.length;
    totalStates += Number(model.distinct);
  }
  assert.equal(totalClaims, 6);
  console.log(`OM wallpaper CLOSED | 3 models | ${totalStates} reachable states | ${totalClaims} claims | 0 VACUOUS | 0 INCOMPLETE`);
' "$proof/wallpaper-project.json"

for model in .om/wallpaper/twins/*.om; do
  receipt="$proof/wallpaper-$(basename "$model" .om).json"
  status=0
  om check "$model" --stop-at-first --json > "$receipt" || status=$?
  if [[ "$status" -ne 2 ]]; then
    printf 'Expected exit 2 for %s, got %s\n' "$model" "$status" >&2
    exit 1
  fi
  printf 'OM wallpaper twin %s exit=%s\n' "$(basename "$model")" "$status"
done
