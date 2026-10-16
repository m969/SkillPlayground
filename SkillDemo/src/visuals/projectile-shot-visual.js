import * as THREE from "three";

const SHOT_DURATION = 0.58;
const IMPACT_DURATION = 0.28;
const EFFECT_DURATION = SHOT_DURATION + IMPACT_DURATION;
const TRAIL_SEGMENTS = 14;
const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
const easeOutCubic = (value) => 1 - (1 - value) ** 3;

/** 播放单枚飞弹的抛射轨迹与命中波纹，实例由单个 SkillFlow Action 独立持有。 */
export class ProjectileShotVisual {
  constructor(scene, { target, color }) {
    this.scene = scene;
    this.start = new THREE.Vector3(0, 0.58, 3.25);
    this.target = new THREE.Vector3(target[0], 0.08, target[1]);
    this.control = new THREE.Vector3(
      (this.start.x + this.target.x) / 2,
      Math.max(this.start.y, this.target.y) + 1.8,
      (this.start.z + this.target.z) / 2
    );
    this.sample = new THREE.Vector3();
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.trailGeometry = new THREE.BufferGeometry();
    this.trailGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array((TRAIL_SEGMENTS + 1) * 3),
        3
      ).setUsage(THREE.DynamicDrawUsage)
    );
    this.trail = new THREE.Line(
      this.trailGeometry,
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.trail.frustumCulled = false;
    this.group.add(this.trail);

    this.glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.27, 12, 10),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.projectile = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0xfff4cf,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.group.add(this.glow, this.projectile);

    this.impactRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.035, 8, 40),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    this.impactRing.rotation.x = -Math.PI / 2;
    this.impactRing.position.copy(this.target);
    this.group.add(this.impactRing);

    this.impactFlash = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 10),
      new THREE.MeshBasicMaterial({
        color: 0xfff4cf,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.impactFlash.position.copy(this.target);
    this.group.add(this.impactFlash);

    this.elapsed = 0;
    this.isPlaying = false;
    this.isFinished = false;
    this.group.visible = false;
  }

  get progress() {
    return this.isPlaying || this.isFinished
      ? clamp01(this.elapsed / EFFECT_DURATION)
      : 0;
  }

  play() {
    this.elapsed = 0;
    this.isPlaying = true;
    this.isFinished = false;
    this.group.visible = true;
    this.#updateLayers();
    return this;
  }

  update(deltaSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError("deltaSeconds must be finite and non-negative");
    }
    if (!this.isPlaying) {
      return;
    }

    this.elapsed = Math.min(this.elapsed + deltaSeconds, EFFECT_DURATION);
    this.#updateLayers();
    if (this.elapsed >= EFFECT_DURATION) {
      this.isPlaying = false;
      this.isFinished = true;
      this.group.visible = false;
    }
  }

  stop() {
    this.elapsed = 0;
    this.isPlaying = false;
    this.isFinished = false;
    this.group.visible = false;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line)) {
        return;
      }
      object.geometry.dispose();
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) {
        material.dispose();
      }
    });
  }

  #updateLayers() {
    const shotProgress = clamp01(this.elapsed / SHOT_DURATION);
    const easedShotProgress = easeOutCubic(shotProgress);
    const isInFlight = this.elapsed < SHOT_DURATION;
    this.#getPositionAt(easedShotProgress, this.projectile.position);
    this.glow.position.copy(this.projectile.position);
    this.projectile.visible = isInFlight;
    this.glow.visible = isInFlight;
    this.trail.visible = isInFlight;
    this.#updateTrail(easedShotProgress);

    const impactElapsed = Math.max(0, this.elapsed - SHOT_DURATION);
    const impactProgress = clamp01(impactElapsed / IMPACT_DURATION);
    this.impactRing.scale.setScalar(0.35 + 1.05 * easeOutCubic(impactProgress));
    this.impactRing.material.opacity = 0.9 * (1 - impactProgress);
    this.impactRing.visible = this.elapsed >= SHOT_DURATION;

    const flashProgress = clamp01(impactElapsed / 0.16);
    this.impactFlash.scale.setScalar(0.08 + 0.5 * easeOutCubic(flashProgress));
    this.impactFlash.material.opacity = 0.82 * (1 - flashProgress);
    this.impactFlash.visible = this.elapsed >= SHOT_DURATION && impactElapsed < 0.16;
  }

  #updateTrail(progress) {
    const trailStart = Math.max(0, progress - 0.24);
    const trailPositions = this.trailGeometry.attributes.position;
    for (let index = 0; index <= TRAIL_SEGMENTS; index += 1) {
      const sampleProgress = trailStart +
        (progress - trailStart) * index / TRAIL_SEGMENTS;
      this.#getPositionAt(sampleProgress, this.sample);
      trailPositions.setXYZ(
        index,
        this.sample.x,
        this.sample.y,
        this.sample.z
      );
    }
    trailPositions.needsUpdate = true;
  }

  #getPositionAt(progress, target) {
    const inverse = 1 - progress;
    target.set(
      inverse ** 2 * this.start.x +
        2 * inverse * progress * this.control.x +
        progress ** 2 * this.target.x,
      inverse ** 2 * this.start.y +
        2 * inverse * progress * this.control.y +
        progress ** 2 * this.target.y,
      inverse ** 2 * this.start.z +
        2 * inverse * progress * this.control.z +
        progress ** 2 * this.target.z
    );
    return target;
  }
}
