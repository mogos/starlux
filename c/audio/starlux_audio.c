#include "starlux_audio.h"
#include <float.h>
#include <math.h>
#include <stdalign.h>
#include <string.h>

#if defined(__GNUC__) || defined(__clang__)
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wmisleading-indentation"
#pragma GCC diagnostic ignored "-Wmissing-field-initializers"
#pragma GCC diagnostic ignored "-Wunused-function"
#pragma GCC diagnostic ignored "-Wunused-label"
#pragma GCC diagnostic ignored "-Wunused-parameter"
#endif
#include "module.c"
#if defined(__GNUC__) || defined(__clang__)
#pragma GCC diagnostic pop
#endif

_Static_assert(sizeof(double) == 8 && DBL_MANT_DIG == 53, "Starlux audio requires IEEE binary64");
_Static_assert(sizeof(float) == 4 && FLT_MANT_DIG == 24, "Starlux audio requires IEEE binary32");

typedef struct sl_audio_cmd_record {
  int32_t fields[12];
} sl_audio_cmd_record;

struct sl_audio {
  uint32_t magic;
  uint32_t frame;
  uint32_t active;
  uint32_t quanta;
  int32_t  peak_hold;
  int32_t  muted;
  uint32_t cmd_count;
  sl_audio_cmd_record cmds[16];
};

#define SL_AUDIO_MAGIC 0x534C4155u

static int32_t sl_read_i32_le(const uint8_t *p) {
  uint32_t u = ((uint32_t)p[0])
             | ((uint32_t)p[1] << 8)
             | ((uint32_t)p[2] << 16)
             | ((uint32_t)p[3] << 24);
  return (int32_t)u;
}

size_t sl_audio_bytes(void) {
  return sizeof(struct sl_audio);
}

size_t sl_audio_align(void) {
  return alignof(struct sl_audio);
}

int sl_audio_init(void *storage, size_t bytes, sl_audio **out) {
  if (storage == NULL || out == NULL) return SL_AUDIO_ERR_BAD_ARG;
  if (bytes < sizeof(struct sl_audio)) return SL_AUDIO_ERR_STORAGE;
  if (((uintptr_t)storage % alignof(struct sl_audio)) != 0u) return SL_AUDIO_ERR_ALIGN;
  memset(storage, 0, sizeof(struct sl_audio));
  sl_audio *s = (sl_audio *)storage;
  s->magic = SL_AUDIO_MAGIC;
  *out = s;
  return SL_AUDIO_OK;
}

int sl_audio_submit(sl_audio *s, const uint8_t *cmd_le, size_t len) {
  if (s == NULL || s->magic != SL_AUDIO_MAGIC || cmd_le == NULL) return SL_AUDIO_ERR_BAD_ARG;
  if (len != SL_AUDIO_CMD_WIRE_BYTES) return SL_AUDIO_ERR_BAD_ARG;
  if (s->muted) return SL_AUDIO_OK;
  if (s->cmd_count >= 16u) return SL_AUDIO_ERR_STORAGE;
  sl_audio_cmd_record *rec = &s->cmds[s->cmd_count];
  for (size_t i = 0; i < 12u; ++i) {
    rec->fields[i] = sl_read_i32_le(cmd_le + i * 4u);
  }
  if (rec->fields[6] < 1 || rec->fields[6] > 250) return SL_AUDIO_ERR_BAD_ARG;
  s->cmd_count += 1u;
  s->active = 1u;
  return SL_AUDIO_OK;
}

int sl_audio_cancel(sl_audio *s, uint32_t subject, uint32_t epoch) {
  if (s == NULL || s->magic != SL_AUDIO_MAGIC) return SL_AUDIO_ERR_BAD_ARG;
  uint32_t kept = 0u;
  for (uint32_t i = 0u; i < s->cmd_count; ++i) {
    int match_s = (subject == 0u || (uint32_t)s->cmds[i].fields[3] == subject);
    int match_e = (epoch == 0u || (uint32_t)s->cmds[i].fields[4] == epoch);
    if (!(match_s && match_e)) {
      if (kept != i) s->cmds[kept] = s->cmds[i];
      kept += 1u;
    }
  }
  s->cmd_count = kept;
  if (kept == 0u) s->active = 0u;
  return SL_AUDIO_OK;
}

int sl_audio_mute(sl_audio *s, int muted) {
  if (s == NULL || s->magic != SL_AUDIO_MAGIC) return SL_AUDIO_ERR_BAD_ARG;
  s->muted = muted ? 1 : 0;
  if (s->muted) {
    s->cmd_count = 0u;
    s->active = 0u;
  }
  return SL_AUDIO_OK;
}

size_t sl_audio_s16(sl_audio *s, int16_t *lr, size_t frames) {
  if (s == NULL || s->magic != SL_AUDIO_MAGIC || lr == NULL || frames == 0u) return 0u;
  size_t count = frames > SL_AUDIO_MAX_BLOCK ? SL_AUDIO_MAX_BLOCK : frames;
  if (s->muted || s->cmd_count == 0u) {
    memset(lr, 0, count * 2u * sizeof(int16_t));
    s->active = 0u;
    return count;
  }

  static _Thread_local ss_ctx context = {0};
  ss_ctx *ctx = &context;
  memset(&app, 0, sizeof(app));
  app.root = (ss_meter){
    .instruction_limit = UINT64_C(200000000),
    .allocation_limit = UINT64_C(2000000),
    .output_limit = UINT64_C(2097152),
  };
  if (setjmp(ctx->escape)) {
    ss_app_dispose();
    memset(lr, 0, count * 2u * sizeof(int16_t));
    return 0u;
  }
  ss_val req = ss_seq_new(ctx, SS_ARR);
  ss_push(ctx, req, ss_num((double)count));
  ss_push(ctx, req, ss_num((double)s->cmd_count));
  for (uint32_t i = 0u; i < s->cmd_count; ++i) {
    for (size_t j = 0u; j < 12u; ++j) {
      ss_push(ctx, req, ss_num((double)s->cmds[i].fields[j]));
    }
  }
  const ss_val result = ss_dispatch(ctx, 0, req);
  if (result.kind != SS_ARR || result.seq->len < 4u + count * 2u) {
    ss_app_dispose();
    memset(lr, 0, count * 2u * sizeof(int16_t));
    return 0u;
  }
  s->active = (uint32_t)ss_native_source_item(result.seq, 0u).num;
  int32_t pk = (int32_t)ss_native_source_item(result.seq, 1u).num;
  if (pk > s->peak_hold) s->peak_hold = pk;
  for (size_t k = 0u; k < count * 2u; ++k) {
    int32_t v = (int32_t)ss_native_source_item(result.seq, 4u + k).num;
    if (v > SL_AUDIO_CEILING_S16) v = SL_AUDIO_CEILING_S16;
    if (v < -SL_AUDIO_CEILING_S16) v = -SL_AUDIO_CEILING_S16;
    lr[k] = (int16_t)v;
  }
  ss_app_dispose();
  s->frame += (uint32_t)count;
  s->quanta += 1u;
  s->cmd_count = 0u;
  return count;
}

size_t sl_audio_f32(sl_audio *s, float *lr, size_t frames) {
  if (s == NULL || lr == NULL || frames == 0u) return 0u;
  int16_t tmp[SL_AUDIO_MAX_BLOCK * 2u];
  size_t got = sl_audio_s16(s, tmp, frames);
  for (size_t k = 0u; k < got * 2u; ++k) {
    lr[k] = (tmp[k] == 0) ? 0.0f : ((float)tmp[k] / 32768.0f);
  }
  return got;
}

uint32_t sl_audio_active(const sl_audio *s) {
  if (s == NULL || s->magic != SL_AUDIO_MAGIC) return 0u;
  return s->active;
}

uint32_t sl_audio_quanta(const sl_audio *s) {
  if (s == NULL || s->magic != SL_AUDIO_MAGIC) return 0u;
  return s->quanta;
}

int32_t sl_audio_peak_hold(const sl_audio *s) {
  if (s == NULL || s->magic != SL_AUDIO_MAGIC) return 0;
  return s->peak_hold;
}

/* SPSC 4096-frame stereo PCM ring (Floors P19, P20, P21). */
void sl_pcm_ring_init(sl_pcm_ring *ring) {
  if (ring == NULL) return;
  memset(ring, 0, sizeof(*ring));
}

uint32_t sl_pcm_ring_available(const sl_pcm_ring *ring) {
  if (ring == NULL) return 0u;
  return ring->write_idx - ring->read_idx;
}

uint32_t sl_pcm_ring_free(const sl_pcm_ring *ring) {
  if (ring == NULL) return 0u;
  return SL_AUDIO_RING_FRAMES - sl_pcm_ring_available(ring);
}

uint32_t sl_pcm_ring_write(sl_pcm_ring *ring, const int16_t *lr, uint32_t frames) {
  if (ring == NULL || lr == NULL || frames == 0u) return 0u;
  uint32_t space = sl_pcm_ring_free(ring);
  uint32_t n = frames < space ? frames : space;
  uint32_t mask = SL_AUDIO_RING_FRAMES - 1u;
  uint32_t w = ring->write_idx;
  for (uint32_t i = 0u; i < n; ++i) {
    uint32_t slot = (w + i) & mask;
    ring->samples[slot * 2u] = lr[i * 2u];
    ring->samples[slot * 2u + 1u] = lr[i * 2u + 1u];
  }
  ring->write_idx = w + n;
  return n;
}

uint32_t sl_pcm_ring_read(sl_pcm_ring *ring, int16_t *lr, uint32_t frames) {
  if (ring == NULL || lr == NULL || frames == 0u) return 0u;
  uint32_t avail = sl_pcm_ring_available(ring);
  uint32_t n = frames < avail ? frames : avail;
  uint32_t mask = SL_AUDIO_RING_FRAMES - 1u;
  uint32_t r = ring->read_idx;
  for (uint32_t i = 0u; i < n; ++i) {
    uint32_t slot = (r + i) & mask;
    lr[i * 2u] = ring->samples[slot * 2u];
    lr[i * 2u + 1u] = ring->samples[slot * 2u + 1u];
  }
  ring->read_idx = r + n;
  if (n < frames) {
    ring->underruns += 1u;
    memset(lr + n * 2u, 0, (size_t)(frames - n) * 2u * sizeof(int16_t));
  }
  return n;
}
