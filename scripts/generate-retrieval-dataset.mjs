import fs from 'node:fs/promises';
import path from 'node:path';

const vault = process.env.OO_EVAL_VAULT || '/home/varshith/VOLT/Engineers';
const outputPath = path.resolve('tests/fixtures/retrieval-evaluation-dataset.json');

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'and', 'are', 'because', 'before', 'being',
  'can', 'could', 'does', 'for', 'from', 'have', 'how', 'into', 'its', 'not',
  'that', 'the', 'their', 'then', 'there', 'these', 'they', 'this', 'those', 'was',
  'what', 'when', 'where', 'which', 'who', 'why', 'will', 'with', 'would', 'your',
]);

function tokens(str) {
  return str
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

async function collectMarkdownFiles(dir, base = dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!['.git', '.openonyx', '.trash', 'node_modules'].includes(entry.name)) {
        results.push(...await collectMarkdownFiles(path.join(dir, entry.name), base));
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(path.relative(base, path.join(dir, entry.name)).replace(/\\/g, '/'));
    }
  }
  return results.sort();
}

const mdFiles = await collectMarkdownFiles(vault);
console.log(`Analyzing ${mdFiles.length} notes in ${vault}...`);

const items = [];
const seenTitles = new Set();

for (const file of mdFiles) {
  const title = path.basename(file, '.md');
  const titleKey = title.toLowerCase();
  if (seenTitles.has(titleKey)) continue;
  seenTitles.add(titleKey);

  const titleTokens = new Set(tokens(title));
  if (titleTokens.size < 2) continue;

  const content = await fs.readFile(path.join(vault, file), 'utf8');
  if (content.length < 500) continue;

  // Split into paragraphs (skipping headers, code blocks, lists)
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 80 && !p.startsWith('#') && !p.startsWith('```') && !p.startsWith('- '));

  if (paragraphs.length < 2) continue;

  let chosenBodyQuery = null;
  for (const para of paragraphs.slice(1)) {
    const sentences = para
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim().replace(/^>\s*/, ''))
      .filter((s) => s.length >= 45 && s.length <= 160 && !s.includes('http'));

    for (const sent of sentences) {
      const sentTokens = tokens(sent);
      // Strict rule: ZERO token overlap with the note title
      const overlap = sentTokens.filter((t) => titleTokens.has(t));
      if (overlap.length === 0 && sentTokens.length >= 5) {
        chosenBodyQuery = sent;
        break;
      }
    }
    if (chosenBodyQuery) break;
  }

  if (chosenBodyQuery) {
    items.push({
      id: items.length + 1,
      targetPath: file,
      title,
      titleQuery: `What does ${title.replace(/[-_]+/g, ' ')} cover?`,
      bodyQuery: chosenBodyQuery,
    });
  }
}

// Sample a balanced, deterministic set of 30 items
const targetCount = 30;
const step = Math.max(1, Math.floor(items.length / targetCount));
const dataset = items.filter((_, idx) => idx % step === 0).slice(0, targetCount);

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(
  outputPath,
  JSON.stringify(
    {
      description: 'Fixed evaluation dataset separating title recall, body-content retrieval, and ranking quality',
      vault,
      itemCount: dataset.length,
      createdAt: new Date().toISOString(),
      items: dataset,
    },
    null,
    2,
  ),
);

console.log(`Generated fixed evaluation dataset with ${dataset.length} items at: ${outputPath}`);
