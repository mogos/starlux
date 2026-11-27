# Starlux Voice OM Source Anchors

Author: MOGOS Collective

Pinned source: `c2390f8aa407f00df20a5dc88663f07643eaf331`. Structured OM-ANCHORS/1 rows bind StarluxVoice states, actions, and claims to `ss/voice/` and `.om/voice/RULESET.md`.

| Model element | Citation | Quote |
| --- | --- | --- |
| starluxvoice.voice_state | `ss/voice/state.ss.ts:16-23` | VOICE_REST |
| starluxvoice.wake_held | `ss/voice/state.ss.ts:106-108` | voiceHeldWakeTokens |
| starluxvoice.settled | `ss/voice/state.ss.ts:157-162` | settledAtRest |
| starluxvoice.idle_ticks | `ss/voice/state.ss.ts:165-188` | idleSkippedTicks |
| starluxvoice.reduced_motion | `ss/voice/state.ss.ts:191-256` | reducedMotion |
| starluxvoice.phase_moved | `ss/voice/state.ss.ts:282-287` | voiceStatePhaseRate |
| starluxvoice.vad_state | `ss/voice/signal.ss.ts:168-184` | vadActive |
| starluxvoice.vad_hangover | `ss/voice/signal.ss.ts:168-184` | vadHangoverFrames |
| starluxvoice.enable_reduced | `ss/voice/state.ss.ts:191-256` | reducedMotion |
| starluxvoice.enter_listen | `ss/voice/state.ss.ts:258-266` | acquireWake |
| starluxvoice.enter_speak | `ss/voice/state.ss.ts:258-266` | acquireWake |
| starluxvoice.enter_error | `ss/voice/state.ss.ts:258-266` | acquireWake |
| starluxvoice.step_active_motion | `ss/voice/state.ss.ts:282-287` | voiceStatePhaseRate |
| starluxvoice.step_active_reduced | `ss/voice/state.ss.ts:191-256` | reducedMotion |
| starluxvoice.vad_mid_band_hold | `ss/voice/signal.ss.ts:168-184` | vadHangoverFrames |
| starluxvoice.vad_silence_close | `ss/voice/signal.ss.ts:168-184` | vadHangoverFrames |
| starluxvoice.request_rest | `ss/voice/state.ss.ts:289-302` | settleRestFrames |
| starluxvoice.settle_to_idle | `ss/voice/state.ss.ts:289-302` | releaseWake |
| starluxvoice.idle_poll | `ss/voice/state.ss.ts:165-188` | idleSkippedTicks |
| starluxvoice.rest_zero_idle_ticks | `.om/voice/RULESET.md:9-9` | When the voice state machine is settled at rest, zero WakeTokens are held and zero idle ticks advance. |
| starluxvoice.active_state_holds_wake | `.om/voice/RULESET.md:14-14` | Any full-motion active non-rest voice state holds an active WakeToken until settled back to rest. |
| starluxvoice.reduced_motion_freezes_phase | `.om/voice/RULESET.md:19-19` | When reducedMotion is enabled, oscillation phase never advances across active frames and static frames hold zero WakeTokens. |
| starluxvoice.vad_hysteresis_no_premature_drop | `.om/voice/RULESET.md:24-24` | An active VAD gate never drops prematurely while hangover frames remain in the hysteresis band. |

## Structured source anchors (OM-ANCHORS/1)

code_sha: c2390f8aa407f00df20a5dc88663f07643eaf331

| Model element | File | Start line | End line | SHA-256 |
| --- | --- | ---: | ---: | --- |
| starluxvoice.voice_state | ss/voice/state.ss.ts | 16 | 23 | 97ee8de1d24638a2ce6faa73b4f44fa6d8006104362cdcee72ba40008347a135 |
| starluxvoice.wake_held | ss/voice/state.ss.ts | 106 | 108 | 3ba5048d2f02f354d5eea8b09d66384660a95abb4dd3826fc4328e0503e411d3 |
| starluxvoice.settled | ss/voice/state.ss.ts | 157 | 162 | d99e28723ec30880c740f2dc9e7f1ae7938aac03ece646285bdae4fa8efaad54 |
| starluxvoice.idle_ticks | ss/voice/state.ss.ts | 165 | 188 | f7f511d7f60d514d875066290494bc5e977cff79a887c20669b36730560d01a2 |
| starluxvoice.reduced_motion | ss/voice/state.ss.ts | 191 | 256 | f1096746086fc56359ec628d2fe464ef4a1b97dfc7bb67cb6a222d2d9b19fcce |
| starluxvoice.phase_moved | ss/voice/state.ss.ts | 282 | 287 | b3e9c209eab060b0cbab3c729eb3eb98e14653b8e09aae254bc9cfc8289e73eb |
| starluxvoice.vad_state | ss/voice/signal.ss.ts | 168 | 184 | a81424f0629fb19c0df202b913ae0df2988f6e32560b0570c24a5be1c331c52a |
| starluxvoice.vad_hangover | ss/voice/signal.ss.ts | 168 | 184 | a81424f0629fb19c0df202b913ae0df2988f6e32560b0570c24a5be1c331c52a |
| starluxvoice.enable_reduced | ss/voice/state.ss.ts | 191 | 256 | f1096746086fc56359ec628d2fe464ef4a1b97dfc7bb67cb6a222d2d9b19fcce |
| starluxvoice.enter_listen | ss/voice/state.ss.ts | 258 | 266 | dbdee5de3fda0dd405732dd4afb18a1bc874ff870c1ad819f1ab29da0c7ae3a3 |
| starluxvoice.enter_speak | ss/voice/state.ss.ts | 258 | 266 | dbdee5de3fda0dd405732dd4afb18a1bc874ff870c1ad819f1ab29da0c7ae3a3 |
| starluxvoice.enter_error | ss/voice/state.ss.ts | 258 | 266 | dbdee5de3fda0dd405732dd4afb18a1bc874ff870c1ad819f1ab29da0c7ae3a3 |
| starluxvoice.step_active_motion | ss/voice/state.ss.ts | 282 | 287 | b3e9c209eab060b0cbab3c729eb3eb98e14653b8e09aae254bc9cfc8289e73eb |
| starluxvoice.step_active_reduced | ss/voice/state.ss.ts | 191 | 256 | f1096746086fc56359ec628d2fe464ef4a1b97dfc7bb67cb6a222d2d9b19fcce |
| starluxvoice.vad_mid_band_hold | ss/voice/signal.ss.ts | 168 | 184 | a81424f0629fb19c0df202b913ae0df2988f6e32560b0570c24a5be1c331c52a |
| starluxvoice.vad_silence_close | ss/voice/signal.ss.ts | 168 | 184 | a81424f0629fb19c0df202b913ae0df2988f6e32560b0570c24a5be1c331c52a |
| starluxvoice.request_rest | ss/voice/state.ss.ts | 289 | 302 | 33c2c1fb1050800a8c642150b9457d878b0ee94cf0a17a7b6ed3ddc38201e069 |
| starluxvoice.settle_to_idle | ss/voice/state.ss.ts | 289 | 302 | 33c2c1fb1050800a8c642150b9457d878b0ee94cf0a17a7b6ed3ddc38201e069 |
| starluxvoice.idle_poll | ss/voice/state.ss.ts | 165 | 188 | f7f511d7f60d514d875066290494bc5e977cff79a887c20669b36730560d01a2 |
| starluxvoice.rest_zero_idle_ticks | .om/voice/RULESET.md | 9 | 9 | b9f3378f5b1425f519094ac4ea1db7e57976e9f4ee7105b35d689f3d81878e12 |
| starluxvoice.active_state_holds_wake | .om/voice/RULESET.md | 14 | 14 | ab211d7b6bbc3f998f83015a0987894dea738df5e44d71d745bec8a548346230 |
| starluxvoice.reduced_motion_freezes_phase | .om/voice/RULESET.md | 19 | 19 | ed7d1c6baf04f9221dbc93c633098db2bdfc1da140165a9f5b572c66a0087e02 |
| starluxvoice.vad_hysteresis_no_premature_drop | .om/voice/RULESET.md | 24 | 24 | 2a4ebf8684c297001b02611d5b1206d52e4da846a134211d47069976f366fb11 |
