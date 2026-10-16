import * as THREE from "three";

const EFFECT_DURATION = 1.25;
const FULL_CIRCLE = Math.PI * 2;
const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
const easeOutCubic = (value) => 1 - (1 - value) ** 3;

/** 以扩散的治愈波纹和上升光点表现范围治疗。 */
export class HealingPulseVisual {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.rings = [
      this.#createRing(0x83ffd1, 0.055),
      this.#createRing(0xc4ffe8, 0.035)
    ];
    this.core = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0xb8ffe5,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.core.position.y = 0.72;
    this.group.add(this.core);
    this.particles = Array.from({ length: 10 }, (_, index) => {
      const particle = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.075, 0),
        new THREE.MeshBasicMaterial({
          color: index % 2 === 0 ? 0x83ffd1 : 0xe2fff3,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      this.group.add(particle);
      return particle;
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
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }
      object.geometry.dispose();
      object.material.dispose();
    });
  }

  #createRing(color, thickness) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, thickness, 8, 80),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    this.group.add(ring);
    return ring;
  }

  #updateLayers() {
    const ringSettings = [
      { start: 0.04, duration: 0.84, from: 0.3, to: 2.35, opacity: 0.82 },
      { start: 0.2, duration: 0.88, from: 0.24, to: 1.85, opacity: 0.66 }
    ];
    for (const [index, ring] of this.rings.entries()) {
      const setting = ringSettings[index];
      const progress = clamp01((this.elapsed - setting.start) / setting.duration);
      ring.scale.set(setting.from + (setting.to - setting.from) * easeOutCubic(progress),
        setting.from + (setting.to - setting.from) * easeOutCubic(progress),
        1);
      ring.material.opacity = setting.opacity * (1 - progress);
      ring.visible = this.elapsed >= setting.start &&
        this.elapsed < setting.start + setting.duration;
    }

    const coreProgress = clamp01(this.elapsed / EFFECT_DURATION);
    this.core.scale.setScalar(0.72 + 0.42 * Math.sin(coreProgress * Math.PI));
    this.core.material.opacity = 0.86 * Math.sin(coreProgress * Math.PI);
    this.core.visible = this.elapsed < EFFECT_DURATION;

    for (const [index, particle] of this.particles.entries()) {
      const start = index * 0.025;
      const progress = clamp01((this.elapsed - start) / 0.92);
      const angle = index / this.particles.length * FULL_CIRCLE;
      const radius = 0.48 + 0.38 * progress;
      particle.position.set(
        Math.cos(angle) * radius,
        0.18 + 1.32 * easeOutCubic(progress),
        Math.sin(angle) * radius
      );
      particle.scale.setScalar(0.35 + 0.65 * (1 - progress));
      particle.material.opacity = 0.9 * (1 - progress);
      particle.visible = this.elapsed >= start && progress < 1;
    }
  }
}
