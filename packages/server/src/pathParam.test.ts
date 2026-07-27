import { describe, expect, it } from "vitest";
import { decodePath, encodePath } from "./pathParam.js";

describe("path codec", () => {
  it("round-trips a path with spaces and CJK", () => {
    const p = "D:/文件/课程功课/AIsongchen";
    expect(decodePath(encodePath(p))).toBe(p);
  });

  it("produces URL-safe base64url (no +, /, or =)", () => {
    expect(encodePath("D:/a b+c/d")).not.toMatch(/[+/=]/);
  });
});
