/* Starlux Audio Public Polyglot C11/C17 Header (Zero Heap, Caller-Owned Storage, Zero libm) */
#ifndef STARLUX_AUDIO_H
#define STARLUX_AUDIO_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define SL_AUDIO_ABI_VERSION     1u
#define SL_AUDIO_SAMPLE_RATE     48000u
#define SL_AUDIO_MAX_VOICES      6u
#define SL_AUDIO_MAX_PENDING     64u
#define SL_AUDIO_MAX_BLOCK       256u
#define SL_AUDIO_CEILING_S16     23197
#define SL_AUDIO_CMD_WIRE_BYTES  48u
#define SL_AUDIO_RING_FRAMES     4096u

#define SL_AUDIO_OK              0
#define SL_AUDIO_ERR_BAD_ARG    -1
#define SL_AUDIO_ERR_ALIGN      -2
#define SL_AUDIO_ERR_STORAGE    -3
#define SL_AUDIO_ERR_RUNTIME    -4

typedef struct sl_audio sl_audio;

/* Caller-owned storage sizing and initialization (reinitializing resets all bytes cleanly). */
size_t   sl_audio_bytes(void);
size_t   sl_audio_align(void);
int      sl_audio_init(void *storage, size_t bytes, sl_audio **out);

/* Little-endian 48-byte command layout (12 x int32_t):
 * [0] atFrame, [1] seq, [2] hitIndex, [3] subject, [4] epoch, [5] seed,
 * [6] cueId (1..250), [7] gainQ15 (0..32768), [8] pan (-32767..32767),
 * [9] rate100 (10..400), [10] materialOverride (-1..5), [11] pitchCents (-1200..1200)
 */
int      sl_audio_submit(sl_audio *s, const uint8_t *cmd_le, size_t len);
int      sl_audio_cancel(sl_audio *s, uint32_t subject, uint32_t epoch);
int      sl_audio_mute(sl_audio *s, int muted);

/* Render up to SL_AUDIO_MAX_BLOCK interleaved stereo frames, advancing engine state. */
size_t   sl_audio_s16(sl_audio *s, int16_t *lr, size_t frames);
size_t   sl_audio_f32(sl_audio *s, float *lr, size_t frames);

/* Inspection helpers for zero-heat WakeToken idle checks. */
uint32_t sl_audio_active(const sl_audio *s);
uint32_t sl_audio_quanta(const sl_audio *s);
int32_t  sl_audio_peak_hold(const sl_audio *s);

/* Power-of-two 4096-frame stereo SPSC PCM ring for native push hosts (star0, starland, starnative). */
typedef struct sl_pcm_ring {
  int16_t  samples[SL_AUDIO_RING_FRAMES * 2u];
  uint32_t write_idx;
  uint32_t read_idx;
  uint32_t underruns;
} sl_pcm_ring;

void     sl_pcm_ring_init(sl_pcm_ring *ring);
uint32_t sl_pcm_ring_available(const sl_pcm_ring *ring);
uint32_t sl_pcm_ring_free(const sl_pcm_ring *ring);
uint32_t sl_pcm_ring_write(sl_pcm_ring *ring, const int16_t *lr, uint32_t frames);
uint32_t sl_pcm_ring_read(sl_pcm_ring *ring, int16_t *lr, uint32_t frames);

#ifdef __cplusplus
}
#endif

#endif /* STARLUX_AUDIO_H */
