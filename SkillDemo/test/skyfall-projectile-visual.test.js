import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { SkyfallProjectileVisual } from "../src/visuals/skyfall-projectile-visual.js";

test("天降投射物从高空下坠、命中后扩散并可重播释放", () => {
  const scene = new THREE.Scene();
  const visual = new SkyfallProjectileVisual(scene, {
    start: [0.5, 3.2],
    target: [0, -1.5],
    startHeight: 5.4,
    color: 0xff8a42,
    size: 1.25,
    duration: 1.08
  });

  visual.play();
  assert.equal(visual.isPlaying, true);
  assert.ok(visual.projectile.position.y > 5);
  visual.update(visual.flightDuration / 2);
  assert.ok(visual.projectile.position.y < visual.start.y);
  assert.ok(visual.projectile.position.y > visual.target.y);
  assert.equal(visual.trail.visible, true);

  visual.update(visual.flightDuration / 2);
  assert.equal(visual.projectile.visible, false);
  assert.equal(visual.impactRing.visible, true);
  assert.ok(visual.fragments.some((fragment) => fragment.visible));

  visual.update(visual.duration - visual.flightDuration);
  assert.equal(visual.isPlaying, false);
  assert.equal(visual.isFinished, true);
  assert.equal(visual.progress, 1);

  visual.play();
  visual.stop();
  assert.equal(visual.isPlaying, false);
  assert.equal(visual.isFinished, false);
  assert.equal(visual.group.visible, false);

  visual.dispose();
  assert.equal(scene.children.length, 0);
});

test("天降投射物拒绝无效步长", () => {
  const scene = new THREE.Scene();
  const visual = new SkyfallProjectileVisual(scene, {
    start: [0, 0],
    target: [0, 0],
    startHeight: 5,
    color: 0xff8a42,
    size: 1,
    duration: 1
  });

  assert.throws(() => visual.update(-0.1), RangeError);
  visual.dispose();
});
