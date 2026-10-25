# OpenOnyx Verified Embedding Baseline

This document records the verified baseline architecture, hardware environment, model specifications, test-vault characteristics, and empirical performance metrics for OpenOnyx's local embedding and semantic retrieval subsystem. All subsequent optimizations, model evaluations, or architectural modifications must be measured against this baseline.

---

## 1. System & Model Specifications

| Component | Specification | Description |
|---|---|---|
| **Package Version** | `1.0.5` | Standard OpenOnyx desktop package (`package.json`) |
| **Model ID** | `Xenova/all-MiniLM-L6-v2` | Sentence-transformers MiniLM quantized ONNX model |
| **Model Git Revision** | `751bff37182d3f1213fa05d7196b954e230abad9` | Pinned Hugging Face checkpoint for deterministic inference |
| **Embedding Dimensions** | `384` | 384-dimensional unit-normalized Float32 vector |
| **Schema Versions** | `v2` (legacy), `v3` (modern) | Full backward read compatibility for legacy single-vector schema 2; modern schema 3 multi-segment vectors with per-chunk hashing |
| **Execution Architecture** | Dedicated Web Worker | Web Worker (`embeddingWorker.ts`) via asynchronous RPC client (`embedding-worker-client.ts`) |
| **Runtime Backend** | ONNX Runtime Web (WASM) | Local WASM binaries (`ort-wasm.wasm`, `ort-wasm-simd.wasm`) bundled in `public/wasm/` and ASAR |
| **WASM Threading Policy** | 1 WASM thread per worker | Deterministic single-thread fallback in standard Electron HTTP/file context (avoids SharedArrayBuffer deadlock/cross-origin requirement) |
| **Batch Size** | `4` chunks | Optimal balance between throughput (chunks/sec) and interactive query preemption latency |
| **Queue Architecture** | Priority Queue (`background-queue.ts`) | Interactive user queries (P0) preempt background chunk indexing batches (P2) |
| **Disk Storage** | Atomic serialized writes | Atomic writes via temporary UUID files (`.openonyx/embeddings/v3` and `.openonyx/embedding-chunks/v3`) |

---

## 2. Benchmark Hardware Environment

Measurements were recorded on the verified reference hardware configuration:

- **Host OS**: Linux (x86_64, kernel 6.x)
- **CPU**: Intel Core i7-10870H @ 2.20GHz (8 physical cores, 16 virtual threads)
- **Memory**: 16 GB DDR4 RAM
- **Node.js**: v22.23.3 (host development) / v24.18.0 (bundled runtime)
- **Electron**: 33.4.11 / Chromium 130 / V8 12.9
- **Display Server**: Headless Xvfb / off-screen rendering (no application GUI opened)

---

## 3. Test-Vault Characteristics & Retrieval Quality

### Real Vault: Engineers (`/home/varshith/VOLT/Engineers`)
- **Note Count**: 582 Markdown documents.
- **Content Profile**: Highly diverse software engineering notes, distributed systems architecture, API documentation, design documents, and operational playbooks.
- **Title Retrieval Recall@adaptive**: **96.9%** (`0.969`) across 32 deterministic sample queries.
- **Broad Summary Evidence Diversity**: **26 distinct notes** across 26 summary passages (100% path diversity, zero redundant notes).
- **Long-Note Chunk Retention**: 100% of documents exceeding 1,500 characters retain all segment vectors and chunk boundaries across schema updates.

### Test Vault: OO-Test-Vault (`OO-Test-Vault/`)
- **Note Count**: 181 Markdown documents.
- **Content Profile**: Repository test vault containing callouts, math formulas, canvas diagrams, and nested directories.

### Isolated Synthetic Benchmark Vault
- **Note Count**: 48 notes (85 chunks, 12 long notes with 28 paragraphs each, 36 short notes with 3 paragraphs).
- **Deterministic Topics**: Neural networks, network routing, ancient history, plant biology.

---

## 4. Empirical Performance Baseline Numbers

All numbers are measured using isolated real ONNX inference in headless Electron (`scripts/benchmark-embedding-real.mjs`):

| Metric | Measured Baseline | Notes / Constraints |
|---|---|---|
| **Cold Vault Indexing (48 notes, 85 chunks)** | **17,089.8 ms** (~17.1 s) | From scratch, downloads/loads model once, processes all chunks |
| **Indexing Throughput** | **4.97 chunks/s** (2.81 notes/s) | Measured with single-thread WASM at batch size 4 |
| **Batch Inference Latency (batch=4)** | **634.7 ms** average / **913.3 ms** p95 | Single-thread WASM execution on reference CPU |
| **Model Cold Load Time** | **959.8 ms** | One-time compilation and graph optimization of ONNX model |
| **Tokenization Time** | **2.02 ms** average | Fast BertTokenizer in worker thread |
| **ONNX Tensor Compute Time** | **576.4 ms** average | Actual matrix math in ONNX Runtime Web |
| **Interactive Query Latency (During Indexing)** | **644.9 ms** | P0 query executed immediately ahead of pending P2 background batches |
| **Warm Reopen (Re-indexing same vault)** | **353.3 ms** | 100% cache hit, 0 ONNX inferences required |
| **Incremental Note Edit Latency** | **427.2 ms** | 3 chunks reused from disk cache, only 2 modified chunks inferred |
| **Main Thread Event Loop Delay (Worker)** | **0.18 ms** avg / **0.30 ms** p95 | Heartbeat monitoring during heavy indexing |
| **Main Thread Event Loop Delay (Unthreaded)** | **195.3 ms** peak delay | Baseline before worker offload (99.9% reduction achieved) |
| **Renderer JS Heap** | **48.7 MB** avg / **51.7 MB** peak | Managed memory during continuous indexing |
| **Peak Renderer Process Working Set** | **~446 MB** | Includes V8 heap, DOM, and WASM memory allocations |
| **Peak Total Process RSS (App + Workers)** | **~911 MB** | Entire Electron tree working set under load |

---

## 5. Verification Commands

To reproduce and verify these baseline figures, execute the following commands from the repository root:

### 1. Full Vitest Test Suite
```bash
npm test
```
*Expected: 83+ test files passed, 540+ tests passed, 0 failures.*

### 2. Real Vault Retrieval & Intelligence Evaluation
```bash
OO_EVAL_VAULT=/home/varshith/VOLT/Engineers npx vitest run tests/e2e/vault-intelligence-real-vault.test.ts
```
*Expected: Target note count (582) verified, long-note chunk retention verified, title recall >= 90% (measured 96.9%), broad summary diversity 26 distinct notes.*

### 3. Real ONNX Model & Responsiveness Benchmarks
```bash
# Real ONNX inference benchmark in isolated headless Electron:
node scripts/benchmark-embedding-real.mjs /tmp/openonyx-real-embedding-benchmark baseline

# Event-loop responsiveness benchmark:
node scripts/benchmark-embedding-responsiveness.mjs
```

### 4. Packaged ASAR Asset Verification
```bash
node scripts/check-embedding-worker-assets.mjs release/linux-unpacked/resources/app.asar
```
*Expected: Confirms `embeddingWorker-*.js`, `semanticAnalysisWorker-*.js`, dynamic chunks, and `ort-wasm*.wasm` binaries are correctly bundled inside the ASAR.*
