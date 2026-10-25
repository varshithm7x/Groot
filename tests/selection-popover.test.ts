import { describe, expect, it } from 'vitest';
import { positionAdjacentPopover, positionSelectionPopover } from '../src/utils/selectionPopover';

const pane = { left: 400, right: 800, top: 50, bottom: 700 };
describe('selection popover placement', () => {
  it('prefers the area above the selection without crossing pane boundaries', () => {
    const result = positionSelectionPopover({ left: 420, right: 490, top: 300, bottom: 320 }, pane, 360, 40);
    expect(result).toEqual({ left: 408, top: 252, width: 360 });
    expect(result.top + 40).toBeLessThan(300);
  });
  it('moves below a selection near the top of its pane', () => {
    const result = positionSelectionPopover({ left: 740, right: 790, top: 65, bottom: 90 }, pane, 360, 40);
    expect(result.top).toBe(98);
    expect(result.left + result.width).toBeLessThanOrEqual(792);
  });
  it('constrains overflow formatting to narrow panes and the viewport', () => {
    const result = positionSelectionPopover({ left: 410, right: 440, top: 650, bottom: 675 }, { ...pane, right: 630 }, 420, 180);
    expect(result.width).toBe(214);
    expect(result.top + 180).toBeLessThan(650);
    expect(result.left).toBeGreaterThanOrEqual(408);
    expect(result.left + result.width).toBeLessThanOrEqual(622);
  });
});

describe('selection submenu placement', () => {
  const viewport = { left: 0, right: 1000, top: 51, bottom: 740 };

  it('opens beside the selection card when there is room on the right', () => {
    expect(positionAdjacentPopover({ left: 100, right: 336, top: 200, bottom: 362 }, viewport, 236, 300))
      .toEqual({ left: 344, top: 200 });
  });

  it('opens to the left near the viewport edge and keeps tall menus visible', () => {
    expect(positionAdjacentPopover({ left: 740, right: 976, top: 630, bottom: 792 }, viewport, 236, 300))
      .toEqual({ left: 496, top: 432 });
  });
});
