import test from "node:test";
import assert from "node:assert/strict";
import { FixedStepClock, FIXED_STEP_SECONDS } from "../src/runtime/fixed-step-clock.js";

test("固定步进器每次只发送固定长度的 delta", () => {
  const clock = new FixedStepClock();
  const deltas = [];

  const result = clock.advance(FIXED_STEP_SECONDS * 3, (delta) => deltas.push(delta));

  assert.equal(result.steps, 3);
  assert.deepEqual(deltas, [
    FIXED_STEP_SECONDS,
    FIXED_STEP_SECONDS,
    FIXED_STEP_SECONDS
  ]);
  assert.equal(result.interpolationAlpha, 0);
});

test("固定步进器限制单帧补步并保留尚未处理的时间", () => {
  const clock = new FixedStepClock(FIXED_STEP_SECONDS, 2);
  let steps = 0;

  assert.equal(clock.advance(FIXED_STEP_SECONDS * 3, () => steps++).steps, 2);
  assert.equal(clock.advance(0, () => steps++).steps, 1);
  assert.equal(steps, 3);
});

test("隐藏页面恢复时可清空累积时间", () => {
  const clock = new FixedStepClock();
  clock.advance(FIXED_STEP_SECONDS / 2, () => assert.fail("不应推进半个步长"));
  clock.reset();

  assert.equal(clock.advance(FIXED_STEP_SECONDS / 2, () => assert.fail("不应推进半个步长")).steps, 0);
});
