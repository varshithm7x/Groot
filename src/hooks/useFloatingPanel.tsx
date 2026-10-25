import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import { readStudioPreference, writeStudioPreference } from "../utils/studioTools";

export interface PanelGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const MARGIN = 12;
const TOP = 62;
const BOTTOM = 60;
let frontPanel = 3100;

export function clampPanelGeometry(
  value: PanelGeometry,
  viewportWidth: number,
  viewportHeight: number,
  minWidth = 300,
  minHeight = 240,
): PanelGeometry {
  const safe = {
    x: Number.isFinite(value?.x) ? value.x : MARGIN,
    y: Number.isFinite(value?.y) ? value.y : TOP,
    width: Number.isFinite(value?.width) ? value.width : minWidth,
    height: Number.isFinite(value?.height) ? value.height : minHeight,
  };
  const availableWidth = Math.max(180, viewportWidth - MARGIN * 2);
  const availableHeight = Math.max(160, viewportHeight - TOP - BOTTOM);
  const width = Math.min(Math.max(Math.min(minWidth, availableWidth), safe.width), availableWidth);
  const height = Math.min(Math.max(Math.min(minHeight, availableHeight), safe.height), availableHeight);
  return {
    x: Math.min(Math.max(MARGIN, safe.x), viewportWidth - width - MARGIN),
    y: Math.min(Math.max(TOP, safe.y), viewportHeight - height - BOTTOM),
    width,
    height,
  };
}

export function useFloatingPanel(
  id: string,
  side: "left" | "right",
  minWidth = 300,
  minHeight = 240,
) {
  const [geometry, setGeometry] = useState<PanelGeometry>(() => {
    const fallback = {
      x: side === "left" ? 20 : window.innerWidth - 434,
      y: window.innerHeight - (side === "left" ? 430 : 510),
      width: side === "left" ? 340 : 410,
      height: side === "left" ? 370 : 420,
    };
    return clampPanelGeometry(
      readStudioPreference<PanelGeometry>(`panel.${id}`, fallback),
      window.innerWidth,
      window.innerHeight,
      minWidth,
      minHeight,
    );
  });
  const geometryRef = useRef(geometry);
  const elementRef = useRef<HTMLElement | null>(null);
  const draggingRef = useRef(false);
  const cancelDragRef = useRef<(() => void) | null>(null);
  const [zIndex, setZIndex] = useState(() => ++frontPanel);
  if (!draggingRef.current) geometryRef.current = geometry;

  const attach = (element: HTMLElement | null) => { elementRef.current = element; };
  const paint = (next: PanelGeometry) => {
    geometryRef.current = next;
    const element = elementRef.current;
    if (!element?.classList.contains("is-floating")) return;
    element.style.left = `${next.x}px`;
    element.style.top = `${next.y}px`;
    element.style.width = `${next.width}px`;
    element.style.height = `${next.height}px`;
  };
  const bringToFront = useCallback(() => setZIndex(++frontPanel), []);

  useEffect(() => { writeStudioPreference(`panel.${id}`, geometry); }, [geometry, id]);
  useEffect(() => () => cancelDragRef.current?.(), []);
  useEffect(() => {
    const onResize = () => {
      const next = clampPanelGeometry(
        geometryRef.current,
        window.innerWidth,
        window.innerHeight,
        minWidth,
        minHeight,
      );
      paint(next);
      setGeometry(next);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [minWidth, minHeight]);

  const start = (event: React.PointerEvent<HTMLElement>, edge?: Edge) => {
    if (event.button !== 0) return;
    if (!edge && (event.target as HTMLElement).closest(
      "button, input, textarea, select, a, [contenteditable], [data-panel-no-drag]",
    )) return;
    event.preventDefault();
    cancelDragRef.current?.();
    draggingRef.current = true;
    bringToFront();
    const original = geometryRef.current;
    const startX = event.clientX;
    const startY = event.clientY;

    const move = (pointer: PointerEvent) => {
      const dx = pointer.clientX - startX;
      const dy = pointer.clientY - startY;
      if (!edge) {
        paint(clampPanelGeometry(
          { ...original, x: original.x + dx, y: original.y + dy },
          window.innerWidth, window.innerHeight, minWidth, minHeight,
        ));
        return;
      }

      const minW = Math.min(minWidth, window.innerWidth - MARGIN * 2);
      const minH = Math.min(minHeight, window.innerHeight - TOP - BOTTOM);
      const x = edge.includes("w")
        ? Math.min(original.x + original.width - minW, Math.max(MARGIN, original.x + dx))
        : original.x;
      const y = edge.includes("n")
        ? Math.min(original.y + original.height - minH, Math.max(TOP, original.y + dy))
        : original.y;
      const width = edge.includes("w")
        ? original.width + original.x - x
        : edge.includes("e")
          ? Math.max(minW, Math.min(original.width + dx, window.innerWidth - original.x - MARGIN))
          : original.width;
      const height = edge.includes("n")
        ? original.height + original.y - y
        : edge.includes("s")
          ? Math.max(minH, Math.min(original.height + dy, window.innerHeight - original.y - BOTTOM))
          : original.height;
      paint(clampPanelGeometry(
        { x, y, width, height },
        window.innerWidth, window.innerHeight, minWidth, minHeight,
      ));
    };
    const cleanup = () => {
      draggingRef.current = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      cancelDragRef.current = null;
    };
    const stop = () => {
      cleanup();
      setGeometry({ ...geometryRef.current });
    };
    cancelDragRef.current = cleanup;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  };

  const onHeaderKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || !event.altKey ||
        !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    bringToFront();
    const step = event.shiftKey ? 20 : 10;
    const dx = event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
    const dy = event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0;
    setGeometry(current => clampPanelGeometry(
      event.shiftKey
        ? { ...current, width: current.width + dx, height: current.height + dy }
        : { ...current, x: current.x + dx, y: current.y + dy },
      window.innerWidth, window.innerHeight, minWidth, minHeight,
    ));
  };

  return { geometry, zIndex, attach, bringToFront, start, onHeaderKeyDown };
}

export function PanelResizeHandles({ onStart }: {
  onStart: (event: React.PointerEvent<HTMLElement>, edge: Edge) => void;
}) {
  const edges: Edge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
  return <>
    {edges.map(edge => <div
      key={edge}
      className={`studio-panel-resize studio-panel-resize-${edge}`}
      aria-hidden="true"
      onPointerDown={event => onStart(event, edge)}
    />)}
    <span className="studio-panel-resize-affordance" aria-hidden="true" />
  </>;
}
