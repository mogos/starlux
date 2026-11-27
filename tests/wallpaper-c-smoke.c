#include "starlux_wallpaper.h"
#include <assert.h>
#include <inttypes.h>
#include <stdio.h>
#include <string.h>

_Static_assert(sizeof(starlux_wallpaper_workspace) == 5504, "Flat ABI size");

static uint32_t hash(uint32_t digest, const uint8_t *bytes, size_t length) {
    for (size_t i = 0; i < length; ++i) digest = digest * UINT32_C(65599) + bytes[i];
    return digest;
}

static void le32(uint8_t *bytes, uint32_t value) {
    for (unsigned i = 0; i < 4; ++i) bytes[i] = (uint8_t)(value >> (i * 8));
}

static void le64(uint8_t *bytes, double value) {
    uint64_t bits;
    memcpy(&bits, &value, sizeof(bits));
    le32(bytes, (uint32_t)bits);
    le32(bytes + 4, (uint32_t)(bits >> 32));
}

int main(void) {
    starlux_wallpaper_workspace a, b;
    uint8_t recipe[512], clone[512];
    uint32_t digest = 1;
    assert(starlux_wallpaper_abi_v1() == 1);
    assert(starlux_wallpaper_init_v1(&a, 1) == 0);
    assert(starlux_wallpaper_init_v1(&b, 1) == 0);
    for (uint32_t id = 1; id <= 200; ++id) {
        assert(starlux_wallpaper_load_preset_v1(&a, id) == 0);
        assert(starlux_wallpaper_recipe_encode_v1(&a, recipe, sizeof(recipe)) == 0);
        assert(starlux_wallpaper_recipe_decode_v1(recipe, sizeof(recipe), &b) == 0);
        assert(starlux_wallpaper_recipe_encode_v1(&b, clone, sizeof(clone)) == 0);
        assert(memcmp(recipe, clone, sizeof(recipe)) == 0);
        digest = hash(digest, recipe, sizeof(recipe));
    }
    recipe[17] ^= 1;
    assert(starlux_wallpaper_recipe_decode_v1(recipe, sizeof(recipe), &b) == STARLUX_WALLPAPER_BAD_INPUT);
    assert(starlux_wallpaper_recipe_encode_v1(&b, recipe, sizeof(recipe)) == 0);
    assert(memcmp(recipe, clone, sizeof(recipe)) == 0);

    uint8_t in[STARLUX_WALLPAPER_V1_STEP_INPUT_BYTES], out[STARLUX_WALLPAPER_V1_STEP_OUTPUT_BYTES];
    assert(starlux_wallpaper_load_preset_v1(&a, 1) == 0);
    a.planes.input[0] = 1;
    le32(in, 1); le32(in + 4, sizeof(in));
    for (unsigned i = 0; i < 344; ++i) le64(in + 8 + i * 8, a.words[i]);
    memset(out, 0x23, sizeof(out));
    assert(starlux_wallpaper_step_v1(in, sizeof(in), out, sizeof(out) - 1, &a) == STARLUX_WALLPAPER_SHORT_OUTPUT);
    assert(out[0] == 0x23 && out[sizeof(out) - 1] == 0x23 && a.planes.frame[0] == 0);
    assert(starlux_wallpaper_step_v1(in, sizeof(in), out, sizeof(out), &a) == 0);
    assert(a.planes.state[20] == 0 && a.planes.frame[3] == 27);
    digest = hash(digest, out + 8, STARLUX_WALLPAPER_V1_FRAME_BYTES);

    uint8_t rgba[60], qoi[160], png[131], decoded[60];
    double staging[512];
    uint32_t qoi_bytes, png_bytes, width, height;
    assert(starlux_wallpaper_render_rows_v1(&a, 0, 3, 5, 3, rgba, sizeof(rgba)) == 0);
    assert(starlux_wallpaper_qoi_encode_v1(rgba, 5, 3, qoi, sizeof(qoi), &qoi_bytes, staging, 512) == 0);
    assert(starlux_wallpaper_qoi_decode_v1(qoi, qoi_bytes, decoded, sizeof(decoded), &width, &height, staging, 512) == 0);
    assert(width == 5 && height == 3 && memcmp(rgba, decoded, sizeof(rgba)) == 0);
    assert(starlux_wallpaper_png_encode_v1(rgba, 5, 3, png, sizeof(png), &png_bytes, staging, 512) == 0);
    assert(png_bytes == sizeof(png));
    assert(starlux_wallpaper_png_decode_v1(png, png_bytes, decoded, sizeof(decoded), &width, &height, staging, 512) == 0);
    assert(width == 5 && height == 3 && memcmp(rgba, decoded, sizeof(rgba)) == 0);

    digest = hash(hash(hash(digest, rgba, sizeof(rgba)), qoi, qoi_bytes), png, png_bytes);
    printf("wallpaper parity digest %" PRIu32 "\n", digest);
    assert(digest == UINT32_C(3574483510));

    png[png_bytes - 1] ^= 1;
    memset(decoded, 0x5a, sizeof(decoded));
    assert(starlux_wallpaper_png_decode_v1(png, png_bytes, decoded, sizeof(decoded), NULL, NULL, staging, 512)
        == STARLUX_WALLPAPER_BAD_INPUT);
    for (size_t i = 0; i < sizeof(decoded); ++i) assert(decoded[i] == 0x5a);
    return 0;
}
