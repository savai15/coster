import fs from 'fs';
import { MemoryCategory } from '../types/index.js';

export interface CandidateMemory {
  category: MemoryCategory;
  content: string;
  importance: number;
  tags: string[];
  source: 'import';
}

type ToolArg = 'claude' | 'opencode' | 'auto';

function classifyText(text: string): { category: MemoryCategory; importance: number } {
  const t = text.toLowerCase();
  if (/\b(decided|decision|standard|standardized|chose|choose|policy|convention|rule|always|never)\b/.test(t)) {
    return { category: 'decision', importance: 0.6 };
  }
  if (/\b(bug|broken|error|exception|fix|workaround|hack|temporary|kludge)\b/.test(t)) {
    return { category: 'workaround', importance: 0.6 };
  }
  if (/\b(investigat|root cause|why did|found that|discovered|turns out)\b/.test(t)) {
    return { category: 'investigation', importance: 0.55 };
  }
  if (/\b(mistake|wrong|accidentally|oops|don't repeat|never again)\b/.test(t)) {
    return { category: 'mistake', importance: 0.55 };
  }
  if (/\b(prefer|preference|like to|favorite|usually)\b/.test(t)) {
    return { category: 'preference', importance: 0.5 };
  }
  return { category: 'convention', importance: 0.5 };
}

function messageText(o: any): string | null {
  if (!o) return null;
  if (typeof o === 'string') return o;
  if (Array.isArray(o)) return o.map(messageText).filter(Boolean).join('\n');
  if (typeof o.content === 'string') return o.content;
  if (Array.isArray(o.content)) {
    return o.content
      .map((b: any) => (typeof b === 'string' ? b : b && typeof b.text === 'string' ? b.text : ''))
      .filter(Boolean)
      .join('\n');
  }
  if (typeof o.text === 'string') return o.text;
  if (typeof o.message === 'string') return o.message;
  return null;
}

function collectTexts(filePath: string, raw: string): string[] {
  const texts: string[] = [];
  if (filePath.endsWith('.jsonl')) {
    for (const line of raw.split('\n')) {
      const lineTrim = line.trim();
      if (!lineTrim) continue;
      try {
        const t = messageText(JSON.parse(lineTrim));
        if (t) texts.push(t);
      } catch {
        /* skip non-json lines */
      }
    }
    return texts;
  }

  let o: any = null;
  try {
    o = JSON.parse(raw);
  } catch {
    return [raw];
  }

  if (Array.isArray(o)) {
    for (const m of o) {
      const t = messageText(m);
      if (t) texts.push(t);
    }
  } else if (o && Array.isArray(o.messages)) {
    for (const m of o.messages) {
      const t = messageText(m);
      if (t) texts.push(t);
    }
  } else if (o && Array.isArray(o.conversation)) {
    for (const m of o.conversation) {
      const t = messageText(m);
      if (t) texts.push(t);
    }
  } else {
    const t = messageText(o);
    if (t) texts.push(t);
  }
  return texts;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Extract candidate memories from an exported agent conversation (Claude jsonl,
 * OpenCode json, or plain text). Heuristic only — semantic clustering arrives in M2.
 */
export function parseTranscript(filePath: string, tool: ToolArg): CandidateMemory[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const texts = collectTexts(filePath, raw);
  const tag = tool === 'auto' ? 'transcript' : tool;
  const out: CandidateMemory[] = [];
  const seen = new Set<string>();

  for (const text of texts) {
    for (const sentence of splitSentences(text)) {
      const trimmed = sentence.trim();
      if (trimmed.length < 12) continue;
      if (!/[a-z]{4,}/i.test(trimmed)) continue;
      const cls = classifyText(trimmed);
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        category: cls.category,
        content: trimmed,
        importance: cls.importance,
        tags: ['import', tag],
        source: 'import',
      });
    }
  }

  return out;
}
