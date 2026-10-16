/** 首版固定模拟频率：每秒推进 60 个等长时间步。 */
export const FIXED_STEP_SECONDS = 1 / 60;

/** 将渲染帧的真实间隔累积为固定长度的模拟步进。 */
export class FixedStepClock {
  constructor(stepSeconds = FIXED_STEP_SECONDS, maxStepsPerFrame = 8) {
    if (!Number.isFinite(stepSeconds) || stepSeconds <= 0) {
      throw new RangeError("stepSeconds must be a finite positive number");
    }
    if (!Number.isInteger(maxStepsPerFrame) || maxStepsPerFrame < 1) {
      throw new RangeError("maxStepsPerFrame must be a positive integer");
    }

    this.stepSeconds = stepSeconds;
    this.maxStepsPerFrame = maxStepsPerFrame;
    this.accumulator = 0;
  }

  advance(elapsedSeconds, update) {
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
      throw new RangeError("elapsedSeconds must be finite and non-negative");
    }
    if (typeof update !== "function") {
      throw new TypeError("update must be a function");
    }

    this.accumulator += elapsedSeconds;
    let steps = 0;
    while (
      this.accumulator + Number.EPSILON >= this.stepSeconds &&
      steps < this.maxStepsPerFrame
    ) {
      update(this.stepSeconds);
      this.accumulator -= this.stepSeconds;
      if (Math.abs(this.accumulator) < 1e-12) {
        this.accumulator = 0;
      }
      steps += 1;
    }

    return {
      steps,
      interpolationAlpha: Math.min(this.accumulator / this.stepSeconds, 1)
    };
  }

  reset() {
    this.accumulator = 0;
  }
}
