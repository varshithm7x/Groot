// @vitest-environment jsdom

import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  loadStore,
  resetEmbeddingsStore,
  seedLexicalEmbeddings,
} from '../../src/utils/embeddings';
import {
  getVaultRetrievalPlan,
  rankVaultPassages,
  type VaultRagDocument,
} from '../../src/utils/vault-rag';

const vaultRoot = process.env.OO_EVAL_VAULT || (existsSync('/home/varshith/VOLT/Engineers') ? '/home/varshith/VOLT/Engineers' : undefined);
const datasetPath = path.resolve(__dirname, '../fixtures/retrieval-evaluation-dataset.json');

const describeEval = vaultRoot && existsSync(datasetPath) ? describe : describe.skip;

interface EvalItem {
  id: number;
  targetPath: string;
  title: string;
  titleQuery: string;
  bodyQuery: string;
}

interface DatasetFile {
  description: string;
  vault: string;
  itemCount: number;
  items: EvalItem[];
}

interface QueryResult {
  hit: boolean;
  rank: number | null; // 1-indexed, null if not in top K
  reciprocalRank: number;
  latencyMs: number;
}

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(sorted.length * (percentile / 100)) - 1);
  return sorted[idx];
}

describeEval('Vault Intelligence Broadened Retrieval Evaluation', () => {
  let documents: VaultRagDocument[] = [];
  let dataset: DatasetFile;
  const titleResults: QueryResult[] = [];
  const bodyResults: QueryResult[] = [];

  beforeAll(async () => {
    dataset = JSON.parse(await fs.readFile(datasetPath, 'utf8'));

    // Collect all markdown documents in vault
    const collectMarkdown = async (dir: string): Promise<string[]> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const paths: string[] = [];
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!['.git', '.openonyx', '.trash', 'node_modules'].includes(entry.name)) {
            paths.push(...await collectMarkdown(path.join(dir, entry.name)));
          }
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          paths.push(path.relative(vaultRoot!, path.join(dir, entry.name)).replace(/\\/g, '/'));
        }
      }
      return paths;
    };

    const filePaths = await collectMarkdown(vaultRoot!);
    documents = await Promise.all(filePaths.map(async (p) => ({
      path: p,
      content: await fs.readFile(path.join(vaultRoot!, p), 'utf8'),
    })));

    // Seed lexical embeddings
    seedLexicalEmbeddings(Object.fromEntries(
      documents.map((doc) => [doc.path, doc.content]),
    ));
  }, 90000);

  afterAll(async () => {
    resetEmbeddingsStore();

    if (titleResults.length > 0 && bodyResults.length > 0) {
      const summary = {
        vault: vaultRoot,
        totalVaultNotes: documents.length,
        datasetItems: dataset.items.length,
        titleRetrieval: {
          recallAtAdaptive: (titleResults.filter((r) => r.hit).length / titleResults.length),
          hitAt1: (titleResults.filter((r) => r.rank === 1).length / titleResults.length),
          hitAt3: (titleResults.filter((r) => r.rank !== null && r.rank <= 3).length / titleResults.length),
          hitAt5: (titleResults.filter((r) => r.rank !== null && r.rank <= 5).length / titleResults.length),
          mrr: (titleResults.reduce((sum, r) => sum + r.reciprocalRank, 0) / titleResults.length),
          latencyMs: {
            median: calculatePercentile(titleResults.map((r) => r.latencyMs), 50),
            p95: calculatePercentile(titleResults.map((r) => r.latencyMs), 95),
            mean: titleResults.reduce((sum, r) => sum + r.latencyMs, 0) / titleResults.length,
          },
        },
        bodyRetrieval: {
          recallAtAdaptive: (bodyResults.filter((r) => r.hit).length / bodyResults.length),
          hitAt1: (bodyResults.filter((r) => r.rank === 1).length / bodyResults.length),
          hitAt3: (bodyResults.filter((r) => r.rank !== null && r.rank <= 3).length / bodyResults.length),
          hitAt5: (bodyResults.filter((r) => r.rank !== null && r.rank <= 5).length / bodyResults.length),
          mrr: (bodyResults.reduce((sum, r) => sum + r.reciprocalRank, 0) / bodyResults.length),
          latencyMs: {
            median: calculatePercentile(bodyResults.map((r) => r.latencyMs), 50),
            p95: calculatePercentile(bodyResults.map((r) => r.latencyMs), 95),
            mean: bodyResults.reduce((sum, r) => sum + r.latencyMs, 0) / bodyResults.length,
          },
        },
      };

      const outPath = path.resolve('docs/performance/embedding/retrieval-evaluation-results.json');
      await fs.writeFile(outPath, JSON.stringify(summary, null, 2));
      console.log(`\n[Retrieval Evaluation] Results written to: ${outPath}`);
    }
  });

  it('evaluates Title Retrieval Recall and MRR on the fixed dataset', () => {
    const plan = getVaultRetrievalPlan(documents.length, false);

    for (const item of dataset.items) {
      const start = performance.now();
      const passages = rankVaultPassages(item.titleQuery, documents, plan.passageLimit, false);
      const latencyMs = performance.now() - start;

      const rankIndex = passages.findIndex((p) => p.path === item.targetPath);
      const hit = rankIndex !== -1;
      const rank = hit ? rankIndex + 1 : null;
      const reciprocalRank = hit ? 1 / rank! : 0;

      titleResults.push({ hit, rank, reciprocalRank, latencyMs });
    }

    const recall = titleResults.filter((r) => r.hit).length / titleResults.length;
    const mrr = titleResults.reduce((sum, r) => sum + r.reciprocalRank, 0) / titleResults.length;
    const medianLatency = calculatePercentile(titleResults.map((r) => r.latencyMs), 50);

    console.info(`[Title Retrieval Eval] Recall@adaptive = ${(recall * 100).toFixed(1)}% | MRR = ${mrr.toFixed(3)} | Median Latency = ${medianLatency.toFixed(2)}ms`);

    expect(recall).toBeGreaterThanOrEqual(0.85);
    expect(mrr).toBeGreaterThanOrEqual(0.70);
  }, 60000);

  it('evaluates Body-Content Retrieval Recall and MRR on the fixed dataset', () => {
    const plan = getVaultRetrievalPlan(documents.length, false);

    for (const item of dataset.items) {
      const start = performance.now();
      const passages = rankVaultPassages(item.bodyQuery, documents, plan.passageLimit, false);
      const latencyMs = performance.now() - start;

      const rankIndex = passages.findIndex((p) => p.path === item.targetPath);
      const hit = rankIndex !== -1;
      const rank = hit ? rankIndex + 1 : null;
      const reciprocalRank = hit ? 1 / rank! : 0;

      bodyResults.push({ hit, rank, reciprocalRank, latencyMs });
    }

    const recall = bodyResults.filter((r) => r.hit).length / bodyResults.length;
    const mrr = bodyResults.reduce((sum, r) => sum + r.reciprocalRank, 0) / bodyResults.length;
    const medianLatency = calculatePercentile(bodyResults.map((r) => r.latencyMs), 50);

    console.info(`[Body Retrieval Eval] Recall@adaptive = ${(recall * 100).toFixed(1)}% | MRR = ${mrr.toFixed(3)} | Median Latency = ${medianLatency.toFixed(2)}ms`);

    // Body queries have zero title overlap; verify solid retrieval and ranking quality
    expect(recall).toBeGreaterThanOrEqual(0.70);
    expect(mrr).toBeGreaterThanOrEqual(0.50);
  }, 60000);

  it('measures Query Latency distribution across both workloads', () => {
    const allLatencies = [...titleResults, ...bodyResults].map((r) => r.latencyMs);
    const p50 = calculatePercentile(allLatencies, 50);
    const p95 = calculatePercentile(allLatencies, 95);

    console.info(`[Query Latency] p50 = ${p50.toFixed(2)}ms | p95 = ${p95.toFixed(2)}ms across ${allLatencies.length} queries`);

    // In a 582-note vault, full passage ranking across all documents should be well under 250ms
    expect(p50).toBeLessThan(250);
    expect(p95).toBeLessThan(500);
  });
});
