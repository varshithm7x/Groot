// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

const files = vi.hoisted(() => new Map<string, string>([
  ['first.md', '# First note'],
  ['second.md', '# Second note'],
]));
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
vi.mock('../src/lib/localdb', () => ({
  localDB: { getClientId: vi.fn().mockResolvedValue('test-client'), getNoteByPath: vi.fn().mockResolvedValue(null) },
}));
vi.mock('y-codemirror.next', () => ({ yCollab: () => [], yUndoManagerKeymap: [] }));
vi.mock('../src/components/editor/Editor', () => ({
  Editor: ({ documentPath, content }: { documentPath: string; content: string }) =>
    React.createElement('div', { 'data-testid': 'editing-note', 'data-path': documentPath }, content),
}));

import { LeafPaneEditor } from '../src/components/layout/LeafPaneEditor';
import { collaborationEngine } from '../src/lib/collaborationEngine';
import { yDocManager } from '../src/lib/yDocManager';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it('waits for the active note binding before mounting Edit after a collaborative tab switch', async () => {
  const openSecond = Promise.withResolvers<Awaited<ReturnType<typeof yDocManager.openDoc>>>();
  const makeDoc = (path: string) => ({
    doc: { guid: path, transact: (callback: () => void) => callback() },
    text: { toString: () => files.get(path), length: files.get(path)?.length ?? 0 },
    awareness: {}, undoManager: {}, provider: {},
  }) as unknown as Awaited<ReturnType<typeof yDocManager.openDoc>>;
  const openDoc = vi.spyOn(yDocManager, 'openDoc').mockImplementation(async (path) =>
    path === 'first.md' ? makeDoc(path) : openSecond.promise);
  const closeDoc = vi.spyOn(yDocManager, 'closeDoc').mockImplementation(() => {});
  const activeSpace = vi.spyOn(collaborationEngine, 'activeSpaceId', 'get').mockReturnValue('space');
  const paused = vi.spyOn(collaborationEngine, 'collabPaused', 'get').mockReturnValue(false);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const tabs = [
    { id: 'first', path: 'first.md', name: 'First', isModified: false },
    { id: 'second', path: 'second.md', name: 'Second', isModified: false },
  ];
  const props = (active: typeof tabs[number]) => ({
    leaf: { type: 'leaf' as const, id: 'leaf', tabs, activeTabId: active.id },
    activeTab: active, cachedContent: files.get(active.path),
    theme: 'dark', settings: {}, allNoteNames: [], editorSuggestions: [], editorNextStepSuggestions: [],
    inlineAnnotation: null, showInlineInsight: false, isFocused: true,
    onTabSelect: vi.fn(), onTabClose: vi.fn(), onLinkClick: vi.fn(), onImagePaste: vi.fn(),
    getNoteContent: vi.fn(), onAdjustFontSize: vi.fn(), onAcceptSuggestion: vi.fn(),
    onRejectSuggestion: vi.fn(), onOpenNote: vi.fn(), onToggleInsight: vi.fn(),
    onContentChangeGlobal: vi.fn(),
  } as unknown as React.ComponentProps<typeof LeafPaneEditor>);
  try {
    await act(async () => root.render(React.createElement(LeafPaneEditor, props(tabs[0]))));
    expect(host.querySelector('[data-testid="editing-note"]')?.getAttribute('data-path')).toBe('first.md');
    await act(async () => root.render(React.createElement(LeafPaneEditor, props(tabs[1]))));
    expect(host.querySelector('[data-testid="editing-note"]')).toBeNull();
    await act(async () => openSecond.resolve(makeDoc('second.md')));
    expect(host.querySelector('[data-testid="editing-note"]')?.getAttribute('data-path')).toBe('second.md');
    expect(host.querySelector('[data-testid="editing-note"]')?.textContent).toBe('# Second note');
  } finally {
    await act(async () => root.unmount());
    host.remove();
    openDoc.mockRestore(); closeDoc.mockRestore(); activeSpace.mockRestore(); paused.mockRestore();
  }
});

it('rebinds the active note when the collaborative space changes', async () => {
  let currentSpace = 'first-space';
  const openSecond = Promise.withResolvers<Awaited<ReturnType<typeof yDocManager.openDoc>>>();
  const makeDoc = (space: string) => ({
    doc: { guid: space, transact: (callback: () => void) => callback() },
    text: { toString: () => space, length: space.length },
    awareness: {}, undoManager: {}, provider: {},
  }) as unknown as Awaited<ReturnType<typeof yDocManager.openDoc>>;
  const openDoc = vi.spyOn(yDocManager, 'openDoc').mockImplementation(async (_path, space) =>
    space === 'first-space' ? makeDoc(space) : openSecond.promise);
  const closeDoc = vi.spyOn(yDocManager, 'closeDoc').mockImplementation(() => {});
  const activeSpace = vi.spyOn(collaborationEngine, 'activeSpaceId', 'get').mockImplementation(() => currentSpace);
  const paused = vi.spyOn(collaborationEngine, 'collabPaused', 'get').mockReturnValue(false);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const active = { id: 'note', path: 'first.md', name: 'First', isModified: false };
  const props = () => ({
    leaf: { type: 'leaf' as const, id: 'leaf', tabs: [active], activeTabId: active.id },
    activeTab: active, cachedContent: files.get(active.path),
    theme: 'dark', settings: {}, allNoteNames: [], editorSuggestions: [], editorNextStepSuggestions: [],
    inlineAnnotation: null, showInlineInsight: false, isFocused: true,
    onTabSelect: vi.fn(), onTabClose: vi.fn(), onLinkClick: vi.fn(), onImagePaste: vi.fn(),
    getNoteContent: vi.fn(), onAdjustFontSize: vi.fn(), onAcceptSuggestion: vi.fn(),
    onRejectSuggestion: vi.fn(), onOpenNote: vi.fn(), onToggleInsight: vi.fn(),
    onContentChangeGlobal: vi.fn(),
  }) as unknown as React.ComponentProps<typeof LeafPaneEditor>;
  try {
    await act(async () => root.render(React.createElement(LeafPaneEditor, props())));
    expect(host.querySelector('[data-testid="editing-note"]')?.textContent).toBe('first-space');

    currentSpace = 'second-space';
    await act(async () => root.render(React.createElement(LeafPaneEditor, props())));
    expect(closeDoc).toHaveBeenCalledWith('first.md', 'first-space');
    expect(openDoc).toHaveBeenCalledWith('first.md', 'second-space');
    expect(host.querySelector('[data-testid="editing-note"]')).toBeNull();

    await act(async () => openSecond.resolve(makeDoc('second-space')));
    expect(host.querySelector('[data-testid="editing-note"]')?.textContent).toBe('second-space');
  } finally {
    await act(async () => root.unmount());
    host.remove();
    openDoc.mockRestore(); closeDoc.mockRestore(); activeSpace.mockRestore(); paused.mockRestore();
  }
});
