import { readFileSync } from "node:fs";
// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { TitleBar } from '../src/components/layout/TitleBar';
vi.mock('../src/components/layout/TabPreviewCard', () => ({ TabPreviewCard: () => null }));

let root: Root;
let container: HTMLDivElement;
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const tabs = [{ id: 'one', path: 'One.md', name: 'One', isModified: false }, { id: 'two', path: 'Two.md', name: 'Two', isModified: true }];
function render() {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  const onTabSelect = vi.fn(); const onTabClose = vi.fn(); const onSearch = vi.fn();
  act(() => root.render(React.createElement(TitleBar, { theme: 'dark', tabs, activeTabId: 'one', onTabSelect, onTabClose, onSearch })));
  return { onTabSelect, onTabClose, onSearch };
}
afterEach(() => { act(() => root?.unmount()); container?.remove(); });

it('supports arrow navigation in the existing document tab strip', () => {
  const { onTabSelect } = render();
  const first = container.querySelector<HTMLElement>('[data-tab-id="one"]')!;
  act(() => first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
  expect(onTabSelect).toHaveBeenCalledWith('two');
  expect(document.activeElement).toBe(container.querySelector('[data-tab-id="two"]'));
});

it('highlights the clicked tab before its parent finishes switching notes', () => {
  const { onTabSelect } = render();
  const first = container.querySelector<HTMLElement>('[data-tab-id="one"]')!;
  const second = container.querySelector<HTMLElement>('[data-tab-id="two"]')!;
  const startTransition = vi.spyOn(React, 'startTransition');
  act(() => second.click());
  expect(onTabSelect).toHaveBeenCalledWith('two');
  expect(startTransition).not.toHaveBeenCalled();
  startTransition.mockRestore();
  expect(second.getAttribute('aria-selected')).toBe('true');
  expect(first.getAttribute('aria-selected')).toBe('false');

  act(() => root.render(React.createElement(TitleBar, { theme: 'dark', tabs, activeTabId: 'two', onTabSelect })));
  expect(second.getAttribute('aria-selected')).toBe('true');
});

it('allows the native close-button keyboard event instead of treating it as tab activation', async () => {
  const { onTabSelect, onTabClose } = render();
  const close = container.querySelector<HTMLButtonElement>('[aria-label="Close One"]')!;
  const key = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
  act(() => close.dispatchEvent(key));
  expect(key.defaultPrevented).toBe(false);
  expect(onTabSelect).not.toHaveBeenCalled();
  act(() => close.click());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 200)); });
  expect(onTabClose).toHaveBeenCalledWith('one');
});

it('puts the view switcher in the title bar and anchors document actions to its dots', () => {
  render();
  const switcher = container.querySelector<HTMLButtonElement>('[aria-label="Reading view"]')!;
  const toggle = vi.fn();
  document.addEventListener('studio:toggle-view-mode', toggle);
  act(() => switcher.click());
  expect(toggle).toHaveBeenCalledTimes(1);
  document.removeEventListener('studio:toggle-view-mode', toggle);
  act(() => document.dispatchEvent(new CustomEvent('studio:note-view-mode', { detail: { path: 'One.md', mode: 'preview' } })));
  expect(container.querySelector('[aria-label="Editing view"]')).not.toBeNull();

  const menu = container.querySelector<HTMLButtonElement>('[aria-label="Document menu"]')!;
  menu.getBoundingClientRect = () => ({ right: 1000, bottom: 51 } as DOMRect);
  const openMenu = vi.fn();
  document.addEventListener('editor:format', openMenu);
  act(() => menu.click());
  expect((openMenu.mock.calls[0][0] as CustomEvent).detail).toEqual({ command: 'more', anchor: { x: 1000, y: 51 } });
  document.removeEventListener('editor:format', openMenu);
});

it('puts the view switcher before search without swapping their actions', () => {
  const { onSearch } = render();
  const controls = [...container.querySelectorAll<HTMLButtonElement>('[aria-label="Reading view"], [aria-label="Search notes"]')];
  expect(controls.map(control => control.getAttribute('aria-label'))).toEqual(['Reading view', 'Search notes']);
  const toggle = vi.fn();
  document.addEventListener('studio:toggle-view-mode', toggle);
  act(() => controls[0].click());
  act(() => controls[1].click());
  expect(toggle).toHaveBeenCalledTimes(1);
  expect(onSearch).toHaveBeenCalledTimes(1);
  document.removeEventListener('studio:toggle-view-mode', toggle);
});

it('does not place the vault breadcrumb among document tabs', () => {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  act(() => root.render(React.createElement(TitleBar, { theme: 'dark', tabs, activeTabId: 'one', breadcrumb: 'Engineers' })));
  expect(container.textContent).not.toContain('Engineers');
});

it('lets document tabs use free title-bar width before overflowing', () => {
  const css = readFileSync('src/styles/studio.css', 'utf8');
  expect(css).not.toMatch(/\.studio-titlebar-tabs\s*\{[^}]*max-width:/);
  const source = readFileSync('src/components/layout/TitleBar.tsx', 'utf8');
  expect(source).toContain('studio-titlebar-tabs relative z-[2] flex h-full min-w-0 flex-1');
});

it('keeps grouped tabs together and exposes the group label as a keyboard-accessible control', () => {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  const onToggleGroupCollapse = vi.fn();
  const onChangeGroupColor = vi.fn();
  const group = { id: 'group-one', vault_path: '/vault', name: 'Research', color: '#cccccc', created_at: '', updated_at: '', auto_save_enabled: false, layout_state: null };
  act(() => root.render(React.createElement(TitleBar, {
    theme: 'dark',
    tabs: [{ ...tabs[0], groupId: group.id }, { ...tabs[1], groupId: group.id }, { id: 'three', path: 'Three.md', name: 'Three', isModified: false }],
    activeTabId: 'one',
    groups: [group],
    activeGroupId: group.id,
    onToggleGroupCollapse,
    onChangeGroupColor,
  })));
  const groupButton = container.querySelector<HTMLButtonElement>('[aria-label="Research group, 2 tabs"]');
  expect(groupButton?.tagName).toBe('BUTTON');
  expect(groupButton?.style.backgroundColor).toBe('rgb(204, 204, 204)');
  expect(groupButton?.getAttribute('aria-expanded')).toBe('true');
  expect(groupButton?.compareDocumentPosition(container.querySelector('[data-tab-id="one"]')!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  expect((groupButton?.parentElement as HTMLElement).style.getPropertyValue('--tab-group-color')).toBe('#cccccc');
  expect(container.querySelector('[data-tab-id="one"]')?.parentElement?.classList.contains('studio-grouped-slot')).toBe(true);
  expect((container.querySelector('[data-tab-id="one"]')?.parentElement as HTMLElement).style.getPropertyValue('--tab-group-color')).toBe('#cccccc');
  expect(container.querySelector('[data-tab-id="one"]')?.parentElement?.classList.contains('studio-group-end')).toBe(false);
  expect(container.querySelector('[data-tab-id="two"]')?.parentElement?.classList.contains('studio-group-end')).toBe(true);
  expect(container.querySelector('[data-tab-id="three"]')?.parentElement?.classList.contains('studio-grouped-slot')).toBe(false);
  expect((container.querySelector('[data-tab-id="three"]')?.parentElement as HTMLElement).style.getPropertyValue('--tab-group-color')).toBe('');
  expect(container.querySelector('[data-tab-id="one"]')?.querySelector('.absolute.top-0')).toBeNull();
  act(() => groupButton?.click());
  expect(onToggleGroupCollapse).toHaveBeenCalledWith(group.id);
  act(() => groupButton?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
  act(() => container.querySelector<HTMLButtonElement>('[data-tooltip="Blue"]')?.click());
  expect(onChangeGroupColor).toHaveBeenCalledWith(group.id, '#1a73e8');
});
