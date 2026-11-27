import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { acquireWake, createLuxClock, dispatchClock, heldWakeTokens, releaseWake, sampleRest } from "../ss/lux/wake.ss.ts";
import { defaultSpatialKnobs } from "../ss/lux/knobs.ss.ts";
import { initialBody, stepPhysics } from "../ss/physics/simulator.ss.ts";
import { mount } from "../src/dom/controller.ts";
import { fakeDom, input } from "./fixtures.ts";

const claims = new Set([
  "no_tick_without_token", "body_rest_releases", "cancelled_gesture_releases", "stale_epoch_rejected",
  "coupled_neighbors_terminate",
]);

function replay(steps: readonly { readonly action: string }[]) {
  let clock = createLuxClock();
  let callbackEpoch = clock.generation;
  let plain = 0;
  let body = 0;
  let gesture = 0;
  let hold = 3;
  let pushed = false;
  let checked = "";

  const host = fakeDom();
  const controller = mount(host.element, { host: host.host });
  try {
    for (const { action } of steps) {
      if (action.startsWith("acquire_body_")) {
        hold = Number(action.split("_").at(-1));
        const lease = acquireWake(clock, "body");
        clock = lease.clock;
        body = lease.token;
        assert.notEqual(body, 0);
        continue;
      }
      switch (action) {
        case "acquire_plain": {
          const lease = acquireWake(clock, "plain");
          clock = lease.clock;
          plain = lease.token;
          assert.notEqual(plain, 0);
          break;
        }
        case "release_plain":
          clock = releaseWake(clock, plain);
          plain = 0;
          break;
        case "acquire_gesture": {
          const lease = acquireWake(clock, "gesture");
          clock = lease.clock;
          gesture = lease.token;
          host.pointer("pointerdown", 3, 9);
          assert.equal(controller.metrics().heldTokens, 1);
          break;
        }
        case "cancel_gesture":
          clock = releaseWake(clock, gesture);
          assert.equal(clock.registry.slots.some((slot) => slot.token === gesture), false);
          host.pointer("pointercancel", 3, 9);
          assert.equal(controller.metrics().heldTokens, 0);
          assert.equal(host.scheduled.size, 0);
          gesture = 0;
          checked = "cancelled_gesture_releases";
          break;
        case "resting_frame":
        case "moving_frame":
        case "rest_release": {
          clock = sampleRest(clock, body, action !== "moving_frame", hold);
          const remains = clock.registry.slots.some((slot) => slot.token === body);
          assert.equal(remains, action !== "rest_release");
          if (!remains) {
            checked = "body_rest_releases";
            body = 0;
          }
          break;
        }
        case "capture_epoch":
          callbackEpoch = clock.generation;
          break;
        case "deliver_frame":
        case "deliver_stale":
        case "deliver_idle": {
          const delivered = dispatchClock(clock, callbackEpoch);
          const running = action === "deliver_frame";
          assert.equal(delivered.accepted, running);
          assert.equal(delivered.clock.clockTicks, clock.clockTicks + Number(running));
          assert.equal(delivered.clock.idleWakeupCount, clock.idleWakeupCount + Number(!running));
          if (action === "deliver_idle") {
            assert.equal(heldWakeTokens(clock), 0);
            checked = "no_tick_without_token";
          }
          if (action === "deliver_stale") {
            assert.notEqual(callbackEpoch, clock.generation);
            checked = "stale_epoch_rejected";
          }
          clock = delivered.clock;
          break;
        }
        case "request_push":
          pushed = true;
          break;
        case "receive_push": {
          assert.equal(pushed, true);
          const k = defaultSpatialKnobs();
          const start = initialBody(12, 12, input.neighborHomeX, input.neighborHomeY);
          const coupled = stepPhysics(start, input, 4000, k);
          const alone = stepPhysics(start, input, 4000, { ...k, enableCoupledNeighbors: false });
          assert.deepEqual([coupled.x, coupled.y, coupled.vx, coupled.vy], [alone.x, alone.y, alone.vx, alone.vy]);
          assert.notEqual(coupled.neighborX, alone.neighborX);
          let passive = coupled;
          for (let i = 0; i < 240 && !passive.resting; i++) {
            passive = stepPhysics(passive, { ...input, pushActive: false }, 4000, k);
          }
          // A passive body can release its spring tail without emitting a reciprocal push.
          assert.equal(passive.neighborX, input.neighborHomeX);
          assert.equal(passive.neighborY, input.neighborHomeY);
          assert.equal(passive.neighborVx, 0);
          assert.equal(passive.neighborVy, 0);
          pushed = false;
          checked = "coupled_neighbors_terminate";
          break;
        }
        default:
          throw new Error("Unmapped OM action " + action);
      }
    }
    return checked;
  } finally {
    controller.unmount();
  }
}

for (const file of process.argv.slice(2)) {
  const receipt = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(receipt.exit_code, 2);
  const { claim, steps } = receipt.counterexample;
  assert.ok(claims.delete(claim), "Unknown or duplicate OM claim " + claim);
  assert.equal(replay(steps), claim, "Runtime did not exercise " + claim);
  console.log("OM runtime replay passed " + claim);
}
assert.equal(claims.size, 0);
