import {
  NodeResult,
  NodeStatus,
  SkillExecuteComponent,
  SkillFlowConfig,
  SkillFlowContext,
  SkillFlowInterpreter
} from "@m969/game-skillflow";
import { DemoEventSource } from "./demo-event-source.js";

const VISUAL_FRAME_STATE_KEY = "skill-action-visual";

export const SkillDemoStatus = Object.freeze({
  Ready: "ready",
  Running: "running",
  Success: "success",
  Cancelled: "cancelled",
  Failure: "failure"
});

/** 使用同一套生命周期管理器运行目录中的任意代码模板。 */
export class SkillDemoRuntime {
  constructor(scene, template) {
    this.scene = scene;
    this.status = SkillDemoStatus.Ready;
    this.result = null;
    this.execution = null;
    this.template = null;
    this.visuals = [];
    this.eventSource = null;
    this.context = new SkillFlowContext();
    this.selectTemplate(template);
  }

  get phase() {
    return this.context.Variables.get("phase");
  }

  get progress() {
    if (this.visuals.length === 0) {
      return 0;
    }
    return this.visuals.reduce((total, visual) => total + visual.progress, 0) /
      this.visuals.length;
  }

  get errorMessage() {
    return this.result?.Reason ?? "";
  }

  get statusDetail() {
    if (this.errorMessage) {
      return this.errorMessage;
    }
    if (
      this.status === SkillDemoStatus.Running &&
      this.template.eventKey &&
      this.eventSource.listenerCount > 0
    ) {
      return this.template.eventWaitingDetail ??
        "正在等待来袭事件；触发事件后会自动播放反击视觉。";
    }
    if (this.status === SkillDemoStatus.Running) {
      return "技能流程与视觉效果按 1/60 秒固定步长推进。";
    }
    if (this.status === SkillDemoStatus.Success) {
      return "技能流程和视觉播放均已完成。";
    }
    if (this.status === SkillDemoStatus.Cancelled) {
      return "流程与视觉均已停止，可以重新施放。";
    }
    if (this.status === SkillDemoStatus.Failure) {
      return "技能执行失败，请检查错误原因。";
    }
    return "选择模板并施放，启动 SkillFlow 流程。";
  }

  get canTriggerEvent() {
    return this.status === SkillDemoStatus.Running &&
      this.template.eventKey !== null &&
      this.eventSource.listenerCount > 0;
  }

  selectTemplate(template) {
    if (this.status === SkillDemoStatus.Running) {
      throw new Error("技能运行期间不能切换模板。");
    }
    this.#disposeVisuals();
    this.template = template;
    this.eventSource = new DemoEventSource();
    this.context = this.#createContext(template.initialPhase);
    this.execution = null;
    this.result = null;
    this.status = SkillDemoStatus.Ready;
  }

  play() {
    if (this.status === SkillDemoStatus.Running) {
      throw new Error("技能当前正在运行，不能重复施放。");
    }

    this.#disposeVisuals();
    this.eventSource = new DemoEventSource();
    this.context = this.#createContext(this.template.initialPhase);

    const actionHost = {
      Execute: (context, actionKey, frame) => {
        const createVisual = this.template.visualFactories[actionKey];
        if (!createVisual) {
          return NodeResult.Failure(`未注册的技能动作：${actionKey}`);
        }

        let visual = frame.Locals.get(VISUAL_FRAME_STATE_KEY);
        if (!visual) {
          context.Variables.set("phase", `${this.template.name}视觉播放中`);
          visual = createVisual(this.scene);
          this.visuals.push(visual);
          visual.play();
          frame.Locals.set(VISUAL_FRAME_STATE_KEY, visual);
        }

        return visual.isFinished
          ? NodeResult.Success()
          : NodeResult.Running();
      }
    };

    this.execution = new SkillExecuteComponent({
      Config: new SkillFlowConfig({
        SkillId: this.template.skillId,
        Name: this.template.name,
        Root: this.template.createRoot()
      }),
      Context: this.context,
      ActionHost: actionHost
    });
    this.status = SkillDemoStatus.Running;
    this.result = SkillFlowInterpreter.Enter(this.execution);
    this.#finishIfTerminal(this.result);
  }

  triggerEvent(targetEntity = { id: "demo-target" }) {
    if (!this.template.eventKey) {
      throw new Error(`技能“${this.template.name}”没有待触发的事件。`);
    }
    return this.eventSource.publish(this.template.eventKey, targetEntity);
  }

  step(deltaSeconds) {
    if (this.status !== SkillDemoStatus.Running) {
      return;
    }

    for (const visual of this.visuals) {
      visual.update(deltaSeconds);
    }
    this.result = SkillFlowInterpreter.Tick(this.execution, deltaSeconds);
    this.#finishIfTerminal(this.result);
  }

  cancel() {
    if (this.status !== SkillDemoStatus.Running) {
      return;
    }

    SkillFlowInterpreter.Cancel(this.execution);
    for (const visual of this.visuals) {
      visual.stop();
    }
    this.result = NodeResult.Cancelled("技能已由用户中断。");
    SkillFlowInterpreter.Exit(this.execution, this.result);
    this.context.Variables.set("phase", "已中断");
    this.status = SkillDemoStatus.Cancelled;
  }

  dispose() {
    if (this.status === SkillDemoStatus.Running) {
      this.cancel();
    }
    this.#disposeVisuals();
  }

  #createContext(initialPhase) {
    const variables = new Map([["phase", initialPhase]]);
    for (const [key, value] of Object.entries(
      this.template.initialVariables ?? {}
    )) {
      variables.set(key, value);
    }
    return new SkillFlowContext({
      SkillId: this.template.skillId,
      EventSource: this.eventSource,
      Variables: variables
    });
  }

  #disposeVisuals() {
    for (const visual of this.visuals) {
      visual.stop();
      visual.dispose();
    }
    this.visuals = [];
  }

  #finishIfTerminal(result) {
    if (result.Status === NodeStatus.Running) {
      return;
    }

    SkillFlowInterpreter.Exit(this.execution, result);
    this.status = result.Status === NodeStatus.Success
      ? SkillDemoStatus.Success
      : SkillDemoStatus.Failure;
    this.context.Variables.set(
      "phase",
      this.status === SkillDemoStatus.Success ? "技能完成" : "技能失败"
    );
    if (this.status === SkillDemoStatus.Failure) {
      for (const visual of this.visuals) {
        visual.stop();
      }
    }
  }
}
