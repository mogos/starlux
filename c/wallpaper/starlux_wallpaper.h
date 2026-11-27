#ifndef MOGOS_STARLUX_WALLPAPER_H
#define MOGOS_STARLUX_WALLPAPER_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define STARLUX_WALLPAPER_V1_SCHEMA 1u
#define STARLUX_WALLPAPER_V1_CONFIG_WORDS 48u
#define STARLUX_WALLPAPER_V1_STATE_WORDS 40u
#define STARLUX_WALLPAPER_V1_INPUT_WORDS 64u
#define STARLUX_WALLPAPER_V1_LAYERS_WORDS 192u
#define STARLUX_WALLPAPER_V1_LIGHT_BRIDGE_WORDS 64u
#define STARLUX_WALLPAPER_V1_FRAME_WORDS 96u
#define STARLUX_WALLPAPER_V1_RECIPE_WORDS 120u
#define STARLUX_WALLPAPER_V1_SCRATCH_WORDS 64u
#define STARLUX_WALLPAPER_V1_WORKSPACE_WORDS 688u
#define STARLUX_WALLPAPER_V1_WORKSPACE_BYTES 5504u
#define STARLUX_WALLPAPER_V1_FRAME_BYTES 384u
#define STARLUX_WALLPAPER_V1_RECIPE_BYTES 512u
#define STARLUX_WALLPAPER_V1_STEP_INPUT_BYTES 2760u
#define STARLUX_WALLPAPER_V1_STEP_OUTPUT_BYTES 1224u
#define STARLUX_WALLPAPER_V1_ALLOCATION_LIMIT 0u

enum {
    STARLUX_WALLPAPER_OK = 0,
    STARLUX_WALLPAPER_BAD_ARGUMENT = -1,
    STARLUX_WALLPAPER_UNSUPPORTED_SCHEMA = -2,
    STARLUX_WALLPAPER_BAD_INPUT = -3,
    STARLUX_WALLPAPER_SHORT_OUTPUT = -4,
    STARLUX_WALLPAPER_RUNTIME_ERROR = -5
};

typedef union starlux_wallpaper_workspace {
    double words[STARLUX_WALLPAPER_V1_WORKSPACE_WORDS];
    struct {
        double config[STARLUX_WALLPAPER_V1_CONFIG_WORDS];
        double state[STARLUX_WALLPAPER_V1_STATE_WORDS];
        double input[STARLUX_WALLPAPER_V1_INPUT_WORDS];
        double layers[STARLUX_WALLPAPER_V1_LAYERS_WORDS];
        double lightBridge[STARLUX_WALLPAPER_V1_LIGHT_BRIDGE_WORDS];
        double frame[STARLUX_WALLPAPER_V1_FRAME_WORDS];
        double recipe[STARLUX_WALLPAPER_V1_RECIPE_WORDS];
        double scratch[STARLUX_WALLPAPER_V1_SCRATCH_WORDS];
    } planes;
} starlux_wallpaper_workspace;

uint32_t starlux_wallpaper_abi_v1(void);
int32_t starlux_wallpaper_init_v1(starlux_wallpaper_workspace *workspace, uint32_t preset);
int32_t starlux_wallpaper_load_preset_v1(starlux_wallpaper_workspace *workspace, uint32_t preset);
int32_t starlux_wallpaper_step_workspace_v1(starlux_wallpaper_workspace *workspace);

/* Input is LE u32 schema and size, then config, state, input, layers as
 * binary64. Output is schema and size, frame as LE u32, then state and
 * lightBridge as LE binary64. The workspace supplies the retained recipe.
 * All spans must be disjoint. Output and workspace survive a refused call. */
int32_t starlux_wallpaper_step_v1(const uint8_t *input, uint32_t input_bytes, uint8_t *output,
    uint32_t capacity, starlux_wallpaper_workspace *workspace);

int32_t starlux_wallpaper_recipe_decode_v1(const uint8_t *input, uint32_t bytes,
    starlux_wallpaper_workspace *workspace);
int32_t starlux_wallpaper_recipe_encode_v1(const starlux_wallpaper_workspace *workspace,
    uint8_t *output, uint32_t capacity);

int32_t starlux_wallpaper_render_rows_v1(const starlux_wallpaper_workspace *workspace, uint32_t y,
    uint32_t rows, uint32_t width, uint32_t height, uint8_t *rgba, uint32_t capacity);

/* Codec staging uses one binary64 word per input byte and output byte, and
 * 64 more words for the QOI index. Callers may reuse a staging arena across
 * disjoint requests. All spans must be disjoint. Encoded lengths are optional
 * only on decode (width and height may be NULL). */
int32_t starlux_wallpaper_qoi_encode_v1(const uint8_t *rgba, uint32_t width, uint32_t height,
    uint8_t *output, uint32_t capacity, uint32_t *written, double *staging, size_t staging_words);
int32_t starlux_wallpaper_qoi_decode_v1(const uint8_t *input, uint32_t bytes, uint8_t *rgba,
    uint32_t capacity, uint32_t *width, uint32_t *height, double *staging, size_t staging_words);
int32_t starlux_wallpaper_png_encode_v1(const uint8_t *rgba, uint32_t width, uint32_t height,
    uint8_t *output, uint32_t capacity, uint32_t *written, double *staging, size_t staging_words);
int32_t starlux_wallpaper_png_decode_v1(const uint8_t *input, uint32_t bytes, uint8_t *rgba,
    uint32_t capacity, uint32_t *width, uint32_t *height, double *staging, size_t staging_words);

#ifdef __cplusplus
}
#endif
#endif
