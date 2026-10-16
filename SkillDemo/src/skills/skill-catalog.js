import { SkillFlowNodes } from "@m969/game-skillflow";
import { ChargedGroundImpactVisual } from "../visuals/charged-ground-impact.js";
import { CounterSlashVisual } from "../visuals/counter-slash-visual.js";
import { DashStrikeVisual } from "../visuals/dash-strike-visual.js";
import { GuardianShieldVisual } from "../visuals/guardian-shield-visual.js";
import { HealingPulseVisual } from "../visuals/healing-pulse-visual.js";
import { IceShardVisual } from "../visuals/ice-shard-visual.js";
import { ProjectileShotVisual } from "../visuals/projectile-shot-visual.js";
import { SkyfallProjectileVisual } from "../visuals/skyfall-projectile-visual.js";

const FULL_CIRCLE = Math.PI * 2;

function createSkyfallWave({
  actionPrefix,
  count,
  waveIndex,
  targetRadius,
  startHeight,
  size,
  duration,
  colors
}) {
  return Object.freeze(Array.from({ length: count }, (_, index) => {
    const angle = index / count * FULL_CIRCLE + waveIndex * 0.28;
    const radius = targetRadius + (index % 2 === 0 ? 0.18 : -0.16);
    const target = [
      Math.cos(angle) * radius,
      Math.sin(angle) * radius
    ];
    return Object.freeze({
      actionKey: `${actionPrefix}-${String(index + 1).padStart(2, "0")}`,
      start: Object.freeze([
        target[0] + Math.cos(angle) * 0.34,
        target[1] + 3.2
      ]),
      target: Object.freeze(target),
      startHeight,
      color: colors[(index + waveIndex) % colors.length],
      size: size * (1 + index % 3 * 0.055),
      duration: duration + index % 4 * 0.025
    });
  }));
}

function createSkyfallVisualFactories(waves) {
  return Object.freeze(Object.fromEntries(
    waves.flat().map((projectile) => [
      projectile.actionKey,
      (scene) => new SkyfallProjectileVisual(scene, projectile)
    ])
  ));
}

function createSkyfallWaveNode(wave) {
  return SkillFlowNodes.ParallelAll(
    ...wave.map(({ actionKey }) => SkillFlowNodes.Action(actionKey))
  );
}

function createSkyfallSequence(waves, waveDelay, finalActionKey = null) {
  const steps = [];
  for (const [index, wave] of waves.entries()) {
    if (index > 0) {
      steps.push(SkillFlowNodes.Delay(waveDelay));
    }
    steps.push(createSkyfallWaveNode(wave));
  }
  if (finalActionKey !== null) {
    steps.push(SkillFlowNodes.Action(finalActionKey));
  }
  return SkillFlowNodes.Sequence(...steps);
}

const chargedGroundImpact = Object.freeze({
  id: "charged-ground-impact",
  skillId: 1001,
  name: "蓄力地面冲击",
  subtitle: "蓄力后释放范围冲击",
  description: "先等待蓄力时长，再播放扩散冲击环、弧光与地面波纹。",
  eventKey: null,
  eventButtonLabel: "",
  initialPhase: "蓄力中",
  flowSteps: ["蓄力等待", "播放冲击视觉", "视觉结束，流程完成"],
  visualFactories: Object.freeze({
    "play-charged-ground-impact": (scene) => new ChargedGroundImpactVisual(scene)
  }),
  createRoot() {
    return SkillFlowNodes.Sequence(
      SkillFlowNodes.Delay(0.2),
      SkillFlowNodes.Action("play-charged-ground-impact")
    );
  }
});

const counterSlash = Object.freeze({
  id: "counter-slash",
  skillId: 1002,
  name: "格挡反击",
  subtitle: "等待来袭事件后快速反击",
  description: "WaitEvent 等待来袭事件；事件触发后播放交错弧光并完成技能。",
  eventKey: "incoming-attack",
  eventButtonLabel: "模拟敌人来袭",
  initialPhase: "等待来袭",
  flowSteps: ["等待来袭事件", "播放反击视觉", "视觉结束，流程完成"],
  visualFactories: Object.freeze({
    "play-counter-slash": (scene) => new CounterSlashVisual(scene)
  }),
  createRoot() {
    return SkillFlowNodes.Sequence(
      SkillFlowNodes.WaitEvent(this.eventKey),
      SkillFlowNodes.Action("play-counter-slash")
    );
  }
});

const projectileVolley = Object.freeze({
  id: "projectile-volley",
  skillId: 1003,
  name: "连射飞弹",
  subtitle: "三路弹体错峰齐射",
  description: "ParallelAll 并行推进三条错峰发射流程；所有飞弹命中视觉结束后技能才完成。",
  eventKey: null,
  eventButtonLabel: "",
  initialPhase: "准备齐射",
  flowSteps: ["三路弹道并行发射", "弹体命中并播放冲击", "等待全部视觉完成"],
  visualFactories: Object.freeze({
    "launch-left-projectile": (scene) => new ProjectileShotVisual(scene, {
      target: [-2.2, -2.2],
      color: 0xffcb6b
    }),
    "launch-center-projectile": (scene) => new ProjectileShotVisual(scene, {
      target: [0, -2.8],
      color: 0x67e8ff
    }),
    "launch-right-projectile": (scene) => new ProjectileShotVisual(scene, {
      target: [2.2, -2.2],
      color: 0xff7ef0
    })
  }),
  createRoot() {
    const shot = (delaySeconds, actionKey) => SkillFlowNodes.Sequence(
      SkillFlowNodes.Delay(delaySeconds),
      SkillFlowNodes.Action(actionKey)
    );
    return SkillFlowNodes.ParallelAll(
      shot(0.06, "launch-left-projectile"),
      shot(0.16, "launch-center-projectile"),
      shot(0.26, "launch-right-projectile")
    );
  }
});

const iceShardShots = Object.freeze([
  Object.freeze({
    actionKey: "launch-ice-shard-01",
    target: Object.freeze([-3.3, -1.6]),
    color: 0x69dfff
  }),
  Object.freeze({
    actionKey: "launch-ice-shard-02",
    target: Object.freeze([-2.2, -2]),
    color: 0x82eaff
  }),
  Object.freeze({
    actionKey: "launch-ice-shard-03",
    target: Object.freeze([-1.1, -2.4]),
    color: 0x9af1ff
  }),
  Object.freeze({
    actionKey: "launch-ice-shard-04",
    target: Object.freeze([0, -2.65]),
    color: 0x73dcff
  }),
  Object.freeze({
    actionKey: "launch-ice-shard-05",
    target: Object.freeze([1.1, -2.4]),
    color: 0x9af1ff
  }),
  Object.freeze({
    actionKey: "launch-ice-shard-06",
    target: Object.freeze([2.2, -2]),
    color: 0x82eaff
  }),
  Object.freeze({
    actionKey: "launch-ice-shard-07",
    target: Object.freeze([3.3, -1.6]),
    color: 0x69dfff
  })
]);

const iceShardVisualFactories = Object.freeze(
  Object.fromEntries(
    iceShardShots.map((shot) => [
      shot.actionKey,
      (scene) => new IceShardVisual(scene, shot)
    ])
  )
);

const iceShardVolley = Object.freeze({
  id: "ice-shard-volley",
  skillId: 1004,
  name: "冰晶箭幕",
  subtitle: "七道冰晶直线扇形齐射",
  description: "七枚冰晶箭同时沿扇形目标直线射出，命中后散成短暂霜纹；全部视觉结束后技能完成。",
  eventKey: null,
  eventButtonLabel: "",
  initialPhase: "蓄势待发",
  flowSteps: ["七道箭路同时射出", "冰晶箭直线穿越扇形区域", "全部命中，霜纹消散"],
  visualFactories: iceShardVisualFactories,
  createRoot() {
    const branches = iceShardShots.map(({ actionKey }) =>
      SkillFlowNodes.Action(actionKey)
    );
    return SkillFlowNodes.ParallelAll(...branches);
  }
});

const healingPulse = Object.freeze({
  id: "healing-pulse",
  skillId: 1005,
  name: "疗愈脉冲",
  subtitle: "释放扩散的治疗能量",
  description: "短暂蓄势后扩散治愈波纹，并让能量光点向上升起；视觉结束后流程完成。",
  eventKey: null,
  eventButtonLabel: "",
  initialPhase: "凝聚治愈能量",
  flowSteps: ["凝聚治愈能量", "释放范围治疗", "波纹与光点消散"],
  visualFactories: Object.freeze({
    "play-healing-pulse": (scene) => new HealingPulseVisual(scene)
  }),
  createRoot() {
    return SkillFlowNodes.Sequence(
      SkillFlowNodes.Delay(0.12),
      SkillFlowNodes.Action("play-healing-pulse")
    );
  }
});

const dashStrike = Object.freeze({
  id: "dash-strike",
  skillId: 1006,
  name: "疾风突进",
  subtitle: "沿直线突进并冲击目标",
  description: "短暂蓄势后，能量体沿舞台斜线快速突进，并在终点释放冲击波。",
  eventKey: null,
  eventButtonLabel: "",
  initialPhase: "准备突进",
  flowSteps: ["锁定突进方向", "快速穿越战场", "终点冲击波消散"],
  visualFactories: Object.freeze({
    "play-dash-strike": (scene) => new DashStrikeVisual(scene)
  }),
  createRoot() {
    return SkillFlowNodes.Sequence(
      SkillFlowNodes.Delay(0.1),
      SkillFlowNodes.Action("play-dash-strike")
    );
  }
});

const guardianShield = Object.freeze({
  id: "guardian-shield",
  skillId: 1007,
  name: "守护屏障",
  subtitle: "展开并维持一道能量护盾",
  description: "展开半球形能量屏障并维持片刻，随后平滑收束；视觉结束后流程完成。",
  eventKey: null,
  eventButtonLabel: "",
  initialPhase: "准备守护屏障",
  flowSteps: ["展开屏障", "维持防护", "屏障收束消散"],
  visualFactories: Object.freeze({
    "play-guardian-shield": (scene) => new GuardianShieldVisual(scene)
  }),
  createRoot() {
    return SkillFlowNodes.Action("play-guardian-shield");
  }
});

const starfallFinisher = Object.freeze({
  id: "starfall-finisher",
  skillId: 1008,
  name: "星陨连携终结技",
  subtitle: "双路星弹汇聚为终结冲击",
  description: "蓄力后错峰发射两枚星弹；两路命中后再释放地面终结冲击。",
  eventKey: null,
  eventButtonLabel: "",
  initialPhase: "凝聚星陨之力",
  flowSteps: ["凝聚终结能量", "双路星弹并行命中", "释放最终范围冲击"],
  visualFactories: Object.freeze({
    "launch-starfall-left": (scene) => new ProjectileShotVisual(scene, {
      target: [-1.35, -2.4],
      color: 0xffcb6b
    }),
    "launch-starfall-right": (scene) => new ProjectileShotVisual(scene, {
      target: [1.35, -2.4],
      color: 0x9f8cff
    }),
    "play-starfall-finale": (scene) => new ChargedGroundImpactVisual(scene)
  }),
  createRoot() {
    return SkillFlowNodes.Sequence(
      SkillFlowNodes.Delay(0.24),
      SkillFlowNodes.ParallelAll(
        SkillFlowNodes.Action("launch-starfall-left"),
        SkillFlowNodes.Sequence(
          SkillFlowNodes.Delay(0.12),
          SkillFlowNodes.Action("launch-starfall-right")
        )
      ),
      SkillFlowNodes.Action("play-starfall-finale")
    );
  }
});

const interruptibleChannel = Object.freeze({
  id: "interruptible-channel",
  skillId: 1009,
  name: "可打断蓄力",
  subtitle: "来袭时反制，超时后释放蓄力攻击",
  description: "蓄力期间限时等待来袭事件；事件触发后反制，等待超时则释放蓄力冲击。",
  eventKey: "incoming-attack",
  eventButtonLabel: "模拟敌人打断",
  eventWaitingDetail: "蓄力窗口内可触发敌人来袭；触发后反制，窗口结束后释放蓄力攻击。",
  initialPhase: "蓄力中，等待敌人打断",
  flowSteps: ["蓄力并监听来袭事件", "事件触发则播放反制", "窗口超时则释放冲击"],
  visualFactories: Object.freeze({
    "play-channel-counter": (scene) => new CounterSlashVisual(scene),
    "play-channel-release": (scene) => new ChargedGroundImpactVisual(scene)
  }),
  createRoot() {
    return SkillFlowNodes.Selector(
      SkillFlowNodes.Sequence(
        SkillFlowNodes.Timeout(0.75, SkillFlowNodes.WaitEvent(this.eventKey)),
        SkillFlowNodes.Action("play-channel-counter")
      ),
      SkillFlowNodes.Action("play-channel-release")
    );
  }
});

const adaptiveCombo = Object.freeze({
  id: "adaptive-combo",
  skillId: 1010,
  name: "星弧变式连招",
  subtitle: "根据连招上下文自动选择终结式",
  description: "先发动起手弧光，再按上下文中的 comboRoute 选择突进终结或双路飞弹终结。",
  eventKey: null,
  eventButtonLabel: "",
  initialPhase: "准备连携",
  initialVariables: Object.freeze({ comboRoute: 1 }),
  flowSteps: ["发动连招起手", "读取连招路线", "执行对应的终结动作"],
  visualFactories: Object.freeze({
    "play-combo-opener": (scene) => new CounterSlashVisual(scene),
    "play-combo-dash-finisher": (scene) => new DashStrikeVisual(scene),
    "play-combo-left-projectile": (scene) => new ProjectileShotVisual(scene, {
      target: [-1.6, -2.5],
      color: 0x67e8ff
    }),
    "play-combo-right-projectile": (scene) => new ProjectileShotVisual(scene, {
      target: [1.6, -2.5],
      color: 0xff7ef0
    })
  }),
  createRoot() {
    const standardFinisher = SkillFlowNodes.Action("play-combo-dash-finisher");
    return SkillFlowNodes.Sequence(
      SkillFlowNodes.Action("play-combo-opener"),
      SkillFlowNodes.Switch("comboRoute", standardFinisher, [
        { Value: 1, Branch: SkillFlowNodes.Action("play-combo-dash-finisher") },
        {
          Value: 2,
          Branch: SkillFlowNodes.ParallelAll(
            SkillFlowNodes.Action("play-combo-left-projectile"),
            SkillFlowNodes.Action("play-combo-right-projectile")
          )
        }
      ])
    );
  }
});

const meteorRainWaves = Object.freeze([
  createSkyfallWave({
    actionPrefix: "meteor-rain",
    count: 8,
    waveIndex: 0,
    targetRadius: 3.2,
    startHeight: 5.5,
    size: 1.65,
    duration: 1.18,
    colors: [0xff633d, 0xffa14c, 0xffd17d]
  })
]);

const fireRainRadii = [2.2, 3, 3.8];
const fireRainWaves = Object.freeze(fireRainRadii.map((targetRadius, waveIndex) =>
  createSkyfallWave({
    actionPrefix: `fire-rain-${waveIndex + 1}`,
    count: 8,
    waveIndex,
    targetRadius,
    startHeight: 5.25,
    size: 0.82,
    duration: 1.02,
    colors: [0xff673d, 0xffa337, 0xffd45c]
  })
));

const cataclysmRadii = [1.9, 2.85, 3.75];
const cataclysmSizes = [0.98, 1.24, 1.5];
const cataclysmWaves = Object.freeze(cataclysmRadii.map((targetRadius, waveIndex) =>
  createSkyfallWave({
    actionPrefix: `cataclysm-${waveIndex + 1}`,
    count: 12,
    waveIndex,
    targetRadius,
    startHeight: 5.35 + waveIndex * 0.15,
    size: cataclysmSizes[waveIndex],
    duration: 0.98 + waveIndex * 0.08,
    colors: [
      [0xff813e, 0xffc05b],
      [0xff5a45, 0xff9a4d],
      [0xe66cff, 0xff744a]
    ][waveIndex]
  })
));

const cataclysmVisualFactories = Object.freeze({
  ...createSkyfallVisualFactories(cataclysmWaves),
  "play-cataclysm-finale": (scene) => new ChargedGroundImpactVisual(scene)
});

const meteorRain = Object.freeze({
  id: "meteor-rain",
  skillId: 1011,
  name: "陨星天降",
  subtitle: "八枚巨型陨星同时砸向战场",
  description: "八枚大型陨星从高处分散坠落，在地面留下明亮冲击波。",
  eventKey: null,
  eventButtonLabel: "",
  initialPhase: "天幕裂开，陨星来袭",
  flowSteps: ["陨星从高空急坠", "八处落点同时爆发", "冲击波与碎片消散"],
  projectileCount: 8,
  waveSizes: Object.freeze([8]),
  visualFactories: createSkyfallVisualFactories(meteorRainWaves),
  createRoot() {
    return createSkyfallWaveNode(meteorRainWaves[0]);
  }
});

const heavenlyFireRain = Object.freeze({
  id: "heavenly-fire-rain",
  skillId: 1012,
  name: "天火流雨",
  subtitle: "三轮二十四枚火流星覆盖战场",
  description: "二十四枚火流星分三轮从天而降，每轮八枚，落点逐步向外扩散。",
  eventKey: null,
  eventButtonLabel: "",
  initialPhase: "天火正在聚集",
  flowSteps: ["第一轮火流星落下", "第二轮扩大覆盖", "第三轮火雨收束"],
  projectileCount: 24,
  waveSizes: Object.freeze([8, 8, 8]),
  visualFactories: createSkyfallVisualFactories(fireRainWaves),
  createRoot() {
    return createSkyfallSequence(fireRainWaves, 0.12);
  }
});

const cataclysmStarfall = Object.freeze({
  id: "cataclysm-starfall",
  skillId: 1013,
  name: "末日星陨",
  subtitle: "三轮星陨逐步扩大，最终引爆地面",
  description: "三轮共三十六枚星陨逐步扩大落点与体积；全部命中后释放范围终结冲击。",
  eventKey: null,
  eventButtonLabel: "",
  initialPhase: "末日星云凝结",
  flowSteps: ["第一轮星陨试探落下", "第二轮星陨扩大覆盖", "第三轮密集轰击", "终结冲击横扫战场"],
  projectileCount: 36,
  waveSizes: Object.freeze([12, 12, 12]),
  visualFactories: cataclysmVisualFactories,
  createRoot() {
    return createSkyfallSequence(
      cataclysmWaves,
      0.16,
      "play-cataclysm-finale"
    );
  }
});

/** 示例目录只保存代码工厂；每次启动都会创建全新的节点图与视觉实例。 */
export const skillCatalog = Object.freeze([
  chargedGroundImpact,
  counterSlash,
  projectileVolley,
  iceShardVolley,
  healingPulse,
  dashStrike,
  guardianShield,
  starfallFinisher,
  interruptibleChannel,
  adaptiveCombo,
  meteorRain,
  heavenlyFireRain,
  cataclysmStarfall
]);
