import { acquireWake, createLuxClock, heldWakeTokens, releaseWake } from "../../ss/lux/wake.ss.ts";
import { NO_DEADLINE, STATE } from "../../ss/wallpaper/types.ss.ts";
import { WallpaperRuntime } from "./runtime.ts";
import type { WallpaperLightSensors, WallpaperOptions, WallpaperSignals } from "./runtime.ts";

export interface WallpaperScheduler {
  nowUs(): number;
  unixSeconds(): number;
  requestFrame(callback: () => void): number;
  cancelFrame(handle: number): void;
  setTimer(delayMs: number, callback: () => void): number;
  clearTimer(handle: number): void;
}

export interface WallpaperWakePort {
  acquire(): number;
  release(token: number): void;
}

export interface WallpaperPresenter {
  draw(runtime: WallpaperRuntime): void;
}

export class WallpaperHost {
  readonly runtime: WallpaperRuntime;
  #clock = createLuxClock();
  #token = 0;
  #raf: number | undefined;
  #timer: number | undefined;
  #timerDue = 0;
  #generation = 0;
  #disposed = false;
  #callbacks = 0;
  #draws = 0;

  constructor(
    private readonly scheduler: WallpaperScheduler,
    private readonly presenter: WallpaperPresenter,
    options: WallpaperOptions = {},
    private readonly wakePort?: WallpaperWakePort,
  ) {
    this.runtime = new WallpaperRuntime(options);
  }

  get heldTokens(): number { return this.wakePort ? Number(this.#token > 0) : heldWakeTokens(this.#clock); }
  get frameCallbacks(): number { return this.#callbacks; }
  get draws(): number { return this.#draws; }

  update(signals: WallpaperSignals = {}): void {
    if (this.#disposed) return;
    this.runtime.setSignals(signals);
    this.#sample();
  }

  pointer(x: number, y: number, active: boolean, trusted: boolean): void {
    if (!this.#disposed && this.runtime.pointer(x, y, active, trusted)) this.#sample();
  }

  updateLightSensors(sensors: WallpaperLightSensors): void {
    if (this.#disposed) return;
    this.runtime.setLightSensors(sensors);
    this.#sample();
  }

  #releaseWake(): void {
    if (this.#token === 0) return;
    if (this.wakePort) this.wakePort.release(this.#token);
    else this.#clock = releaseWake(this.#clock, this.#token);
    this.#token = 0;
  }

  #cancel(): void {
    this.#generation++;
    if (this.#raf !== undefined) this.scheduler.cancelFrame(this.#raf);
    if (this.#timer !== undefined) this.scheduler.clearTimer(this.#timer);
    this.#raf = this.#timer = undefined;
  }

  #sample(): void {
    const now = this.scheduler.nowUs();
    this.runtime.step(now, this.scheduler.unixSeconds());
    if (!this.runtime.active && this.#token > 0) {
      this.#cancel();
      this.#releaseWake();
    }
    if (this.runtime.active && this.#token === 0) {
      if (this.wakePort) this.#token = this.wakePort.acquire();
      else {
        const acquired = acquireWake(this.#clock, "plain");
        this.#clock = acquired.clock;
        this.#token = acquired.token;
      }
    }
    if (this.runtime.frameWord(3) & 1) {
      this.presenter.draw(this.runtime);
      this.#draws++;
    }
    if (!this.#disposed) this.#schedule(now);
  }

  #schedule(now: number): void {
    const solarDelay = this.runtime.frameWord(5);
    const hz = this.runtime.frameWord(4);
    const lastDraw = this.runtime.words[STATE() + 23] ?? now;
    const liveDeadline = this.#token > 0 && hz > 0 && this.#raf === undefined
      ? Math.max(now, lastDraw + Math.ceil(1_000_000 / hz)) : Infinity;
    const solarDeadline = solarDelay === NO_DEADLINE() ? Infinity : now + solarDelay * 1000;
    const deadline = Math.min(liveDeadline, solarDeadline);
    if (this.#timer !== undefined && this.#timerDue === deadline) return;
    if (this.#timer !== undefined) this.scheduler.clearTimer(this.#timer);
    this.#timer = undefined;
    if (!Number.isFinite(deadline)) return;
    const generation = this.#generation;
    const id = this.scheduler.setTimer(Math.max(0, Math.ceil((deadline - now) / 1000)), () => {
      if (generation !== this.#generation || id !== this.#timer) return;
      this.#timer = undefined;
      if (solarDeadline <= liveDeadline) this.#sample();
      else if (this.#token > 0 && this.#raf === undefined) {
        const raf = this.scheduler.requestFrame(() => {
          if (generation !== this.#generation || raf !== this.#raf || this.#token === 0) return;
          this.#raf = undefined;
          this.#callbacks++;
          this.#sample();
        });
        this.#raf = raf;
      }
    });
    this.#timer = id;
    this.#timerDue = deadline;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#cancel();
    this.#releaseWake();
  }
}
