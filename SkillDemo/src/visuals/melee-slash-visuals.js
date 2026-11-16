import * as THREE from "three";

const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
const easeOutCubic = (value) => 1 - (1 - value) ** 3;

/** 按配置播放弧形斩击、冲击波与可选突进，并统一管理视觉生命周期。 */
class MeleeSlashVisual {
  constructor(scene, settings) {
    this.scene = scene;
    this.settings = settings;
    this.duration = settings.duration;
    this.group = new THREE.Group();
    this.actionGroup = new THREE.Group();
    this.travelTarget = settings.travel
      ? new THREE.Vector3(...settings.travel.target)
      : null;
    this.group.add(this.actionGroup);
    this.scene.add(this.group);

    this.slashes = settings.slashes.map((layer) => this.#createSlash(layer));
    this.rings = (settings.rings ?? []).map((layer) => this.#createRing(layer));
    this.flash = settings.flash ? this.#createFlash(settings.flash) : null;
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
    if (this.settings.travel) {
      this.actionGroup.position.fromArray(this.settings.travel.start);
    }
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

  #createSlash(layer) {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(1, layer.thickness, 8, 72, layer.arc),
      new THREE.MeshBasicMaterial({
        color: layer.color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    mesh.rotation.x = layer.plane === "ground" ? -Math.PI / 2 : 0;
    mesh.position.fromArray(layer.position);
    mesh.visible = false;
    this.actionGroup.add(mesh);
    return mesh;
  }

  #createRing(layer) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, layer.thickness, 8, 72),
      new THREE.MeshBasicMaterial({
        color: layer.color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.fromArray(layer.position);
    ring.visible = false;
    this.group.add(ring);
    return ring;
  }

  #createFlash(layer) {
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(layer.radius, 16, 12),
      new THREE.MeshBasicMaterial({
        color: layer.color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    flash.position.fromArray(layer.position);
    flash.visible = false;
    this.group.add(flash);
    return flash;
  }

  #updateLayers() {
    if (this.settings.travel) {
      const travelProgress = clamp01(this.elapsed / this.settings.travel.duration);
      this.actionGroup.position.fromArray(this.settings.travel.start);
      this.actionGroup.position.lerp(
        this.travelTarget,
        easeOutCubic(travelProgress)
      );
    }

    for (const [index, layer] of this.settings.slashes.entries()) {
      const slash = this.slashes[index];
      const rawProgress = (this.elapsed - layer.start) / layer.duration;
      if (rawProgress < 0 || rawProgress > 1) {
        slash.visible = false;
        continue;
      }

      const progress = clamp01(rawProgress);
      const eased = easeOutCubic(progress);
      const scale = layer.from + (layer.to - layer.from) * eased;
      slash.scale.set(scale, scale * (layer.aspect ?? 1), 1);
      slash.position.fromArray(layer.position);
      slash.position.y += (layer.travelY ?? 0) * eased;
      if (layer.plane === "ground") {
        slash.rotation.y = layer.rotation + (layer.rotationDelta ?? 0) * progress;
      } else {
        slash.rotation.z = layer.rotation + (layer.rotationDelta ?? 0) * progress;
      }
      slash.material.opacity = layer.opacity * (1 - progress) ** (layer.fadePower ?? 1);
      slash.visible = true;
    }

    for (const [index, layer] of (this.settings.rings ?? []).entries()) {
      const ring = this.rings[index];
      const rawProgress = (this.elapsed - layer.start) / layer.duration;
      if (rawProgress < 0 || rawProgress > 1) {
        ring.visible = false;
        continue;
      }

      const progress = clamp01(rawProgress);
      const scale = layer.from + (layer.to - layer.from) * easeOutCubic(progress);
      ring.scale.setScalar(scale);
      ring.material.opacity = layer.opacity * (1 - progress);
      ring.visible = true;
    }

    if (this.flash) {
      const layer = this.settings.flash;
      const rawProgress = (this.elapsed - layer.start) / layer.duration;
      if (rawProgress < 0 || rawProgress > 1) {
        this.flash.visible = false;
      } else {
        const progress = clamp01(rawProgress);
        const scale = layer.from + (layer.to - layer.from) * easeOutCubic(progress);
        this.flash.scale.setScalar(scale);
        this.flash.material.opacity = layer.opacity * (1 - progress);
        this.flash.visible = true;
      }
    }
  }
}

/** 快速横向挥出两道轻盈、短促的刀光。 */
export class HorizontalLightSlashVisual extends MeleeSlashVisual {
  constructor(scene) {
    super(scene, {
      duration: 0.58,
      slashes: [
        {
          plane: "ground",
          color: 0x67e8ff,
          thickness: 0.045,
          arc: Math.PI * 1.35,
          rotation: -0.62,
          rotationDelta: -0.3,
          position: [0, 0.34, 0],
          aspect: 0.3,
          start: 0,
          duration: 0.38,
          from: 0.42,
          to: 1.75,
          opacity: 0.98
        },
        {
          plane: "ground",
          color: 0xe6fcff,
          thickness: 0.026,
          arc: Math.PI * 0.92,
          rotation: 0.48,
          rotationDelta: 0.24,
          position: [0, 0.37, 0.025],
          aspect: 0.24,
          start: 0.035,
          duration: 0.31,
          from: 0.34,
          to: 1.44,
          opacity: 0.84
        }
      ]
    });
  }
}

/** 由上向下劈落，并在落点扩散沉重冲击波。 */
export class HeavyVerticalCleaveVisual extends MeleeSlashVisual {
  constructor(scene) {
    super(scene, {
      duration: 1.02,
      slashes: [
        {
          plane: "vertical",
          color: 0xff9a4d,
          thickness: 0.12,
          arc: Math.PI * 1.08,
          rotation: 1.85,
          rotationDelta: -1.7,
          position: [0, 1.82, 0],
          travelY: -1.35,
          start: 0.08,
          duration: 0.48,
          from: 0.24,
          to: 1.9,
          opacity: 1,
          fadePower: 1.4
        },
        {
          plane: "vertical",
          color: 0xffe6ae,
          thickness: 0.035,
          arc: Math.PI * 0.72,
          rotation: 1.78,
          rotationDelta: -1.55,
          position: [0, 1.78, 0.035],
          travelY: -1.3,
          start: 0.1,
          duration: 0.34,
          from: 0.18,
          to: 1.6,
          opacity: 0.95
        }
      ],
      rings: [
        {
          color: 0xffa64d,
          thickness: 0.075,
          position: [0, 0.08, 0],
          start: 0.47,
          duration: 0.52,
          from: 0.22,
          to: 2.05,
          opacity: 0.95
        }
      ],
      flash: {
        color: 0xfff0c4,
        radius: 0.2,
        position: [0, 0.34, 0],
        start: 0.45,
        duration: 0.22,
        from: 0.55,
        to: 2.1,
        opacity: 0.92
      }
    });
  }
}

/** 以三段交错旋转的弧光表现连续旋风斩击。 */
export class WhirlwindComboSlashVisual extends MeleeSlashVisual {
  constructor(scene) {
    super(scene, {
      duration: 1.24,
      slashes: [
        {
          plane: "vertical",
          color: 0x67e8ff,
          thickness: 0.07,
          arc: Math.PI * 1.5,
          rotation: -0.7,
          rotationDelta: 2.2,
          position: [0, 0.92, 0],
          start: 0,
          duration: 0.43,
          from: 0.34,
          to: 1.65,
          opacity: 0.92
        },
        {
          plane: "vertical",
          color: 0xb69bff,
          thickness: 0.065,
          arc: Math.PI * 1.42,
          rotation: 0.82,
          rotationDelta: -2.5,
          position: [0, 1.08, 0.025],
          start: 0.27,
          duration: 0.45,
          from: 0.38,
          to: 1.8,
          opacity: 0.9
        },
        {
          plane: "ground",
          color: 0x8fffe1,
          thickness: 0.055,
          arc: Math.PI * 1.72,
          rotation: -0.9,
          rotationDelta: 3.8,
          position: [0, 0.28, 0],
          start: 0.54,
          duration: 0.5,
          from: 0.36,
          to: 2.05,
          opacity: 0.86
        }
      ],
      rings: [
        {
          color: 0x67e8ff,
          thickness: 0.035,
          position: [0, 0.07, 0],
          start: 0.56,
          duration: 0.55,
          from: 0.36,
          to: 2.2,
          opacity: 0.68
        }
      ]
    });
  }
}

/** 沿战场斜线突进，并在终点补上一道刀光与冲击。 */
export class DashSlashVisual extends MeleeSlashVisual {
  constructor(scene) {
    super(scene, {
      duration: 0.98,
      travel: {
        start: [-3.1, 0.72, 2.2],
        target: [2.65, 0.72, -1.8],
        duration: 0.56
      },
      slashes: [
        {
          plane: "vertical",
          color: 0xff744a,
          thickness: 0.09,
          arc: Math.PI * 1.22,
          rotation: -0.52,
          rotationDelta: -1.15,
          position: [0, 0, 0],
          start: 0,
          duration: 0.53,
          from: 0.3,
          to: 1.52,
          opacity: 1
        },
        {
          plane: "vertical",
          color: 0xffe2b8,
          thickness: 0.035,
          arc: Math.PI * 0.78,
          rotation: 0.72,
          rotationDelta: -0.8,
          position: [0, 0.025, 0.04],
          start: 0.08,
          duration: 0.39,
          from: 0.26,
          to: 1.38,
          opacity: 0.94
        }
      ],
      rings: [
        {
          color: 0xff8752,
          thickness: 0.055,
          position: [2.65, 0.08, -1.8],
          start: 0.53,
          duration: 0.42,
          from: 0.24,
          to: 1.45,
          opacity: 0.88
        }
      ],
      flash: {
        color: 0xffe2b8,
        radius: 0.15,
        position: [2.65, 0.76, -1.8],
        start: 0.53,
        duration: 0.2,
        from: 0.5,
        to: 1.9,
        opacity: 0.88
      }
    });
  }
}
