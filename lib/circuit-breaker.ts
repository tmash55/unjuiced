type CBState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CBConfig {
  failureThreshold: number;
  recoveryTimeout: number; // ms before attempting HALF_OPEN
}

class CircuitBreaker {
  private state: CBState = "CLOSED";
  private failures = 0;
  private lastFailureAt = 0;

  constructor(
    readonly name: string,
    private config: CBConfig,
  ) {}

  async call<T>(fn: () => PromiseLike<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureAt >= this.config.recoveryTimeout) {
        this.state = "HALF_OPEN";
      } else {
        throw new Error(`[circuit-breaker] ${this.name} is OPEN`);
      }
    }

    try {
      const result = await fn();
      if (this.state === "HALF_OPEN") {
        this.failures = 0;
        this.state = "CLOSED";
      }
      return result;
    } catch (err) {
      this.failures++;
      this.lastFailureAt = Date.now();
      if (this.failures >= this.config.failureThreshold) {
        this.state = "OPEN";
        console.error(
          `[circuit-breaker] ${this.name} opened after ${this.failures} failures`,
        );
      }
      throw err;
    }
  }

  status() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureAt: this.lastFailureAt || null,
    };
  }
}

// Module-level singletons — shared across requests within the same process instance.
export const supabaseBreaker = new CircuitBreaker("supabase", {
  failureThreshold: 5,
  recoveryTimeout: 30_000,
});

export const redisBreaker = new CircuitBreaker("redis", {
  failureThreshold: 3,
  recoveryTimeout: 15_000,
});
