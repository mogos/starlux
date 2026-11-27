#include "starlux_audio.h"
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static void write_i32_le(uint8_t *dst, int32_t v) {
  uint32_t u = (uint32_t)v;
  dst[0] = (uint8_t)(u & 0xFFu);
  dst[1] = (uint8_t)((u >> 8) & 0xFFu);
  dst[2] = (uint8_t)((u >> 16) & 0xFFu);
  dst[3] = (uint8_t)((u >> 24) & 0xFFu);
}

static uint32_t pcm_digest(const int16_t *pcm, size_t samples) {
  uint32_t h = 2166136261u;
  for (size_t i = 0; i < samples; ++i) {
    uint16_t u = (uint16_t)pcm[i];
    uint32_t lo = u & 0xFFu;
    uint32_t hi = (u >> 8) & 0xFFu;
    h = (h + lo * 131u + hi * 257u) * 65599u;
  }
  return h;
}

static int32_t block_peak_abs(const int16_t *pcm, size_t samples) {
  int32_t max_abs = 0;
  for (size_t i = 0; i < samples; ++i) {
    int32_t a = pcm[i] < 0 ? -pcm[i] : pcm[i];
    if (a > max_abs) max_abs = a;
  }
  return max_abs;
}

int main(void) {
  size_t bytes = sl_audio_bytes();
  size_t align = sl_audio_align();
  if (bytes == 0u || align == 0u) return 10;

  unsigned char raw[4096];
  unsigned char raw2[4096];
  if (bytes + align > sizeof(raw)) return 11;

  /* Floor P22: short storage and misaligned storage must fail cleanly before mutation. */
  sl_audio *bad = NULL;
  if (sl_audio_init(raw, bytes - 1u, &bad) != SL_AUDIO_ERR_STORAGE) return 12;
  uintptr_t base = (uintptr_t)raw;
  uintptr_t aligned_addr = (base + align - 1u) & ~(align - 1u);
  uintptr_t base2 = (uintptr_t)raw2;
  uintptr_t aligned_addr2 = (base2 + align - 1u) & ~(align - 1u);
  if (align > 1u) {
    if (sl_audio_init((void *)(aligned_addr + 1u), bytes, &bad) != SL_AUDIO_ERR_ALIGN) return 13;
  }

  /* Dirty caller storage -> reinit produces a clean fresh instance */
  memset((void *)aligned_addr, 0xA5, bytes);
  sl_audio *engine = NULL;
  if (sl_audio_init((void *)aligned_addr, bytes, &engine) != SL_AUDIO_OK) return 14;
  if (sl_audio_active(engine) != 0u || sl_audio_quanta(engine) != 0u) return 15;

  /* Submit control.press (cue 27, 3360 frames = 26.25 quanta) at frame 0, center pan, rate 100 */
  uint8_t cmd[SL_AUDIO_CMD_WIRE_BYTES];
  int32_t fields[12] = { 0, 1, 0, 1, 1, 7, 27, 32768, 0, 100, -1, 0 };
  for (size_t i = 0; i < 12u; ++i) write_i32_le(cmd + i * 4u, fields[i]);
  if (sl_audio_submit(engine, cmd, sizeof(cmd)) != SL_AUDIO_OK) return 16;

  /* P0-SL2 Falsifier 1: Render 4 x 128-frame quanta (512 frames total) and prove:
   *  - every quantum past frame 128 renders non-zero audio (state persists across quanta),
   *  - 4 x 128 frames equals 2 x 256 frames bit-for-bit (chunk-repartition invariance in C),
   *  - draining to rest clears sl_audio_active and freezes sl_audio_quanta on idle calls.
   */
  int16_t multi_128[512 * 2];
  for (size_t q = 0u; q < 4u; ++q) {
    int16_t *dst = multi_128 + q * 256u;
    size_t got = sl_audio_s16(engine, dst, 128u);
    if (got != 128u) return 17;
    if (q == 0u && (dst[0] != 0 || dst[1] != 0)) return 18;
    int32_t q_peak = block_peak_abs(dst, 256u);
    if (q_peak == 0 || q_peak > SL_AUDIO_CEILING_S16) return 19;
    if (sl_audio_active(engine) != 1u) return 32;
  }
  if (sl_audio_quanta(engine) != 4u) return 33;

  sl_audio *engine_256 = NULL;
  if (sl_audio_init((void *)aligned_addr2, bytes, &engine_256) != SL_AUDIO_OK) return 34;
  if (sl_audio_submit(engine_256, cmd, sizeof(cmd)) != SL_AUDIO_OK) return 35;
  int16_t multi_256[512 * 2];
  if (sl_audio_s16(engine_256, multi_256, 256u) != 256u) return 36;
  if (sl_audio_s16(engine_256, multi_256 + 512u, 256u) != 256u) return 37;
  if (memcmp(multi_128, multi_256, sizeof(multi_128)) != 0) return 38;

  /* Drain control.press to rest and verify zero-idle quanta invariant */
  int16_t drain_buf[128 * 2];
  for (size_t q = 4u; q < 32u && sl_audio_active(engine) != 0u; ++q) {
    if (sl_audio_s16(engine, drain_buf, 128u) != 128u) return 39;
  }
  if (sl_audio_active(engine) != 0u) return 40;
  uint32_t settled_quanta = sl_audio_quanta(engine);
  if (sl_audio_s16(engine, drain_buf, 128u) != 128u) return 41;
  if (sl_audio_quanta(engine) != settled_quanta) return 42;

  /* P0-SL2 Falsifier 2: Delayed multi-hit stroke fires across silent inter-hit gap!
   * Hit 0 at frame 0 (rate 400 -> 840 frames = 6.56 quanta) + Hit 1 at frame 2048 (quantum 16).
   */
  if (sl_audio_init((void *)aligned_addr, bytes, &engine) != SL_AUDIO_OK) return 43;
  int32_t hit0[12] = { 0, 1, 0, 2, 1, 7, 27, 32768, 0, 400, -1, 0 };
  int32_t hit1[12] = { 2048, 1, 0, 2, 1, 11, 27, 32768, 0, 400, -1, 200 };
  uint8_t cmd0[SL_AUDIO_CMD_WIRE_BYTES];
  uint8_t cmd1[SL_AUDIO_CMD_WIRE_BYTES];
  for (size_t i = 0; i < 12u; ++i) {
    write_i32_le(cmd0 + i * 4u, hit0[i]);
    write_i32_le(cmd1 + i * 4u, hit1[i]);
  }
  if (sl_audio_submit(engine, cmd0, sizeof(cmd0)) != SL_AUDIO_OK) return 44;
  if (sl_audio_submit(engine, cmd1, sizeof(cmd1)) != SL_AUDIO_OK) return 45;

  int32_t gap_peak = -1;
  int32_t hit1_peak = 0;
  for (size_t q = 0u; q < 32u; ++q) {
    if (sl_audio_s16(engine, drain_buf, 128u) != 128u) return 46;
    int32_t pk = block_peak_abs(drain_buf, 256u);
    if (q == 15u) {
      /* Frames 1920..2047: Hit 0 ended & DC settled, Hit 1 due at 2048 -> engine stays active! */
      gap_peak = pk;
      if (sl_audio_active(engine) != 1u) return 47;
    }
    if (q == 16u || q == 17u) {
      if (pk > hit1_peak) hit1_peak = pk;
    }
  }
  if (gap_peak <= 0 || gap_peak >= 200 || hit1_peak < 600 || hit1_peak < gap_peak * 4) return 48;
  if (sl_audio_active(engine) != 0u) return 49;

  /* Verify f32 adapter matches s16 exact conversion */
  sl_audio *engine_f = NULL;
  if (sl_audio_init((void *)aligned_addr, bytes, &engine_f) != SL_AUDIO_OK) return 20;
  if (sl_audio_submit(engine_f, cmd, sizeof(cmd)) != SL_AUDIO_OK) return 21;
  float lr_f32[128 * 2];
  if (sl_audio_f32(engine_f, lr_f32, 128u) != 128u) return 22;
  for (size_t i = 0; i < 256u; ++i) {
    float expected = (multi_128[i] == 0) ? 0.0f : ((float)multi_128[i] / 32768.0f);
    if (lr_f32[i] != expected) return 23;
  }

  /* Verify SPSC 4096-frame stereo PCM ring wrap & full preservation (Floors P19, P20) */
  sl_pcm_ring ring;
  sl_pcm_ring_init(&ring);
  int16_t ramp[2000 * 2];
  int16_t out[2000 * 2];
  for (int i = 0; i < 2000; ++i) {
    ramp[i * 2] = (int16_t)(i + 1);
    ramp[i * 2 + 1] = (int16_t)(-(i + 1));
  }
  for (int round = 0; round < 3; ++round) {
    if (sl_pcm_ring_write(&ring, ramp, 2000u) != 2000u) return 24;
    if (sl_pcm_ring_read(&ring, out, 2000u) != 2000u) return 25;
    if (memcmp(ramp, out, sizeof(ramp)) != 0) return 26;
  }
  if (sl_pcm_ring_available(&ring) != 0u) return 27;

  /* Full ring rejects excess frames without overwriting unread data */
  int16_t blk[1024 * 2];
  for (int i = 0; i < 1024; ++i) { blk[i * 2] = (int16_t)(i + 10); blk[i * 2 + 1] = (int16_t)(i + 20); }
  for (int k = 0; k < 4; ++k) {
    if (sl_pcm_ring_write(&ring, blk, 1024u) != 1024u) return 28;
  }
  if (sl_pcm_ring_write(&ring, blk, 16u) != 0u) return 29;
  int16_t check[1024 * 2];
  if (sl_pcm_ring_read(&ring, check, 1024u) != 1024u) return 30;
  if (memcmp(blk, check, sizeof(blk)) != 0) return 31;

  int32_t first_peak = block_peak_abs(multi_128, 256u);
  printf("C_AUDIO_OK digest=%u digest512=%u peak=%d hit1_peak=%d\n",
    pcm_digest(multi_128, 256u), pcm_digest(multi_128, 1024u), first_peak, hit1_peak);
  return 0;
}
