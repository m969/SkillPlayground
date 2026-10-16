import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { ProjectileShotVisual } from "../src/visuals/projectile-shot-visual.js";

test("飞弹视觉可播放至命中、完成、重播与取消", () => {
  const scene = new THREE.Scene();
  const visual = new ProjectileShotVisual(scene, {
    target: [1.5, -2],
    color: 0x67e8ff
  });

  visual.play();
  assert.equal(visual.isPlaying, true);
  assert.equal(visual.group.visible, true);
  visual.update(0.5);
  assert.equal(visual.isPlaying, true);
  assert.ok(visual.progress > 0.5 && visual.progress < 0.6);

  visual.update(0.1);
  assert.equal(visual.projectile.visible, false);
  assert.equal(visual.impactRing.visible, true);
  visual.update(0.5);
  assert.equal(visual.isPlaying, false);
  assert.equal(visual.isFinished, true);
  assert.equal(visual.progress, 1);

  visual.play();
  assert.equal(visual.isPlaying, true);
  visual.stop();
  assert.equal(visual.isPlaying, false);
  assert.equal(visual.isFinished, false);
  visual.dispose();
  assert.equal(scene.children.length, 0);
});
