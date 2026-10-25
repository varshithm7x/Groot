interface RectEdges {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Keep selection tools in their pane and prefer the space above the selection. */
export function positionSelectionPopover(
  selection: RectEdges,
  bounds: RectEdges,
  requestedWidth: number,
  height: number,
) {
  const margin = 8;
  const width = Math.max(
    0,
    Math.min(requestedWidth, bounds.right - bounds.left - margin * 2),
  );
  const above = selection.top - height - margin;
  const below = selection.bottom + margin;
  const top =
    above >= bounds.top + margin
      ? above
      : below + height <= bounds.bottom - margin
        ? below
        : Math.max(
            bounds.top + margin,
            Math.min(above, bounds.bottom - height - margin),
          );
  const left = Math.max(
    bounds.left + margin,
    Math.min(
      (selection.left + selection.right - width) / 2,
      bounds.right - width - margin,
    ),
  );
  return { left, top, width };
}

/** Place a submenu beside its parent card, keeping it inside the visible window. */
export function positionAdjacentPopover(
  anchor: RectEdges,
  bounds: RectEdges,
  width: number,
  height: number,
) {
  const gap = 8;
  const right = anchor.right + gap;
  const left = anchor.left - width - gap;
  const rightFits = right + width <= bounds.right - gap;
  const leftFits = left >= bounds.left + gap;
  const preferRight = rightFits || (!leftFits && bounds.right - anchor.right >= anchor.left - bounds.left);
  const desiredLeft = preferRight ? right : left;
  return {
    left: Math.max(bounds.left + gap, Math.min(desiredLeft, bounds.right - width - gap)),
    top: Math.max(bounds.top + gap, Math.min(anchor.top, bounds.bottom - height - gap)),
  };
}
