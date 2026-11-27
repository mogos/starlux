#include "starlux_light.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static unsigned allocations;
void *__real_malloc(size_t size);
void *__wrap_malloc(size_t size) {
    ++allocations;
    return __real_malloc(size);
}

static int failing_calls_preserve_output(uint8_t *input) {
    uint8_t guard[STARLUX_LIGHT_V1_PACKET_BYTES + 2];
    memset(guard, 0xA5, sizeof(guard));

    if (starlux_light_shade_v1(input, STARLUX_LIGHT_V1_INPUT_BYTES, guard + 1,
        STARLUX_LIGHT_V1_PACKET_BYTES - 1) != STARLUX_LIGHT_SHORT_OUTPUT) return 1;
    input[0] = 2;
    if (starlux_light_shade_v1(input, STARLUX_LIGHT_V1_INPUT_BYTES, guard + 1,
        STARLUX_LIGHT_V1_PACKET_BYTES) != STARLUX_LIGHT_UNSUPPORTED_SCHEMA) return 2;
    input[0] = 1;
    const uint8_t previous = input[7];
    input[7] = 128;
    if (starlux_light_shade_v1(input, STARLUX_LIGHT_V1_INPUT_BYTES, guard + 1,
        STARLUX_LIGHT_V1_PACKET_BYTES) != STARLUX_LIGHT_BAD_INPUT) return 3;
    input[7] = previous;
    uint8_t *scale = input + 8 + 13 * 8;
    uint8_t original[8];
    memcpy(original, scale, sizeof(original));
    memset(scale, 0, sizeof(original));
    if (starlux_light_shade_v1(input, STARLUX_LIGHT_V1_INPUT_BYTES, guard + 1,
        STARLUX_LIGHT_V1_PACKET_BYTES) != STARLUX_LIGHT_BAD_INPUT) return 4;
    memcpy(scale, original, sizeof(original));
    for (size_t i = 0; i < sizeof(guard); ++i) if (guard[i] != 0xA5) return 5;
    return 0;
}

int main(void) {
    uint8_t input[STARLUX_LIGHT_V1_INPUT_BYTES];
    uint8_t framed[STARLUX_LIGHT_V1_PACKET_BYTES + 2] = { 0xA5 };
    framed[sizeof(framed) - 1] = 0x5A;
    starlux_light_workspace workspace;
    size_t size;
    unsigned frames = 0;
    while ((size = fread(input, 1, sizeof(input), stdin)) == sizeof(input)) {
        if (frames == 0 && failing_calls_preserve_output(input)) return 1;
        const int32_t status = starlux_light_shade_with_workspace_v1(input, sizeof(input), framed + 1,
            STARLUX_LIGHT_V1_PACKET_BYTES, &workspace);
        if (status != STARLUX_LIGHT_OK) { fprintf(stderr, "frame %u status %d\n", frames, (int)status); return 2; }
        if (framed[0] != 0xA5 || framed[sizeof(framed) - 1] != 0x5A || allocations) return 3;
        if (fwrite(framed + 1, 1, STARLUX_LIGHT_V1_PACKET_BYTES, stdout) != STARLUX_LIGHT_V1_PACKET_BYTES) return 4;
        ++frames;
    }
    return ferror(stdin) || size != 0 || frames == 0;
}
