// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';

const readFile = vi.hoisted(() => vi.fn(() => new Promise<string>(() => {})));
const fileExists = vi.hoisted(() => vi.fn(() => new Promise<boolean>(() => {})));
vi.mock('../src/utils/api', () => ({ getAPI: () => ({ readFile, fileExists, writeFile: vi.fn().mockResolvedValue(undefined) }) }));
const mockView = vi.hoisted(() => ({ current: null as null | { state: { doc: { toString: () => string; length: number } }; dispatch: (change: any) => void } }));
vi.mock('../src/components/editor/Editor', () => ({
  Editor: ({ content, viewMode, activeTabId, onContentChange, onEditorViewReady }: {
    content: string; viewMode: string; activeTabId: string; onContentChange: (content: string, userEdit: boolean) => void;
    onEditorViewReady: (view: any, path?: string) => void;
  }) => {
    React.useEffect(() => {
      if (!mockView.current) onEditorViewReady(null);
    }, [onEditorViewReady]);
    return React.createElement(React.Fragment, null,
      React.createElement('div', { 'data-testid': 'note-content', 'data-mode': viewMode }, content),
      React.createElement('button', { onClick: () => {
        mockView.current = {
          state: { doc: { toString: () => '# Fresh edit', length: 12 } },
          dispatch: vi.fn(),
        };
        onEditorViewReady(mockView.current as any, `${activeTabId}.md`);
        onContentChange('# Fresh edit', true);
      } }, 'Type'),
      React.createElement('button', { onClick: () => onContentChange('# Preview change', false) }, 'Change preview'),
    );
  },
}));
vi.mock('../src/components/editor/EditorHeader', () => ({ EditorHeader: ({ onViewModeChange }: { onViewModeChange: (mode: string) => void }) => React.createElement(React.Fragment, null,
  React.createElement('button', { onClick: () => onViewModeChange('preview') }, 'Read'),
  React.createElement('button', { onClick: () => onViewModeChange('editor') }, 'Edit'),
) }));
vi.mock('../src/lib/syncEngine', () => ({
  syncEngine: { triggerPush: vi.fn() },
  normalizeSyncPath: (path: string) => path,
}));
vi.mock('../src/utils/collabDocument', () => ({
  sha256Hex: () => new Promise<string>(() => {}),
  normalizeVersion: (version: number | undefined) => version ?? 0,
}));

import { LeafPaneEditor } from '../src/components/layout/LeafPaneEditor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  readFile.mockClear();
  fileExists.mockClear();
  document.body.replaceChildren();
  mockView.current = null;
});

it('shows a warm note immediately without fading it out on a tab switch', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const makeProps = (id: string, content: string) => ({
    leaf: { type: 'leaf' as const, id: 'leaf', tabs: [], activeTabId: id },
    activeTab: { id, path: `${id}.md`, name: id, isModified: false },
    cachedContent: content,
    theme: 'dark', settings: {}, allNoteNames: [], editorSuggestions: [], editorNextStepSuggestions: [],
    inlineAnnotation: null, showInlineInsight: false, isFocused: true,
    onTabSelect: vi.fn(), onTabClose: vi.fn(), onLinkClick: vi.fn(), onImagePaste: vi.fn(),
    getNoteContent: vi.fn(), onAdjustFontSize: vi.fn(), onAcceptSuggestion: vi.fn(),
    onRejectSuggestion: vi.fn(), onOpenNote: vi.fn(), onToggleInsight: vi.fn(),
    onContentChangeGlobal: vi.fn(),
  } as unknown as React.ComponentProps<typeof LeafPaneEditor>);

  act(() => root.render(React.createElement(LeafPaneEditor, makeProps('one', '# First note'))));
  expect(container.querySelector('[data-testid="note-content"]')?.textContent).toBe('# First note');
  act(() => root.render(React.createElement(LeafPaneEditor, makeProps('two', '# Second note'))));
  expect(container.querySelector('[data-testid="note-content"]')?.textContent).toBe('# Second note');
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
  expect(container.querySelector('.is-content-transitioning')).toBeNull();
  act(() => root.unmount());
});

it('shows a cold note as soon as the file is read without waiting for its hash', async () => {
  let resolveRead!: (content: string) => void;
  fileExists.mockResolvedValueOnce(true);
  readFile.mockReturnValueOnce(new Promise<string>((resolve) => { resolveRead = resolve; }));
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const props = {
    leaf: { type: 'leaf', id: 'leaf', tabs: [], activeTabId: 'cold' },
    activeTab: { id: 'cold', path: 'cold.md', name: 'cold', isModified: false },
    theme: 'dark', settings: {}, allNoteNames: [], editorSuggestions: [], editorNextStepSuggestions: [],
    inlineAnnotation: null, showInlineInsight: false, isFocused: true,
    onTabSelect: vi.fn(), onTabClose: vi.fn(), onLinkClick: vi.fn(), onImagePaste: vi.fn(),
    getNoteContent: vi.fn(), onAdjustFontSize: vi.fn(), onAcceptSuggestion: vi.fn(),
    onRejectSuggestion: vi.fn(), onOpenNote: vi.fn(), onToggleInsight: vi.fn(),
    onContentChangeGlobal: vi.fn(),
  } as unknown as React.ComponentProps<typeof LeafPaneEditor>;

  await act(async () => { root.render(React.createElement(LeafPaneEditor, props)); });
  expect(container.querySelector('[role="status"]')?.textContent).toBe('Opening note…');
  expect(container.querySelector('[data-testid="note-content"]')).toBeNull();
  await act(async () => { resolveRead('# Loaded note'); });
  expect(container.querySelector('[data-testid="note-content"]')?.textContent).toBe('# Loaded note');
  expect(container.querySelector('[role="status"]')).toBeNull();
  act(() => root.unmount());
});

it('does not publish a second content update when a warm note matches disk', async () => {
  fileExists.mockResolvedValueOnce(true);
  readFile.mockResolvedValueOnce('# Warm note');
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const onContentChangeGlobal = vi.fn();
  const props = {
    leaf: { type: 'leaf', id: 'leaf', tabs: [], activeTabId: 'warm' },
    activeTab: { id: 'warm', path: 'warm.md', name: 'warm', isModified: false },
    cachedContent: '# Warm note',
    theme: 'dark', settings: {}, allNoteNames: [], editorSuggestions: [], editorNextStepSuggestions: [],
    inlineAnnotation: null, showInlineInsight: false, isFocused: true,
    onTabSelect: vi.fn(), onTabClose: vi.fn(), onLinkClick: vi.fn(), onImagePaste: vi.fn(),
    getNoteContent: vi.fn(), onAdjustFontSize: vi.fn(), onAcceptSuggestion: vi.fn(),
    onRejectSuggestion: vi.fn(), onOpenNote: vi.fn(), onToggleInsight: vi.fn(),
    onContentChangeGlobal,
  } as unknown as React.ComponentProps<typeof LeafPaneEditor>;

  await act(async () => { root.render(React.createElement(LeafPaneEditor, props)); });
  expect(container.querySelector('[data-testid="note-content"]')?.textContent).toBe('# Warm note');
  expect(onContentChangeGlobal).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});

it('keeps unsaved cached edits when the disk still has an older version', async () => {
  fileExists.mockResolvedValueOnce(true);
  readFile.mockResolvedValueOnce('# Old version');
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const onContentChangeGlobal = vi.fn();
  const props = {
    leaf: { type: 'leaf', id: 'leaf', tabs: [], activeTabId: 'edited' },
    activeTab: { id: 'edited', path: 'edited.md', name: 'edited', isModified: true },
    cachedContent: '# Latest edit',
    theme: 'dark', settings: {}, allNoteNames: [], editorSuggestions: [], editorNextStepSuggestions: [],
    inlineAnnotation: null, showInlineInsight: false, isFocused: true,
    onTabSelect: vi.fn(), onTabClose: vi.fn(), onLinkClick: vi.fn(), onImagePaste: vi.fn(),
    getNoteContent: vi.fn(), onAdjustFontSize: vi.fn(), onAcceptSuggestion: vi.fn(),
    onRejectSuggestion: vi.fn(), onOpenNote: vi.fn(), onToggleInsight: vi.fn(),
    onContentChangeGlobal,
  } as unknown as React.ComponentProps<typeof LeafPaneEditor>;

  await act(async () => { root.render(React.createElement(LeafPaneEditor, props)); });
  expect(container.querySelector('[data-testid="note-content"]')?.textContent).toBe('# Latest edit');
  expect(onContentChangeGlobal).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});

it('shows the editor document immediately when switching to read mode during the edit debounce', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const props = {
    leaf: { type: 'leaf', id: 'leaf', tabs: [], activeTabId: 'note' },
    activeTab: { id: 'note', path: 'note.md', name: 'note', isModified: true },
    cachedContent: '# Old version',
    theme: 'dark', settings: {}, allNoteNames: [], editorSuggestions: [], editorNextStepSuggestions: [],
    inlineAnnotation: null, showInlineInsight: false, isFocused: true,
    onTabSelect: vi.fn(), onTabClose: vi.fn(), onLinkClick: vi.fn(), onImagePaste: vi.fn(),
    getNoteContent: vi.fn(), onAdjustFontSize: vi.fn(), onAcceptSuggestion: vi.fn(),
    onRejectSuggestion: vi.fn(), onOpenNote: vi.fn(), onToggleInsight: vi.fn(),
    onContentChangeGlobal: vi.fn(),
  } as unknown as React.ComponentProps<typeof LeafPaneEditor>;
  await act(async () => root.render(React.createElement(LeafPaneEditor, props)));
  await act(async () => { (Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Type'))?.click(); });
  await act(async () => { (Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Read'))?.click(); });
  expect(container.querySelector('[data-testid="note-content"]')?.textContent).toContain('# Fresh edit');
  expect(container.querySelector('[data-testid="note-content"]')?.getAttribute('data-mode')).toBe('preview');
  await act(async () => { (Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Change preview'))?.click(); });
  await act(async () => { (Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Edit'))?.click(); });
  expect(container.querySelector('[data-testid="note-content"]')?.textContent).toContain('# Preview change');
  expect(mockView.current?.dispatch).toHaveBeenCalledWith(expect.objectContaining({
    changes: expect.objectContaining({ insert: '# Preview change' }),
  }));
  await act(async () => root.unmount());
});

it('does not reuse the first note editor when another note switches modes', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const makeProps = (id: string, cachedContent: string) => ({
    leaf: { type: 'leaf', id: 'leaf', tabs: [], activeTabId: id },
    activeTab: { id, path: `${id}.md`, name: id, isModified: false },
    cachedContent,
    theme: 'dark', settings: {}, allNoteNames: [], editorSuggestions: [], editorNextStepSuggestions: [],
    inlineAnnotation: null, showInlineInsight: false, isFocused: true,
    onTabSelect: vi.fn(), onTabClose: vi.fn(), onLinkClick: vi.fn(), onImagePaste: vi.fn(),
    getNoteContent: vi.fn(), onAdjustFontSize: vi.fn(), onAcceptSuggestion: vi.fn(),
    onRejectSuggestion: vi.fn(), onOpenNote: vi.fn(), onToggleInsight: vi.fn(),
    onContentChangeGlobal: vi.fn(),
  } as unknown as React.ComponentProps<typeof LeafPaneEditor>);
  await act(async () => root.render(React.createElement(LeafPaneEditor, makeProps('first', '# First note'))));
  await act(async () => { (Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Type'))?.click(); });
  await act(async () => root.render(React.createElement(LeafPaneEditor, makeProps('second', '# Second note'))));
  await act(async () => { (Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Read'))?.click(); });
  expect(container.querySelector('[data-testid="note-content"]')?.textContent).toBe('# Second note');
  await act(async () => { (Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Edit'))?.click(); });
  expect(container.querySelector('[data-testid="note-content"]')?.textContent).toBe('# Second note');
  await act(async () => root.unmount());
});
