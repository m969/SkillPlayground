import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { ChargedGroundImpactVisual } from "../src/visuals/charged-ground-impact.js";

test("蓄力地面冲击视觉可重播、完成和取消", () => {
  const scene = new THREE.Scene();
  const visual = new ChargedGroundImpactVisual(scene);

  visual.play();
  assert.equal(visual.isPlaying, true);
  visual.update(0.55);
  assert.equal(visual.isPlaying, true);
  assert.ok(visual.progress > 0.49 && visual.progress < 0.51);

  visual.update(0.55);
  assert.equal(visual.isPlaying, false);
  assert.equal(visual.isFinished, true);
  assert.equal(visual.progress, 1);

  visual.play();
  assert.equal(visual.isPlaying, true);
  visual.stop();
  assert.equal(visual.isPlaying, false);
  assert.equal(visual.isFinished, false);
  visual.dispose();
});
