#ifndef MOGOS_STARLUX_LIGHT_H
#define MOGOS_STARLUX_LIGHT_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define STARLUX_LIGHT_V1_SCHEMA 1u
#define STARLUX_LIGHT_V1_INPUT_WORDS 106u
#define STARLUX_LIGHT_V1_INPUT_BYTES 856u
#define STARLUX_LIGHT_V1_PACKET_WORDS 1352u
#define STARLUX_LIGHT_V1_PACKET_BYTES 5408u
#define STARLUX_LIGHT_V1_SCENE_WORDS 8u
#define STARLUX_LIGHT_V1_SCRATCH_WORDS 14u

enum {
    STARLUX_LIGHT_OK = 0,
    STARLUX_LIGHT_BAD_ARGUMENT = -1,
    STARLUX_LIGHT_UNSUPPORTED_SCHEMA = -2,
    STARLUX_LIGHT_BAD_INPUT = -3,
    STARLUX_LIGHT_SHORT_OUTPUT = -4,
    STARLUX_LIGHT_RUNTIME_ERROR = -5
};

typedef struct starlux_light_workspace {
    double input[STARLUX_LIGHT_V1_INPUT_WORDS];
    double packet[STARLUX_LIGHT_V1_PACKET_WORDS];
    double scene[STARLUX_LIGHT_V1_SCENE_WORDS];
    double scratch[STARLUX_LIGHT_V1_SCRATCH_WORDS];
} starlux_light_workspace;

/*
 * The input envelope starts with two little-endian u32 words (schema and
 * size), followed by 106 little-endian binary64 words. See README.md for
 * record offsets. Input, workspace and output spans must be disjoint.
 * On failure the output span is untouched. The floating environment must
 * use round-to-nearest. Each simultaneous call needs its own workspace.
 */
int32_t starlux_light_shade_with_workspace_v1(
    const uint8_t *input, uint32_t input_bytes,
    uint8_t *output, uint32_t output_capacity,
    starlux_light_workspace *workspace);

/* Convenience entry with automatic local workspace. */
int32_t starlux_light_shade_v1(
    const uint8_t *input, uint32_t input_bytes,
    uint8_t *output, uint32_t output_capacity);

#ifdef __cplusplus
}
#endif
#endif
