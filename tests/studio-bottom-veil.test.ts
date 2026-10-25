import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('keeps the dock over a scrolling, softly fading document instead of a reserved footer row', () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  const css = readFileSync('src/styles/studio.css', 'utf8');

  expect(app).toContain('className="studio-bottom-veil" aria-hidden="true"');
  expect(css).toMatch(/\.studio-app \.onyx-statusbar\s*\{[^}]*position:\s*fixed;[^}]*background:\s*transparent\s*!important;/s);
  expect(css).toMatch(/\.studio-bottom-veil\s*\{[^}]*pointer-events:\s*none;[^}]*backdrop-filter:\s*blur\(/s);
  expect(css).toMatch(/\.studio-dock-items\s*\{[^}]*border-radius:\s*11px;[^}]*background:\s*var\(--bg-elevated\);/s);
  expect(css).toMatch(/\.studio-dock-button \+ \.studio-dock-button::before\s*\{[^}]*display:\s*block;/s);
  expect(css).toMatch(/\.studio-app \.cm-content,\s*\.studio-app \.markdown-preview\s*\{[^}]*padding-bottom:\s*max\(/s);
});
