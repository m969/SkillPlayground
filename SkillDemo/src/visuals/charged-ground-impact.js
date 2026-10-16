import * as THREE from "three";

const EFFECT_DURATION = 1.1;
const FULL_CIRCLE = Math.PI * 2;
const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
const easeOutCubic = (value) => 1 - (1 - value) ** 3;

function createRing(parent, color, thickness, arc = FULL_CIRCLE, rotation = 0) {
  const geometry = new THREE.TorusGeometry(1, thickness, 8, 96, arc);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.set(-Math.PI / 2, 0, rotation);
  mesh.visible = false;
  parent.add(mesh);
  return mesh;
}

function animateRing(mesh, elapsed, start, duration, fromRadius, toRadius, peakOpacity, fadePower = 1) {
  const rawProgress = (elapsed - start) / duration;
  if (rawProgress < 0 || rawProgress > 1) {
    mesh.visible = false;
    return;
  }

  const progress = clamp01(rawProgress);
  const eased = easeOutCubic(progress);
  const radius = fromRadius + (toRadius - fromRadius) * eased;
  mesh.scale.set(radius, radius, 1);
  mesh.material.opacity = peakOpacity * (1 - progress) ** fadePower;
  mesh.visible = true;
}

/** 以固定步长播放蓄力光环、冲击环、弧光与地面波纹。 */
export class ChargedGroundImpactVisual {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.chargeHalo = createRing(this.group, 0xffcb6b, 0.035);
    this.releaseRing = createRing(this.group, 0xffe6a0, 0.07);
    this.releaseArc = createRing(
      this.group,
      0xffa64d,
      0.085,
      FULL_CIRCLE * (245 / 360),
      -Math.PI * 0.57
    );
    this.groundWave = createRing(this.group, 0x67e8ff, 0.16);

    this.core = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0xfff1c2,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.core.position.y = 0.08;
    this.group.add(this.core);
    this.sparks = this.#createSparks();

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
      if (!(object instanceof THREE.Mesh)) {
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

  #createSparks() {
    const sparks = [];
    for (let index = 0; index < 12; index += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: index % 3 === 0 ? 0x67e8ff : 0xffcb6b,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 6, 6),
        material
      );
      mesh.visible = false;
      this.group.add(mesh);
      sparks.push({ angle: (index / 12) * FULL_CIRCLE, mesh });
    }
    return sparks;
  }

  #updateLayers() {
    const chargeProgress = clamp01(this.elapsed / 0.38);
    const chargeRadius = 2.7 - 1.75 * chargeProgress ** 2;
    this.chargeHalo.scale.set(chargeRadius, chargeRadius, 1);
    this.chargeHalo.material.opacity = 0.18 + 0.56 * easeOutCubic(chargeProgress);
    this.chargeHalo.visible = this.elapsed < 0.38;

    animateRing(this.releaseRing, this.elapsed, 0.34, 0.52, 0.12, 3.2, 0.95, 2);
    animateRing(this.releaseArc, this.elapsed, 0.38, 0.46, 0.35, 3.0, 0.82, 1.5);
    animateRing(this.groundWave, this.elapsed, 0.44, 0.66, 0.08, 3.25, 0.74, 2);

    const flashProgress = clamp01((this.elapsed - 0.34) / 0.24);
    const flashRadius = 0.08 + 0.52 * easeOutCubic(flashProgress);
    this.core.scale.setScalar(flashRadius);
    this.core.material.opacity = 0.78 * (1 - flashProgress);
    this.core.visible = this.elapsed >= 0.34 && this.elapsed < 0.58;

    const sparkProgress = clamp01((this.elapsed - 0.38) / 0.5);
    for (const { angle, mesh } of this.sparks) {
      const radius = 0.25 + 1.55 * sparkProgress;
      mesh.position.set(
        Math.cos(angle) * radius,
        0.08 + Math.sin(sparkProgress * Math.PI) * 0.55,
        Math.sin(angle) * radius
      );
      mesh.scale.setScalar(1 - sparkProgress);
      mesh.material.opacity = 0.9 * (1 - sparkProgress);
      mesh.visible = this.elapsed >= 0.38 && this.elapsed < 0.88;
    }
  }
}
