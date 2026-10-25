import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('keeps Read and Edit titles at the same relative sizes as note zoom changes', () => {
  const css = readFileSync('src/styles/studio.css', 'utf8');
  const titleRules = [...css.matchAll(/\.studio-app \.markdown-preview h1,\s*\.studio-app \.cm-heading-1\s*\{([^}]+)\}/g)];
  const fontSizes = titleRules.flatMap(([, body]) => [...body.matchAll(/font-size:\s*([^;]+);/g)].map(([, value]) => value));
  expect(fontSizes).toHaveLength(3);
  expect(fontSizes.every(value => /em\s*!important$/.test(value))).toBe(true);
  expect(css).toContain('font-size: var(--preview-font-size, 17px)');
  expect(readFileSync('src/components/editor/Editor.tsx', 'utf8')).toContain('fontSize: "var(--preview-font-size, var(--editor-font-size))"');
});
