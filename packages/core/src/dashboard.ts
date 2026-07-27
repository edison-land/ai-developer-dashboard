import type { RawSignals, Stage, SynthCacheEntry, UnifiedProject } from "./domain.js";
import type { DashboardConfig } from "./config.js";
import { ClaudeCodeAdapter } from "./adapters/claudeCode.js";
import { CodexAdapter } from "./adapters/codex.js";
import { GitAdapter } from "./adapters/git.js";
import { mergeByCanonicalPath, sortByRecency } from "./aggregate.js";

export interface CollectContext {
  overrides: Map<string, Stage>;
  synthCache: Map<string, SynthCacheEntry>;
  nowMs?: number;
}

/**
 * Orchestrates all adapters into the unified project list. Runs the source
 * adapters (Claude Code + Codex, including config.toml seed projects), derives
 * the set of project paths, snapshots git for exactly those paths, then merges
 * + sorts.
 */
export class Dashboard {
  constructor(private cfg: DashboardConfig, private gitConcurrency = 6) {}

  async collect(ctx: CollectContext): Promise<UnifiedProject[]> {
    const signals: RawSignals[] = [];
    const cc = new ClaudeCodeAdapter(this.cfg);
    if (cc.available()) {
      signals.push(...(await cc.collect({ gitConcurrency: this.gitConcurrency })));
    }
    const codex = new CodexAdapter(this.cfg);
    if (codex.available()) {
      signals.push(...(await codex.collect({ gitConcurrency: this.gitConcurrency })));
    }

    const paths = signals.map((s) => s.canonicalPath);
    const gitByPath = await new GitAdapter(this.gitConcurrency).snapshotAll(paths);

    const merged = mergeByCanonicalPath(signals, gitByPath, {
      overrides: ctx.overrides,
      synthCache: ctx.synthCache,
      nowMs: ctx.nowMs ?? Date.now(),
    });
    return sortByRecency(merged);
  }
}
