import { Redis } from '@upstash/redis';

const isMock = !process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN;

if (isMock) {
  console.warn("⚠️ Warning: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is not defined. Falling back to an in-memory mock database for local verification!");
}

const realDb = isMock ? null : new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const mockStore = new Map<string, any>();

// Retries a Redis call a few times with short exponential backoff, to ride
// out transient Upstash errors (timeouts, brief rate-limit blips) instead of
// failing a write on the first hiccup.
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 150): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise(r => setTimeout(r, baseDelayMs * 2 ** i));
      }
    }
  }
  throw lastErr;
}

export const db = {
  get: async (key: string) => {
    if (isMock) return mockStore.get(key) || null;
    return withRetry(() => realDb!.get(key));
  },
  set: async (key: string, value: any) => {
    if (isMock) {
      mockStore.set(key, value);
      return "OK";
    }
    return withRetry(() => realDb!.set(key, value));
  },
  sadd: async (key: string, member: string) => {
    if (isMock) {
      if (!mockStore.has(key)) mockStore.set(key, new Set());
      mockStore.get(key).add(member);
      return 1;
    }
    return withRetry(() => realDb!.sadd(key, member));
  },
  smembers: async (key: string) => {
    if (isMock) {
      const set = mockStore.get(key);
      return set ? Array.from(set) : [];
    }
    return withRetry(() => realDb!.smembers(key));
  },
  // Writes a rating blob and adds the user to the session's participants set
  // in a single round trip via a Redis MULTI, instead of two independently
  // awaited calls. Closes the gap where a rating could be saved but the user
  // never lands in `participants` (making their scores invisible to
  // /results, which only aggregates over that set) because the second call
  // failed or the process died between the two writes.
  submitRating: async (ratingKey: string, ratingValue: any, participantsKey: string, userName: string) => {
    if (isMock) {
      mockStore.set(ratingKey, ratingValue);
      if (!mockStore.has(participantsKey)) mockStore.set(participantsKey, new Set());
      mockStore.get(participantsKey).add(userName);
      return ['OK', 1];
    }
    return withRetry(() => {
      const tx = realDb!.multi();
      tx.set(ratingKey, ratingValue);
      tx.sadd(participantsKey, userName);
      return tx.exec();
    });
  },
};
