#ifndef MOGOS_STARLUX_H
#define MOGOS_STARLUX_H

#include <stddef.h>
#include <stdio.h>

#ifdef __cplusplus
extern "C" {
#endif

int starlux_default_knobs(FILE *output, FILE *errors);
int starlux_step_spring(const char *json, FILE *output, FILE *errors);
int starlux_step_physics(const char *json, FILE *output, FILE *errors);

/* Flat magnetic compositor ABI v1. See c/README.md for state and pose fields. */
enum {
  STARLUX_MAGNETIC_ABI_VERSION = 1,
  STARLUX_MAGNETIC_INPUT_COUNT = 76,
  STARLUX_MAGNETIC_OUTPUT_COUNT = 93,
  STARLUX_MAGNETIC_STATE_INPUT = 14,
  STARLUX_MAGNETIC_STATE_COUNT = 62,
  STARLUX_MAGNETIC_POSE_OUTPUT = 62,
  STARLUX_MAGNETIC_POSE_COUNT = 29,
  STARLUX_MAGNETIC_EVENTS_OUTPUT = 91,
  STARLUX_MAGNETIC_ACTIVE_OUTPUT = 92,
};

enum starlux_magnetic_command {
  STARLUX_MAGNETIC_INIT = 0,
  STARLUX_MAGNETIC_STEP = 1,
  STARLUX_MAGNETIC_TARGET = 2,
  STARLUX_MAGNETIC_VISIBILITY = 3,
  STARLUX_MAGNETIC_PICKUP = 4,
  STARLUX_MAGNETIC_REDUCE = 5,
  STARLUX_MAGNETIC_POSE = 6,
};

enum starlux_magnetic_status {
  STARLUX_MAGNETIC_OK = 0,
  STARLUX_MAGNETIC_BAD_INPUT = 1,
  STARLUX_MAGNETIC_RUNTIME_ERROR = 2,
};

enum starlux_magnetic_event {
  STARLUX_MAGNETIC_ABSORB = 1,
  STARLUX_MAGNETIC_RELEASE = 2,
  STARLUX_MAGNETIC_HANDOFF = 4,
};

int starlux_magnetic_frame(const double *input, size_t input_count, double *output, size_t output_count);

#ifdef __cplusplus
}
#endif

#endif
