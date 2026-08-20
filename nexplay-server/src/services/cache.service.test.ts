import { describe, it, expect, beforeEach } from "vitest";
import { cacheService } from "./cache.service";

// These run against the in-memory fallback (no REDIS_URL in test env).
describe("cacheService (in-memory fallback)", () => {
  beforeEach(async () => {
    await cacheService.del("test:key");
  });

  it("returns null on miss", async () => {
    expect(await cacheService.get("test:missing")).toBeNull();
  });

  it("stores and retrieves a value", async () => {
    await cacheService.set("test:key", { hello: "world" }, 60);
    expect(await cacheService.get("test:key")).toEqual({ hello: "world" });
  });

  it("deletes a value", async () => {
    await cacheService.set("test:key", 123, 60);
    await cacheService.del("test:key");
    expect(await cacheService.get("test:key")).toBeNull();
  });

  it("remember() computes once then caches", async () => {
    let calls = 0;
    const producer = async () => {
      calls++;
      return "computed";
    };
    const first = await cacheService.remember("test:key", 60, producer);
    const second = await cacheService.remember("test:key", 60, producer);
    expect(first).toBe("computed");
    expect(second).toBe("computed");
    expect(calls).toBe(1); // producer ran only once
  });

  it("invalidatePrefix clears matching keys", async () => {
    await cacheService.set("test:a", 1, 60);
    await cacheService.set("test:b", 2, 60);
    await cacheService.invalidatePrefix("test:");
    expect(await cacheService.get("test:a")).toBeNull();
    expect(await cacheService.get("test:b")).toBeNull();
  });
});
