#include "starlux_light.h"

#include <fenv.h>
#include <float.h>
#include "light_generated.h"

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

_Static_assert(sizeof(double) == 8 && DBL_MANT_DIG == 53 && DBL_MAX_EXP == 1024
    && FLT_EVAL_METHOD == 0, "Starlux light requires ordered binary64");

static uint32_t read_u32(const uint8_t *bytes) {
    return (uint32_t)bytes[0] | ((uint32_t)bytes[1] << 8)
        | ((uint32_t)bytes[2] << 16) | ((uint32_t)bytes[3] << 24);
}

static double read_f64(const uint8_t *bytes) {
    uint64_t bits = (uint64_t)read_u32(bytes) | ((uint64_t)read_u32(bytes + 4) << 32);
    double value;
    memcpy(&value, &bits, sizeof(value));
    return value;
}

static void write_u32(uint8_t *bytes, uint32_t word) {
    for (unsigned i = 0; i < 4; ++i) {
        bytes[i] = (uint8_t)word;
        word >>= 8;
    }
}

static ss_native_0 borrow_words(double *words, size_t count) {
    return (ss_native_0){
        .header = { .shape = &ss_shape_0, .len = count, .cap = count },
        .ptr = words,
    };
}

static int32_t shade_words(starlux_light_workspace *workspace) {
    ss_ctx context;
    memset(&context, 0, sizeof(context));
    memset(&app, 0, sizeof(app));
    app.root.instruction_limit = UINT64_C(100000000);
    app.root.allocation_limit = 0;
    if (setjmp(context.escape)) {
        ss_app_dispose();
        return STARLUX_LIGHT_RUNTIME_ERROR;
    }
    ss_native_0 input = borrow_words(workspace->input, STARLUX_LIGHT_V1_INPUT_WORDS);
    ss_native_0 packet = borrow_words(workspace->packet, STARLUX_LIGHT_V1_PACKET_WORDS);
    ss_native_0 scene = borrow_words(workspace->scene, STARLUX_LIGHT_V1_SCENE_WORDS);
    ss_native_0 scratch = borrow_words(workspace->scratch, STARLUX_LIGHT_V1_SCRATCH_WORDS);
    const int32_t status = (int32_t)LIGHT_SHADE(&context, &input, &packet, &scene, &scratch);
    ss_app_dispose();
    return status;
}

int32_t starlux_light_shade_with_workspace_v1(
    const uint8_t *input, uint32_t input_bytes, uint8_t *output, uint32_t output_capacity,
    starlux_light_workspace *workspace
) {
    if (!input || !output || !workspace || input_bytes < 8 || fegetround() != FE_TONEAREST) {
        return STARLUX_LIGHT_BAD_ARGUMENT;
    }
    if (read_u32(input) != STARLUX_LIGHT_V1_SCHEMA) return STARLUX_LIGHT_UNSUPPORTED_SCHEMA;
    if (input_bytes != STARLUX_LIGHT_V1_INPUT_BYTES || read_u32(input + 4) != input_bytes) {
        return STARLUX_LIGHT_BAD_INPUT;
    }
    if (output_capacity < STARLUX_LIGHT_V1_PACKET_BYTES) return STARLUX_LIGHT_SHORT_OUTPUT;
    for (size_t i = 0; i < STARLUX_LIGHT_V1_INPUT_WORDS; ++i) {
        const double value = read_f64(input + 8 + i * 8);
        if (!isfinite(value)) return STARLUX_LIGHT_BAD_INPUT;
        workspace->input[i] = value == 0 ? 0 : value;
    }
    const int32_t status = shade_words(workspace);
    if (status != STARLUX_LIGHT_OK) return status;
    for (size_t i = 0; i < STARLUX_LIGHT_V1_PACKET_WORDS; ++i) {
        write_u32(output + i * 4, (uint32_t)(int64_t)workspace->packet[i]);
    }
    return STARLUX_LIGHT_OK;
}

int32_t starlux_light_shade_v1(
    const uint8_t *input, uint32_t input_bytes, uint8_t *output, uint32_t output_capacity
) {
    starlux_light_workspace workspace;
    return starlux_light_shade_with_workspace_v1(input, input_bytes, output, output_capacity, &workspace);
}
