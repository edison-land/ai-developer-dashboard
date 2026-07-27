import fs from "node:fs";
import type { TailRecord, TailReader } from "@ai-dashboard/core";

const TAIL_BYTES = 256 * 1024; // read at most the last 256KB — never the whole transcript

type TranscriptRecord = {
  type?: string;
  message?: { content?: string | Array<{ type?: string; text?: string }> };
};

/** Extract readable text from a Claude Code transcript record's `message.content` (string or content-block array). */
function extractText(rec: TranscriptRecord): string | undefined {
  const content = rec.message?.content;
  if (typeof content === "string") return content.trim() || undefined;
  if (Array.isArray(content)) {
    const text = content
      .filter((b) => b?.type === "text" && typeof b.text === "string")
      .map((b) => b.text!)
      .join("\n")
      .trim();
    return text || undefined;
  }
  return undefined;
}

/**
 * Reads the **tail** of a Claude Code session jsonl without loading the whole
 * file (transcripts can be large). Returns the last `maxRecords` user/assistant
 * turns in chronological order. Never throws — unreadable/missing files yield [].
 */
export class NodeTailReader implements TailReader {
  readTail(jsonPath: string, maxRecords: number): TailRecord[] {
    let size = 0;
    try {
      size = fs.statSync(jsonPath).size;
    } catch {
      return [];
    }

    const fd = fs.openSync(jsonPath, "r");
    try {
      const len = Math.min(size, TAIL_BYTES);
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, Math.max(0, size - len));
      const lines = buf.toString("utf8").split("\n");
      // If we truncated the front, the first line is likely a partial record — drop it.
      const start = size > TAIL_BYTES ? 1 : 0;

      const out: TailRecord[] = [];
      for (let i = lines.length - 1; i >= start && out.length < maxRecords; i--) {
        const line = lines[i]!.trim();
        if (!line) continue;
        let rec: TranscriptRecord;
        try {
          rec = JSON.parse(line) as TranscriptRecord;
        } catch {
          continue;
        }
        if (rec.type !== "user" && rec.type !== "assistant") continue;
        const text = extractText(rec);
        if (text) out.push({ role: rec.type as "user" | "assistant", text });
      }
      return out.reverse(); // oldest of the tail first
    } finally {
      fs.closeSync(fd);
    }
  }
}
