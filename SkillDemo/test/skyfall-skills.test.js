import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { FIXED_STEP_SECONDS } from "../src/runtime/fixed-step-clock.js";
import {
  SkillDemoRuntime,
  SkillDemoStatus
} from "../src/runtime/skill-demo-runtime.js";
import { skillCatalog } from "../src/skills/skill-catalog.js";
import { ChargedGroundImpactVisual } from "../src/visuals/charged-ground-impact.js";
import { SkyfallProjectileVisual } from "../src/visuals/skyfall-projectile-visual.js";

function createRuntime(templateId) {
  const template = skillCatalog.find((entry) => entry.id === templateId);
  const scene = new THREE.Scene();
  return { runtime: new SkillDemoRuntime(scene, template), scene };
}

function advanceUntil(runtime, predicate, maximumSteps = 360) {
  for (let index = 0; index < maximumSteps && !predicate(); index += 1) {
    runtime.step(FIXED_STEP_SECONDS);
  }
  assert.equal(predicate(), true, "天降技能未在预期步数内到达目标状态");
}

test("三个天降模板注册的投射物数量和波次大小符合约定", () => {
  const expected = [
    ["meteor-rain", 8, [8]],
    ["heavenly-fire-rain", 24, [8, 8, 8]],
    ["cataclysm-starfall", 36, [12, 12, 12]]
  ];

  for (const [templateId, projectileCount, waveSizes] of expected) {
    const template = skillCatalog.find((entry) => entry.id === templateId);
    assert.equal(template.projectileCount, projectileCount);
    assert.deepEqual(template.waveSizes, waveSizes);
  }
});

test("陨星天降并行播放八枚大型投射物并等待全部命中", () => {
  const { runtime, scene } = createRuntime("meteor-rain");
  runtime.play();

  assert.equal(runtime.visuals.length, 8);
  assert.ok(runtime.visuals.every((visual) => visual instanceof SkyfallProjectileVisual));
  assert.ok(runtime.visuals.every((visual) => visual.isPlaying));
  assert.equal(runtime.status, SkillDemoStatus.Running);

  advanceUntil(runtime, () => runtime.status === SkillDemoStatus.Success);
  assert.equal(runtime.visuals.length, 8);
  assert.ok(runtime.visuals.every((visual) => visual.isFinished));
  assert.equal(runtime.progress, 1);
  runtime.dispose();
  assert.equal(scene.children.length, 0);
});

test("天火流雨按三波各八枚推进，前一波结束后才启动下一波", () => {
  const { runtime, scene } = createRuntime("heavenly-fire-rain");
  runtime.play();
  assert.equal(runtime.visuals.length, 8);
  const firstWave = [...runtime.visuals];

  advanceUntil(runtime, () => runtime.visuals.length === 16);
  assert.ok(firstWave.every((visual) => visual.isFinished));
  assert.ok(runtime.visuals.slice(8).every((visual) => visual.isPlaying));

  advanceUntil(runtime, () => runtime.visuals.length === 24);
  assert.ok(runtime.visuals.slice(8, 16).every((visual) => visual.isFinished));
  assert.ok(runtime.visuals.slice(16).every((visual) => visual.isPlaying));

  advanceUntil(runtime, () => runtime.status === SkillDemoStatus.Success);
  assert.equal(runtime.visuals.length, 24);
  assert.ok(runtime.visuals.every((visual) => visual.isFinished));
  assert.equal(runtime.progress, 1);
  runtime.dispose();
  assert.equal(scene.children.length, 0);
});

test("末日星陨逐波完成三十六枚投射物后才播放终结冲击", () => {
  const { runtime, scene } = createRuntime("cataclysm-starfall");
  runtime.play();
  assert.equal(runtime.visuals.length, 12);
  const firstWave = [...runtime.visuals];

  advanceUntil(runtime, () => runtime.visuals.length === 24);
  assert.ok(firstWave.every((visual) => visual.isFinished));
  assert.ok(runtime.visuals.slice(12).every((visual) => visual.isPlaying));

  advanceUntil(runtime, () => runtime.visuals.length === 36);
  assert.ok(runtime.visuals.slice(12, 24).every((visual) => visual.isFinished));
  assert.ok(runtime.visuals.slice(24).every((visual) => visual.isPlaying));

  advanceUntil(runtime, () => runtime.visuals.length === 37);
  assert.ok(runtime.visuals.slice(24, 36).every((visual) => visual.isFinished));
  assert.ok(runtime.visuals[36] instanceof ChargedGroundImpactVisual);
  assert.equal(runtime.status, SkillDemoStatus.Running);

  advanceUntil(runtime, () => runtime.status === SkillDemoStatus.Success);
  assert.ok(runtime.visuals.every((visual) => visual.isFinished));
  assert.equal(runtime.progress, 1);
  runtime.dispose();
  assert.equal(scene.children.length, 0);
});

test("取消末日星陨会停止当前波次并在重播时释放旧场景对象", () => {
  const { runtime, scene } = createRuntime("cataclysm-starfall");
  runtime.play();
  const cancelledWave = [...runtime.visuals];
  assert.equal(cancelledWave.length, 12);

  runtime.cancel();
  assert.ok(cancelledWave.every((visual) => !visual.isPlaying));
  assert.ok(cancelledWave.every((visual) => !visual.group.visible));

  runtime.play();
  assert.ok(cancelledWave.every((visual) => visual.group.parent === null));
  assert.equal(runtime.visuals.length, 12);
  runtime.cancel();
  runtime.dispose();
  assert.equal(scene.children.length, 0);
});
