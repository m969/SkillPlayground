import * as THREE from "three";

const FULL_CIRCLE = Math.PI * 2;
const EFFECT_DURATION = 0.72;
const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
const easeOutCubic = (value) => 1 - (1 - value) ** 3;

/** 以两道交错弧光表现格挡成功后的快速反击。 */
export class CounterSlashVisual {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.slashes = [
      this.#createSlash(0xffcb6b, 0.085, FULL_CIRCLE * 0.43, -0.75),
      this.#createSlash(0x67e8ff, 0.055, FULL_CIRCLE * 0.31, 1.05)
    ];
    this.flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0xfff0c4,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.flash.position.y = 0.08;
    this.group.add(this.flash);
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

  #createSlash(color, thickness, arc, rotation) {
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
    this.group.add(mesh);
    return mesh;
  }

  #updateLayers() {
    const slashSettings = [
      { start: 0, duration: 0.54, from: 0.3, to: 3.1, opacity: 0.95 },
      { start: 0.09, duration: 0.48, from: 0.25, to: 2.75, opacity: 0.82 }
    ];

    for (const [index, slash] of this.slashes.entries()) {
      const setting = slashSettings[index];
      const rawProgress = (this.elapsed - setting.start) / setting.duration;
      if (rawProgress < 0 || rawProgress > 1) {
        slash.visible = false;
        continue;
      }

      const progress = clamp01(rawProgress);
      const eased = easeOutCubic(progress);
      const radius = setting.from + (setting.to - setting.from) * eased;
      slash.scale.set(radius, radius, 1);
      slash.material.opacity = setting.opacity * (1 - progress) ** 1.4;
      slash.visible = true;
    }

    const flashProgress = clamp01(this.elapsed / 0.22);
    this.flash.scale.setScalar(0.08 + 0.48 * easeOutCubic(flashProgress));
    this.flash.material.opacity = 0.82 * (1 - flashProgress);
    this.flash.visible = this.elapsed < 0.22;
  }
}
