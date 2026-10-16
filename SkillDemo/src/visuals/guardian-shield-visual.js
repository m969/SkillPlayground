import * as THREE from "three";

const EFFECT_DURATION = 1.5;
const FULL_CIRCLE = Math.PI * 2;
const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
const easeOutCubic = (value) => 1 - (1 - value) ** 3;

/** 展开半球屏障并维持片刻，随后平滑收束消散。 */
export class GuardianShieldVisual {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.shell = new THREE.Mesh(
      new THREE.SphereGeometry(1.35, 28, 18, 0, FULL_CIRCLE, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0x67cfff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    this.shell.position.y = 0.04;
    this.group.add(this.shell);

    this.rings = [
      this.#createRing(1.18, 0.055, 0x67e8ff, 0.08),
      this.#createRing(0.94, 0.035, 0x9bf2ff, 0.52),
      this.#createRing(0.63, 0.025, 0xd1fbff, 0.92)
    ];

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

  #createRing(radius, thickness, color, height) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, thickness, 8, 72),
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
    ring.position.y = height;
    this.group.add(ring);
    return ring;
  }

  #updateLayers() {
    const reveal = easeOutCubic(clamp01(this.elapsed / 0.28));
    const fade = 1 - easeOutCubic(
      clamp01((this.elapsed - 1.18) / (EFFECT_DURATION - 1.18))
    );
    this.shell.scale.setScalar(0.72 + 0.28 * reveal);
    this.shell.material.opacity = (0.1 + 0.16 * reveal) * fade;
    this.shell.visible = this.elapsed < EFFECT_DURATION;

    const pulse = 0.78 + 0.22 * Math.sin(this.elapsed * 11);
    for (const [index, ring] of this.rings.entries()) {
      ring.scale.setScalar(0.82 + 0.18 * reveal);
      ring.material.opacity = (0.38 + 0.2 * pulse) * fade;
      ring.visible = this.elapsed < EFFECT_DURATION;
      ring.rotation.y = index % 2 === 0
        ? this.elapsed * 0.42
        : -this.elapsed * 0.34;
    }
  }
}
