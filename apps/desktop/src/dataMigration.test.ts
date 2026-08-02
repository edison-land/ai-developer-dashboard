import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prepareDataDirectory } from "./dataMigration.js";

const roots: string[] = [];

function tempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-dashboard-data-migration-"));
  roots.push(root);
  return root;
}

function writeLegacyData(root: string): void {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, "dashboard.db"), "database snapshot", "utf8");
  fs.writeFileSync(path.join(root, "dashboard.db-wal"), "wal snapshot", "utf8");
  fs.mkdirSync(path.join(root, "nested"));
  fs.writeFileSync(path.join(root, "nested", "notes.txt"), "recover me", "utf8");
}

function migrationFixture(): { root: string; legacy: string; managed: string } {
  const root = tempRoot();
  const legacy = path.join(root, "legacy");
  const managed = path.join(root, "managed");
  writeLegacyData(legacy);
  return { root, legacy, managed };
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("prepareDataDirectory", () => {
  it("keeps an explicit compatibility directory unchanged", () => {
    const { root, legacy } = migrationFixture();
    const explicit = path.join(root, "explicit");

    const result = prepareDataDirectory({
      explicitDataDir: explicit,
      managedDataDir: path.join(root, "managed"),
      legacyDataDir: legacy,
    });

    expect(result).toMatchObject({ dataDir: path.resolve(explicit), mode: "explicit" });
    expect(fs.existsSync(path.join(legacy, "dashboard.db"))).toBe(true);
    expect(fs.existsSync(path.join(explicit, "dashboard.db"))).toBe(false);
  });

  it("copies legacy data and leaves a recoverable backup", () => {
    const { legacy, managed } = migrationFixture();

    const result = prepareDataDirectory({
      managedDataDir: managed,
      legacyDataDir: legacy,
      now: new Date("2026-08-01T01:02:03.000Z"),
      migrationId: "test-migration",
    });

    expect(result.mode).toBe("migrated");
    expect(fs.readFileSync(path.join(managed, "dashboard.db"), "utf8")).toBe("database snapshot");
    expect(fs.readFileSync(path.join(managed, "nested", "notes.txt"), "utf8")).toBe("recover me");
    expect(fs.existsSync(path.join(legacy, "dashboard.db"))).toBe(true);
    expect(result.backupDir).toBeDefined();
    expect(fs.readFileSync(path.join(result.backupDir!, "dashboard.db"), "utf8")).toBe(
      "database snapshot",
    );
    const manifest = JSON.parse(fs.readFileSync(result.manifestPath!, "utf8")) as {
      sourceDir: string;
      destinationDir: string;
      files: string[];
    };
    expect(manifest.sourceDir).toBe(path.resolve(legacy));
    expect(manifest.destinationDir).toBe(path.resolve(managed));
    expect(manifest.files).toContain("dashboard.db");
    expect(manifest.files).toContain(path.join("nested", "notes.txt"));
  });

  it("reuses an existing managed directory instead of copying legacy data over it", () => {
    const { legacy, managed } = migrationFixture();
    fs.mkdirSync(managed, { recursive: true });
    fs.writeFileSync(path.join(managed, "dashboard.db"), "managed snapshot", "utf8");

    const result = prepareDataDirectory({ managedDataDir: managed, legacyDataDir: legacy });

    expect(result.mode).toBe("existing");
    expect(fs.readFileSync(path.join(managed, "dashboard.db"), "utf8")).toBe("managed snapshot");
    expect(fs.existsSync(path.join(managed, "migration-backups"))).toBe(false);
  });

  it("stops instead of overwriting a non-empty incomplete destination", () => {
    const { legacy, managed } = migrationFixture();
    fs.mkdirSync(managed, { recursive: true });
    fs.writeFileSync(path.join(managed, "unexpected.txt"), "keep me", "utf8");

    expect(() => prepareDataDirectory({ managedDataDir: managed, legacyDataDir: legacy })).toThrow(
      "安装版数据目录已存在但缺少 dashboard.db",
    );
    expect(fs.readFileSync(path.join(legacy, "dashboard.db"), "utf8")).toBe("database snapshot");
    expect(fs.readFileSync(path.join(managed, "unexpected.txt"), "utf8")).toBe("keep me");
  });

  it("does not delete a pre-existing staging directory after a failed retry", () => {
    const { root, legacy, managed } = migrationFixture();
    const staging = path.join(path.dirname(managed), ".ai-dashboard-migration-retry");
    fs.mkdirSync(staging, { recursive: true });
    fs.writeFileSync(path.join(staging, "recovery-marker.txt"), "keep me", "utf8");

    expect(() =>
      prepareDataDirectory({
        managedDataDir: managed,
        legacyDataDir: legacy,
        migrationId: "retry",
      }),
    ).toThrow("迁移临时目录已存在");
    expect(fs.readFileSync(path.join(staging, "recovery-marker.txt"), "utf8")).toBe("keep me");
    expect(fs.existsSync(path.join(root, "legacy", "dashboard.db"))).toBe(true);
  });
});
