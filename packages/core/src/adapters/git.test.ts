import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { GitAdapter, parseStatus } from "./git.js";

function gitInit(dir: string): void {
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir, windowsHide: true });
  execFileSync("git", ["config", "user.email", "t@t.test"], { cwd: dir, windowsHide: true });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: dir, windowsHide: true });
}

function fwd(p: string): string {
  return p.replace(/\\/g, "/");
}

describe("GitAdapter", () => {
  let repo: string;
  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), "addb-git-"));
  });

  it("snapshots a clean repo with one commit", async () => {
    gitInit(repo);
    fs.writeFileSync(path.join(repo, "a.txt"), "a");
    execFileSync("git", ["add", "."], { cwd: repo, windowsHide: true });
    execFileSync("git", ["commit", "-q", "-m", "init"], { cwd: repo, windowsHide: true });

    const snap = await new GitAdapter().snapshotOne(fwd(repo));
    expect(snap.gitError).toBeUndefined();
    expect(snap.branch).toBe("main");
    expect(snap.headSha).toMatch(/^[0-9a-f]{7,40}$/);
    expect(snap.headCommit?.subject).toBe("init");
    expect(snap.headCommit?.author).toBe("Test");
    expect(snap.dirtyFileCount).toBe(0);
  });

  it("counts dirty files after modifications", async () => {
    gitInit(repo);
    fs.writeFileSync(path.join(repo, "a.txt"), "a");
    execFileSync("git", ["add", "."], { cwd: repo, windowsHide: true });
    execFileSync("git", ["commit", "-q", "-m", "init"], { cwd: repo, windowsHide: true });
    fs.writeFileSync(path.join(repo, "a.txt"), "changed");
    fs.writeFileSync(path.join(repo, "b.txt"), "new");

    const snap = await new GitAdapter().snapshotOne(fwd(repo));
    expect(snap.dirtyFileCount).toBe(2);
    expect(snap.dirtySample?.length).toBe(2);
  });

  it("reports gitError without throwing on a non-repo path", async () => {
    const snap = await new GitAdapter().snapshotOne(fwd(path.join(repo, "nope")));
    expect(snap.gitError).toBeTruthy();
    expect(snap.headSha).toBeNull();
  });

  it("snapshotAll keys results by path and respects concurrency", async () => {
    const r1 = fs.mkdtempSync(path.join(os.tmpdir(), "addb-git-"));
    const r2 = fs.mkdtempSync(path.join(os.tmpdir(), "addb-git-"));
    for (const r of [r1, r2]) {
      gitInit(r);
      fs.writeFileSync(path.join(r, "x"), "x");
      execFileSync("git", ["add", "."], { cwd: r, windowsHide: true });
      execFileSync("git", ["commit", "-q", "-m", "c"], { cwd: r, windowsHide: true });
    }
    const map = await new GitAdapter(2).snapshotAll([fwd(r1), fwd(r2)]);
    expect(map.size).toBe(2);
    for (const v of map.values()) expect(v.headCommit?.subject).toBe("c");
  });
});

describe("parseStatus", () => {
  it("parses a tracking branch header (branch before the ... upstream ref)", () => {
    const p = parseStatus("## main...origin/main\n M file.txt\n");
    expect(p.branch).toBe("main");
    expect(p.hasUpstream).toBe(true);
    expect(p.dirtyFileCount).toBe(1);
  });

  it("parses ahead/behind counts", () => {
    const p = parseStatus("## dev...origin/dev [ahead 2, behind 1]\n");
    expect(p.branch).toBe("dev");
    expect(p.ahead).toBe(2);
    expect(p.behind).toBe(1);
    expect(p.hasUpstream).toBe(true);
  });

  it("parses a branch with no upstream", () => {
    const p = parseStatus("## feature-x\n");
    expect(p.branch).toBe("feature-x");
    expect(p.hasUpstream).toBe(false);
  });
});
