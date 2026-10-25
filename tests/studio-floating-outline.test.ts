// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { clampPanelGeometry, useFloatingPanel } from "../src/hooks/useFloatingPanel";
import { OutlinePane } from "../src/components/panels/OutlinePane";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("floating panel geometry", () => {
  it("keeps restored panels usable after the window shrinks", () => {
    expect(clampPanelGeometry({ x: 1450, y: 810, width: 410, height: 460 }, 760, 680)).toEqual({ x: 338, y: 160, width: 410, height: 460 });
    const tiny = clampPanelGeometry({ x: -10, y: -10, width: 600, height: 600 }, 320, 300);
    expect(tiny).toEqual({ x: 12, y: 62, width: 296, height: 178 });
  });
});

describe("automatic note outline", () => {
  it("updates with headings, excludes fenced examples, and follows the reading position", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const go = vi.fn();
    act(() => root.render(React.createElement(OutlinePane, { compact: true, visible: true, documentPath: "one.md", content: "# Note\n## First\n### Detail\n```md\n## Fake\n```\n## Second", onHeadingClick: go })));
    const buttons = [...container.querySelectorAll<HTMLButtonElement>("button")];
    expect(buttons.map(button => button.textContent)).toEqual(["Note", "First", "Detail", "Second"]);
    expect(buttons.map(button => button.style.paddingLeft)).toEqual(["12px", "24px", "36px", "24px"]);
    act(() => document.dispatchEvent(new CustomEvent("editor:scroll-line", { detail: { path: "one.md", line: 7 } })));
    expect(container.querySelector('[aria-current="location"]')?.textContent).toBe("Second");
    act(() => document.dispatchEvent(new CustomEvent("editor:scroll-line", { detail: { path: "other.md", line: 1 } })));
    expect(container.querySelector('[aria-current="location"]')?.textContent).toBe("Second");
    act(() => buttons[1].click());
    expect(go).toHaveBeenCalledWith(2);
    act(() => root.render(React.createElement(OutlinePane, { compact: true, visible: true, documentPath: "one.md", content: "# Updated\n## New section", onHeadingClick: go })));
    expect([...container.querySelectorAll("button")].map(button => button.textContent)).toEqual(["Updated", "New section"]);
    act(() => root.render(React.createElement(OutlinePane, { compact: true, visible: true, documentPath: "one.md", content: "Body without headings", onHeadingClick: go })));
    expect(container.querySelector("nav")).toBeNull();
    act(() => root.unmount());
    container.remove();
  });
});

function DraggableFixture() {
  const panel = useFloatingPanel("fixture", "left");
  return React.createElement("div", { ref: panel.attach, className: "is-floating", style: { position: "fixed", left: panel.geometry.x, top: panel.geometry.y, width: panel.geometry.width, height: panel.geometry.height } },
    React.createElement("div", { className: "header", onPointerDown: panel.start }, "Move"),
    React.createElement("div", { className: "resize", onPointerDown: (event: React.PointerEvent<HTMLElement>) => panel.start(event, "se") }, "Resize"));
}

it("moves a floating panel without changing the document layout and restores saved geometry", () => {
  localStorage.clear();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(React.createElement(DraggableFixture)));
  const panel = container.querySelector<HTMLElement>(".is-floating")!;
  act(() => container.querySelector<HTMLElement>(".header")!.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 10, clientY: 10 })));
  act(() => window.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 110, clientY: 50 })));
  expect(panel.style.left).toBe("120px");
  act(() => window.dispatchEvent(new MouseEvent("pointerup", { bubbles: true })));
  expect(JSON.parse(localStorage.getItem("openonyx.studio.panel.fixture") || "null").x).toBe(120);
  act(() => root.unmount());
  const restored = createRoot(container);
  act(() => restored.render(React.createElement(DraggableFixture)));
  expect(container.querySelector<HTMLElement>(".is-floating")!.style.left).toBe("120px");
  act(() => restored.unmount());
  container.remove();
});

it("resizes a floating panel and clamps persisted geometry after a window resize", () => {
  localStorage.clear();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(React.createElement(DraggableFixture)));
  const panel = container.querySelector<HTMLElement>(".is-floating")!;
  act(() => container.querySelector<HTMLElement>(".header")!.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 0, clientY: 100 })));
  act(() => window.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 0, clientY: 0 })));
  act(() => window.dispatchEvent(new MouseEvent("pointerup", { bubbles: true })));
  act(() => container.querySelector<HTMLElement>(".resize")!.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 0, clientY: 0 })));
  act(() => window.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 120, clientY: 80 })));
  expect(panel.style.width).toBe("460px");
  expect(panel.style.height).toBe("450px");
  act(() => window.dispatchEvent(new MouseEvent("pointerup", { bubbles: true })));
  const originalWidth = window.innerWidth;
  const originalHeight = window.innerHeight;
  try {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 360 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 400 });
    act(() => window.dispatchEvent(new Event("resize")));
    expect(panel.style.width).toBe("336px");
    expect(panel.style.height).toBe("278px");
    expect(JSON.parse(localStorage.getItem("openonyx.studio.panel.fixture") || "null").width).toBe(336);
  } finally {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: originalHeight });
    act(() => root.unmount());
    container.remove();
  }
});
