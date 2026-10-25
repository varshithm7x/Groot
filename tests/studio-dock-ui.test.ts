// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Ribbon } from '../src/components/layout/Ribbon';
import { readStudioPreference } from '../src/utils/studioTools';

let root: Root;
let container: HTMLDivElement;
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const defaults = { onForge: vi.fn(), onSettings: vi.fn(), onToggleExplorer: vi.fn(), onSearch: vi.fn(), onCanvas: vi.fn(), onThoughtModel: vi.fn() };
const button = (name: string) => [...document.body.querySelectorAll<HTMLButtonElement>('button')].find(el => el.getAttribute('aria-label') === name || el.textContent === name)!;
beforeEach(() => { localStorage.clear(); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); vi.clearAllMocks(); });

it('keeps labeled defaults when a plugin registers and runs its real callback', () => {
  const callback = vi.fn();
  act(() => root.render(React.createElement(Ribbon, { ...defaults, pluginRibbonActions: [{ pluginId: 'calendar', title: 'Calendar', icon: 'calendar', callback }] })));
  expect(button('Library').textContent).toBe('Library');
  expect(button('Ask GROOT').textContent).toBe('Ask GROOT');
  act(() => button('More tools').click());
  const calendar = [...document.body.querySelectorAll<HTMLButtonElement>('.studio-tool-action')].find(el => el.textContent === 'Calendar')!;
  act(() => calendar.click());
  expect(callback).toHaveBeenCalledTimes(1);
});

it('pins, reorders and unpins without losing persisted order', () => {
  act(() => root.render(React.createElement(Ribbon, { ...defaults, extraTools: [{ id: 'outline', label: 'Outline', icon: 'list', run: vi.fn() }] })));
  act(() => button('More tools').click());
  act(() => button('Pin Outline').click());
  act(() => button('Customize dock…').click());
  act(() => button('Move Outline left').click());
  expect(readStudioPreference('dock', [])).toEqual(['library', 'search', 'forge', 'canvas', 'outline', 'ai']);
  act(() => button('Unpin Outline').click());
  expect(readStudioPreference('dock', [])).toEqual(['library', 'search', 'forge', 'canvas', 'ai']);
});

it('shows newly registered tools and restores focus on Escape', () => {
  act(() => root.render(React.createElement(Ribbon, defaults)));
  act(() => button('More tools').click());
  act(() => root.render(React.createElement(Ribbon, { ...defaults, extraTools: [{ id: 'new-plugin', label: 'New plugin tool', icon: 'file', category: 'Plugins', run: vi.fn() }] })));
  expect(document.body.textContent).toContain('New plugin tool');
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(button('More tools'));
});

it('recovers from a corrupt stored preference', () => {
  localStorage.setItem('openonyx.studio.dock', '{broken');
  act(() => root.render(React.createElement(Ribbon, defaults)));
  expect(button('Library')).toBeDefined();
});


it('keeps the viewport dock outside the workspace stacking context beneath the footer', () => {
  container.className = 'workspace';
  container.style.position = 'relative';
  container.style.zIndex = '1';
  container.style.overflow = 'hidden';
  const footer = document.createElement('div');
  footer.className = 'onyx-statusbar';
  footer.style.position = 'relative';
  footer.style.zIndex = '180';
  document.body.append(footer);
  try {
    act(() => root.render(React.createElement(Ribbon, defaults)));
    const dock = document.querySelector<HTMLElement>('[aria-label="Workspace tools"]')!;
    expect(dock.parentElement).toBe(document.body);
    expect(container.contains(dock)).toBe(false);
    expect(document.body.contains(button('Library'))).toBe(true);
    act(() => button('More tools').click());
    expect(dock.contains(document.querySelector('[aria-label="Tools"]'))).toBe(true);
  } finally {
    footer.remove();
  }
});

it('shows unpinned and width-hidden tools in More while keeping customization separate', () => {
  act(() => root.render(React.createElement(Ribbon, { ...defaults, extraTools: [{ id: 'outline', label: 'Outline', icon: 'list', run: vi.fn() }] })));
  act(() => button('More tools').click());
  const listed = [...document.body.querySelectorAll('.studio-tool-action')].map(el => el.textContent);
  expect(listed).toContain('Outline');
  expect(listed).not.toContain('Library');
  expect(document.body.querySelector('[aria-label="Reset dock to defaults"]')).toBeNull();
  act(() => button('Customize dock…').click());
  expect(button('Move Search left')).toBeDefined();
  expect(button('Reset dock to defaults')).toBeDefined();
});
