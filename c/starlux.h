#ifndef MOGOS_STARLUX_H
#define MOGOS_STARLUX_H

#include <stdio.h>

#ifdef __cplusplus
extern "C" {
#endif

int starlux_default_knobs(FILE *output, FILE *errors);
int starlux_step_spring(const char *json, FILE *output, FILE *errors);
int starlux_step_physics(const char *json, FILE *output, FILE *errors);

#ifdef __cplusplus
}
#endif

#endif
