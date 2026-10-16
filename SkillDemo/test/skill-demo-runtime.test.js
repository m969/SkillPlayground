import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { FIXED_STEP_SECONDS } from "../src/runtime/fixed-step-clock.js";
import { ChargedGroundImpactVisual } from "../src/visuals/charged-ground-impact.js";
import { CounterSlashVisual } from "../src/visuals/counter-slash-visual.js";
import { DashStrikeVisual } from "../src/visuals/dash-strike-visual.js";
import { ProjectileShotVisual } from "../src/visuals/projectile-shot-visual.js";
import {
  SkillDemoRuntime,
  SkillDemoStatus
} from "../src/runtime/skill-demo-runtime.js";
import { skillCatalog } from "../src/skills/skill-catalog.js";

function createRuntime(templateId, templateOverrides = {}) {
  const template = {
    ...skillCatalog.find((entry) => entry.id === templateId),
    ...templateOverrides
  };
  const scene = new THREE.Scene();
  return { runtime: new SkillDemoRuntime(scene, template), scene };
}

function advanceUntil(runtime, predicate, maximumSteps = 180) {
  for (let index = 0; index < maximumSteps && !predicate(); index += 1) {
    runtime.step(FIXED_STEP_SECONDS);
  }
  assert.equal(predicate(), true, "技能未在预期步数内到达目标状态");
}

test("蓄力地面冲击在视觉播放完成后结束 SkillFlow", () => {
  const { runtime } = createRuntime("charged-ground-impact");
  runtime.play();
  assert.equal(runtime.status, SkillDemoStatus.Running);
  advanceUntil(runtime, () => runtime.visuals.some((visual) => visual.isPlaying));
  assert.equal(runtime.status, SkillDemoStatus.Running);

  advanceUntil(runtime, () => runtime.status === SkillDemoStatus.Success);
  assert.equal(runtime.visuals.length, 1);
  assert.equal(runtime.visuals[0].isFinished, true);
  assert.equal(runtime.execution.IsFinished, true);
  runtime.dispose();
});

test("WaitEvent 触发后捕获目标、释放订阅并播放格挡反击", () => {
  const { runtime } = createRuntime("counter-slash");
  const target = { id: "training-dummy" };

  runtime.play();
  assert.equal(runtime.status, SkillDemoStatus.Running);
  assert.equal(runtime.eventSource.listenerCount, 1);
  assert.equal(runtime.canTriggerEvent, true);

  assert.equal(runtime.triggerEvent(target), 1);
  assert.equal(runtime.context.PrimaryTarget, target);
  assert.equal(runtime.context.Variables.get("hitTarget"), target);
  runtime.step(FIXED_STEP_SECONDS);

  assert.equal(runtime.eventSource.listenerCount, 0);
  assert.equal(runtime.visuals[0].isPlaying, true);
  assert.equal(runtime.status, SkillDemoStatus.Running);
  advanceUntil(runtime, () => runtime.status === SkillDemoStatus.Success);
  assert.equal(runtime.visuals[0].isFinished, true);
  runtime.dispose();
});

test("取消等待事件的技能会释放 WaitEvent 订阅", () => {
  const { runtime } = createRuntime("counter-slash");
  runtime.play();

  assert.equal(runtime.eventSource.listenerCount, 1);
  runtime.cancel();

  assert.equal(runtime.status, SkillDemoStatus.Cancelled);
  assert.equal(runtime.eventSource.listenerCount, 0);
  assert.equal(runtime.execution.IsFinished, true);
  runtime.dispose();
});

test("取消正在播放的技能会停止视觉并允许重播", () => {
  const { runtime } = createRuntime("charged-ground-impact");
  runtime.play();
  advanceUntil(runtime, () => runtime.visuals.some((visual) => visual.isPlaying));

  runtime.cancel();

  assert.equal(runtime.status, SkillDemoStatus.Cancelled);
  assert.ok(runtime.visuals.every((visual) => !visual.isPlaying));
  assert.equal(runtime.execution.IsFinished, true);
  runtime.play();
  assert.equal(runtime.status, SkillDemoStatus.Running);
  runtime.cancel();
  runtime.dispose();
});

test("ParallelAll 连射为每个动作创建独立视觉并等待全部命中", () => {
  const { runtime, scene } = createRuntime("projectile-volley");
  runtime.play();
  advanceUntil(runtime, () => runtime.visuals.length === 3);

  const visuals = [...runtime.visuals];
  assert.equal(new Set(visuals).size, 3);
  assert.ok(visuals.every((visual) => visual.isPlaying));
  assert.equal(runtime.status, SkillDemoStatus.Running);

  advanceUntil(runtime, () => runtime.status === SkillDemoStatus.Success);
  assert.ok(visuals.every((visual) => visual.isFinished));
  assert.equal(runtime.progress, 1);
  runtime.dispose();
  assert.equal(scene.children.length, 0);
});

test("取消 ParallelAll 连射会停止所有视觉并在重播时清理旧实例", () => {
  const { runtime, scene } = createRuntime("projectile-volley");
  runtime.play();
  advanceUntil(runtime, () => runtime.visuals.length === 2);

  const cancelledVisuals = [...runtime.visuals];
  runtime.cancel();

  assert.equal(runtime.status, SkillDemoStatus.Cancelled);
  assert.ok(cancelledVisuals.every((visual) => !visual.isPlaying));
  assert.ok(cancelledVisuals.every((visual) => !visual.group.visible));

  runtime.play();
  assert.ok(cancelledVisuals.every((visual) => visual.group.parent === null));
  runtime.cancel();
  runtime.dispose();
  assert.equal(scene.children.length, 0);
});

test("冰晶箭幕并行发射七道独立视觉并等待全部命中", () => {
  const { runtime, scene } = createRuntime("ice-shard-volley");
  runtime.play();

  const visuals = [...runtime.visuals];
  assert.equal(visuals.length, 7);
  assert.equal(new Set(visuals).size, 7);
  assert.ok(visuals.every((visual) => visual.isPlaying));
  assert.equal(runtime.status, SkillDemoStatus.Running);

  advanceUntil(runtime, () => runtime.status === SkillDemoStatus.Success);
  assert.ok(visuals.every((visual) => visual.isFinished));
  assert.equal(runtime.progress, 1);
  runtime.dispose();
  assert.equal(scene.children.length, 0);
});

test("取消冰晶箭幕会停止所有已发射的冰晶视觉", () => {
  const { runtime, scene } = createRuntime("ice-shard-volley");
  runtime.play();

  const visuals = [...runtime.visuals];
  assert.equal(visuals.length, 7);
  runtime.cancel();

  assert.equal(runtime.status, SkillDemoStatus.Cancelled);
  assert.ok(visuals.every((visual) => !visual.isPlaying));
  assert.ok(visuals.every((visual) => !visual.group.visible));
  runtime.dispose();
  assert.equal(scene.children.length, 0);
});

test("新增治疗、突进和护盾模板均等待各自视觉结束", () => {
  for (const templateId of ["healing-pulse", "dash-strike", "guardian-shield"]) {
    const { runtime, scene } = createRuntime(templateId);
    runtime.play();
    assert.equal(runtime.status, SkillDemoStatus.Running, templateId);

    advanceUntil(runtime, () => runtime.visuals.length === 1);
    const [visual] = runtime.visuals;
    assert.equal(visual.isPlaying, true, templateId);
    assert.equal(runtime.status, SkillDemoStatus.Running, templateId);

    advanceUntil(runtime, () => runtime.status === SkillDemoStatus.Success);
    assert.equal(visual.isFinished, true, templateId);
    assert.equal(runtime.progress, 1, templateId);
    runtime.dispose();
    assert.equal(scene.children.length, 0, templateId);
  }
});

test("取消新增治疗、突进和护盾模板会停止视觉", () => {
  for (const templateId of ["healing-pulse", "dash-strike", "guardian-shield"]) {
    const { runtime, scene } = createRuntime(templateId);
    runtime.play();
    advanceUntil(runtime, () => runtime.visuals.length === 1);

    const [visual] = runtime.visuals;
    runtime.cancel();

    assert.equal(runtime.status, SkillDemoStatus.Cancelled, templateId);
    assert.equal(visual.isPlaying, false, templateId);
    assert.equal(visual.group.visible, false, templateId);
    runtime.dispose();
    assert.equal(scene.children.length, 0, templateId);
  }
});

test("星陨终结技等待并行星弹全部命中后才播放最终冲击", () => {
  const { runtime, scene } = createRuntime("starfall-finisher");
  runtime.play();
  advanceUntil(runtime, () => runtime.visuals.length === 2);

  const starShots = [...runtime.visuals];
  assert.ok(starShots.every((visual) => visual instanceof ProjectileShotVisual));
  assert.equal(runtime.status, SkillDemoStatus.Running);

  advanceUntil(runtime, () => runtime.visuals.length === 3);
  assert.ok(starShots.every((visual) => visual.isFinished));
  assert.ok(runtime.visuals[2] instanceof ChargedGroundImpactVisual);
  assert.equal(runtime.status, SkillDemoStatus.Running);

  advanceUntil(runtime, () => runtime.status === SkillDemoStatus.Success);
  assert.ok(runtime.visuals.every((visual) => visual.isFinished));
  assert.equal(runtime.progress, 1);
  runtime.dispose();
  assert.equal(scene.children.length, 0);
});

test("可打断蓄力在事件窗口内反制，并释放事件订阅", () => {
  const { runtime } = createRuntime("interruptible-channel");
  const target = { id: "training-dummy" };

  runtime.play();
  assert.equal(runtime.eventSource.listenerCount, 1);
  assert.equal(runtime.canTriggerEvent, true);
  for (let index = 0; index < 10; index += 1) {
    runtime.step(FIXED_STEP_SECONDS);
  }

  assert.equal(runtime.triggerEvent(target), 1);
  runtime.step(FIXED_STEP_SECONDS);

  assert.equal(runtime.eventSource.listenerCount, 0);
  assert.equal(runtime.context.PrimaryTarget, target);
  assert.ok(runtime.visuals[0] instanceof CounterSlashVisual);
  advanceUntil(runtime, () => runtime.status === SkillDemoStatus.Success);
  assert.equal(runtime.visuals[0].isFinished, true);
  runtime.dispose();
});

test("可打断蓄力无事件超时后释放冲击并清理订阅", () => {
  const { runtime } = createRuntime("interruptible-channel");
  runtime.play();
  assert.equal(runtime.eventSource.listenerCount, 1);

  advanceUntil(runtime, () => runtime.visuals.length === 1);

  assert.equal(runtime.eventSource.listenerCount, 0);
  assert.ok(runtime.visuals[0] instanceof ChargedGroundImpactVisual);
  advanceUntil(runtime, () => runtime.status === SkillDemoStatus.Success);
  assert.equal(runtime.visuals[0].isFinished, true);
  runtime.dispose();
});

test("条件连招根据上下文路线执行不同终结分支", () => {
  const standard = createRuntime("adaptive-combo", {
    initialVariables: { comboRoute: 1 }
  });
  standard.runtime.play();
  advanceUntil(standard.runtime, () =>
    standard.runtime.status === SkillDemoStatus.Success
  );
  assert.equal(standard.runtime.visuals.length, 2);
  assert.ok(standard.runtime.visuals[1] instanceof DashStrikeVisual);
  assert.equal(standard.runtime.progress, 1);
  standard.runtime.dispose();
  assert.equal(standard.scene.children.length, 0);

  const alternate = createRuntime("adaptive-combo", {
    initialVariables: { comboRoute: 2 }
  });
  alternate.runtime.play();
  advanceUntil(alternate.runtime, () =>
    alternate.runtime.status === SkillDemoStatus.Success
  );
  assert.equal(alternate.runtime.visuals.length, 3);
  assert.ok(
    alternate.runtime.visuals
      .slice(1)
      .every((visual) => visual instanceof ProjectileShotVisual)
  );
  assert.equal(alternate.runtime.progress, 1);
  alternate.runtime.dispose();
  assert.equal(alternate.scene.children.length, 0);
});

test("取消复杂技能会停止所有已启动视觉并清理事件订阅", () => {
  const starfall = createRuntime("starfall-finisher");
  starfall.runtime.play();
  advanceUntil(starfall.runtime, () => starfall.runtime.visuals.length === 2);
  const starfallVisuals = [...starfall.runtime.visuals];
  starfall.runtime.cancel();
  assert.ok(starfallVisuals.every((visual) => !visual.isPlaying));
  starfall.runtime.play();
  assert.ok(starfallVisuals.every((visual) => visual.group.parent === null));
  starfall.runtime.cancel();
  starfall.runtime.dispose();
  assert.equal(starfall.scene.children.length, 0);

  const channel = createRuntime("interruptible-channel");
  channel.runtime.play();
  assert.equal(channel.runtime.eventSource.listenerCount, 1);
  channel.runtime.cancel();
  assert.equal(channel.runtime.eventSource.listenerCount, 0);
  channel.runtime.play();
  assert.equal(channel.runtime.eventSource.listenerCount, 1);
  channel.runtime.cancel();
  assert.equal(channel.runtime.eventSource.listenerCount, 0);
  channel.runtime.dispose();
  assert.equal(channel.scene.children.length, 0);

  const combo = createRuntime("adaptive-combo", {
    initialVariables: { comboRoute: 2 }
  });
  combo.runtime.play();
  advanceUntil(combo.runtime, () => combo.runtime.visuals.length === 1);
  const comboVisuals = [...combo.runtime.visuals];
  combo.runtime.cancel();
  assert.ok(comboVisuals.every((visual) => !visual.isPlaying));
  combo.runtime.play();
  assert.ok(comboVisuals.every((visual) => visual.group.parent === null));
  combo.runtime.cancel();
  combo.runtime.dispose();
  assert.equal(combo.scene.children.length, 0);
});
