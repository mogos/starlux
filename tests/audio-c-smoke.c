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

int main(void) {
  size_t bytes = sl_audio_bytes();
  size_t align = sl_audio_align();
  if (bytes == 0u || align == 0u) return 10;

  unsigned char raw[4096];
  if (bytes + align > sizeof(raw)) return 11;

  /* Floor P22: short storage and misaligned storage must fail cleanly before mutation. */
  sl_audio *bad = NULL;
  if (sl_audio_init(raw, bytes - 1u, &bad) != SL_AUDIO_ERR_STORAGE) return 12;
  uintptr_t base = (uintptr_t)raw;
  uintptr_t aligned_addr = (base + align - 1u) & ~(align - 1u);
  if (align > 1u) {
    if (sl_audio_init((void *)(aligned_addr + 1u), bytes, &bad) != SL_AUDIO_ERR_ALIGN) return 13;
  }

  /* Dirty caller storage -> reinit produces a clean fresh instance */
  memset((void *)aligned_addr, 0xA5, bytes);
  sl_audio *engine = NULL;
  if (sl_audio_init((void *)aligned_addr, bytes, &engine) != SL_AUDIO_OK) return 14;
  if (sl_audio_active(engine) != 0u || sl_audio_quanta(engine) != 0u) return 15;

  /* Submit control.press (cue 27) at frame 0, center pan, rate 100 */
  uint8_t cmd[SL_AUDIO_CMD_WIRE_BYTES];
  int32_t fields[12] = { 0, 1, 0, 1, 1, 7, 27, 32768, 0, 100, -1, 0 };
  for (size_t i = 0; i < 12u; ++i) write_i32_le(cmd + i * 4u, fields[i]);
  if (sl_audio_submit(engine, cmd, sizeof(cmd)) != SL_AUDIO_OK) return 16;

  int16_t lr_s16[128 * 2];
  size_t got = sl_audio_s16(engine, lr_s16, 128u);
  if (got != 128u) return 17;
  if (lr_s16[0] != 0 || lr_s16[1] != 0) return 18;
  int32_t max_abs = 0;
  for (size_t i = 0; i < 256u; ++i) {
    int32_t a = lr_s16[i] < 0 ? -lr_s16[i] : lr_s16[i];
    if (a > max_abs) max_abs = a;
  }
  if (max_abs == 0 || max_abs > SL_AUDIO_CEILING_S16) return 19;

  /* Verify f32 adapter matches s16 exact conversion */
  sl_audio *engine_f = NULL;
  if (sl_audio_init((void *)aligned_addr, bytes, &engine_f) != SL_AUDIO_OK) return 20;
  if (sl_audio_submit(engine_f, cmd, sizeof(cmd)) != SL_AUDIO_OK) return 21;
  float lr_f32[128 * 2];
  if (sl_audio_f32(engine_f, lr_f32, 128u) != 128u) return 22;
  for (size_t i = 0; i < 256u; ++i) {
    float expected = (lr_s16[i] == 0) ? 0.0f : ((float)lr_s16[i] / 32768.0f);
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

  printf("C_AUDIO_OK digest=%u peak=%d\n", pcm_digest(lr_s16, 256u), max_abs);
  return 0;
}
