# Starlux Voice OM Formal Ruleset

Author: MOGOS Collective

Note: A closed finite OM model proves the declared finite model, not arbitrary unbounded source execution. Every must-hold claim below has a companion broken twin under `.om/voice/twins/` that refutes with exit 2 and maps to 4-target runtime falsifier tests in `tests/`.

## R-V01 Rest Zero-Idle WakeToken Discipline
Status: must-hold
Rule: When the voice state machine is settled at rest, zero WakeTokens are held and zero idle ticks advance.
Claims: rest_zero_idle_ticks

## R-V02 Active State Wake Ownership
Status: must-hold
Rule: Any full-motion active non-rest voice state holds an active WakeToken until settled back to rest.
Claims: active_state_holds_wake

## R-V03 Reduced-Motion Phase Freeze and Static Wake Release
Status: must-hold
Rule: When reducedMotion is enabled, oscillation phase never advances across active frames and static frames hold zero WakeTokens.
Claims: reduced_motion_freezes_phase

## R-V04 Schmitt VAD Hysteresis Hold
Status: must-hold
Rule: An active VAD gate never drops prematurely while hangover frames remain in the hysteresis band.
Claims: vad_hysteresis_no_premature_drop
