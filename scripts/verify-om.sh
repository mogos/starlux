#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
proof="$(mktemp -d)"
trap 'rm -rf "$proof"' EXIT
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
