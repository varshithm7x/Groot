import { describe, expect, it } from 'vitest';
import { fitDockTools, isBuiltInRightSidebarTab, normalizePinnedTools } from '../src/utils/studioTools';

describe('studio dock preferences and overflow', () => {
  it('preserves missing plugin IDs and stable order while rejecting invalid preferences', () => {
    expect(normalizePinnedTools(['library', null, 'plugin:calendar:open', 'library', 3, '', 'forge']))
      .toEqual(['library', 'plugin:calendar:open', 'forge']);
  });
  it('recovers safely from a stored value of the wrong type', () => {
    expect(normalizePinnedTools({ pins: [] })).toEqual(['library', 'search', 'forge', 'canvas', 'ai']);
  });
  it('replaces a saved Graph dock pin with Forge', () => {
    expect(normalizePinnedTools(['library', 'graph', 'forge'])).toEqual(['library', 'forge']);
  });
  it('keeps Forge selected when no plugin view is registered', () => {
    expect(isBuiltInRightSidebarTab('forge')).toBe(true);
    expect(isBuiltInRightSidebarTab('outline')).toBe(true);
    expect(isBuiltInRightSidebarTab('plugin:calendar')).toBe(false);
  });
  it('reserves room for More even when no other tool fits', () => {
    const tools = [{ label: 'Library' }, { label: 'Search' }, { label: 'Forge' }];
    expect(fitDockTools(tools, 100)).toEqual([]);
    expect(fitDockTools(tools, 230)).toEqual([tools[0]]);
    expect(fitDockTools(tools, 600)).toEqual(tools);
  });
  it('keeps a prefix of the pinned order instead of rearranging tools to fill gaps', () => {
    const tools = [{ label: 'Library' }, { label: 'A tool with a very long name' }, { label: 'Forge' }];
    expect(fitDockTools(tools, 340)).toEqual([tools[0]]);
  });
});
