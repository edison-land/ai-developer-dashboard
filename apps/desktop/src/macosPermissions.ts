import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const FULL_DISK_ACCESS_SETTINGS_URL =
  "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_AllFiles";

export type MacFullDiskAccessStatus = "granted" | "denied" | "unknown";

export interface MacFullDiskAccessCheck {
  status: MacFullDiskAccessStatus;
  probePath: string;
}

export interface MacFullDiskAccessOptions {
  homeDir?: string;
  probe?: (probePath: string) => void;
}

function probePath(probePath: string): void {
  const fd = fs.openSync(probePath, fs.constants.O_RDONLY);
  fs.closeSync(fd);
}

function isAccessDenied(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "EACCES" || code === "EPERM";
}

/**
 * macOS has no public boolean API for the Full Disk Access switch. Probe the
 * system TCC database, which is itself protected by Full Disk Access, without
 * touching any project folder. A successful read means the app can proceed;
 * EACCES/EPERM means the user must enable the switch. The Mail fallback keeps
 * the check useful on macOS versions that move the system TCC database.
 */
export function checkMacOSFullDiskAccess(options: MacFullDiskAccessOptions = {}): MacFullDiskAccessCheck {
  const paths = [
    "/Library/Application Support/com.apple.TCC/TCC.db",
    path.join(options.homeDir ?? os.homedir(), "Library", "Mail"),
  ];
  const probe = options.probe ?? probePath;
  for (const candidate of paths) {
    try {
      probe(candidate);
      return { status: "granted", probePath: candidate };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (isAccessDenied(error)) {
        return { status: "denied", probePath: candidate };
      }
      if (code !== "ENOENT") {
        return { status: "unknown", probePath: candidate };
      }
    }
  }

  return { status: "unknown", probePath: paths[0]! };
}
