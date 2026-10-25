// @vitest-environment jsdom
import React, { act } from 'react';
import { readFileSync } from 'node:fs';
import { createRoot } from 'react-dom/client';
import type { EditorView } from '@codemirror/view';
import { expect, it, vi } from 'vitest';
import { Editor } from '../src/components/editor/Editor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => new DOMRect();

it('uses one layout rule for Read and Edit column typography', () => {
  const css = readFileSync('src/styles/studio.css', 'utf8');
  const sharedRule = css.match(/\.studio-app \.cm-content,\s*\.studio-app \.markdown-preview\s*\{([^}]+)\}/)?.[1];
  expect(sharedRule).toContain('max-width: min(var(--reading-view-width, 760px), 760px)');
  expect(sharedRule).toContain('padding: 80px 44px 80px');
  expect(sharedRule).toContain('line-height: 1.6');
  expect(sharedRule).toContain('font-family: var(--font-family)');
  expect(sharedRule).toContain('font-size: var(--preview-font-size, 17px)');
  expect(css).toMatch(/\.studio-app \.cm-content\s*\{\s*padding-top: calc\(80px - 1\.5em\) !important;/);
  expect(css).toMatch(/\.studio-app \.cm-scroller,\s*\.studio-app \.editor-preview-scroller\s*\{\s*scrollbar-gutter: stable both-edges;/);
  expect(css).toMatch(/\.studio-app \.cm-live-blank-line\s*\{\s*display: none !important;/);
  expect(css).toMatch(/\.studio-app \.cm-editor\.cm-focused \.cm-live-blank-active\s*\{\s*display: block !important;/);
  expect(css).toMatch(/\.studio-app \.markdown-preview h1,\s*\.studio-app \.cm-heading-1\s*\{/);
  expect(css).toMatch(/\.studio-app \.markdown-preview h2,\s*\.studio-app \.cm-heading-2\s*\{/);
});

it('marks headings, paragraph gaps, lists, and quotes for Read-style live layout', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  let view: EditorView | null = null;
  const originalRect = HTMLElement.prototype.getBoundingClientRect;
  const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    return this.classList.contains('cm-gutters') ? new DOMRect(0, 0, 18, 100) : originalRect.call(this);
  });

  try {
    await act(async () => root.render(React.createElement(Editor, {
      tabs: [{ id: 'note', path: 'note.md', name: 'Note', isModified: false }],
      activeTabId: 'note',
      documentPath: 'note.md',
      content: '# Title\n\nFirst paragraph.\n\nSecond paragraph.\n\n## Section\n\n- Item one\n- Item two\n\n> Quoted text\n\n![figure](data:image/png;base64,aGVsbG8=)\n\n```ts\nconst value = 1;\n```',
      viewMode: 'editor',
      onAdjustFontSize: vi.fn(), onTabSelect: vi.fn(), onTabClose: vi.fn(),
      onContentChange: vi.fn(), onViewModeChange: vi.fn(), onLinkClick: vi.fn(),
      onEditorViewReady: (current: EditorView | null) => { view = current; },
    })));

    expect(host.querySelector('.cm-heading-1')).not.toBeNull();
    expect(host.querySelectorAll('.cm-heading-1 > .cm-widgetBuffer')).toHaveLength(2);
    expect(host.querySelector('.cm-heading-1')?.textContent).toBe('Title');
    expect(view!.state.doc.line(1).text).toBe('# Title');
    expect(host.querySelector('.cm-heading-2')).not.toBeNull();
    expect(host.querySelectorAll('.cm-live-blank-line').length).toBeGreaterThan(0);
    expect(host.querySelectorAll('.cm-live-paragraph-end').length).toBeGreaterThan(0);
    expect(host.querySelectorAll('.cm-live-paragraph-line').length).toBeGreaterThan(0);
    expect(host.querySelector('.cm-live-list-first')).not.toBeNull();
    expect(host.querySelector('.cm-live-list-last')).not.toBeNull();
    expect(host.querySelector('.cm-live-list-first')?.textContent).toBe('•Item one');
    expect(host.querySelector('.cm-live-blockquote-first')).not.toBeNull();
    expect(host.querySelector('.cm-live-codeblock-first')).not.toBeNull();
    expect(host.querySelector('.cm-live-codeblock-last')).not.toBeNull();
    expect(view!.scrollDOM.style.paddingInlineEnd).toBe('18px');
    expect(host.querySelector('.cm-image-widget')?.parentElement?.classList.contains('cm-live-image-line')).toBe(true);
    expect(host.querySelector('.cm-live-image-line > .cm-widgetBuffer')).not.toBeNull();
    expect(host.querySelector('.cm-image-widget')?.parentElement?.classList.contains('cm-live-paragraph-end')).toBe(false);
    expect(host.querySelector('.cm-heading-1')?.classList.contains('cm-live-paragraph-end')).toBe(false);

    const hiddenBlankCount = host.querySelectorAll('.cm-live-blank-line').length;
    act(() => view!.dispatch({ selection: { anchor: view!.state.doc.line(2).from } }));
    expect(host.querySelectorAll('.cm-live-blank-line')).toHaveLength(hiddenBlankCount);
    expect(host.querySelector('.cm-live-blank-line.cm-live-blank-active')).not.toBeNull();
    act(() => view!.dispatch({ selection: { anchor: 0 } }));
    expect(host.querySelectorAll('.cm-live-blank-line')).toHaveLength(hiddenBlankCount);
    act(() => view!.dispatch({ changes: { from: 2, to: 7, insert: 'Heading' } }));
    expect(view!.state.doc.line(1).text).toBe('# Heading');
    expect(host.querySelector('.cm-heading-1')?.textContent).toBe('Heading');
  } finally {
    await act(async () => root.unmount());
    rectSpy.mockRestore();
    host.remove();
  }
});

it('keeps common inline formats rendered while their text is edited', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  let view: EditorView | null = null;

  try {
    await act(async () => root.render(React.createElement(Editor, {
      tabs: [{ id: 'formats', path: 'formats.md', name: 'Formats', isModified: false }],
      activeTabId: 'formats', documentPath: 'formats.md',
      content: '# Formats\n\nUse **bold**, *italic*, ~~strike~~, `code`, and [links](https://example.com).\n\n1. First\n2. Second\n\n- [ ] Task\n\n> Quote\n\n---\n\n| Name | Value |\n| --- | --- |\n| A | B |',
      viewMode: 'editor',
      onAdjustFontSize: vi.fn(), onTabSelect: vi.fn(), onTabClose: vi.fn(),
      onContentChange: vi.fn(), onViewModeChange: vi.fn(), onLinkClick: vi.fn(),
      onEditorViewReady: (current: EditorView | null) => { view = current; },
    })));

    const paragraph = host.querySelector('.cm-live-paragraph-line');
    expect(paragraph?.querySelector('.cm-live-strong')?.textContent).toBe('bold');
    expect(paragraph?.querySelector('.cm-live-emphasis')?.textContent).toBe('italic');
    expect(paragraph?.querySelector('.cm-live-strike')?.textContent).toBe('strike');
    expect(paragraph?.querySelector('.cm-live-code')?.textContent).toBe('code');
    expect(paragraph?.querySelector('.cm-live-link')?.textContent).toBe('links');
    expect(paragraph?.textContent).not.toContain('**');
    expect(host.querySelector('.cm-live-list-first')?.textContent).toBe('1.First');
    expect(host.querySelector('.cm-live-blockquote-first')?.textContent).toBe('Quote');
    expect(host.querySelector('.cm-live-rule-line hr.cm-live-horizontal-rule')).not.toBeNull();
    expect(host.querySelector('.cm-live-task-checkbox')).not.toBeNull();
    expect(host.querySelector('.cm-live-table')).not.toBeNull();

    act(() => host.querySelector<HTMLInputElement>('.cm-live-task-checkbox')!.click());
    expect(view!.state.doc.toString()).toContain('- [x] Task');
    expect(host.querySelector<HTMLInputElement>('.cm-live-task-checkbox')?.checked).toBe(true);

    const boldFrom = view!.state.doc.line(3).from + view!.state.doc.line(3).text.indexOf('bold');
    act(() => view!.dispatch({ selection: { anchor: boldFrom + 2 } }));
    expect(host.querySelector('.cm-live-strong')?.textContent).toBe('bold');
    act(() => view!.dispatch({ changes: { from: boldFrom, to: boldFrom + 4, insert: 'stronger' } }));
    expect(view!.state.doc.line(3).text).toContain('**stronger**');
    expect(host.querySelector('.cm-live-strong')?.textContent).toBe('stronger');

    act(() => view!.dispatch({ selection: { anchor: view!.state.doc.line(5).from + 3 } }));
    expect(host.querySelector('.cm-live-list-first')?.textContent).toBe('1.First');
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
