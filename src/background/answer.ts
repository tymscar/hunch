import { TypeSafeClient } from "@typesafe-ai/sdk";
import { type Block, type BlockId, type Progress, pageText, type Search } from "../shared/protocol";
import { MAX_CHUNK_BLOCKS, MAX_CHUNK_CHARS, MAX_CONCURRENT_REQUESTS, questionsFor } from "../shared/questions";
import { PROVIDERS, type Settings } from "../shared/settings";

export async function answer(
  req: Search,
  settings: Settings,
  signal: AbortSignal,
  emit: (p: Progress) => void,
): Promise<void> {
  const client = new TypeSafeClient({
    apiKey: settings.apiKey,
    baseURL: PROVIDERS[settings.provider].baseURL,
    defaultModel: settings.model,
    dangerouslyAllowBrowser: true,
    timeout: 15_000,
    retry: { maxRetries: 5, backoffInitialMs: 400, backoffMaxMs: 4_000 },
  });
  const chunks = chunkByBudget(req.blocks);

  const started = performance.now();
  const scores: Record<BlockId, number> = {};
  let done = 0;
  let failed = 0;
  const report = () =>
    emit({
      type: "progress",
      scores: { ...scores },
      done,
      total: chunks.length,
      failed,
      ms: Math.round(performance.now() - started),
    });

  if (chunks.length === 0) return report();

  await parallel(chunks, MAX_CONCURRENT_REQUESTS, signal, async (blocks) => {
    try {
      const result = await client.systemOne(
        {
          state: { url: req.url, title: req.title, page_text: pageText(blocks) },
          questions: questionsFor(
            req.query,
            blocks.map((b) => b.id),
          ),
        },
        { signal },
      );
      for (const [id, a] of Object.entries(result.answers)) scores[id as BlockId] = a.noul;
    } catch {
      if (signal.aborted) return;
      failed++;
    }
    done++;
    report();
  });
}

async function parallel<T>(items: T[], limit: number, signal: AbortSignal, work: (item: T) => Promise<void>) {
  let index = 0;
  const worker = async () => {
    while (index < items.length && !signal.aborted) await work(items[index++]!);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

function chunkByBudget(blocks: Block[]): Block[][] {
  const out: Block[][] = [];
  let current: Block[] = [];
  let chars = 0;
  for (const b of blocks) {
    if (chars + b.text.length > MAX_CHUNK_CHARS || current.length >= MAX_CHUNK_BLOCKS) {
      out.push(current);
      current = [];
      chars = 0;
    }
    current.push(b);
    chars += b.text.length;
  }
  if (current.length) out.push(current);
  return out;
}
