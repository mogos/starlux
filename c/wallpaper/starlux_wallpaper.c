#include "starlux_wallpaper.h"

#include <float.h>
#include <math.h>
#include <stdlib.h>
#include <string.h>

#include "wallpaper_generated.h"

/* The JSON adapters are private. Refuse physical allocation in the kernel
 * even if a future emitter bypasses the logical allocation meter. */
static void *no_heap(size_t bytes) { (void)bytes; return NULL; }
static void *no_resize(void *pointer, size_t bytes) { (void)pointer; return no_heap(bytes); }
static void no_free(void *pointer) { (void)pointer; }

static double runtime_trunc(double value) {
    if (!(value > -4503599627370496.0 && value < 4503599627370496.0) || value == 0) return value;
    if (value < 0 && value > -1) return -0.0;
    return (double)(int64_t)value;
}

/* The generated bitwise bridge reduces integral values modulo 2^32.
 * Binary scaling also handles the emitter's signed integer remainder. */
static double runtime_fmod(double value, double divisor) {
    if (!isfinite(value) || divisor == 0 || isnan(divisor)) return NAN;
    double magnitude = value < 0 ? -value : value;
    double step = divisor < 0 ? -divisor : divisor;
    if (magnitude < step) return value;
    while (step <= magnitude * .5) step *= 2;
    while (step >= (divisor < 0 ? -divisor : divisor)) {
        if (magnitude >= step) magnitude -= step;
        step *= .5;
    }
    return value < 0 ? -magnitude : magnitude;
}

#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wmisleading-indentation"
#pragma GCC diagnostic ignored "-Wmissing-field-initializers"
#pragma GCC diagnostic ignored "-Wunused-function"
#pragma GCC diagnostic ignored "-Wunused-label"
#pragma GCC diagnostic ignored "-Wunused-parameter"
#define malloc no_heap
#define realloc no_resize
#define free no_free
#define trunc runtime_trunc
#define fmod runtime_fmod
#define SS_APP_STORAGE _Thread_local
#include "module.c"
#undef malloc
#undef realloc
#undef free
#undef trunc
#undef fmod
#pragma GCC diagnostic pop

_Static_assert(sizeof(double) == 8 && DBL_MANT_DIG == 53 && DBL_MAX_EXP == 1024
    && FLT_EVAL_METHOD == 0, "Wallpaper requires ordered binary64");
_Static_assert(sizeof(starlux_wallpaper_workspace) == STARLUX_WALLPAPER_V1_WORKSPACE_BYTES, "Workspace ABI");
_Static_assert(offsetof(starlux_wallpaper_workspace, planes.config) == 0, "Config ABI");
_Static_assert(offsetof(starlux_wallpaper_workspace, planes.state) == 384, "State ABI");
_Static_assert(offsetof(starlux_wallpaper_workspace, planes.input) == 704, "Input ABI");
_Static_assert(offsetof(starlux_wallpaper_workspace, planes.layers) == 1216, "Layers ABI");
_Static_assert(offsetof(starlux_wallpaper_workspace, planes.lightBridge) == 2752, "Light ABI");
_Static_assert(offsetof(starlux_wallpaper_workspace, planes.frame) == 3264, "Frame ABI");
_Static_assert(offsetof(starlux_wallpaper_workspace, planes.recipe) == 4032, "Recipe ABI");
_Static_assert(offsetof(starlux_wallpaper_workspace, planes.scratch) == 4992, "Scratch ABI");

static ss_native_0 borrow(double *data, size_t count) {
    return (ss_native_0){.header = {.shape = &ss_shape_0, .len = count, .cap = count}, .ptr = data};
}

static void reset_meter(void) {
    memset(&app, 0, sizeof(app));
    app.root.instruction_limit = UINT64_C(12000000000);
    app.root.allocation_limit = STARLUX_WALLPAPER_V1_ALLOCATION_LIMIT;
    ss_app_context = NULL;
}

/* Positive and negative half ties detect directed rounding. Odd half ties
 * additionally distinguish nearest-even from nearest-toward-zero. */
static int ordered_binary64(void) {
    volatile double one = 1.0, odd = 1.0 + DBL_EPSILON, half = DBL_EPSILON / 2;
    volatile double minus_one = -1.0;
    volatile double p = one + half, n = minus_one - half, up = odd + half;
    return p == one && n == minus_one && up == 1.0 + 2.0 * DBL_EPSILON;
}

static int overlaps(const void *a, size_t an, const void *b, size_t bn) {
    uintptr_t x = (uintptr_t)a, y = (uintptr_t)b;
    if (!an || !bn) return 0;
    return x <= y ? y - x < an : x - y < bn;
}

static uint32_t read_u32(const uint8_t *p) {
    return (uint32_t)p[0] | (uint32_t)p[1] << 8 | (uint32_t)p[2] << 16 | (uint32_t)p[3] << 24;
}

static uint32_t read_be(const uint8_t *p) {
    return (uint32_t)p[3] | (uint32_t)p[2] << 8 | (uint32_t)p[1] << 16 | (uint32_t)p[0] << 24;
}

static void write_u32(uint8_t *p, uint32_t n) {
    for (unsigned i = 0; i < 4; ++i) {
        p[i] = (uint8_t)n;
        n >>= 8;
    }
}

static double read_f64(const uint8_t *p) {
    uint64_t bits = read_u32(p) | (uint64_t)read_u32(p + 4) << 32;
    double out;
    memcpy(&out, &bits, sizeof(out));
    return out;
}

static void write_f64(uint8_t *p, double value) {
    uint64_t bits;
    memcpy(&bits, &value, sizeof(bits));
    write_u32(p, (uint32_t)bits);
    write_u32(p + 4, (uint32_t)(bits >> 32));
}

uint32_t starlux_wallpaper_abi_v1(void) { return STARLUX_WALLPAPER_V1_SCHEMA; }

int32_t starlux_wallpaper_init_v1(starlux_wallpaper_workspace *w, uint32_t preset) {
    if (!w || !ordered_binary64()) return STARLUX_WALLPAPER_BAD_ARGUMENT;
    if (preset < 1 || preset > 200) return STARLUX_WALLPAPER_BAD_INPUT;
    ss_ctx context = {0};
    ss_native_0 words = borrow(w->words, 688);
    reset_meter();
    if (setjmp(context.escape)) return STARLUX_WALLPAPER_RUNTIME_ERROR;
    double status = INIT_WORDS(&context, &words);
    return status == 0 ? (int32_t)LOAD_PRESET(&context, &words, preset) : (int32_t)status;
}

int32_t starlux_wallpaper_load_preset_v1(starlux_wallpaper_workspace *w, uint32_t preset) {
    if (!w || !ordered_binary64()) return STARLUX_WALLPAPER_BAD_ARGUMENT;
    ss_ctx context = {0};
    ss_native_0 words = borrow(w->words, 688);
    reset_meter();
    if (setjmp(context.escape)) return STARLUX_WALLPAPER_RUNTIME_ERROR;
    return (int32_t)LOAD_PRESET(&context, &words, preset);
}

int32_t starlux_wallpaper_step_workspace_v1(starlux_wallpaper_workspace *w) {
    if (!w || !ordered_binary64()) return STARLUX_WALLPAPER_BAD_ARGUMENT;
    ss_ctx context = {0};
    ss_native_0 words = borrow(w->words, 688);
    reset_meter();
    if (setjmp(context.escape)) return STARLUX_WALLPAPER_RUNTIME_ERROR;
    return (int32_t)STEP_WORDS(&context, &words);
}

int32_t starlux_wallpaper_step_v1(const uint8_t *input, uint32_t bytes, uint8_t *output,
    uint32_t capacity, starlux_wallpaper_workspace *w) {
    if (!input || !output || !w || bytes < 8 || !ordered_binary64()) return STARLUX_WALLPAPER_BAD_ARGUMENT;
    if (read_u32(input) != 1) return STARLUX_WALLPAPER_UNSUPPORTED_SCHEMA;
    if (bytes != STARLUX_WALLPAPER_V1_STEP_INPUT_BYTES || read_u32(input + 4) != bytes) return STARLUX_WALLPAPER_BAD_INPUT;
    if (capacity < STARLUX_WALLPAPER_V1_STEP_OUTPUT_BYTES) return STARLUX_WALLPAPER_SHORT_OUTPUT;
    if (overlaps(input, bytes, output, capacity) || overlaps(input, bytes, w, sizeof(*w))
        || overlaps(output, capacity, w, sizeof(*w))) return STARLUX_WALLPAPER_BAD_ARGUMENT;
    starlux_wallpaper_workspace next = *w;
    for (size_t i = 0; i < 344; ++i) {
        double value = read_f64(input + 8 + i * 8);
        if (!isfinite(value)) return STARLUX_WALLPAPER_BAD_INPUT;
        next.words[i] = value == 0 ? 0 : value;
    }
    int32_t status = starlux_wallpaper_step_workspace_v1(&next);
    if (status != 0) return status;
    write_u32(output, 1);
    write_u32(output + 4, STARLUX_WALLPAPER_V1_STEP_OUTPUT_BYTES);
    for (size_t i = 0; i < 96; ++i) write_u32(output + 8 + i * 4, (uint32_t)(int64_t)next.planes.frame[i]);
    for (size_t i = 0; i < 40; ++i) write_f64(output + 392 + i * 8, next.planes.state[i]);
    for (size_t i = 0; i < 64; ++i) write_f64(output + 712 + i * 8, next.planes.lightBridge[i]);
    *w = next;
    return 0;
}

int32_t starlux_wallpaper_recipe_decode_v1(const uint8_t *input, uint32_t bytes, starlux_wallpaper_workspace *w) {
    if (!input || !w || !ordered_binary64() || overlaps(input, bytes, w, sizeof(*w))) return STARLUX_WALLPAPER_BAD_ARGUMENT;
    if (bytes != 512) return STARLUX_WALLPAPER_BAD_INPUT;
    double values[512];
    for (size_t i = 0; i < 512; ++i) values[i] = input[i];
    ss_ctx context = {0};
    ss_native_0 data = borrow(values, 512), words = borrow(w->words, 688);
    reset_meter();
    if (setjmp(context.escape)) return STARLUX_WALLPAPER_RUNTIME_ERROR;
    return (int32_t)DECODE_WORDS(&context, &data, &words);
}

int32_t starlux_wallpaper_recipe_encode_v1(const starlux_wallpaper_workspace *w, uint8_t *out, uint32_t capacity) {
    if (!w || !out || !ordered_binary64() || overlaps(out, capacity, w, sizeof(*w))) return STARLUX_WALLPAPER_BAD_ARGUMENT;
    if (capacity < 512) return STARLUX_WALLPAPER_SHORT_OUTPUT;
    double values[512];
    ss_ctx context = {0};
    ss_native_0 data = borrow(values, 512), words = borrow((double *)w->words, 688);
    reset_meter();
    if (setjmp(context.escape)) return STARLUX_WALLPAPER_RUNTIME_ERROR;
    int32_t count = (int32_t)ENCODE_WORDS(&context, &words, &data);
    if (count < 0) return count;
    for (size_t i = 0; i < 512; ++i) out[i] = (uint8_t)values[i];
    return 0;
}

static int32_t render_span(const starlux_wallpaper_workspace *w, uint32_t x, uint32_t y,
    uint32_t count, uint32_t width, uint32_t height, uint8_t *out) {
    double values[4096];
    ss_ctx context = {0};
    ss_native_0 data = borrow(values, count * 4), words = borrow((double *)w->words, 688);
    reset_meter();
    if (setjmp(context.escape)) return STARLUX_WALLPAPER_RUNTIME_ERROR;
    int32_t bytes = (int32_t)RENDER_WORDS(&context, &words, x, y, count, width, height, &data);
    if (bytes < 0) return bytes;
    for (size_t i = 0; i < (size_t)bytes; ++i) out[i] = (uint8_t)values[i];
    return 0;
}

int32_t starlux_wallpaper_render_rows_v1(const starlux_wallpaper_workspace *w, uint32_t y,
    uint32_t rows, uint32_t width, uint32_t height, uint8_t *out, uint32_t capacity) {
    if (!w || !out || !ordered_binary64() || overlaps(out, capacity, w, sizeof(*w))) return STARLUX_WALLPAPER_BAD_ARGUMENT;
    if (!width || width > 32768 || !height || height > 32768 || y >= height || !rows || rows > height - y)
        return STARLUX_WALLPAPER_BAD_INPUT;
    if ((uint64_t)rows * width * 4 > capacity) return STARLUX_WALLPAPER_SHORT_OUTPUT;
    for (uint32_t row = 0; row < rows; ++row) {
        for (uint32_t x = 0; x < width; x += 1024) {
            uint32_t count = width - x < 1024 ? width - x : 1024;
            int32_t status = render_span(w, x, y + row, count, width, height, out + (row * width + x) * 4);
            if (status != 0) return status;
        }
    }
    return 0;
}

static int32_t safe_codec(const uint8_t *src, size_t bytes, uint8_t *dst, size_t capacity, uint32_t *first,
    uint32_t *second, double *scratch, size_t words) {
    if (!src || !dst || !scratch || (uintptr_t)scratch % _Alignof(double)
        || !ordered_binary64() || words > SIZE_MAX / sizeof(double)) return STARLUX_WALLPAPER_BAD_ARGUMENT;
    size_t storage = words * sizeof(double);
    if (overlaps(src, bytes, dst, capacity) || overlaps(src, bytes, scratch, storage)
        || overlaps(dst, capacity, scratch, storage) || overlaps(first, first ? 4 : 0, second, second ? 4 : 0))
        return STARLUX_WALLPAPER_BAD_ARGUMENT;
    for (unsigned j = 0; j < 2; ++j) {
        uint32_t *result = j ? second : first;
        if (result && (overlaps(src, bytes, result, 4) || overlaps(dst, capacity, result, 4)
            || overlaps(scratch, storage, result, 4))) return STARLUX_WALLPAPER_BAD_ARGUMENT;
    }
    if (bytes > words || capacity > words - bytes || words - bytes - capacity < 64) return STARLUX_WALLPAPER_SHORT_OUTPUT;
    return 0;
}

static int32_t run_codec(int png, int encode, const uint8_t *src, size_t bytes, uint8_t *dst, size_t capacity,
    uint32_t width, uint32_t height, double *scratch, uint32_t *written) {
    double *output = scratch + bytes;
    ss_native_0 from = borrow(scratch, bytes), to = borrow(output, capacity), cache = borrow(output + capacity, 64);
    for (size_t i = 0; i < bytes; ++i) scratch[i] = src[i];
    ss_ctx context = {0};
    reset_meter();
    if (setjmp(context.escape)) return STARLUX_WALLPAPER_RUNTIME_ERROR;
    double count;
    if (png) count = encode ? ENCODE_PNG(&context, &from, width, height, &to) : DECODE_PNG(&context, &from, &to);
    else count = encode ? ENCODE_QOI(&context, &from, width, height, &to, &cache) : DECODE_QOI(&context, &from, &to, &cache);
    if (count < 0) return (int32_t)count;
    for (size_t i = 0; i < (size_t)count; ++i) dst[i] = (uint8_t)output[i];
    if (written) *written = (uint32_t)count;
    return 0;
}

static int32_t encode_codec(int png, const uint8_t *src, uint32_t width, uint32_t height, uint8_t *dst,
    uint32_t capacity, uint32_t *written, double *scratch, size_t words) {
    if (!written) return STARLUX_WALLPAPER_BAD_ARGUMENT;
    uint64_t pixels = (uint64_t)width * height;
    if (!pixels || pixels > 1048576 || width > 16384 || height > 16384) return STARLUX_WALLPAPER_BAD_INPUT;
    int32_t status = safe_codec(src, (size_t)pixels * 4, dst, capacity, written, NULL, scratch, words);
    if (status != 0) return status;
    return run_codec(png, 1, src, (size_t)pixels * 4, dst, capacity, width, height, scratch, written);
}

static int32_t decode_codec(int png, const uint8_t *src, uint32_t bytes, uint8_t *dst, uint32_t capacity,
    uint32_t *width, uint32_t *height, double *scratch, size_t words) {
    int32_t status = safe_codec(src, bytes, dst, capacity, width, height, scratch, words);
    if (status != 0) return status;
    uint32_t offset = png ? 16 : 4;
    if (bytes < offset + 8) return STARLUX_WALLPAPER_BAD_INPUT;
    status = run_codec(png, 0, src, bytes, dst, capacity, 0, 0, scratch, NULL);
    if (status != 0) return status;
    if (width) *width = read_be(src + offset);
    if (height) *height = read_be(src + offset + 4);
    return 0;
}

int32_t starlux_wallpaper_qoi_encode_v1(const uint8_t *src, uint32_t width, uint32_t height,
    uint8_t *dst, uint32_t capacity, uint32_t *written, double *scratch, size_t words) {
    return encode_codec(0, src, width, height, dst, capacity, written, scratch, words);
}

int32_t starlux_wallpaper_qoi_decode_v1(const uint8_t *src, uint32_t bytes, uint8_t *dst,
    uint32_t capacity, uint32_t *width, uint32_t *height, double *scratch, size_t words) {
    return decode_codec(0, src, bytes, dst, capacity, width, height, scratch, words);
}

int32_t starlux_wallpaper_png_encode_v1(const uint8_t *src, uint32_t width, uint32_t height,
    uint8_t *dst, uint32_t capacity, uint32_t *written, double *scratch, size_t words) {
    return encode_codec(1, src, width, height, dst, capacity, written, scratch, words);
}

int32_t starlux_wallpaper_png_decode_v1(const uint8_t *src, uint32_t bytes, uint8_t *dst,
    uint32_t capacity, uint32_t *width, uint32_t *height, double *scratch, size_t words) {
    return decode_codec(1, src, bytes, dst, capacity, width, height, scratch, words);
}
