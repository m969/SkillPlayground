import * as THREE from "three";

const TRAIL_SEGMENTS = 14;
const IMPACT_DURATION = 0.34;
const FULL_CIRCLE = Math.PI * 2;
const UP_AXIS = new THREE.Vector3(0, 1, 0);
const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
const easeOutCubic = (value) => 1 - (1 - value) ** 3;

/** 让独立投射物从高空坠落，并在固定落点播放拖尾与撞击效果。 */
export class SkyfallProjectileVisual {
  constructor(scene, {
    start,
    target,
    startHeight,
    color,
    size,
    duration
  }) {
    this.scene = scene;
    this.start = new THREE.Vector3(start[0], startHeight, start[1]);
    this.target = new THREE.Vector3(target[0], 0.08, target[1]);
    this.sample = new THREE.Vector3();
    this.direction = new THREE.Vector3().subVectors(this.target, this.start).normalize();
    this.size = size;
    this.duration = duration;
    this.flightDuration = duration - IMPACT_DURATION;
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
        opacity: 0.84,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.trail.frustumCulled = false;

    this.tail = new THREE.Mesh(
      new THREE.ConeGeometry(0.17 * size, 1.05 * size, 8),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.68,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.tail.quaternion.setFromUnitVectors(UP_AXIS, this.direction);

    this.glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.34 * size, 12, 10),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.projectile = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.2 * size, 0),
      new THREE.MeshBasicMaterial({
        color: 0xffe8b0,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        flatShading: true
      })
    );

    this.impactRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.34 * size, 0.045 * size, 8, 48),
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

    this.impactFlash = new THREE.Mesh(
      new THREE.SphereGeometry(0.18 * size, 12, 10),
      new THREE.MeshBasicMaterial({
        color: 0xfff1ca,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.impactFlash.position.copy(this.target);

    const fragmentGeometry = new THREE.OctahedronGeometry(0.08 * size, 0);
    const fragmentMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.fragments = Array.from({ length: 6 }, () => {
      const fragment = new THREE.Mesh(fragmentGeometry, fragmentMaterial);
      this.group.add(fragment);
      return fragment;
    });
    this.group.add(
      this.trail,
      this.tail,
      this.glow,
      this.projectile,
      this.impactRing,
      this.impactFlash
    );

    this.elapsed = 0;
    this.isPlaying = false;
    this.isFinished = false;
    this.group.visible = false;
  }

  get progress() {
    return this.isPlaying || this.isFinished
      ? clamp01(this.elapsed / this.duration)
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

    this.elapsed = Math.min(this.elapsed + deltaSeconds, this.duration);
    this.#updateLayers();
    if (this.elapsed >= this.duration) {
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
    const geometries = new Set();
    const materials = new Set();
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line)) {
        return;
      }
      geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of objectMaterials) {
        materials.add(material);
      }
    });
    for (const geometry of geometries) {
      geometry.dispose();
    }
    for (const material of materials) {
      material.dispose();
    }
  }

  #updateLayers() {
    const flightProgress = clamp01(this.elapsed / this.flightDuration);
    this.#getPositionAt(flightProgress, this.projectile.position);
    this.glow.position.copy(this.projectile.position);
    this.tail.position.copy(this.projectile.position)
      .addScaledVector(this.direction, -0.38 * this.size);
    this.projectile.rotation.set(
      this.elapsed * 4.2,
      this.elapsed * 2.8,
      this.elapsed * 3.5
    );
    const isFlying = this.elapsed < this.flightDuration;
    this.projectile.visible = isFlying;
    this.glow.visible = isFlying;
    this.tail.visible = isFlying;
    this.trail.visible = isFlying && flightProgress > 0;
    this.#updateTrail(flightProgress);

    const impactElapsed = Math.max(0, this.elapsed - this.flightDuration);
    const impactProgress = clamp01(impactElapsed / IMPACT_DURATION);
    this.impactRing.scale.setScalar(0.35 + 1.45 * easeOutCubic(impactProgress));
    this.impactRing.material.opacity = 0.92 * (1 - impactProgress);
    this.impactRing.visible = this.elapsed >= this.flightDuration;

    const flashProgress = clamp01(impactElapsed / 0.18);
    this.impactFlash.scale.setScalar(0.08 + 0.7 * easeOutCubic(flashProgress));
    this.impactFlash.material.opacity = 0.88 * (1 - flashProgress);
    this.impactFlash.visible =
      this.elapsed >= this.flightDuration && impactElapsed < 0.18;

    for (const [index, fragment] of this.fragments.entries()) {
      const angle = index / this.fragments.length * FULL_CIRCLE;
      const radius = (0.2 + 0.72 * impactProgress) * this.size;
      fragment.position.set(
        this.target.x + Math.cos(angle) * radius,
        this.target.y + 0.08 * this.size +
          Math.sin(impactProgress * Math.PI) * 0.42 * this.size,
        this.target.z + Math.sin(angle) * radius
      );
      fragment.rotation.set(
        impactProgress * Math.PI,
        angle,
        impactProgress * Math.PI * 0.5
      );
      fragment.scale.setScalar(0.3 + 0.7 * (1 - impactProgress));
      fragment.material.opacity = 0.86 * (1 - impactProgress);
      fragment.visible =
        this.elapsed >= this.flightDuration && impactProgress < 1;
    }
  }

  #updateTrail(progress) {
    const trailStart = Math.max(0, progress - 0.24);
    const positions = this.trailGeometry.attributes.position;
    for (let index = 0; index <= TRAIL_SEGMENTS; index += 1) {
      const sampleProgress = trailStart +
        (progress - trailStart) * index / TRAIL_SEGMENTS;
      this.#getPositionAt(sampleProgress, this.sample);
      positions.setXYZ(index, this.sample.x, this.sample.y, this.sample.z);
    }
    positions.needsUpdate = true;
  }

  #getPositionAt(progress, target) {
    const fallProgress = progress ** 1.45;
    target.set(
      this.start.x + (this.target.x - this.start.x) * progress,
      this.start.y + (this.target.y - this.start.y) * fallProgress,
      this.start.z + (this.target.z - this.start.z) * progress
    );
    return target;
  }
}
