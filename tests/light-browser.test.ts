import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "bun:test";

function chromiumPath(): string | undefined {
  const installed = process.env.STARLUX_LIGHT_CHROMIUM ?? Bun.which("chromium") ?? Bun.which("google-chrome");
  if (installed) return installed;
  const cache = join(homedir(), ".cache/ms-playwright");
  if (!existsSync(cache)) return undefined;
  const builds = readdirSync(cache).filter((name) => /^chromium-\d+$/.test(name)).sort((a, b) => b.localeCompare(a, "en", { numeric: true }));
  return builds.map((name) => join(cache, name, "chrome-linux64/chrome")).find(existsSync);
}

const chromium = chromiumPath();
test.skipIf(chromium === undefined)("real browser pre-glyph pixels and CSS paint are bit-identical when hidden", async () => {
  const temp = mkdtempSync(join(tmpdir(), "starlux-light-browser-"));
  try {
    const entry = join(temp, "fixture.ts");
    writeFileSync(entry, `
      import { createCanvasLightGlyph, createLightInput, defaultLightPolicy, mountLightDom, paintLightCanvas,
        paintLightSource, shadeSurface } from ${JSON.stringify(resolve("src/light/index.ts"))};
      const require = (ok, message) => { if (!ok) throw new Error(message); };
      try {
        const glass = document.querySelector("main");
        const toggle = document.querySelector("input");
        const frame = { id: 7, x: 10, y: 10, width: 155, height: 110, radius: 13, blurPx: 5 };
        const mounted = mountLightDom(glass, { surfaces: [{ element: glass, frame }], sourceSwitch: toggle });
        mounted.field.samplePointer({ x: 75, y: 48 });
        mounted.field.flush();
        const physical = glass.querySelector("[data-starlux-surface]");
        const glyph = document.querySelector("[data-starlux-source]");
        const before = physical.innerHTML;
        require(physical.querySelector('[data-lux-lane="caustic"]'), "CSS caustic missing");
        require(getComputedStyle(glyph).display === "block", "CSS glyph should show");
        const beforeStats = mounted.field.metrics();
        toggle.click();
        require(getComputedStyle(glyph).display === "none", "CSS glyph should hide");
        require(physical.innerHTML === before, "CSS physical paint changed");
        require(mounted.field.metrics().frameRequests === beforeStats.frameRequests, "CSS toggle requested a frame");
        require(mounted.field.metrics().evaluations === beforeStats.evaluations, "CSS toggle evaluated optics");
        require(getComputedStyle(glyph).pointerEvents === "none", "glyph has a hit target");

        function pixels(shown, polarity) {
          const canvas = document.createElement("canvas");
          const overlay = document.createElement("canvas");
          canvas.width = overlay.width = 180;
          canvas.height = overlay.height = 130;
          const surfaceCtx = canvas.getContext("2d", { willReadFrequently: true });
          const overlayCtx = overlay.getContext("2d");
          surfaceCtx.fillStyle = polarity === "obsidian-dark" ? "#30343a" : "#e8e0d2";
          surfaceCtx.fillRect(0, 0, 180, 130);
          const input = createLightInput(frame, { ...defaultLightPolicy, polarity }, { pointer: { x: 75, y: 48 } });
          const packet = Array(1352).fill(0);
          require(shadeSurface(input, packet, Array(8).fill(0), Array(14).fill(0)) === 0, "shade error");
          paintLightCanvas(surfaceCtx, packet, frame);
          const shaded = surfaceCtx.getImageData(0, 0, 180, 130).data;
          const words = [0, 0, 0, 0];
          paintLightSource(shown, true, 75, 48, words);
          createCanvasLightGlyph(overlayCtx)(words);
          surfaceCtx.drawImage(overlay, 0, 0);
          return { shaded, final: surfaceCtx.getImageData(0, 0, 180, 130).data };
        }
        let changed = 0;
        for (const polarity of ["obsidian-dark", "sunlit-alabaster-light"]) {
          const shown = pixels(true, polarity);
          const hidden = pixels(false, polarity);
          require(shown.shaded.some((byte, i) => i >= 4 && byte !== shown.shaded[i % 4]), "only uniform backing was drawn");
          for (let i = 0; i < shown.shaded.length; i++) {
            require(shown.shaded[i] === hidden.shaded[i], "pre-glyph pixel differs at byte " + i);
            if (shown.final[i] === hidden.final[i]) continue;
            changed++;
            const pixel = Math.floor(i / 4);
            require(Math.abs(pixel % 180 - 75) <= 11 && Math.abs(Math.floor(pixel / 180) - 48) <= 11,
              "change escaped glyph extent");
          }
        }
        require(changed > 0, "glyph failed to draw");
        mounted.dispose();
        document.body.dataset.verdict = "pass";
      } catch (error) {
        document.body.dataset.verdict = error.message;
      }
    `);
    const bundle = await Bun.build({ entrypoints: [entry], target: "browser" });
    expect(bundle.success, String(bundle.logs)).toBe(true);
    const code = await bundle.outputs[0]!.text();
    const html = join(temp, "fixture.html");
    writeFileSync(html, `<!doctype html><body><label><input type="checkbox">Show light source</label>
      <main style="margin:10px;width:155px;height:110px;border-radius:13px;background:#30343a;"></main>
      <script type="module">${code}</script></body>`);
    const browser = Bun.spawn([chromium!, "--headless", "--no-sandbox", "--disable-gpu",
      "--no-first-run", "--user-data-dir=" + join(temp, "profile"), "--dump-dom", "file://" + html],
    { stdout: "pipe", stderr: "pipe" });
    const [status, dom, errors] = await Promise.all([browser.exited, new Response(browser.stdout).text(), new Response(browser.stderr).text()]);
    expect(status, errors).toBe(0);
    expect(dom.match(/data-verdict="[^"]+"/)?.[0]).toBe('data-verdict="pass"');
    console.log("Chromium | both polarities | 0 changed pre-glyph bytes | final changes confined to glyph");
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}, 30_000);
