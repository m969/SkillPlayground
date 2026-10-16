import * as THREE from "three";

const SHOT_DURATION = 0.7;
const IMPACT_DURATION = 0.35;
const EFFECT_DURATION = SHOT_DURATION + IMPACT_DURATION;
const TRAIL_SEGMENTS = 14;
const FULL_CIRCLE = Math.PI * 2;
const ARROW_AXIS = new THREE.Vector3(0, 1, 0);
const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
const easeOutCubic = (value) => 1 - (1 - value) ** 3;

/** 播放一枚沿直线飞行的冰晶箭，并在目标点生成短暂霜纹。 */
export class IceShardVisual {
  constructor(scene, { target, color }) {
    this.scene = scene;
    this.start = new THREE.Vector3(0, 0.58, 3.25);
    this.target = new THREE.Vector3(target[0], 0.06, target[1]);
    this.sample = new THREE.Vector3();
    this.before = new THREE.Vector3();
    this.after = new THREE.Vector3();
    this.direction = new THREE.Vector3();
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
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.trail.frustumCulled = false;
    this.group.add(this.trail);

    this.arrow = new THREE.Group();
    const crystalMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const brightMaterial = new THREE.MeshBasicMaterial({
      color: 0xe4fcff,
      transparent: true,
      opacity: 0.94,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const arrowhead = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.34, 6),
      brightMaterial
    );
    arrowhead.position.y = 0.2;
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.05, 0.38, 6),
      crystalMaterial
    );
    shaft.position.y = -0.15;
    const fletching = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.09, 0),
      crystalMaterial
    );
    fletching.position.y = -0.34;
    fletching.scale.set(1.3, 0.75, 0.75);
    this.arrow.add(arrowhead, shaft, fletching);
    this.group.add(this.arrow);

    this.impactRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.025, 6, 32),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.impactRing.rotation.x = -Math.PI / 2;
    this.impactRing.position.copy(this.target);
    this.group.add(this.impactRing);

    this.impactShards = Array.from({ length: 6 }, (_, index) => {
      const shard = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.09, 0),
        new THREE.MeshBasicMaterial({
          color: index % 2 === 0 ? color : 0xdffaff,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      this.group.add(shard);
      return shard;
    });

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
    const shotProgress = clamp01(this.elapsed / SHOT_DURATION);
    const isFlying = this.elapsed < SHOT_DURATION;
    this.#getPositionAt(shotProgress, this.arrow.position);
    this.#getPositionAt(Math.max(0, shotProgress - 0.02), this.before);
    this.#getPositionAt(Math.min(1, shotProgress + 0.02), this.after);
    this.direction.subVectors(this.after, this.before).normalize();
    this.arrow.quaternion.setFromUnitVectors(ARROW_AXIS, this.direction);
    this.arrow.visible = isFlying;
    this.trail.visible = isFlying && shotProgress > 0;
    this.#updateTrail(shotProgress);

    const impactElapsed = Math.max(0, this.elapsed - SHOT_DURATION);
    const impactProgress = clamp01(impactElapsed / IMPACT_DURATION);
    const expansion = easeOutCubic(impactProgress);
    this.impactRing.scale.setScalar(0.25 + 1.1 * expansion);
    this.impactRing.material.opacity = 0.86 * (1 - impactProgress);
    this.impactRing.visible = this.elapsed >= SHOT_DURATION;

    for (const [index, shard] of this.impactShards.entries()) {
      const angle = index / this.impactShards.length * FULL_CIRCLE;
      const radius = 0.14 + 0.44 * expansion;
      shard.position.set(
        this.target.x + Math.cos(angle) * radius,
        this.target.y + 0.04 + Math.sin(impactProgress * Math.PI) * 0.13,
        this.target.z + Math.sin(angle) * radius
      );
      shard.rotation.set(
        impactProgress * Math.PI,
        angle,
        impactProgress * Math.PI * 0.5
      );
      shard.scale.setScalar(0.2 + 0.8 * (1 - impactProgress));
      shard.material.opacity = 0.88 * (1 - impactProgress);
      shard.visible = this.elapsed >= SHOT_DURATION && impactProgress < 1;
    }
  }

  #updateTrail(progress) {
    const trailStart = Math.max(0, progress - 0.22);
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
    target.set(
      this.start.x + (this.target.x - this.start.x) * progress,
      this.start.y + (this.target.y - this.start.y) * progress,
      this.start.z + (this.target.z - this.start.z) * progress
    );
    return target;
  }
}
