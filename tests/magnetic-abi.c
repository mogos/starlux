#include "starlux.h"
#include <math.h>
#include <string.h>

int main(void) {
  double input[STARLUX_MAGNETIC_INPUT_COUNT] = {0};
  double output[STARLUX_MAGNETIC_OUTPUT_COUNT];
  if (starlux_magnetic_frame(input, 0, output, STARLUX_MAGNETIC_OUTPUT_COUNT) != STARLUX_MAGNETIC_BAD_INPUT) return 1;
  input[2] = 80;
  input[3] = 80;
  input[4] = 420;
  input[5] = 350;
  input[10] = 600;
  input[11] = 860;
  input[12] = 60;
  input[13] = 44;
  input[14] = INFINITY;
  if (starlux_magnetic_frame(input, STARLUX_MAGNETIC_INPUT_COUNT, output, STARLUX_MAGNETIC_OUTPUT_COUNT) != STARLUX_MAGNETIC_BAD_INPUT) return 2;
  input[14] = 0;

  int events = 0;
  for (int i = 0; i < 320; ++i) {
    input[0] = STARLUX_MAGNETIC_STEP;
    input[1] = 8333;
    if (i == 0) input[0] = STARLUX_MAGNETIC_INIT;
    if (i == 1) {
      input[0] = STARLUX_MAGNETIC_TARGET;
      input[4] = 640;
      input[6] = 0.52;
      input[7] = 1;
    }
    if (i == 20 || i == 38) {
      input[0] = STARLUX_MAGNETIC_PICKUP;
      input[8] = i == 20;
      input[6] = input[8];
    }
    if (i == 50 || i == 180) {
      input[0] = STARLUX_MAGNETIC_VISIBILITY;
      input[8] = i == 50;
    }
    if (i == 250) input[0] = STARLUX_MAGNETIC_POSE;
    if (i == 295) {
      input[0] = STARLUX_MAGNETIC_REDUCE;
      input[8] = 1;
    }
    if (starlux_magnetic_frame(input, STARLUX_MAGNETIC_INPUT_COUNT, output, STARLUX_MAGNETIC_OUTPUT_COUNT) != STARLUX_MAGNETIC_OK) return 3;
    if (fwrite(output, sizeof(*output), STARLUX_MAGNETIC_OUTPUT_COUNT, stdout) != STARLUX_MAGNETIC_OUTPUT_COUNT) return 4;
    events |= (int)output[STARLUX_MAGNETIC_EVENTS_OUTPUT];
    memcpy(input + STARLUX_MAGNETIC_STATE_INPUT, output, STARLUX_MAGNETIC_STATE_COUNT * sizeof(*output));
  }
  if (events != 7 || output[STARLUX_MAGNETIC_ACTIVE_OUTPUT] != 0) return 5;
  return 0;
}
