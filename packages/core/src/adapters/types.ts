import type { RawSignals, SourceId } from "../domain.js";

export interface CollectOpts {
  /** Shared cap for spawning external processes (git). Adapters that spawn must honor it. */
  gitConcurrency?: number;
  signal?: AbortSignal;
}

/**
 * One adapter per source. Each discovers projects and returns mechanical
 * (non-AI) signals per project. Adapters must NOT call LLMs and must NOT spawn
 * more than `gitConcurrency` concurrent processes.
 */
export interface Adapter {
  readonly id: SourceId;
  /** Whether the source's data directory exists on this machine. */
  available(): boolean;
  collect(opts: CollectOpts): Promise<RawSignals[]>;
}
