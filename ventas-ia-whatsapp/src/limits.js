'use strict';

// Límite diario de generaciones para el plan gratis (en memoria).
// En producción esto vive en la tabla usage_counters (ver db/schema.sql).
class UsageLimiter {
  constructor(dailyLimit, now = () => new Date()) {
    this.dailyLimit = dailyLimit;
    this.now = now;
    this.day = null;
    this.counts = new Map();
  }

  #rollDay() {
    const today = this.now().toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.counts.clear();
    }
  }

  tryConsume(id) {
    this.#rollDay();
    const used = this.counts.get(id) || 0;
    if (used >= this.dailyLimit) return false;
    this.counts.set(id, used + 1);
    return true;
  }

  refund(id) {
    const used = this.counts.get(id) || 0;
    if (used > 0) this.counts.set(id, used - 1);
  }

  remaining(id) {
    this.#rollDay();
    return Math.max(0, this.dailyLimit - (this.counts.get(id) || 0));
  }
}

module.exports = { UsageLimiter };
