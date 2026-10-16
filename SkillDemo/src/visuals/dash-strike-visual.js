import * as THREE from "three";

const DASH_DURATION = 0.62;
const EFFECT_DURATION = 0.92;
const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
const easeOutCubic = (value) => 1 - (1 - value) ** 3;
const DASH_AXIS = new THREE.Vector3(0, 1, 0);

/** 让能量体沿直线快速突进，并在终点释放冲击波。 */
export class DashStrikeVisual {
  constructor(scene) {
    this.scene = scene;
    this.start = new THREE.Vector3(-3.1, 0.62, 2.1);
    this.target = new THREE.Vector3(3.1, 0.62, -2.1);
    this.direction = new THREE.Vector3().subVectors(this.target, this.start).normalize();
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.dash = new THREE.Group();
    this.dash.quaternion.setFromUnitVectors(DASH_AXIS, this.direction);
    this.trail = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 1.2, 12),
      new THREE.MeshBasicMaterial({
        color: 0x67e8ff,
        transparent: true,
        opacity: 0.58,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.trail.position.copy(this.direction).multiplyScalar(-0.48);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.31, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0x67e8ff,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.core = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0xe6fcff,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.dash.add(this.trail, glow, this.core);
    this.group.add(this.dash);

    this.impactRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.045, 8, 48),
      new THREE.MeshBasicMaterial({
        color: 0x67e8ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    this.impactRing.rotation.x = -Math.PI / 2;
    this.impactRing.position.set(this.target.x, 0.08, this.target.z);
    this.group.add(this.impactRing);

    this.impactFlash = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 14, 10),
      new THREE.MeshBasicMaterial({
        color: 0xc9fbff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.impactFlash.position.copy(this.impactRing.position);
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
      if (!(object instanceof THREE.Mesh)) {
        return;
      }
      object.geometry.dispose();
      object.material.dispose();
    });
  }

  #updateLayers() {
    const dashProgress = clamp01(this.elapsed / DASH_DURATION);
    this.dash.position.lerpVectors(
      this.start,
      this.target,
      easeOutCubic(dashProgress)
    );
    this.dash.visible = this.elapsed < DASH_DURATION;

    const impactElapsed = Math.max(0, this.elapsed - DASH_DURATION);
    const impactProgress = clamp01(impactElapsed / (EFFECT_DURATION - DASH_DURATION));
    this.impactRing.scale.setScalar(0.35 + 1.2 * easeOutCubic(impactProgress));
    this.impactRing.material.opacity = 0.9 * (1 - impactProgress);
    this.impactRing.visible = this.elapsed >= DASH_DURATION;

    const flashProgress = clamp01(impactElapsed / 0.18);
    this.impactFlash.scale.setScalar(0.08 + 0.55 * easeOutCubic(flashProgress));
    this.impactFlash.material.opacity = 0.82 * (1 - flashProgress);
    this.impactFlash.visible = this.elapsed >= DASH_DURATION && impactElapsed < 0.18;
  }
}
