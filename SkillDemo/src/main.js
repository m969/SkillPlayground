import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import "./style.css";
import { FixedStepClock, FIXED_STEP_SECONDS } from "./runtime/fixed-step-clock.js";
import {
  SkillDemoRuntime,
  SkillDemoStatus
} from "./runtime/skill-demo-runtime.js";
import { skillCatalog } from "./skills/skill-catalog.js";

function requireElement(selector) {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`页面缺少必要元素：${selector}`);
  }
  return element;
}

function displayError(error) {
  const message = error instanceof Error ? error.message : String(error);
  const errorElement = requireElement("#error-message");
  errorElement.textContent = message;
  errorElement.hidden = false;
  console.error(error);
}

function clearError() {
  const errorElement = requireElement("#error-message");
  errorElement.textContent = "";
  errorElement.hidden = true;
}

function startDemo() {
  const canvas = requireElement("#visual-canvas");
  const stage = requireElement(".stage");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x080d18, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080d18);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 8.2, 9.5);
  camera.lookAt(0, 0, 0);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  // 限制旋转角度与缩放范围，避免视角翻到地面下方或远离舞台。
  controls.minDistance = 6;
  controls.maxDistance = 20;
  controls.minPolarAngle = 0.2;
  controls.maxPolarAngle = Math.PI / 2 - 0.08;
  controls.update();

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 18),
    new THREE.MeshBasicMaterial({ color: 0x0c1421 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.04;
  scene.add(ground);

  const grid = new THREE.GridHelper(18, 36, 0x284354, 0x17283a);
  grid.position.y = -0.02;
  scene.add(grid);

  const skillSelect = requireElement("#skill-select");
  for (const template of skillCatalog) {
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = template.name;
    skillSelect.append(option);
  }

  const runtime = new SkillDemoRuntime(scene, skillCatalog[0]);
  const clock = new FixedStepClock(FIXED_STEP_SECONDS);
  const playButton = requireElement("#play-button");
  const cancelButton = requireElement("#cancel-button");
  const eventButton = requireElement("#event-button");
  const replayButton = requireElement("#replay-button");
  const statusBadge = requireElement("#status-badge");
  const phaseLabel = requireElement("#phase-label");
  const statusDetail = requireElement("#status-detail");
  const progressFill = requireElement("#progress-fill");
  const templateId = requireElement("#template-id");
  const skillName = requireElement("#skill-name");
  const visualTitle = requireElement("#visual-title");
  const visualCaption = requireElement("#visual-caption");
  const skillDescription = requireElement("#skill-description");
  const flowSteps = requireElement("#flow-steps");

  const resize = () => {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", resize);
  resize();

  const statusLabels = new Map([
    [SkillDemoStatus.Ready, "待机"],
    [SkillDemoStatus.Running, "运行中"],
    [SkillDemoStatus.Success, "已完成"],
    [SkillDemoStatus.Cancelled, "已中断"],
    [SkillDemoStatus.Failure, "失败"]
  ]);

  function updateTemplateInfo() {
    const template = runtime.template;
    templateId.textContent = `SKILL TEMPLATE · ${template.skillId}`;
    skillName.textContent = template.name;
    document.title = `${template.name} · 技能流程演示`;
    visualTitle.textContent = `${template.name}视觉场景`;
    canvas.setAttribute("aria-label", `${template.name}的 Three.js 视觉效果`);
    visualCaption.textContent = template.id.replaceAll("-", " ").toUpperCase();
    skillDescription.textContent = template.description;
    skillSelect.value = template.id;
    eventButton.hidden = template.eventKey === null;
    eventButton.textContent = template.eventButtonLabel;
    flowSteps.replaceChildren(
      ...template.flowSteps.map((step, index) => {
        const item = document.createElement("li");
        const number = document.createElement("span");
        number.textContent = String(index + 1).padStart(2, "0");
        item.append(number, document.createTextNode(step));
        return item;
      })
    );
  }

  function updateInterface() {
    statusBadge.textContent = statusLabels.get(runtime.status);
    statusBadge.dataset.state = runtime.status;
    phaseLabel.textContent = runtime.phase;
    statusDetail.textContent = runtime.statusDetail;
    progressFill.style.transform = `scaleX(${runtime.progress})`;
    const isRunning = runtime.status === SkillDemoStatus.Running;
    playButton.disabled = isRunning;
    cancelButton.disabled = !isRunning;
    eventButton.disabled = !runtime.canTriggerEvent;
    replayButton.disabled = runtime.status === SkillDemoStatus.Ready || isRunning;
    skillSelect.disabled = isRunning;
  }

  skillSelect.addEventListener("change", () => {
    try {
      clearError();
      const template = skillCatalog.find((entry) => entry.id === skillSelect.value);
      if (!template) {
        throw new Error(`找不到技能模板：${skillSelect.value}`);
      }
      runtime.selectTemplate(template);
      updateTemplateInfo();
      updateInterface();
    } catch (error) {
      displayError(error);
    }
  });

  playButton.addEventListener("click", () => {
    try {
      clearError();
      runtime.play();
      updateInterface();
    } catch (error) {
      displayError(error);
    }
  });

  cancelButton.addEventListener("click", () => {
    runtime.cancel();
    updateInterface();
  });

  eventButton.addEventListener("click", () => {
    try {
      clearError();
      const recipients = runtime.triggerEvent({ id: "training-dummy" });
      if (recipients === 0) {
        throw new Error("当前没有等待该事件的技能节点。");
      }
      updateInterface();
    } catch (error) {
      displayError(error);
    }
  });

  replayButton.addEventListener("click", () => {
    try {
      clearError();
      runtime.play();
      updateInterface();
    } catch (error) {
      displayError(error);
    }
  });

  let lastTimestamp = null;
  function renderFrame(timestamp) {
    if (document.hidden) {
      lastTimestamp = null;
      clock.reset();
      requestAnimationFrame(renderFrame);
      return;
    }

    if (lastTimestamp !== null) {
      const elapsedSeconds = Math.max(0, (timestamp - lastTimestamp) / 1000);
      try {
        clock.advance(elapsedSeconds, (deltaSeconds) => runtime.step(deltaSeconds));
      } catch (error) {
        runtime.cancel();
        displayError(error);
      }
    }
    lastTimestamp = timestamp;
    updateInterface();
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(renderFrame);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      lastTimestamp = null;
      clock.reset();
    }
  });

  window.addEventListener("beforeunload", () => {
    runtime.dispose();
    controls.dispose();
    renderer.dispose();
  });

  updateTemplateInfo();
  updateInterface();
  requestAnimationFrame(renderFrame);
}

try {
  startDemo();
} catch (error) {
  displayError(error);
}
