import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { IceShardVisual } from "../src/visuals/ice-shard-visual.js";

test("冰晶箭视觉沿轨迹飞行、生成霜纹并可取消释放", () => {
  const scene = new THREE.Scene();
  const visual = new IceShardVisual(scene, {
    target: [1.5, -2],
    color: 0x82eaff
  });

  visual.play();
  assert.equal(visual.isPlaying, true);
  assert.equal(visual.arrow.visible, true);
  visual.update(0.35);
  const linearProgress = 0.5;
  const expectedY = visual.start.y +
    (visual.target.y - visual.start.y) * linearProgress;
  assert.ok(Math.abs(visual.arrow.position.y - expectedY) < 1e-6);

  visual.update(0.37);
  assert.equal(visual.isPlaying, true);
  assert.equal(visual.arrow.visible, false);
  assert.equal(visual.impactRing.visible, true);
  assert.ok(visual.impactShards.some((shard) => shard.visible));

  visual.update(0.5);
  assert.equal(visual.isPlaying, false);
  assert.equal(visual.isFinished, true);
  assert.equal(visual.progress, 1);

  visual.play();
  visual.stop();
  assert.equal(visual.isPlaying, false);
  assert.equal(visual.isFinished, false);
  visual.dispose();
  assert.equal(scene.children.length, 0);
});
