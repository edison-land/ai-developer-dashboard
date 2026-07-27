import { describe, expect, it } from "vitest";
import {
  basename,
  canonicalizePath,
  displayPath,
  encodeClaudeFolder,
  pathKey,
  stripExtendedPrefix,
} from "./paths.js";

describe("canonicalizePath", () => {
  it("converts backslashes to forward slashes", () => {
    expect(canonicalizePath("D:\\Agent RA2")).toBe("D:/Agent RA2");
  });

  it("uppercases the drive letter", () => {
    expect(canonicalizePath("d:\\polyu\\foo")).toBe("D:/polyu/foo");
  });

  it("strips the \\\\?\\ extended-length prefix", () => {
    expect(canonicalizePath("\\\\?\\D:\\btc-bear-market-dashboard")).toBe(
      "D:/btc-bear-market-dashboard",
    );
  });

  it("removes trailing slashes", () => {
    expect(canonicalizePath("D:/foo/")).toBe("D:/foo");
    expect(canonicalizePath("D:\\foo\\")).toBe("D:/foo");
  });

  it("preserves CJK characters", () => {
    expect(canonicalizePath("D:\\文件\\课程功课\\AIsongchen")).toBe(
      "D:/文件/课程功课/AIsongchen",
    );
  });

  it("leaves an already-canonical path unchanged", () => {
    expect(canonicalizePath("D:/Agent RA2")).toBe("D:/Agent RA2");
  });
});

describe("displayPath", () => {
  it("converts forward slashes back to backslashes for Windows display", () => {
    expect(displayPath("D:/Agent RA2")).toBe("D:\\Agent RA2");
  });
});

describe("basename", () => {
  it("returns the last path segment", () => {
    // "Agent RA2" is one folder name (with a space) — returned whole.
    expect(basename("D:/Agent RA2")).toBe("Agent RA2");
    expect(basename("D:/btc-bear-market-dashboard")).toBe("btc-bear-market-dashboard");
  });

  it("handles CJK final segments", () => {
    expect(basename("D:/文件/课程功课/AIsongchen")).toBe("AIsongchen");
  });
});

describe("stripExtendedPrefix", () => {
  it("strips \\\\?\\ from a drive path", () => {
    expect(stripExtendedPrefix("\\\\?\\D:\\foo")).toBe("D:\\foo");
  });

  it("rewrites a \\\\?\\UNC\\ path to a UNC share", () => {
    expect(stripExtendedPrefix("\\\\?\\UNC\\server\\share")).toBe("\\\\server\\share");
  });

  it("leaves a plain path unchanged", () => {
    expect(stripExtendedPrefix("D:\\foo")).toBe("D:\\foo");
  });
});

describe("encodeClaudeFolder", () => {
  // Each char that is not [A-Za-z0-9] becomes '-', with NO run collapsing.
  // Calibrated against the real ~/.claude/projects/ folders on this machine.
  it("encodes simple ASCII paths", () => {
    expect(encodeClaudeFolder("C:\\Users\\57652")).toBe("C--Users-57652");
    expect(encodeClaudeFolder("D:\\Agent RA2")).toBe("D--Agent-RA2");
    expect(encodeClaudeFolder("D:\\btc-bear-market-dashboard")).toBe(
      "D--btc-bear-market-dashboard",
    );
    expect(encodeClaudeFolder("D:\\ai-developer-dashboard")).toBe(
      "D--ai-developer-dashboard",
    );
  });

  it("encodes CJK paths one dash per character (no collapsing)", () => {
    // D:\文件\课程功课\AIsongchen -> D + 10 dashes + AIsongchen
    expect(encodeClaudeFolder("D:\\文件\\课程功课\\AIsongchen")).toBe(
      "D----------AIsongchen",
    );
  });

  it("preserves the drive letter case (lowercase d stays lowercase)", () => {
    expect(encodeClaudeFolder("d:\\PolyU\\博士课题")).toMatch(/^d--PolyU/);
  });
});

describe("pathKey", () => {
  it("lowercases for case-insensitive grouping on Windows", () => {
    expect(pathKey("D:/PolyU")).toBe(pathKey("d:\\polyu"));
  });

  it("still strips the extended prefix and normalizes slashes", () => {
    expect(pathKey("\\\\?\\D:\\Foo\\Bar")).toBe("d:/foo/bar");
  });
});
