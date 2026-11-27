#include "starlux.h"
#include <float.h>
#include <math.h>

/* Only this translation unit depends on the generated runtime. The caller ABI
 * uses binary64 buffers directly and does not allocate or serialize JSON. */
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

_Static_assert(sizeof(double) == 8 && DBL_MANT_DIG == 53, "Starlux requires binary64");

int starlux_magnetic_frame(const double *input, size_t input_count, double *output, size_t output_count) {
  if (input == NULL || output == NULL ||
      input_count != STARLUX_MAGNETIC_INPUT_COUNT || output_count < STARLUX_MAGNETIC_OUTPUT_COUNT) {
    return STARLUX_MAGNETIC_BAD_INPUT;
  }
  for (size_t i = 0; i < input_count; ++i) {
    if (!isfinite(input[i])) return STARLUX_MAGNETIC_BAD_INPUT;
  }
  static _Thread_local ss_ctx context = {0};
  ss_ctx *ctx = &context;
  memset(&app, 0, sizeof(app));
  app.root = (ss_meter){
    .instruction_limit = UINT64_C(100000000),
    .allocation_limit = UINT64_C(1000000),
    .output_limit = UINT64_C(1048576),
  };
  if (setjmp(ctx->escape)) {
    ss_app_dispose();
    return STARLUX_MAGNETIC_RUNTIME_ERROR;
  }
  ss_val request = ss_seq_new(ctx, SS_ARR);
  for (size_t i = 0; i < input_count; ++i) ss_push(ctx, request, ss_num(input[i]));
  const ss_val result = ss_dispatch(ctx, 0, request);
  if (result.kind != SS_ARR || result.seq->len != STARLUX_MAGNETIC_OUTPUT_COUNT) {
    ss_app_dispose();
    return STARLUX_MAGNETIC_BAD_INPUT;
  }
  for (size_t i = 0; i < STARLUX_MAGNETIC_OUTPUT_COUNT; ++i) {
    output[i] = ss_native_source_item(result.seq, i).num;
  }
  ss_app_dispose();
  return STARLUX_MAGNETIC_OK;
}
