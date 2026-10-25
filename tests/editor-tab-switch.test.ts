// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { undo } from '@codemirror/commands';
import type { EditorView } from '@codemirror/view';
import { expect, it, vi } from 'vitest';
import { Editor } from '../src/components/editor/Editor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => new DOMRect();

it('reuses the previous note state when switching back, including undo history', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  let view: EditorView | null = null;
  const tabs = [
    { id: 'one', path: 'one.md', name: 'one', isModified: false },
    { id: 'two', path: 'two.md', name: 'two', isModified: false },
  ];
  const shared = {
    tabs, viewMode: 'editor' as const, onAdjustFontSize: vi.fn(), onTabSelect: vi.fn(),
    onTabClose: vi.fn(), onContentChange: vi.fn(), onViewModeChange: vi.fn(),
    onLinkClick: vi.fn(), onEditorViewReady: (current: EditorView | null) => { view = current; },
  };

  await act(async () => root.render(React.createElement(Editor, { ...shared, activeTabId: 'one', content: 'alpha' })));
  const firstView = view;
  act(() => view!.dispatch({ changes: { from: 5, insert: '!' } }));
  expect(view!.state.doc.toString()).toBe('alpha!');

  await act(async () => root.render(React.createElement(Editor, { ...shared, activeTabId: 'two', content: 'bravo' })));
  const secondView = view;
  expect(view!.state.doc.toString()).toBe('bravo');

  await act(async () => root.render(React.createElement(Editor, { ...shared, activeTabId: 'one', content: 'alpha!' })));
  expect(view).toBe(firstView);
  expect(view!.state.doc.toString()).toBe('alpha!');
  act(() => { expect(undo(view!)).toBe(true); });
  expect(view!.state.doc.toString()).toBe('alpha');

  await act(async () => root.render(React.createElement(Editor, { ...shared, activeTabId: 'two', content: 'bravo' })));
  expect(view).toBe(secondView);
  expect(view!.state.doc.toString()).toBe('bravo');
  expect(host.querySelectorAll('.cm-editor')).toHaveLength(1);
  expect(firstView!.dom.isConnected).toBe(false);
  expect(secondView!.dom.isConnected).toBe(true);

  shared.onContentChange.mockClear();
  act(() => firstView!.dispatch({ changes: { from: firstView!.state.doc.length, insert: '?' } }));
  expect(shared.onContentChange).not.toHaveBeenCalled();

  await act(async () => root.unmount());
  expect(host.querySelectorAll('.cm-editor')).toHaveLength(0);
  host.remove();
});

it('uses the active pane path even if its tab list has not caught up', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  let view: EditorView | null = null;
  const shared = {
    tabs: [{ id: 'first', path: 'first.md', name: 'First', isModified: false }],
    viewMode: 'editor' as const, onAdjustFontSize: vi.fn(), onTabSelect: vi.fn(),
    onTabClose: vi.fn(), onContentChange: vi.fn(), onViewModeChange: vi.fn(),
    onLinkClick: vi.fn(), onEditorViewReady: (current: EditorView | null) => { view = current; },
  };
  await act(async () => root.render(React.createElement(Editor, {
    ...shared, activeTabId: 'first', documentPath: 'first.md', content: '# First',
  })));
  expect(view!.state.doc.toString()).toBe('# First');
  await act(async () => root.render(React.createElement(Editor, {
    ...shared, activeTabId: 'second', documentPath: 'second.md', content: '# Second',
  })));
  expect(view!.state.doc.toString()).toBe('# Second');
  expect(view!.dom.dataset.notePath).toBe('second.md');
  const visibleEditor = [...host.querySelectorAll<HTMLElement>('.cm-editor')].find(element => element.style.display !== 'none');
  expect(visibleEditor).toBe(view!.dom);
  expect(visibleEditor?.textContent).toContain('Second');
  await act(async () => root.unmount());
  host.remove();
});

it('renders an image note in Read without a duplicate hidden editor and reuses Edit on return', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  let view: EditorView | null = null;
  const content = `# Images\n\n![photo](data:image/png;base64,${'A'.repeat(100_000)})`;
  const shared = {
    tabs: [{ id: 'image', path: 'image.md', name: 'Image', isModified: false }],
    activeTabId: 'image', content,
    onAdjustFontSize: vi.fn(), onTabSelect: vi.fn(), onTabClose: vi.fn(),
    onContentChange: vi.fn(), onViewModeChange: vi.fn(), onLinkClick: vi.fn(),
    onEditorViewReady: (current: EditorView | null) => { view = current; },
  };

  try {
    await act(async () => root.render(React.createElement(Editor, { ...shared, viewMode: 'preview' })));
    expect(host.querySelector('.markdown-preview img')).not.toBeNull();
    expect(host.querySelector('.cm-editor')).toBeNull();

    await act(async () => root.render(React.createElement(Editor, { ...shared, viewMode: 'editor' })));
    const imageView = view;
    expect(imageView).not.toBeNull();
    expect(host.querySelector('.cm-image-widget-image')).not.toBeNull();

    await act(async () => root.render(React.createElement(Editor, { ...shared, viewMode: 'preview' })));
    expect(host.querySelector('.cm-editor')).toBeNull();
    expect(imageView!.dom.isConnected).toBe(false);

    await act(async () => root.render(React.createElement(Editor, { ...shared, viewMode: 'editor' })));
    expect(view).toBe(imageView);
    expect(host.querySelector('.cm-image-widget-image')).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

it('detaches image widgets when switching from an image note to a text note', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  let view: EditorView | null = null;
  const tabs = [
    { id: 'image', path: 'image.md', name: 'Image', isModified: false },
    { id: 'text', path: 'text.md', name: 'Text', isModified: false },
  ];
  const shared = {
    tabs, viewMode: 'editor' as const,
    onAdjustFontSize: vi.fn(), onTabSelect: vi.fn(), onTabClose: vi.fn(),
    onContentChange: vi.fn(), onViewModeChange: vi.fn(), onLinkClick: vi.fn(),
    onEditorViewReady: (current: EditorView | null) => { view = current; },
  };
  const imageContent = `![photo](data:image/png;base64,${'A'.repeat(100_000)})`;

  try {
    await act(async () => root.render(React.createElement(Editor, {
      ...shared, activeTabId: 'image', content: imageContent,
    })));
    const imageView = view;
    expect(host.querySelector('.cm-image-widget-image')).not.toBeNull();

    await act(async () => root.render(React.createElement(Editor, {
      ...shared, activeTabId: 'text', content: '# Plain text',
    })));
    expect(imageView!.dom.isConnected).toBe(false);
    expect(host.querySelector('.cm-image-widget-image')).toBeNull();
    expect(host.querySelector('.cm-editor')?.textContent).toContain('Plain text');

    await act(async () => root.render(React.createElement(Editor, {
      ...shared, activeTabId: 'image', content: imageContent,
    })));
    expect(view).toBe(imageView);
    expect(host.querySelector('.cm-image-widget-image')).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
