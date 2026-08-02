import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DATABASE_FILE = "dashboard.db";

export type DataDirectoryMode = "explicit" | "new" | "existing" | "migrated";

export interface PrepareDataDirectoryOptions {
  /** Compatibility override used by CLI, development, and diagnostics. */
  explicitDataDir?: string;
  /** Destination used by the installed desktop application. */
  managedDataDir: string;
  /** Legacy ~/.ai-dashboard directory used by the CLI and v1.0 portable app. */
  legacyDataDir: string;
  now?: Date;
  migrationId?: string;
}

export interface PreparedDataDirectory {
  dataDir: string;
  mode: DataDirectoryMode;
  backupDir?: string;
  manifestPath?: string;
}

interface MigrationManifest {
  version: 1;
  migratedAt: string;
  sourceDir: string;
  destinationDir: string;
  backupDir: string;
  files: string[];
}

function absolute(value: string): string {
  return path.resolve(value);
}

function samePath(left: string, right: string): boolean {
  return absolute(left).toLowerCase() === absolute(right).toLowerCase();
}

function hasDatabase(dataDir: string): boolean {
  return fs.existsSync(path.join(dataDir, DATABASE_FILE));
}

function hasEntries(dataDir: string): boolean {
  try {
    return fs.readdirSync(dataDir).length > 0;
  } catch {
    return false;
  }
}

function listRelativeFiles(root: string): string[] {
  const files: string[] = [];
  const visit = (current: string, relativeRoot: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const relative = path.join(relativeRoot, entry.name);
      const absoluteEntry = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absoluteEntry, relative);
      else files.push(relative);
    }
  };
  visit(root, "");
  return files.sort();
}

/** Copy directory contents without nesting the source directory itself. */
function copyDirectoryContents(sourceDir: string, destinationDir: string): void {
  fs.mkdirSync(destinationDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    fs.cpSync(
      path.join(sourceDir, entry.name),
      path.join(destinationDir, entry.name),
      { recursive: true, dereference: false, errorOnExist: true },
    );
  }
}

function migrationStamp(now: Date, id: string): string {
  return `${now.toISOString().replace(/[:.]/g, "-")}-${id}`;
}

function migrateLegacyData(
  legacyDataDir: string,
  managedDataDir: string,
  now: Date,
  migrationId: string,
): PreparedDataDirectory {
  const parentDir = path.dirname(managedDataDir);
  fs.mkdirSync(parentDir, { recursive: true });

  if (fs.existsSync(managedDataDir) && hasEntries(managedDataDir)) {
    throw new Error(
      `安装版数据目录已存在但缺少 ${DATABASE_FILE}，为避免覆盖数据而停止迁移：${managedDataDir}`,
    );
  }

  const stagingDir = path.join(parentDir, `.ai-dashboard-migration-${migrationId}`);
  const stamp = migrationStamp(now, migrationId);
  const backupDir = path.join(stagingDir, "migration-backups", stamp, "source");
  const manifestPath = path.join(stagingDir, "migration-backups", stamp, "manifest.json");
  let ownsStagingDir = false;

  try {
    if (fs.existsSync(stagingDir)) {
      throw new Error(`迁移临时目录已存在：${stagingDir}`);
    }
    fs.mkdirSync(stagingDir);
    ownsStagingDir = true;
    copyDirectoryContents(legacyDataDir, stagingDir);
    copyDirectoryContents(legacyDataDir, backupDir);

    const manifest: MigrationManifest = {
      version: 1,
      migratedAt: now.toISOString(),
      sourceDir: legacyDataDir,
      destinationDir: managedDataDir,
      backupDir: path.join(managedDataDir, "migration-backups", stamp, "source"),
      files: listRelativeFiles(backupDir),
    };
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    if (fs.existsSync(managedDataDir)) {
      // The only allowed existing destination is an empty directory created by
      // the application itself before this operation.
      fs.rmdirSync(managedDataDir);
    }
    fs.renameSync(stagingDir, managedDataDir);
  } catch (error) {
    if (ownsStagingDir) fs.rmSync(stagingDir, { recursive: true, force: true });
    throw new Error(
      `旧数据迁移失败，原目录未删除：${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return {
    dataDir: managedDataDir,
    mode: "migrated",
    backupDir: path.join(managedDataDir, "migration-backups", stamp, "source"),
    manifestPath: path.join(managedDataDir, "migration-backups", stamp, "manifest.json"),
  };
}

/**
 * Resolve the data directory for the desktop shell and perform a one-time,
 * failure-safe copy from the v1.0/CLI directory when needed.
 */
export function prepareDataDirectory(
  options: PrepareDataDirectoryOptions,
): PreparedDataDirectory {
  if (options.explicitDataDir?.trim()) {
    const dataDir = absolute(options.explicitDataDir);
    fs.mkdirSync(dataDir, { recursive: true });
    return { dataDir, mode: "explicit" };
  }

  const managedDataDir = absolute(options.managedDataDir);
  const legacyDataDir = absolute(options.legacyDataDir);
  if (samePath(managedDataDir, legacyDataDir)) {
    fs.mkdirSync(managedDataDir, { recursive: true });
    return { dataDir: managedDataDir, mode: hasDatabase(managedDataDir) ? "existing" : "new" };
  }

  if (hasDatabase(managedDataDir)) {
    return { dataDir: managedDataDir, mode: "existing" };
  }

  if (!hasDatabase(legacyDataDir)) {
    fs.mkdirSync(managedDataDir, { recursive: true });
    return { dataDir: managedDataDir, mode: "new" };
  }

  return migrateLegacyData(
    legacyDataDir,
    managedDataDir,
    options.now ?? new Date(),
    options.migrationId ?? randomUUID(),
  );
}
