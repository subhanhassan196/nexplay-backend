import { describe, it, expect } from "vitest";
import { LAN_ORIGIN, isOriginAllowed } from "./cors";

describe("LAN_ORIGIN (CORS security)", () => {
  it("allows localhost with any port", () => {
    expect(LAN_ORIGIN.test("http://localhost:3000")).toBe(true);
    expect(LAN_ORIGIN.test("http://localhost")).toBe(true);
  });

  it("allows private LAN ranges", () => {
    expect(LAN_ORIGIN.test("http://192.168.18.65:3000")).toBe(true);
    expect(LAN_ORIGIN.test("http://10.0.0.5:3000")).toBe(true);
    expect(LAN_ORIGIN.test("http://172.16.0.1:3000")).toBe(true);
  });

  it("rejects public internet origins", () => {
    expect(LAN_ORIGIN.test("https://evil.com")).toBe(false);
    expect(LAN_ORIGIN.test("http://8.8.8.8:3000")).toBe(false);
    expect(LAN_ORIGIN.test("https://nexplay-attacker.io")).toBe(false);
  });

  it("rejects public 172.x outside the private 16-31 range", () => {
    expect(LAN_ORIGIN.test("http://172.15.0.1:3000")).toBe(false);
    expect(LAN_ORIGIN.test("http://172.32.0.1:3000")).toBe(false);
  });

  it("rejects origins that merely contain a LAN string", () => {
    expect(LAN_ORIGIN.test("http://localhost.evil.com")).toBe(false);
    expect(LAN_ORIGIN.test("http://192.168.1.1.evil.com")).toBe(false);
  });
});


describe("isOriginAllowed", () => {
  it("ignores a trailing slash mismatch", () => {
    // CLIENT_URL is http://localhost:3000 in the test env.
    expect(isOriginAllowed("http://localhost:3000/")).toBe(true);
  });

  it("is case-insensitive about the host", () => {
    expect(isOriginAllowed("HTTP://LOCALHOST:3000")).toBe(true);
  });

  it("still rejects unrelated public origins", () => {
    expect(isOriginAllowed("https://evil.com")).toBe(false);
  });
});
