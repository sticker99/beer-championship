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

export const db = {
  get: async (key: string) => {
    if (isMock) return mockStore.get(key) || null;
    return realDb!.get(key);
  },
  set: async (key: string, value: any) => {
    if (isMock) {
      mockStore.set(key, value);
      return "OK";
    }
    return realDb!.set(key, value);
  },
  sadd: async (key: string, member: string) => {
    if (isMock) {
      if (!mockStore.has(key)) mockStore.set(key, new Set());
      mockStore.get(key).add(member);
      return 1;
    }
    return realDb!.sadd(key, member);
  },
  smembers: async (key: string) => {
    if (isMock) {
      const set = mockStore.get(key);
      return set ? Array.from(set) : [];
    }
    return realDb!.smembers(key);
  }
};
