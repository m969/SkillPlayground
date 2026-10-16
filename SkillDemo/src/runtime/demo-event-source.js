/** 为 WaitEvent 示例提供可订阅、可取消的本地事件源。 */
export class DemoEventSource {
  constructor() {
    this.listeners = new Map();
    this.LastTargetEntity = null;
  }

  get listenerCount() {
    let count = 0;
    for (const listeners of this.listeners.values()) {
      count += listeners.size;
    }
    return count;
  }

  Subscribe(eventKey, callback) {
    let listeners = this.listeners.get(eventKey);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(eventKey, listeners);
    }
    listeners.add(callback);

    return () => {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.listeners.delete(eventKey);
      }
    };
  }

  publish(eventKey, targetEntity) {
    this.LastTargetEntity = targetEntity;
    const listeners = this.listeners.get(eventKey);
    if (!listeners) {
      return 0;
    }

    const callbacks = [...listeners];
    for (const callback of callbacks) {
      callback();
    }
    return callbacks.length;
  }
}
