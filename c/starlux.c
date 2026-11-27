#include "starlux.h"
#include "starlux_generated.h"

/* The starc C11 emitter includes dormant runtime helpers and compact
 * generated statements. Scope its current diagnostics to generated code. */
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

int starlux_default_knobs(FILE *output, FILE *errors) {
  return STARLUX_DEFAULT_KNOBS("null", output, errors);
}

int starlux_step_spring(const char *json, FILE *output, FILE *errors) {
  return STARLUX_STEP_SPRING(json, output, errors);
}

int starlux_step_physics(const char *json, FILE *output, FILE *errors) {
  return STARLUX_STEP_PHYSICS(json, output, errors);
}
