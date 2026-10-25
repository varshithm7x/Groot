// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
const fakeWorker = vi.hoisted(() => ({
  calls: 0,
  chunks: 0,
  delay: null as null | (() => Promise<void>),
}));

vi.mock('../src/utils/embedding-worker-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils/embedding-worker-client')>();
  return {
    ...actual,
    embeddingWorkerClient: {
      ready: true,
      dispose: () => {},
      invalidate: () => {},
      infer: async (texts: string[]) => {
        fakeWorker.calls++;
        fakeWorker.chunks += texts.length;
        if (fakeWorker.delay) await fakeWorker.delay();
        const output = new Float32Array(texts.length * 384);
        for (let i = 0; i < output.length; i++) output[i] = 0.25;
        return output;
      },
    },
  };
});

import { EmbeddingWorkerClient } from '../src/utils/embedding-worker-client';
import {
  embedNote,
  loadStoreAsync,
  resetEmbeddingsStore,
  simpleHash,
  type EmbeddingStore,
  EMBEDDING_SCHEMA_VERSION,
} from '../src/utils/embeddings';
import { FileSystemManager } from '../electron/fileSystem';

describe('Embedding Recovery & Packaged Execution', () => {
  beforeEach(() => {
    resetEmbeddingsStore();
    fakeWorker.calls = 0;
    fakeWorker.chunks = 0;
    fakeWorker.delay = null;
  });

  // ── 1. Worker Crash Recovery ──────────────────────────────────────────────
  describe('Worker crash recovery', () => {
    it('rejects in-flight jobs on worker crash and recovers seamlessly on next request', async () => {
      let workerInstanceCount = 0;
      let activeWorker: any = null;

      const mockWorkerFactory = () => {
        workerInstanceCount++;
        const worker = {
          postMessage: vi.fn((msg: any) => {
            if (msg.type === 'infer') {
              // Simulating async processing
              setTimeout(() => {
                if (worker.onerror && (worker as any).shouldCrash) {
                  (worker as any).onerror(new Error('Out of memory: Worker killed'));
                } else if (worker.onmessage) {
                  const vectors = new Float32Array(msg.texts.length * 384);
                  for (let i = 0; i < vectors.length; i++) vectors[i] = 0.5;
                  worker.onmessage({
                    data: {
                      type: 'infer-result',
                      id: msg.id,
                      generation: msg.generation,
                      vectors,
                      loadMs: 10,
                      inferenceMs: 20,
                    },
                  } as MessageEvent);
                }
              }, 10);
            }
          }),
          terminate: vi.fn(),
          onmessage: null as any,
          onerror: null as any,
          onmessageerror: null as any,
          shouldCrash: false,
        };
        activeWorker = worker;
        return worker as any;
      };

      const client = new EmbeddingWorkerClient(mockWorkerFactory, async () => undefined);

      // First request: simulate worker crash during inference
      const firstInference = client.infer(['first chunk of text'], 1, 'http://localhost/wasm/');
      activeWorker.shouldCrash = true;

      await expect(firstInference).rejects.toThrow(/crashed or returned an unreadable message/);
      expect(client.ready).toBe(false);

      // Subsequent request: client must transparently recreate a fresh worker and succeed
      const secondInference = await client.infer(['second chunk of text'], 1, 'http://localhost/wasm/');
      expect(workerInstanceCount).toBe(2);
      expect(secondInference.length).toBe(384);
      expect(secondInference[0]).toBeCloseTo(0.5);

      client.dispose();
    });
  });

  // ── 2. Corrupted Cache Handling ───────────────────────────────────────────
  describe('Corrupted cache handling', () => {
    it('gracefully skips corrupted, empty, or schema-violating cache files during loadStoreAsync', async () => {
      const diskStore = new Map<string, string>();

      // Corrupted JSON syntax
      diskStore.set('embeddings/v3/corrupt-syntax.json', '{"path": "corrupt.md", "hash": 123, INVALID JSON SYNTAX');
      // Truncated / empty file
      diskStore.set('embeddings/v3/empty.json', '');
      // Malformed vectors (contains null and NaN)
      diskStore.set('embeddings/v3/invalid-vector.json', JSON.stringify({
        path: 'invalid-vector.md',
        hash: 100,
        vector: [1, null, NaN],
        schemaVersion: EMBEDDING_SCHEMA_VERSION,
      }));
      // Valid entry
      const validPath = 'valid-note.md';
      const validHash = simpleHash('valid prose content');
      const validVector = Array(384).fill(0.1);
      diskStore.set('embeddings/v3/valid.json', JSON.stringify({
        path: validPath,
        hash: validHash,
        vector: validVector,
        schemaVersion: EMBEDDING_SCHEMA_VERSION,
        updatedAt: Date.now(),
      }));

      (window as any).electronAPI = {
        dataRead: vi.fn(async (subpath: string) => diskStore.get(subpath) || null),
        dataWrite: vi.fn(async (subpath: string, content: string) => { diskStore.set(subpath, content); }),
        dataDelete: vi.fn(async (subpath: string) => { diskStore.delete(subpath); }),
        dataList: vi.fn(async (subDir: string) => {
          if (subDir === 'embeddings') return ['v3'];
          if (subDir === 'embeddings/v3') return ['corrupt-syntax.json', 'empty.json', 'invalid-vector.json', 'valid.json'];
          return [];
        }),
      };

      const store = await loadStoreAsync();

      // Only the valid entry should be present
      expect(store.entries.size).toBe(1);
      expect(store.entries.has(validPath)).toBe(true);
      expect(store.entries.get(validPath)?.hash).toBe(validHash);
      expect(store.entries.has('corrupt.md')).toBe(false);
      expect(store.entries.has('invalid-vector.md')).toBe(false);
    });

    it('falls back to fresh chunk inference when persisted chunk cache is malformed or incompatible', async () => {
      const diskStore = new Map<string, string>();

      // Seed a corrupted chunk cache file for 'malformed.md'
      diskStore.set('embedding-chunks/malformed.json', '{ "identity": "different-model", "chunks": "NOT AN ARRAY" }');

      (window as any).electronAPI = {
        dataRead: vi.fn(async (subpath: string) => diskStore.get(subpath) || null),
        dataWrite: vi.fn(async (subpath: string, content: string) => { diskStore.set(subpath, content); }),
        dataDelete: vi.fn(async (subpath: string) => { diskStore.delete(subpath); }),
        dataList: vi.fn(async () => []),
      };

      const store: EmbeddingStore = { entries: new Map() };
      const noteProse = 'A well-formed technical paragraph discussing system recovery and fallback mechanisms.';
      
      const success = await embedNote(store, 'malformed.md', noteProse);
      expect(success).toBe(true);
      expect(store.entries.has('malformed.md')).toBe(true);
      expect(store.entries.get('malformed.md')?.vector.length).toBe(384);
      expect(fakeWorker.calls).toBeGreaterThan(0);
    });
  });

  // ── 3. Interrupted Write Safety ───────────────────────────────────────────
  describe('Interrupted write safety', () => {
    it('isolates temporary write files and keeps destination clean during atomic file operations', async () => {
      const tempVault = await fs.mkdtemp(path.join(os.tmpdir(), 'openonyx-atomic-test-'));
      const manager = new FileSystemManager();
      manager.setVaultPath(tempVault);

      try {
        const dest = 'embeddings/v3/state.json';
        await manager.writeDataFile(dest, '{"state": "stable"}');

        // Verify file written
        const initial = await manager.readDataFile(dest);
        expect(JSON.parse(initial!)).toEqual({ state: 'stable' });

        // Simulate an orphaned .tmp file left behind by an interrupted process
        const dataDir = path.join(tempVault, '.openonyx', 'embeddings', 'v3');
        const orphanTmp = path.join(dataDir, `state.json.${crypto.randomUUID()}.tmp`);
        await fs.writeFile(orphanTmp, '{"state": "interrupted-halfway"');

        // listDataDir must strictly ignore .tmp and hidden files
        const files = await manager.listDataDir('embeddings/v3');
        expect(files).toEqual(['state.json']);

        // Overwrite atomically with newest state
        await manager.writeDataFile(dest, '{"state": "updated"}');
        const updated = await manager.readDataFile(dest);
        expect(JSON.parse(updated!)).toEqual({ state: 'updated' });

        // Clean up the orphan
        await fs.unlink(orphanTmp).catch(() => {});
      } finally {
        await fs.rm(tempVault, { recursive: true, force: true });
      }
    });

    it('guarantees sequential order and latest-write-wins under concurrent atomic writes', async () => {
      const tempVault = await fs.mkdtemp(path.join(os.tmpdir(), 'openonyx-atomic-seq-'));
      const manager = new FileSystemManager();
      manager.setVaultPath(tempVault);

      try {
        const target = 'embeddings/v3/concurrent.json';
        // Launch 10 rapid concurrent writes
        const promises = Array.from({ length: 10 }, (_, i) =>
          manager.writeDataFile(target, JSON.stringify({ revision: i }))
        );

        await Promise.all(promises);

        // The final written content must be a valid JSON representing the last launched write
        const content = await manager.readDataFile(target);
        expect(content).not.toBeNull();
        const parsed = JSON.parse(content!);
        expect(parsed.revision).toBe(9);
      } finally {
        await fs.rm(tempVault, { recursive: true, force: true });
      }
    });
  });

  // ── 4. Concurrent Note Edits ──────────────────────────────────────────────
  describe('Concurrent note edits', () => {
    it('aborts obsolete in-flight note revisions and retains only the latest revision', async () => {
      const store: EmbeddingStore = { entries: new Map() };
      let release!: () => void;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      fakeWorker.delay = () => gate;

      (window as any).electronAPI = {
        dataRead: vi.fn(async () => null),
        dataWrite: vi.fn(async () => {}),
        dataDelete: vi.fn(async () => {}),
        dataList: vi.fn(async () => []),
      };

      // Launch revision 1 (gets held at fakeWorker.delay)
      const rev1 = embedNote(store, 'note.md', 'Revision 1 initial concept');
      await vi.waitFor(() => expect(fakeWorker.calls).toBe(1));

      // Launch revision 2 and revision 3 while revision 1 is pending
      const rev2 = embedNote(store, 'note.md', 'Revision 2 modified concept');
      const rev3 = embedNote(store, 'note.md', 'Revision 3 final verified concept');

      // Release the gate to let processing complete
      release();

      expect(await rev1).toBe(false);
      expect(await rev2).toBe(false);
      expect(await rev3).toBe(true);

      // Store must contain revision 3's hash
      expect(store.entries.get('note.md')?.hash).toBe(simpleHash('Revision 3 final verified concept'));
    });
  });

  // ── 5. Clean Packaged Launch & Asset Verification ─────────────────────────
  describe('Clean packaged launch and asset integrity', () => {
    const root = path.resolve(__dirname, '..');
    const binary = path.join(root, 'release', 'linux-unpacked', 'openonyx');
    const asarPath = path.join(root, 'release', 'linux-unpacked', 'resources', 'app.asar');

    it('verifies that the packaged linux binary exists and executes cleanly in node mode', async () => {
      try {
        await fs.access(binary);
      } catch {
        // Skip if binary packaging hasn't been run in this environment
        return;
      }

      // Execute packaged binary in node mode
      const result = spawnSync(binary, ['-e', 'console.log("PACKAGE_LAUNCH_OK:" + process.versions.electron)'], {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        encoding: 'utf8',
        timeout: 10000,
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('PACKAGE_LAUNCH_OK:');
    });

    it('verifies that the production ASAR archive contains all workers, entry points, and local WASM binaries', async () => {
      try {
        await fs.access(asarPath);
      } catch {
        return;
      }

      const asar = await import('@electron/asar');
      const files = asar.listPackage(asarPath).map((f) => f.replace(/\\/g, '/').replace(/^\//, ''));

      // Check main electron entry points
      expect(files).toContain('dist-electron/main.js');
      expect(files).toContain('dist-electron/preload.js');
      expect(files).toContain('dist/index.html');

      // Check WASM binaries
      expect(files).toContain('dist/wasm/ort-wasm.wasm');
      expect(files).toContain('dist/wasm/ort-wasm-simd.wasm');

      // Check bundled workers
      const embeddingWorker = files.find((f) => f.startsWith('dist/assets/embeddingWorker-') && f.endsWith('.js'));
      const semanticWorker = files.find((f) => f.startsWith('dist/assets/semanticAnalysisWorker-') && f.endsWith('.js'));
      expect(embeddingWorker).toBeDefined();
      expect(semanticWorker).toBeDefined();

      // Check packaged preload API contract
      const preloadCode = asar.extractFile(asarPath, 'dist-electron/preload.js').toString('utf8');
      expect(preloadCode).toContain('fileMetadata');
      expect(preloadCode).toContain('dataRead');
      expect(preloadCode).toContain('dataWrite');
      expect(preloadCode).toContain('embeddingCacheRead');
      expect(preloadCode).toContain('embeddingCacheWrite');
    });
  });
});
