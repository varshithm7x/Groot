// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { EditorHeader } from '../src/components/editor/EditorHeader';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it('opens focused note actions beside the title-bar dots in a body portal', () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(React.createElement(EditorHeader, {
    filePath: 'Foundations/One.md', viewMode: 'editor', isFocused: true,
    onViewModeChange: vi.fn(),
  })));
  act(() => document.dispatchEvent(new CustomEvent('editor:format', {
    detail: { command: 'more', anchor: { x: 1000, y: 51 } },
  })));
  const item = [...document.body.querySelectorAll<HTMLButtonElement>('button')]
    .find(button => button.textContent === 'Backlinks in document')!;
  expect(item).toBeDefined();
  expect(container.contains(item)).toBe(false);
  const menu = item.parentElement as HTMLElement;
  expect(menu.style.left).toBe('795px');
  expect(menu.style.top).toBe('55px');
  act(() => root.unmount());
  container.remove();
});
