import type { TailReader, UnifiedProject } from "../domain.js";

// Bundle budget (target ≤ ~1.8k tokens). Each cap is a hard truncation so a
// pathological input can never blow the bundle — the core cost-control guard.
const MAX_ONELINER = 300;
const MAX_TAIL_RECORDS = 2;
const MAX_TAIL_CHARS = 600;
const MAX_DIRTY_FILES = 5; // small sample only — a long file list biases the model toward "commit your files"
const MAX_DIRTY_LINE = 160;
const MAX_COMMIT_SUBJECT = 80;

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n) + "…";
}

export interface SynthBundle {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * The system prompt is fixed across all calls (so provider-side context caching
 * can kick in). It deliberately steers the model away from low-value noise:
 * uncommitted files are normal WIP (not a blocker, not a next step), and the
 * next step must be a concrete task inferred from the actual work, not generic
 * "keep coding / commit your changes".
 */
export const SYNTH_SYSTEM_PROMPT = [
  "你是资深开发者的项目状态分析助手。输入是某个项目最新的机械信号：最近一段对话（用户在让做什么、助手做到哪）、最近一次 git 提交、当前工作区状态。",
  "",
  "判断原则：",
  "1. 【对话片段才是真正的进度信号】，要优先据此判断开发者实际在推进什么；git 状态只是背景。",
  "2. 【未提交的文件是开发中的正常状态】——绝不构成阻塞，也【不要把「提交代码 / commit / 推进项目」当作下一步】，除非明确在做发布收尾。",
  "3. nextStep 必须具体、可执行、紧扣当前实际工作（例如「实现 X 的 Y 部分」「修复 Z 报错」「给 W 补单测」「验证 V 能跑通」）。禁止泛泛的「继续开发 / 完善 / 推进 / 提交」。",
  "4. summary 要说清【这个项目在做什么、推进到哪一步】，而不是罗列有多少个未提交文件。",
  "5. blockers 只填真正的阻塞（缺依赖、环境/权限问题、等外部、关键设计未定、被别处卡住）；没有就给空数组 []。",
  "6. attention 判断阻塞是否需要用户现在处理：user-action=用户现在能采取动作；waiting=只能等待外部条件；none=无阻塞；无法判断才用 unknown。",
  "",
  "stage 只能是这五个之一：idea（想法）/ building（开发中）/ verifying（待验证）/ done（完成）/ stalled（搁置）。",
  '只输出一个 JSON 对象，不要任何额外文字、不要 markdown 代码块：',
  '{"stage": string, "summary": string, "nextStep": string, "blockers": string[], "attention": "user-action" | "waiting" | "none" | "unknown"}',
  "（summary≤280字、1-2 句；nextStep≤200字、一句具体动作；blockers 0-5 条、每条简短）",
].join("\n");

/**
 * Assemble a bounded synthesis prompt from a project's mechanical signals:
 * the last Claude Code one-liner + the transcript tail (last 1-2 turns, read
 * lazily via the TailReader — never the whole file) + a compact git snapshot.
 * Pure given the TailReader; every field is hard-capped so the bundle stays
 * cheap regardless of input size.
 */
export function buildSynthBundle(project: UnifiedProject, tailReader: TailReader): SynthBundle {
  const parts: string[] = [];
  parts.push(`项目：${project.name}（${project.displayPath}）`);

  const cc = project.signalsBySource["claude-code"];
  const oneLiner = cc?.lastActionOneLiner ?? project.lastActionOneLiner;
  if (oneLiner) parts.push(`最近一次指令：${clip(oneLiner, MAX_ONELINER)}`);

  // Transcript tail — only Claude Code carries a transcriptTailPath.
  const tailPath = cc?.transcriptTailPath;
  if (tailPath) {
    try {
      const tail = tailReader.readTail(tailPath, MAX_TAIL_RECORDS);
      for (const rec of tail) {
        const label = rec.role === "user" ? "用户" : "助手";
        parts.push(`${label}：${clip(rec.text, MAX_TAIL_CHARS)}`);
      }
    } catch {
      // unreadable transcript — skip; the bundle still works from other signals
    }
  }

  const git = project.git;
  if (git && !git.gitError) {
    const segments = [`git：分支 ${git.branch}`];
    if (git.headCommit) segments.push(`最近提交「${clip(git.headCommit.subject, MAX_COMMIT_SUBJECT)}」`);
    if (git.dirtyFileCount > 0) {
      const sample = git.dirtySample?.slice(0, MAX_DIRTY_FILES).join(", ");
      segments.push(`${git.dirtyFileCount} 个未提交${sample ? `（${clip(sample, MAX_DIRTY_LINE)}）` : ""}`);
    } else {
      segments.push("工作区干净");
    }
    if (git.aheadBehind.ahead > 0) segments.push(`领先远端 ${git.aheadBehind.ahead}`);
    if (git.aheadBehind.behind > 0) segments.push(`落后远端 ${git.aheadBehind.behind}`);
    parts.push(segments.join("，"));
  }

  return { systemPrompt: SYNTH_SYSTEM_PROMPT, userPrompt: parts.join("\n") };
}
