import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { FIXED_STEP_SECONDS } from "../src/runtime/fixed-step-clock.js";
import {
  SkillDemoRuntime,
  SkillDemoStatus
} from "../src/runtime/skill-demo-runtime.js";
import { skillCatalog } from "../src/skills/skill-catalog.js";
import {
  DashSlashVisual,
  HeavyVerticalCleaveVisual,
  HorizontalLightSlashVisual,
  WhirlwindComboSlashVisual
} from "../src/visuals/melee-slash-visuals.js";

function advanceUntil(runtime, predicate, maximumSteps = 180) {
  for (let index = 0; index < maximumSteps && !predicate(); index += 1) {
    runtime.step(FIXED_STEP_SECONDS);
  }
  assert.equal(predicate(), true, "近战斩击未在预期步数内到达目标状态");
}

const meleeSkills = [
  ["横向轻斩", "horizontal-light-slash", HorizontalLightSlashVisual],
  ["竖向重劈", "heavy-vertical-cleave", HeavyVerticalCleaveVisual],
  ["旋风多段斩", "whirlwind-combo-slash", WhirlwindComboSlashVisual],
  ["突进斩", "dash-slash", DashSlashVisual]
];

for (const [name, templateId, VisualType] of meleeSkills) {
  test(`${name}可播放完成、取消并重播`, () => {
    const template = skillCatalog.find((entry) => entry.id === templateId);
    assert.ok(template);
    const scene = new THREE.Scene();
    const runtime = new SkillDemoRuntime(scene, template);

    runtime.play();
    advanceUntil(runtime, () => runtime.visuals.length === 1);
    const cancelledVisual = runtime.visuals[0];
    assert.ok(cancelledVisual instanceof VisualType);
    assert.equal(runtime.status, SkillDemoStatus.Running);

    runtime.cancel();
    assert.equal(cancelledVisual.isPlaying, false);
    assert.equal(cancelledVisual.group.visible, false);

    runtime.play();
    assert.equal(cancelledVisual.group.parent, null);
    advanceUntil(runtime, () => runtime.status === SkillDemoStatus.Success);
    assert.equal(runtime.visuals.length, 1);
    assert.equal(runtime.visuals[0].isFinished, true);

    runtime.dispose();
    assert.equal(scene.children.length, 0);
  });
}

test("横向轻斩的弧光贴近地面并横向展开", () => {
  const scene = new THREE.Scene();
  const visual = new HorizontalLightSlashVisual(scene);

  visual.play();
  visual.update(0.1);

  assert.ok(Math.abs(visual.slashes[0].rotation.x + Math.PI / 2) < 1e-6);
  assert.ok(visual.slashes[0].scale.x > visual.slashes[0].scale.y);
  assert.ok(visual.slashes[0].position.y < 0.5);

  visual.dispose();
});
