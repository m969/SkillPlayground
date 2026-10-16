import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { DashStrikeVisual } from "../src/visuals/dash-strike-visual.js";
import { GuardianShieldVisual } from "../src/visuals/guardian-shield-visual.js";
import { HealingPulseVisual } from "../src/visuals/healing-pulse-visual.js";

const visualCases = [
  ["治疗脉冲", (scene) => new HealingPulseVisual(scene), 1.25],
  ["位移突进", (scene) => new DashStrikeVisual(scene), 0.92],
  ["守护屏障", (scene) => new GuardianShieldVisual(scene), 1.5]
];

for (const [name, createVisual, duration] of visualCases) {
  test(`${name}视觉可播放完成、重播、取消并释放资源`, () => {
    const scene = new THREE.Scene();
    const visual = createVisual(scene);

    visual.play();
    assert.equal(visual.isPlaying, true);
    assert.equal(visual.group.visible, true);
    visual.update(duration / 2);
    assert.equal(visual.isPlaying, true);
    assert.ok(visual.progress > 0.49 && visual.progress < 0.51);

    visual.update(duration / 2);
    assert.equal(visual.isPlaying, false);
    assert.equal(visual.isFinished, true);
    assert.equal(visual.progress, 1);

    visual.play();
    assert.equal(visual.isPlaying, true);
    visual.stop();
    assert.equal(visual.isPlaying, false);
    assert.equal(visual.isFinished, false);
    assert.equal(visual.group.visible, false);

    visual.dispose();
    assert.equal(scene.children.length, 0);
  });
}

test("突进视觉从起点移动到终点，并在到达后播放冲击波", () => {
  const scene = new THREE.Scene();
  const visual = new DashStrikeVisual(scene);
  const start = visual.start.clone();
  const target = visual.target.clone();

  visual.play();
  assert.ok(visual.dash.position.distanceTo(start) < 1e-6);
  visual.update(0.31);
  assert.ok(visual.dash.position.distanceTo(start) > 1);

  visual.update(0.32);
  assert.equal(visual.dash.visible, false);
  assert.ok(visual.impactRing.visible);
  assert.ok(visual.dash.position.distanceTo(target) < 1e-6);
  visual.dispose();
});
