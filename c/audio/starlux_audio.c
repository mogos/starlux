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

typedef struct sl_audio_cmd_packed {
  uint32_t at_frame;
  int32_t  seq;
  int32_t  subject;
  int32_t  epoch;
  int32_t  seed;
  int16_t  hit_index;
  int16_t  cue_id;
  uint16_t gain_q15;
  int16_t  pan;
  uint16_t rate100;
  int16_t  material_override;
  int16_t  pitch_cents;
  int16_t  op;
} sl_audio_cmd_packed;

typedef struct sl_audio_mode_packed {
  uint32_t phase;
  uint32_t start_inc;
  uint32_t end_inc;
  int32_t  glide_frames;
  int32_t  env_q15;
  int32_t  decay_mul_q24;
  int32_t  total_frames;
  uint16_t weight_q15;
  uint16_t active;
} sl_audio_mode_packed;

typedef struct sl_audio_voice_packed {
  int32_t  admit_order;
  int32_t  age;
  int32_t  total_frames;
  uint32_t noise_seed;
  int32_t  noise_env_q24;
  int32_t  noise_mul_q24;
  int32_t  noise_stop_frames;
  int32_t  b0_q29;
  int32_t  a1_q29;
  int32_t  a2_q29;
  int32_t  x1;
  int32_t  x2;
  int32_t  y1;
  int32_t  y2;
  int32_t  subject;
  int32_t  epoch;
  uint16_t attack_frames;
  uint16_t release_frames;
  uint16_t gain_q15;
  uint16_t pan_l_q15;
  uint16_t pan_r_q15;
  uint16_t cue_id;
  uint8_t  state;
  uint8_t  noise_kind;
  uint8_t  fade_index;
  uint8_t  has_replacement;
  sl_audio_mode_packed modes[4];
  sl_audio_cmd_packed  replacement;
} sl_audio_voice_packed;

struct sl_audio {
  uint32_t magic;
  uint32_t active;
  uint32_t frame;
  int32_t  serial;
  int32_t  cancel_gen;
  int32_t  muted;
  int32_t  comp_gain_q15;
  int32_t  dc_x1_l;
  int32_t  dc_y1_l;
  int32_t  dc_x1_r;
  int32_t  dc_y1_r;
  int32_t  peak_hold;
  int32_t  dropped_count;
  int32_t  steal_count;
  int32_t  max_simultaneous;
  uint32_t quanta;
  uint32_t pending_len;
  sl_audio_voice_packed voices[SL_AUDIO_MAX_VOICES];
  sl_audio_cmd_packed   pending[SL_AUDIO_MAX_PENDING];
};

_Static_assert(sizeof(struct sl_audio) + alignof(struct sl_audio) <= 4096u, "sl_audio fits 4096-byte caller stack buffer");

#define SL_AUDIO_MAGIC 0x534C4155u

static int32_t sl_read_i32_le(const uint8_t *p) {
  uint32_t u = ((uint32_t)p[0])
             | ((uint32_t)p[1] << 8)
             | ((uint32_t)p[2] << 16)
             | ((uint32_t)p[3] << 24);
  return (int32_t)u;
}

static int32_t sl_clamp_i32(int32_t v, int32_t lo, int32_t hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

static void sl_init_empty_cmd(sl_audio_cmd_packed *c) {
  memset(c, 0, sizeof(*c));
  c->seed = 7;
  c->rate100 = 100u;
  c->material_override = -1;
}

static void sl_init_empty_voice(sl_audio_voice_packed *v) {
  memset(v, 0, sizeof(*v));
  v->pan_l_q15 = 23170u;
  v->pan_r_q15 = 23170u;
  v->noise_seed = 7u;
  sl_init_empty_cmd(&v->replacement);
}

static uint32_t sl_compute_active(const sl_audio *s) {
  if (s->muted) return 0u;
  if (s->pending_len > 0u) return 1u;
  for (uint32_t i = 0u; i < SL_AUDIO_MAX_VOICES; ++i) {
    if (s->voices[i].state != 0u) return 1u;
  }
  return 0u;
}

static void sl_push_cmd(ss_ctx *ctx, ss_val req, const sl_audio_cmd_packed *c) {
  ss_push(ctx, req, ss_num((double)c->at_frame));
  ss_push(ctx, req, ss_num((double)c->seq));
  ss_push(ctx, req, ss_num((double)c->hit_index));
  ss_push(ctx, req, ss_num((double)c->subject));
  ss_push(ctx, req, ss_num((double)c->epoch));
  ss_push(ctx, req, ss_num((double)c->seed));
  ss_push(ctx, req, ss_num((double)c->cue_id));
  ss_push(ctx, req, ss_num((double)c->gain_q15));
  ss_push(ctx, req, ss_num((double)c->pan));
  ss_push(ctx, req, ss_num((double)c->rate100));
  ss_push(ctx, req, ss_num((double)c->material_override));
  ss_push(ctx, req, ss_num((double)c->pitch_cents));
  ss_push(ctx, req, ss_num((double)c->op));
}

static void sl_read_cmd(ss_seq *seq, size_t base, sl_audio_cmd_packed *c) {
  c->at_frame = (uint32_t)ss_native_source_item(seq, base + 0u).num;
  c->seq = (int32_t)ss_native_source_item(seq, base + 1u).num;
  c->hit_index = (int16_t)sl_clamp_i32((int32_t)ss_native_source_item(seq, base + 2u).num, 0, 3);
  c->subject = (int32_t)ss_native_source_item(seq, base + 3u).num;
  c->epoch = (int32_t)ss_native_source_item(seq, base + 4u).num;
  c->seed = (int32_t)ss_native_source_item(seq, base + 5u).num;
  c->cue_id = (int16_t)sl_clamp_i32((int32_t)ss_native_source_item(seq, base + 6u).num, 0, 250);
  c->gain_q15 = (uint16_t)sl_clamp_i32((int32_t)ss_native_source_item(seq, base + 7u).num, 0, 32768);
  c->pan = (int16_t)sl_clamp_i32((int32_t)ss_native_source_item(seq, base + 8u).num, -32767, 32767);
  c->rate100 = (uint16_t)sl_clamp_i32((int32_t)ss_native_source_item(seq, base + 9u).num, 10, 400);
  c->material_override = (int16_t)sl_clamp_i32((int32_t)ss_native_source_item(seq, base + 10u).num, -1, 5);
  c->pitch_cents = (int16_t)sl_clamp_i32((int32_t)ss_native_source_item(seq, base + 11u).num, -1200, 1200);
  c->op = (int16_t)sl_clamp_i32((int32_t)ss_native_source_item(seq, base + 12u).num, 0, 2);
}

static void sl_push_voice(ss_ctx *ctx, ss_val req, const sl_audio_voice_packed *v) {
  ss_push(ctx, req, ss_num((double)v->state));
  ss_push(ctx, req, ss_num((double)v->admit_order));
  ss_push(ctx, req, ss_num((double)v->age));
  ss_push(ctx, req, ss_num((double)v->total_frames));
  ss_push(ctx, req, ss_num((double)v->attack_frames));
  ss_push(ctx, req, ss_num((double)v->release_frames));
  ss_push(ctx, req, ss_num((double)v->gain_q15));
  ss_push(ctx, req, ss_num((double)v->pan_l_q15));
  ss_push(ctx, req, ss_num((double)v->pan_r_q15));
  ss_push(ctx, req, ss_num((double)v->noise_kind));
  ss_push(ctx, req, ss_num((double)v->noise_seed));
  ss_push(ctx, req, ss_num((double)v->noise_env_q24));
  ss_push(ctx, req, ss_num((double)v->noise_mul_q24));
  ss_push(ctx, req, ss_num((double)v->noise_stop_frames));
  ss_push(ctx, req, ss_num((double)v->b0_q29));
  ss_push(ctx, req, ss_num((double)v->a1_q29));
  ss_push(ctx, req, ss_num((double)v->a2_q29));
  ss_push(ctx, req, ss_num((double)v->x1));
  ss_push(ctx, req, ss_num((double)v->x2));
  ss_push(ctx, req, ss_num((double)v->y1));
  ss_push(ctx, req, ss_num((double)v->y2));
  ss_push(ctx, req, ss_num((double)v->fade_index));
  ss_push(ctx, req, ss_num((double)v->subject));
  ss_push(ctx, req, ss_num((double)v->epoch));
  ss_push(ctx, req, ss_num((double)v->cue_id));
  for (size_t m = 0u; m < 4u; ++m) {
    const sl_audio_mode_packed *md = &v->modes[m];
    ss_push(ctx, req, ss_num((double)md->active));
    ss_push(ctx, req, ss_num((double)md->phase));
    ss_push(ctx, req, ss_num((double)md->start_inc));
    ss_push(ctx, req, ss_num((double)md->end_inc));
    ss_push(ctx, req, ss_num((double)md->glide_frames));
    ss_push(ctx, req, ss_num((double)md->weight_q15));
    ss_push(ctx, req, ss_num((double)md->env_q15));
    ss_push(ctx, req, ss_num((double)md->decay_mul_q24));
    ss_push(ctx, req, ss_num((double)md->total_frames));
  }
  ss_push(ctx, req, ss_num((double)v->has_replacement));
  sl_push_cmd(ctx, req, &v->replacement);
}

static void sl_read_voice(ss_seq *seq, size_t base, sl_audio_voice_packed *v) {
  v->state = (uint8_t)sl_clamp_i32((int32_t)ss_native_source_item(seq, base + 0u).num, 0, 2);
  v->admit_order = (int32_t)ss_native_source_item(seq, base + 1u).num;
  v->age = (int32_t)ss_native_source_item(seq, base + 2u).num;
  v->total_frames = (int32_t)ss_native_source_item(seq, base + 3u).num;
  v->attack_frames = (uint16_t)sl_clamp_i32((int32_t)ss_native_source_item(seq, base + 4u).num, 0, 72);
  v->release_frames = (uint16_t)sl_clamp_i32((int32_t)ss_native_source_item(seq, base + 5u).num, 0, 96);
  v->gain_q15 = (uint16_t)sl_clamp_i32((int32_t)ss_native_source_item(seq, base + 6u).num, 0, 32768);
  v->pan_l_q15 = (uint16_t)sl_clamp_i32((int32_t)ss_native_source_item(seq, base + 7u).num, 0, 32768);
  v->pan_r_q15 = (uint16_t)sl_clamp_i32((int32_t)ss_native_source_item(seq, base + 8u).num, 0, 32768);
  v->noise_kind = (uint8_t)sl_clamp_i32((int32_t)ss_native_source_item(seq, base + 9u).num, 0, 1);
  v->noise_seed = (uint32_t)ss_native_source_item(seq, base + 10u).num;
  v->noise_env_q24 = (int32_t)ss_native_source_item(seq, base + 11u).num;
  v->noise_mul_q24 = (int32_t)ss_native_source_item(seq, base + 12u).num;
  v->noise_stop_frames = (int32_t)ss_native_source_item(seq, base + 13u).num;
  v->b0_q29 = (int32_t)ss_native_source_item(seq, base + 14u).num;
  v->a1_q29 = (int32_t)ss_native_source_item(seq, base + 15u).num;
  v->a2_q29 = (int32_t)ss_native_source_item(seq, base + 16u).num;
  v->x1 = (int32_t)ss_native_source_item(seq, base + 17u).num;
  v->x2 = (int32_t)ss_native_source_item(seq, base + 18u).num;
  v->y1 = (int32_t)ss_native_source_item(seq, base + 19u).num;
  v->y2 = (int32_t)ss_native_source_item(seq, base + 20u).num;
  v->fade_index = (uint8_t)sl_clamp_i32((int32_t)ss_native_source_item(seq, base + 21u).num, 0, 96);
  v->subject = (int32_t)ss_native_source_item(seq, base + 22u).num;
  v->epoch = (int32_t)ss_native_source_item(seq, base + 23u).num;
  v->cue_id = (uint16_t)sl_clamp_i32((int32_t)ss_native_source_item(seq, base + 24u).num, 0, 250);
  for (size_t m = 0u; m < 4u; ++m) {
    size_t mb = base + 25u + m * 9u;
    sl_audio_mode_packed *md = &v->modes[m];
    md->active = ((int32_t)ss_native_source_item(seq, mb + 0u).num != 0) ? 1u : 0u;
    md->phase = (uint32_t)ss_native_source_item(seq, mb + 1u).num;
    md->start_inc = (uint32_t)ss_native_source_item(seq, mb + 2u).num;
    md->end_inc = (uint32_t)ss_native_source_item(seq, mb + 3u).num;
    md->glide_frames = (int32_t)ss_native_source_item(seq, mb + 4u).num;
    md->weight_q15 = (uint16_t)sl_clamp_i32((int32_t)ss_native_source_item(seq, mb + 5u).num, 0, 32768);
    md->env_q15 = (int32_t)ss_native_source_item(seq, mb + 6u).num;
    md->decay_mul_q24 = (int32_t)ss_native_source_item(seq, mb + 7u).num;
    md->total_frames = (int32_t)ss_native_source_item(seq, mb + 8u).num;
  }
  v->has_replacement = ((int32_t)ss_native_source_item(seq, base + 61u).num != 0) ? 1u : 0u;
  sl_read_cmd(seq, base + 62u, &v->replacement);
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
  s->comp_gain_q15 = 32768;
  for (uint32_t i = 0u; i < SL_AUDIO_MAX_VOICES; ++i) {
    sl_init_empty_voice(&s->voices[i]);
  }
  for (uint32_t p = 0u; p < SL_AUDIO_MAX_PENDING; ++p) {
    sl_init_empty_cmd(&s->pending[p]);
  }
  *out = s;
  return SL_AUDIO_OK;
}

int sl_audio_submit(sl_audio *s, const uint8_t *cmd_le, size_t len) {
  if (s == NULL || s->magic != SL_AUDIO_MAGIC || cmd_le == NULL) return SL_AUDIO_ERR_BAD_ARG;
  if (len != SL_AUDIO_CMD_WIRE_BYTES) return SL_AUDIO_ERR_BAD_ARG;
  int32_t f[12];
  for (size_t i = 0u; i < 12u; ++i) {
    f[i] = sl_read_i32_le(cmd_le + i * 4u);
  }
  if (f[6] < 1 || f[6] > 250) return SL_AUDIO_ERR_BAD_ARG;
  if (f[2] < 0 || f[2] > 3) return SL_AUDIO_ERR_BAD_ARG;
  if (s->muted) return SL_AUDIO_OK;
  if (s->pending_len >= SL_AUDIO_MAX_PENDING) {
    s->dropped_count += 1;
    return SL_AUDIO_ERR_STORAGE;
  }
  uint32_t at_frame = (uint32_t)f[0];
  int32_t dist = (int32_t)(at_frame - s->frame);
  if (dist < 0 || dist >= 2147483647) {
    s->dropped_count += 1;
    return SL_AUDIO_OK;
  }
  sl_audio_cmd_packed *rec = &s->pending[s->pending_len];
  rec->at_frame = at_frame;
  rec->seq = f[1];
  rec->hit_index = (int16_t)f[2];
  rec->subject = f[3];
  rec->epoch = f[4];
  rec->seed = f[5];
  rec->cue_id = (int16_t)f[6];
  rec->gain_q15 = (uint16_t)sl_clamp_i32(f[7], 0, 32768);
  rec->pan = (int16_t)sl_clamp_i32(f[8], -32767, 32767);
  rec->rate100 = (uint16_t)sl_clamp_i32(f[9], 10, 400);
  rec->material_override = (int16_t)sl_clamp_i32(f[10], -1, 5);
  rec->pitch_cents = (int16_t)sl_clamp_i32(f[11], -1200, 1200);
  rec->op = 0;
  s->pending_len += 1u;
  s->active = 1u;
  return SL_AUDIO_OK;
}

int sl_audio_cancel(sl_audio *s, uint32_t subject, uint32_t epoch) {
  if (s == NULL || s->magic != SL_AUDIO_MAGIC) return SL_AUDIO_ERR_BAD_ARG;
  uint32_t kept = 0u;
  for (uint32_t i = 0u; i < s->pending_len; ++i) {
    int match_s = (subject == 0u || (uint32_t)s->pending[i].subject == subject);
    int match_e = (epoch == 0u || (uint32_t)s->pending[i].epoch == epoch);
    if (!(match_s && match_e)) {
      if (kept != i) s->pending[kept] = s->pending[i];
      kept += 1u;
    }
  }
  s->pending_len = kept;
  for (uint32_t v = 0u; v < SL_AUDIO_MAX_VOICES; ++v) {
    sl_audio_voice_packed *slot = &s->voices[v];
    int match_s = (subject == 0u || (uint32_t)slot->subject == subject);
    int match_e = (epoch == 0u || (uint32_t)slot->epoch == epoch);
    int cancel_rep = (slot->has_replacement != 0u) &&
      (subject == 0u || (uint32_t)slot->replacement.subject == subject) &&
      (epoch == 0u || (uint32_t)slot->replacement.epoch == epoch);
    if (slot->state == 1u && match_s && match_e) {
      slot->state = 2u;
      slot->fade_index = 0u;
      if (cancel_rep) {
        slot->has_replacement = 0u;
        sl_init_empty_cmd(&slot->replacement);
      }
    } else if (cancel_rep) {
      slot->has_replacement = 0u;
      sl_init_empty_cmd(&slot->replacement);
    }
  }
  s->cancel_gen += 1;
  s->active = sl_compute_active(s);
  return SL_AUDIO_OK;
}

int sl_audio_mute(sl_audio *s, int muted) {
  if (s == NULL || s->magic != SL_AUDIO_MAGIC) return SL_AUDIO_ERR_BAD_ARG;
  s->muted = muted ? 1 : 0;
  if (s->muted) {
    s->pending_len = 0u;
    for (uint32_t v = 0u; v < SL_AUDIO_MAX_VOICES; ++v) {
      sl_init_empty_voice(&s->voices[v]);
    }
    s->dc_x1_l = 0;
    s->dc_y1_l = 0;
    s->dc_x1_r = 0;
    s->dc_y1_r = 0;
    s->active = 0u;
  } else {
    s->active = sl_compute_active(s);
  }
  return SL_AUDIO_OK;
}

size_t sl_audio_s16(sl_audio *s, int16_t *lr, size_t frames) {
  if (s == NULL || s->magic != SL_AUDIO_MAGIC || lr == NULL || frames == 0u) return 0u;
  size_t count = frames > SL_AUDIO_MAX_BLOCK ? SL_AUDIO_MAX_BLOCK : frames;
  if (s->muted || s->active == 0u) {
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
  ss_push(ctx, req, ss_num((double)s->frame));
  ss_push(ctx, req, ss_num((double)s->serial));
  ss_push(ctx, req, ss_num((double)s->cancel_gen));
  ss_push(ctx, req, ss_num((double)s->muted));
  ss_push(ctx, req, ss_num((double)s->comp_gain_q15));
  ss_push(ctx, req, ss_num((double)s->dc_x1_l));
  ss_push(ctx, req, ss_num((double)s->dc_y1_l));
  ss_push(ctx, req, ss_num((double)s->dc_x1_r));
  ss_push(ctx, req, ss_num((double)s->dc_y1_r));
  ss_push(ctx, req, ss_num((double)s->peak_hold));
  ss_push(ctx, req, ss_num((double)s->dropped_count));
  ss_push(ctx, req, ss_num((double)s->steal_count));
  ss_push(ctx, req, ss_num((double)s->max_simultaneous));
  ss_push(ctx, req, ss_num((double)s->quanta));
  ss_push(ctx, req, ss_num((double)s->pending_len));
  for (uint32_t v = 0u; v < SL_AUDIO_MAX_VOICES; ++v) {
    sl_push_voice(ctx, req, &s->voices[v]);
  }
  for (uint32_t p = 0u; p < s->pending_len; ++p) {
    sl_push_cmd(ctx, req, &s->pending[p]);
  }

#ifndef SL_AUDIO_EXPORT_TARGET
#define SL_AUDIO_EXPORT_TARGET 0u
#endif

  const ss_val result = ss_dispatch(ctx, SL_AUDIO_EXPORT_TARGET, req);
  if (result.kind != SS_ARR || result.seq->len < 466u) {
    ss_app_dispose();
    memset(lr, 0, count * 2u * sizeof(int16_t));
    return 0u;
  }

  uint32_t out_pending = (uint32_t)sl_clamp_i32((int32_t)ss_native_source_item(result.seq, 15u).num, 0, 64);
  size_t pcm_offset = 466u + (size_t)out_pending * 13u;
  if (result.seq->len < pcm_offset + count * 2u) {
    ss_app_dispose();
    memset(lr, 0, count * 2u * sizeof(int16_t));
    return 0u;
  }

  s->active = ((int32_t)ss_native_source_item(result.seq, 0u).num != 0) ? 1u : 0u;
  s->frame = (uint32_t)ss_native_source_item(result.seq, 1u).num;
  s->serial = (int32_t)ss_native_source_item(result.seq, 2u).num;
  s->cancel_gen = (int32_t)ss_native_source_item(result.seq, 3u).num;
  s->muted = ((int32_t)ss_native_source_item(result.seq, 4u).num != 0) ? 1 : 0;
  s->comp_gain_q15 = sl_clamp_i32((int32_t)ss_native_source_item(result.seq, 5u).num, 0, 32768);
  s->dc_x1_l = (int32_t)ss_native_source_item(result.seq, 6u).num;
  s->dc_y1_l = (int32_t)ss_native_source_item(result.seq, 7u).num;
  s->dc_x1_r = (int32_t)ss_native_source_item(result.seq, 8u).num;
  s->dc_y1_r = (int32_t)ss_native_source_item(result.seq, 9u).num;
  s->peak_hold = (int32_t)ss_native_source_item(result.seq, 10u).num;
  s->dropped_count = (int32_t)ss_native_source_item(result.seq, 11u).num;
  s->steal_count = (int32_t)ss_native_source_item(result.seq, 12u).num;
  s->max_simultaneous = (int32_t)ss_native_source_item(result.seq, 13u).num;
  s->quanta = (uint32_t)ss_native_source_item(result.seq, 14u).num;
  s->pending_len = out_pending;

  for (uint32_t v = 0u; v < SL_AUDIO_MAX_VOICES; ++v) {
    sl_read_voice(result.seq, 16u + (size_t)v * 75u, &s->voices[v]);
  }
  for (uint32_t p = 0u; p < out_pending; ++p) {
    sl_read_cmd(result.seq, 466u + (size_t)p * 13u, &s->pending[p]);
  }

  for (size_t k = 0u; k < count * 2u; ++k) {
    int32_t v = (int32_t)ss_native_source_item(result.seq, pcm_offset + k).num;
    if (v > SL_AUDIO_CEILING_S16) v = SL_AUDIO_CEILING_S16;
    if (v < -SL_AUDIO_CEILING_S16) v = -SL_AUDIO_CEILING_S16;
    lr[k] = (int16_t)v;
  }
  ss_app_dispose();
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

/* SPSC 4096-frame stereo PCM ring (Floors P19, P20, P21) with C11/C17 acquire/release atomics. */
void sl_pcm_ring_init(sl_pcm_ring *ring) {
  if (ring == NULL) return;
  memset(ring->samples, 0, sizeof(ring->samples));
  atomic_store_explicit(&ring->write_idx, 0u, memory_order_relaxed);
  atomic_store_explicit(&ring->read_idx, 0u, memory_order_relaxed);
  ring->underruns = 0u;
}

uint32_t sl_pcm_ring_available(const sl_pcm_ring *ring) {
  if (ring == NULL) return 0u;
  uint32_t w = atomic_load_explicit(&ring->write_idx, memory_order_acquire);
  uint32_t r = atomic_load_explicit(&ring->read_idx, memory_order_acquire);
  return w - r;
}

uint32_t sl_pcm_ring_free(const sl_pcm_ring *ring) {
  if (ring == NULL) return 0u;
  return SL_AUDIO_RING_FRAMES - sl_pcm_ring_available(ring);
}

uint32_t sl_pcm_ring_write(sl_pcm_ring *ring, const int16_t *lr, uint32_t frames) {
  if (ring == NULL || lr == NULL || frames == 0u) return 0u;
  uint32_t w = atomic_load_explicit(&ring->write_idx, memory_order_relaxed);
  uint32_t r = atomic_load_explicit(&ring->read_idx, memory_order_acquire);
  uint32_t space = SL_AUDIO_RING_FRAMES - (w - r);
  uint32_t n = frames < space ? frames : space;
  uint32_t mask = SL_AUDIO_RING_FRAMES - 1u;
  for (uint32_t i = 0u; i < n; ++i) {
    uint32_t slot = (w + i) & mask;
    ring->samples[slot * 2u] = lr[i * 2u];
    ring->samples[slot * 2u + 1u] = lr[i * 2u + 1u];
  }
  atomic_store_explicit(&ring->write_idx, w + n, memory_order_release);
  return n;
}

uint32_t sl_pcm_ring_read(sl_pcm_ring *ring, int16_t *lr, uint32_t frames) {
  if (ring == NULL || lr == NULL || frames == 0u) return 0u;
  uint32_t w = atomic_load_explicit(&ring->write_idx, memory_order_acquire);
  uint32_t r = atomic_load_explicit(&ring->read_idx, memory_order_relaxed);
  uint32_t avail = w - r;
  uint32_t n = frames < avail ? frames : avail;
  uint32_t mask = SL_AUDIO_RING_FRAMES - 1u;
  for (uint32_t i = 0u; i < n; ++i) {
    uint32_t slot = (r + i) & mask;
    lr[i * 2u] = ring->samples[slot * 2u];
    lr[i * 2u + 1u] = ring->samples[slot * 2u + 1u];
  }
  atomic_store_explicit(&ring->read_idx, r + n, memory_order_release);
  if (n < frames) {
    ring->underruns += 1u;
    memset(lr + n * 2u, 0, (size_t)(frames - n) * 2u * sizeof(int16_t));
  }
  return n;
}
