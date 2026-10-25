import { build } from 'vite';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, access, copyFile, cp } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(process.env.OPENONYX_EMBEDDING_BENCH_ROOT || '/tmp/openonyx-real-embedding-benchmark');
const iterations = Math.max(3, parseInt(process.env.BENCH_ITERATIONS || process.argv[2] || '5', 10));

console.log(`[Repeated Benchmark] Running ${iterations} iterations against isolated synthetic vault in ${root}`);

// 1. Ensure model assets exist
const model = path.join(root, 'models');
for (const file of ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json', 'onnx/model_quantized.onnx']) {
  const target = path.join(model, file);
  try { await access(target); continue; } catch {}
  console.log(`Downloading public MiniLM asset: ${file}`);
  const response = await fetch(`https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/${file}`, { signal: AbortSignal.timeout(90000) });
  if (!response.ok) throw new Error(`Model download failed: HTTP ${response.status}`);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, new Uint8Array(await response.arrayBuffer()));
}

// 2. Build assets once
const sharedAssets = path.join(root, 'shared-assets');
await mkdir(sharedAssets, { recursive: true });
await build({
  configFile: 'vite.config.ts',
  mode: 'embedding-benchmark',
  publicDir: false,
  build: {
    outDir: sharedAssets,
    emptyOutDir: true,
    minify: true,
    rollupOptions: {
      input: {
        controller: path.resolve('scripts/benchmarks/embedding-controller.ts'),
        embeddingWorker: path.resolve('src/utils/embeddingWorker.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name]-[hash].js',
        manualChunks: undefined,
      },
    },
  },
});

function calculateStats(values) {
  if (values.length === 0) return { min: 0, median: 0, p95: 0, max: 0, mean: 0, stdDev: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  const p95 = sorted[p95Index];
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  return { min, median, p95, max, mean, stdDev };
}

const electron = createRequire(import.meta.url)('electron');
const iterationResults = [];

for (let i = 1; i <= iterations; i++) {
  const label = `iter-${i}`;
  const iterRoot = path.join(root, label);
  const iterAssets = path.join(iterRoot, 'assets');
  await mkdir(iterAssets, { recursive: true });

  // Copy compiled assets recursively
  await cp(sharedAssets, iterAssets, { recursive: true });

  // Copy wasm assets
  await mkdir(path.join(iterRoot, 'wasm'), { recursive: true });
  for (const file of ['ort-wasm.wasm', 'ort-wasm-simd.wasm', 'ort-wasm-threaded.wasm', 'ort-wasm-simd-threaded.wasm']) {
    await copyFile(`public/wasm/${file}`, path.join(iterRoot, 'wasm', file));
  }

  await writeFile(
    path.join(iterRoot, 'index.html'),
    '<!doctype html><meta charset="utf-8"><title>Isolated embedding benchmark</title><script type="module" src="./assets/controller.js"></script>'
  );

  console.log(`[Iteration ${i}/${iterations}] Launching headless Electron benchmark (${label})...`);
  const env = { ...process.env, OPENONYX_EMBEDDING_BENCH_ROOT: root, OPENONYX_EMBEDDING_BENCH_LABEL: label };
  delete env.ELECTRON_RUN_AS_NODE;

  const child = spawn(electron, [path.resolve('scripts/benchmarks/embedding-electron.cjs')], { env, stdio: 'inherit' });
  const code = await new Promise((resolve, reject) => {
    child.once('exit', resolve);
    child.once('error', reject);
  });

  if (code !== 0) throw new Error(`Benchmark iteration ${i} failed with exit code ${code}`);

  const result = JSON.parse(await readFile(path.join(root, `${label}.json`), 'utf8'));
  iterationResults.push({
    iteration: i,
    coldMs: result.indexing.cold.elapsedMs,
    coldChunksPerSecond: result.indexing.cold.chunksPerSecond,
    queryMs: result.indexing.cold.queryMs,
    warmMs: result.indexing.warm.elapsedMs,
    editMs: result.indexing.edit.elapsedMs,
    peakRendererKiB: result.memory?.peakRendererKiB || 0,
    peakTotalKiB: result.memory?.peakTotalKiB || 0,
  });

  console.log(`  Iter ${i} -> Cold: ${result.indexing.cold.elapsedMs.toFixed(1)}ms (${result.indexing.cold.chunksPerSecond.toFixed(2)} ch/s) | Query: ${result.indexing.cold.queryMs.toFixed(1)}ms | Warm: ${result.indexing.warm.elapsedMs.toFixed(1)}ms | Edit: ${result.indexing.edit.elapsedMs.toFixed(1)}ms`);
}

const stats = {
  iterations,
  timestamp: new Date().toISOString(),
  metrics: {
    coldElapsedMs: calculateStats(iterationResults.map((r) => r.coldMs)),
    coldChunksPerSecond: calculateStats(iterationResults.map((r) => r.coldChunksPerSecond)),
    queryDuringIndexingMs: calculateStats(iterationResults.map((r) => r.queryMs)),
    warmReopenMs: calculateStats(iterationResults.map((r) => r.warmMs)),
    incrementalEditMs: calculateStats(iterationResults.map((r) => r.editMs)),
    peakRendererMB: calculateStats(iterationResults.map((r) => r.peakRendererKiB / 1024)),
    peakTotalRSSMB: calculateStats(iterationResults.map((r) => r.peakTotalKiB / 1024)),
  },
  runs: iterationResults,
};

const outputPath = path.resolve('docs/performance/embedding/repeated-benchmark-results.json');
await writeFile(outputPath, JSON.stringify(stats, null, 2));

console.log('\n=== REPEATED BENCHMARK SUMMARY (N=' + iterations + ') ===');
console.table({
  'Cold Index (ms)': {
    Min: stats.metrics.coldElapsedMs.min.toFixed(1),
    Median: stats.metrics.coldElapsedMs.median.toFixed(1),
    p95: stats.metrics.coldElapsedMs.p95.toFixed(1),
    Max: stats.metrics.coldElapsedMs.max.toFixed(1),
    Mean: stats.metrics.coldElapsedMs.mean.toFixed(1),
    StdDev: stats.metrics.coldElapsedMs.stdDev.toFixed(1),
  },
  'Cold Throughput (chunks/s)': {
    Min: stats.metrics.coldChunksPerSecond.min.toFixed(2),
    Median: stats.metrics.coldChunksPerSecond.median.toFixed(2),
    p95: stats.metrics.coldChunksPerSecond.p95.toFixed(2),
    Max: stats.metrics.coldChunksPerSecond.max.toFixed(2),
    Mean: stats.metrics.coldChunksPerSecond.mean.toFixed(2),
    StdDev: stats.metrics.coldChunksPerSecond.stdDev.toFixed(2),
  },
  'Query During Index (ms)': {
    Min: stats.metrics.queryDuringIndexingMs.min.toFixed(1),
    Median: stats.metrics.queryDuringIndexingMs.median.toFixed(1),
    p95: stats.metrics.queryDuringIndexingMs.p95.toFixed(1),
    Max: stats.metrics.queryDuringIndexingMs.max.toFixed(1),
    Mean: stats.metrics.queryDuringIndexingMs.mean.toFixed(1),
    StdDev: stats.metrics.queryDuringIndexingMs.stdDev.toFixed(1),
  },
  'Warm Reopen (ms)': {
    Min: stats.metrics.warmReopenMs.min.toFixed(1),
    Median: stats.metrics.warmReopenMs.median.toFixed(1),
    p95: stats.metrics.warmReopenMs.p95.toFixed(1),
    Max: stats.metrics.warmReopenMs.max.toFixed(1),
    Mean: stats.metrics.warmReopenMs.mean.toFixed(1),
    StdDev: stats.metrics.warmReopenMs.stdDev.toFixed(1),
  },
  'Incremental Edit (ms)': {
    Min: stats.metrics.incrementalEditMs.min.toFixed(1),
    Median: stats.metrics.incrementalEditMs.median.toFixed(1),
    p95: stats.metrics.incrementalEditMs.p95.toFixed(1),
    Max: stats.metrics.incrementalEditMs.max.toFixed(1),
    Mean: stats.metrics.incrementalEditMs.mean.toFixed(1),
    StdDev: stats.metrics.incrementalEditMs.stdDev.toFixed(1),
  },
  'Peak Renderer Memory (MB)': {
    Min: stats.metrics.peakRendererMB.min.toFixed(1),
    Median: stats.metrics.peakRendererMB.median.toFixed(1),
    p95: stats.metrics.peakRendererMB.p95.toFixed(1),
    Max: stats.metrics.peakRendererMB.max.toFixed(1),
    Mean: stats.metrics.peakRendererMB.mean.toFixed(1),
    StdDev: stats.metrics.peakRendererMB.stdDev.toFixed(1),
  },
  'Peak Total Process RSS (MB)': {
    Min: stats.metrics.peakTotalRSSMB.min.toFixed(1),
    Median: stats.metrics.peakTotalRSSMB.median.toFixed(1),
    p95: stats.metrics.peakTotalRSSMB.p95.toFixed(1),
    Max: stats.metrics.peakTotalRSSMB.max.toFixed(1),
    Mean: stats.metrics.peakTotalRSSMB.mean.toFixed(1),
    StdDev: stats.metrics.peakTotalRSSMB.stdDev.toFixed(1),
  },
});
console.log(`\nDetailed repeated benchmark results saved to: ${outputPath}`);
