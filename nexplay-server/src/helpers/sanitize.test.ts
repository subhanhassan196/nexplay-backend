import { describe, it, expect } from "vitest";
import { stripHtml, sanitizeText, sanitizeObject } from "./sanitize";

describe("stripHtml", () => {
  it("removes HTML tags", () => {
    expect(stripHtml("<b>hello</b>")).toBe("hello");
  });

  it("neutralizes script tags (XSS)", () => {
    expect(stripHtml("<script>alert('x')</script>hi")).toBe("alert('x')hi");
  });

  it("strips javascript: protocol", () => {
    expect(stripHtml("javascript:alert(1)")).toBe("alert(1)");
  });

  it("leaves plain text untouched", () => {
    expect(stripHtml("just normal text")).toBe("just normal text");
  });
});

describe("sanitizeText", () => {
  it("trims whitespace", () => {
    expect(sanitizeText("  hi  ")).toBe("hi");
  });

  it("enforces max length", () => {
    expect(sanitizeText("abcdefghij", 5)).toBe("abcde");
  });

  it("strips tags and trims together", () => {
    expect(sanitizeText("  <i>test</i>  ")).toBe("test");
  });
});

describe("sanitizeObject", () => {
  it("sanitizes every string field", () => {
    const result = sanitizeObject({ name: "<b>Bob</b>", bio: "javascript:evil", age: 30 });
    expect(result.name).toBe("Bob");
    expect(result.bio).toBe("evil");
    expect(result.age).toBe(30); // non-strings untouched
  });
});
