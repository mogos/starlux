# Starlux Voice OM Source Anchors

Author: MOGOS Collective

Pinned source: `b57db8bbf1bc3867c71d9dcafc3e7b419fa07b32`. Structured OM-ANCHORS/1 rows bind StarluxVoice states, actions, and claims to `ss/voice/` and `.om/voice/RULESET.md`.

| Model element | Citation | Quote |
| --- | --- | --- |
| starluxvoice.voice_state | `ss/voice/state.ss.ts:14-21` | VOICE_REST |
| starluxvoice.wake_held | `ss/voice/state.ss.ts:104-106` | voiceHeldWakeTokens |
| starluxvoice.settled | `ss/voice/state.ss.ts:156-161` | settledAtRest |
| starluxvoice.idle_ticks | `ss/voice/state.ss.ts:164-189` | idleSkippedTicks |
| starluxvoice.reduced_motion | `ss/voice/state.ss.ts:200-229` | reducedMotion |
| starluxvoice.phase_moved | `ss/voice/state.ss.ts:246-250` | voiceStatePhaseRate |
| starluxvoice.vad_state | `ss/voice/signal.ss.ts:168-184` | vadActive |
| starluxvoice.vad_hangover | `ss/voice/signal.ss.ts:168-184` | vadHangoverFrames |
| starluxvoice.enable_reduced | `ss/voice/state.ss.ts:200-229` | reducedMotion |
| starluxvoice.enter_listen | `ss/voice/state.ss.ts:191-198` | acquireWake |
| starluxvoice.enter_speak | `ss/voice/state.ss.ts:191-198` | acquireWake |
| starluxvoice.enter_error | `ss/voice/state.ss.ts:191-198` | acquireWake |
| starluxvoice.step_active_motion | `ss/voice/state.ss.ts:246-250` | voiceStatePhaseRate |
| starluxvoice.step_active_reduced | `ss/voice/state.ss.ts:200-229` | reducedMotion |
| starluxvoice.vad_mid_band_hold | `ss/voice/signal.ss.ts:168-184` | vadHangoverFrames |
| starluxvoice.vad_silence_close | `ss/voice/signal.ss.ts:168-184` | vadHangoverFrames |
| starluxvoice.request_rest | `ss/voice/state.ss.ts:252-265` | settleRestFrames |
| starluxvoice.settle_to_idle | `ss/voice/state.ss.ts:252-265` | releaseWake |
| starluxvoice.idle_poll | `ss/voice/state.ss.ts:164-189` | idleSkippedTicks |
| starluxvoice.rest_zero_idle_ticks | `.om/voice/RULESET.md:9-9` | When the voice state machine is settled at rest, zero WakeTokens are held and zero idle ticks advance. |
| starluxvoice.active_state_holds_wake | `.om/voice/RULESET.md:14-14` | Any active non-rest voice state holds an active WakeToken until settled back to rest. |
| starluxvoice.reduced_motion_freezes_phase | `.om/voice/RULESET.md:19-19` | When reducedMotion is enabled, oscillation phase never advances across active frames. |
| starluxvoice.vad_hysteresis_no_premature_drop | `.om/voice/RULESET.md:24-24` | An active VAD gate never drops prematurely while hangover frames remain in the hysteresis band. |

## Structured source anchors (OM-ANCHORS/1)

code_sha: b57db8bbf1bc3867c71d9dcafc3e7b419fa07b32

| Model element | File | Start line | End line | SHA-256 |
| --- | --- | ---: | ---: | --- |
| starluxvoice.voice_state | ss/voice/state.ss.ts | 14 | 21 | 70cfde22fba1e6c61e37af84c491bf682872053b1bae14f90bb1333111a776e6 |
| starluxvoice.wake_held | ss/voice/state.ss.ts | 104 | 106 | 711c64163775a41558be452b506c700cfccd0d1c65e6cf700d631f619cdbd941 |
| starluxvoice.settled | ss/voice/state.ss.ts | 156 | 161 | d68c6046623a89c6e74d0ed2b07641dea99a6fac44e70077f56312aa22d6f264 |
| starluxvoice.idle_ticks | ss/voice/state.ss.ts | 164 | 189 | 7d7a4af150b6a0deb2231e758ac278008d135c5e5f21f5338dedf70ca00cab7a |
| starluxvoice.reduced_motion | ss/voice/state.ss.ts | 200 | 229 | f5d6a372c736fd9c089ca275b735818c69af671c81a7ab295389de297e6ca23c |
| starluxvoice.phase_moved | ss/voice/state.ss.ts | 246 | 250 | 791ad28919500d69cfc53aa12ee0ceb75f07a6e6d564e44fa202e160e2e6b729 |
| starluxvoice.vad_state | ss/voice/signal.ss.ts | 168 | 184 | a81424f0629fb19c0df202b913ae0df2988f6e32560b0570c24a5be1c331c52a |
| starluxvoice.vad_hangover | ss/voice/signal.ss.ts | 168 | 184 | a81424f0629fb19c0df202b913ae0df2988f6e32560b0570c24a5be1c331c52a |
| starluxvoice.enable_reduced | ss/voice/state.ss.ts | 200 | 229 | f5d6a372c736fd9c089ca275b735818c69af671c81a7ab295389de297e6ca23c |
| starluxvoice.enter_listen | ss/voice/state.ss.ts | 191 | 198 | 580728828133b7dc8be600af8fc2f9cba55e37aab526bfcc1d9144436f7cb5f3 |
| starluxvoice.enter_speak | ss/voice/state.ss.ts | 191 | 198 | 580728828133b7dc8be600af8fc2f9cba55e37aab526bfcc1d9144436f7cb5f3 |
| starluxvoice.enter_error | ss/voice/state.ss.ts | 191 | 198 | 580728828133b7dc8be600af8fc2f9cba55e37aab526bfcc1d9144436f7cb5f3 |
| starluxvoice.step_active_motion | ss/voice/state.ss.ts | 246 | 250 | 791ad28919500d69cfc53aa12ee0ceb75f07a6e6d564e44fa202e160e2e6b729 |
| starluxvoice.step_active_reduced | ss/voice/state.ss.ts | 200 | 229 | f5d6a372c736fd9c089ca275b735818c69af671c81a7ab295389de297e6ca23c |
| starluxvoice.vad_mid_band_hold | ss/voice/signal.ss.ts | 168 | 184 | a81424f0629fb19c0df202b913ae0df2988f6e32560b0570c24a5be1c331c52a |
| starluxvoice.vad_silence_close | ss/voice/signal.ss.ts | 168 | 184 | a81424f0629fb19c0df202b913ae0df2988f6e32560b0570c24a5be1c331c52a |
| starluxvoice.request_rest | ss/voice/state.ss.ts | 252 | 265 | 3960fdf7bf212556c0b7aa0e062b2a3f1f9146ae0744deffd72c7df98ed10e99 |
| starluxvoice.settle_to_idle | ss/voice/state.ss.ts | 252 | 265 | 3960fdf7bf212556c0b7aa0e062b2a3f1f9146ae0744deffd72c7df98ed10e99 |
| starluxvoice.idle_poll | ss/voice/state.ss.ts | 164 | 189 | 7d7a4af150b6a0deb2231e758ac278008d135c5e5f21f5338dedf70ca00cab7a |
| starluxvoice.rest_zero_idle_ticks | .om/voice/RULESET.md | 9 | 9 | b9f3378f5b1425f519094ac4ea1db7e57976e9f4ee7105b35d689f3d81878e12 |
| starluxvoice.active_state_holds_wake | .om/voice/RULESET.md | 14 | 14 | 00f16ba4b7c5645c91f16a879f4d4b5376b47242547dbca868d4c4b4b878287a |
| starluxvoice.reduced_motion_freezes_phase | .om/voice/RULESET.md | 19 | 19 | fb77dc883b5e44bdcbd081cc3053b9535deabfb10a9c645e48edcf86e6c3171c |
| starluxvoice.vad_hysteresis_no_premature_drop | .om/voice/RULESET.md | 24 | 24 | 2a4ebf8684c297001b02611d5b1206d52e4da846a134211d47069976f366fb11 |
