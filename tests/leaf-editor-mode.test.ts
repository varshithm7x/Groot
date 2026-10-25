// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

const files = vi.hoisted(() => new Map<string, string>());
vi.mock('../src/utils/api', () => ({
  getAPI: () => ({
    readFile: async (path: string) => files.get(path) ?? '',
    fileExists: async () => true,
    writeFile: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock('../src/lib/syncEngine', () => ({
  syncEngine: { triggerPush: vi.fn() },
  normalizeSyncPath: (path: string) => path,
}));

import { LeafPaneEditor } from '../src/components/layout/LeafPaneEditor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => new DOMRect();

it('shows the active note in the real editor after switching tabs and read/edit modes', async () => {
  files.set('first.md', '# First note');
  files.set('second.md', '# Second note');
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const tabs = [
    { id: 'first', path: 'first.md', name: 'First', isModified: false },
    { id: 'second', path: 'second.md', name: 'Second', isModified: false },
  ];
  const props = (active: typeof tabs[number]) => ({
    leaf: { type: 'leaf' as const, id: 'leaf', tabs, activeTabId: active.id },
    activeTab: active,
    cachedContent: files.get(active.path),
    theme: 'dark', settings: {}, allNoteNames: [], editorSuggestions: [], editorNextStepSuggestions: [],
    inlineAnnotation: null, showInlineInsight: false, isFocused: true,
    onTabSelect: vi.fn(), onTabClose: vi.fn(), onLinkClick: vi.fn(), onImagePaste: vi.fn(),
    getNoteContent: vi.fn(), onAdjustFontSize: vi.fn(), onAcceptSuggestion: vi.fn(),
    onRejectSuggestion: vi.fn(), onOpenNote: vi.fn(), onToggleInsight: vi.fn(),
    onContentChangeGlobal: vi.fn(),
  } as unknown as React.ComponentProps<typeof LeafPaneEditor>);
  const visibleEditor = () => [...host.querySelectorAll<HTMLElement>('.cm-editor')]
    .find(element => element.style.display !== 'none');
  try {
    await act(async () => root.render(React.createElement(LeafPaneEditor, props(tabs[0]))));
    expect(visibleEditor()?.textContent).toContain('First note');
    await act(async () => root.render(React.createElement(LeafPaneEditor, props(tabs[1]))));
    expect(visibleEditor()?.textContent).toContain('Second note');
    await act(async () => document.dispatchEvent(new CustomEvent('studio:toggle-view-mode')));
    expect(host.querySelector('.markdown-preview')?.textContent).toContain('Second note');
    await act(async () => document.dispatchEvent(new CustomEvent('studio:toggle-view-mode')));
    expect(visibleEditor()?.textContent).toContain('Second note');
    expect(visibleEditor()?.textContent).not.toContain('First note');
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

it('opens the second note in Edit after switching between notes in Read', async () => {
  files.set('first.md', '# First note');
  files.set('second.md', '# Second note');
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const tabs = [
    { id: 'first', path: 'first.md', name: 'First', isModified: false },
    { id: 'second', path: 'second.md', name: 'Second', isModified: false },
  ];
  const props = (active: typeof tabs[number]) => ({
    leaf: { type: 'leaf' as const, id: 'leaf', tabs, activeTabId: active.id },
    activeTab: active,
    cachedContent: files.get(active.path),
    theme: 'dark', settings: { defaultView: 'preview' }, allNoteNames: [], editorSuggestions: [], editorNextStepSuggestions: [],
    inlineAnnotation: null, showInlineInsight: false, isFocused: true,
    onTabSelect: vi.fn(), onTabClose: vi.fn(), onLinkClick: vi.fn(), onImagePaste: vi.fn(),
    getNoteContent: vi.fn(), onAdjustFontSize: vi.fn(), onAcceptSuggestion: vi.fn(),
    onRejectSuggestion: vi.fn(), onOpenNote: vi.fn(), onToggleInsight: vi.fn(),
    onContentChangeGlobal: vi.fn(),
  } as unknown as React.ComponentProps<typeof LeafPaneEditor>);
  const visibleEditor = () => [...host.querySelectorAll<HTMLElement>('.cm-editor')]
    .find(element => element.style.display !== 'none');
  try {
    await act(async () => root.render(React.createElement(LeafPaneEditor, props(tabs[0]))));
    expect(host.querySelector('.markdown-preview')?.textContent).toContain('First note');
    await act(async () => root.render(React.createElement(LeafPaneEditor, props(tabs[1]))));
    expect(host.querySelector('.markdown-preview')?.textContent).toContain('Second note');
    await act(async () => document.dispatchEvent(new CustomEvent('studio:toggle-view-mode')));
    expect(visibleEditor()?.textContent).toContain('Second note');
    expect(visibleEditor()?.textContent).not.toContain('First note');
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

it('uses the destination note Read mode on the first render of an image tab', async () => {
  files.set('first.md', '# First note');
  files.set('second.md', `# Second note\n\n![photo](data:image/png;base64,${'A'.repeat(100_000)})`);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const tabs = [
    { id: 'first', path: 'first.md', name: 'First', isModified: false },
    { id: 'second', path: 'second.md', name: 'Second', isModified: false },
  ];
  const getViewState = (path: string) => ({ viewMode: path === 'second.md' ? 'preview' as const : 'editor' as const });
  const props = (active: typeof tabs[number]) => ({
    leaf: { type: 'leaf' as const, id: 'leaf', tabs, activeTabId: active.id },
    activeTab: active, cachedContent: files.get(active.path), getViewState,
    theme: 'dark', settings: {}, allNoteNames: [], editorSuggestions: [], editorNextStepSuggestions: [],
    inlineAnnotation: null, showInlineInsight: false, isFocused: true,
    onTabSelect: vi.fn(), onTabClose: vi.fn(), onLinkClick: vi.fn(), onImagePaste: vi.fn(),
    getNoteContent: vi.fn(), onAdjustFontSize: vi.fn(), onAcceptSuggestion: vi.fn(),
    onRejectSuggestion: vi.fn(), onOpenNote: vi.fn(), onToggleInsight: vi.fn(),
    onContentChangeGlobal: vi.fn(),
  } as unknown as React.ComponentProps<typeof LeafPaneEditor>);
  try {
    await act(async () => root.render(React.createElement(LeafPaneEditor, props(tabs[0]))));
    expect(host.querySelector('.cm-editor')).not.toBeNull();
    await act(async () => root.render(React.createElement(LeafPaneEditor, props(tabs[1]))));
    expect(host.querySelector('.markdown-preview img')).not.toBeNull();
    expect(host.querySelector('.cm-editor')).toBeNull();
    await act(async () => root.render(React.createElement(LeafPaneEditor, props(tabs[0]))));
    expect(host.querySelector('.cm-editor')?.textContent).toContain('First note');
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
