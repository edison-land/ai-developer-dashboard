import { describe, expect, it } from "vitest";
import { checkMacOSFullDiskAccess } from "./macosPermissions.js";

describe("checkMacOSFullDiskAccess", () => {
  it("returns granted when the protected probe can be read", () => {
    const result = checkMacOSFullDiskAccess({ probe: () => undefined });

    expect(result.status).toBe("granted");
  });

  it("returns denied on the TCC errors emitted without Full Disk Access", () => {
    const probed: string[] = [];
    const result = checkMacOSFullDiskAccess({
      probe: () => {
        probed.push("probe");
        const error = new Error("operation not permitted") as NodeJS.ErrnoException;
        error.code = "EPERM";
        throw error;
      },
    });

    expect(result.status).toBe("denied");
    expect(probed).toHaveLength(1);
  });

  it("does not treat a fallback probe as FDA when the protected probe is denied", () => {
    const probed: string[] = [];
    const result = checkMacOSFullDiskAccess({
      probe: (probePath) => {
        probed.push(probePath);
        if (probed.length === 1) {
          const error = new Error("operation not permitted") as NodeJS.ErrnoException;
          error.code = "EPERM";
          throw error;
        }
      },
    });

    expect(result.status).toBe("denied");
    expect(probed).toHaveLength(1);
  });

  it("falls back when the system probe path is absent", () => {
    const probed: string[] = [];
    const result = checkMacOSFullDiskAccess({
      homeDir: "/Users/test",
      probe: (probePath) => {
        probed.push(probePath);
        if (probed.length === 1) {
          const error = new Error("missing") as NodeJS.ErrnoException;
          error.code = "ENOENT";
          throw error;
        }
      },
    });

    expect(result.status).toBe("granted");
    expect(probed).toEqual([
      "/Library/Application Support/com.apple.TCC/TCC.db",
      "/Users/test/Library/Mail",
    ]);
  });
});
