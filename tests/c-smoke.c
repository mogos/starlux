#include "starlux.h"

#include <string.h>

int main(int argc, char **argv) {
  if (argc == 1) return starlux_default_knobs(stdout, stderr);
  if (argc == 3 && strcmp(argv[1], "spring") == 0) return starlux_step_spring(argv[2], stdout, stderr);
  if (argc == 3 && strcmp(argv[1], "physics") == 0) return starlux_step_physics(argv[2], stdout, stderr);
  return 2;
}
