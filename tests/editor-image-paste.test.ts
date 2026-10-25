// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Editor, imageWidgetPlugin } from "../src/components/editor/Editor";
import { persistPastedImage } from "../src/utils/pastedImage";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => document.body.replaceChildren());

it("stores pasted image bytes in the vault and returns a short Markdown path", async () => {
  const file = new File([new Uint8Array([1, 2, 3])], "diagram.png", { type: "image/png" });
  const save = vi.fn(async () => ({ relativePath: "attachments/diagram.png" }));
  expect(await persistPastedImage(file, save)).toBe("attachments/diagram.png");
  expect(save).toHaveBeenCalledWith("diagram.png", "AQID");
  const unnamed = new File([new Uint8Array([1])], "image", { type: "image/jpeg" });
  await persistPastedImage(unnamed, save);
  expect(save).toHaveBeenLastCalledWith("image.jpg", "AQ==");
});

it("renders a long existing base64 image in edit mode", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const doc = `![image.png](data:image/png;base64,${"A".repeat(1_000_000)})`;
  const view = new EditorView({
    parent: host,
    state: EditorState.create({ doc, extensions: [imageWidgetPlugin(() => {})] }),
  });
  expect(host.querySelector(".cm-image-widget-image")).not.toBeNull();
  view.destroy();
});

it("keeps one image widget when a transaction edits the same line twice", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: "prefix ![image.png](attachments/image.png) suffix",
      extensions: [imageWidgetPlugin(() => {})],
    }),
  });
  view.dispatch({ changes: [{ from: 0, insert: "A" }, { from: 3, insert: "B" }] });
  expect(host.querySelectorAll(".cm-image-widget-image")).toHaveLength(1);
  view.destroy();
});

it("resizes an image by dragging its right edge and persists the width", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: "![image.png](attachments/image.png)",
      extensions: [imageWidgetPlugin(() => {})],
    }),
  });
  try {
    const image = host.querySelector<HTMLImageElement>(".cm-image-widget-image")!;
    image.getBoundingClientRect = () => new DOMRect(0, 0, 400, 200);
    const content = host.querySelector<HTMLElement>(".cm-content")!;
    content.getBoundingClientRect = () => new DOMRect(0, 0, 700, 500);

    image.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, clientX: 398, clientY: 100 }));
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 300, clientY: 100 }));
    window.dispatchEvent(new MouseEvent("mouseup", { clientX: 300, clientY: 100 }));

    expect(view.state.doc.toString()).toContain('"w=302"');
  } finally {
    view.destroy();
    host.remove();
  }
});

it("resizes an image with its handle without opening the lightbox", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const openLightbox = vi.fn();
  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: '![image.png](attachments/image.png "w=400")',
      extensions: [imageWidgetPlugin(openLightbox)],
    }),
  });
  try {
    const content = host.querySelector<HTMLElement>(".cm-content")!;
    content.getBoundingClientRect = () => new DOMRect(0, 0, 700, 500);
    const handle = host.querySelector<HTMLButtonElement>(".cm-image-widget-resize")!;
    const image = host.querySelector<HTMLImageElement>(".cm-image-widget-image")!;
    image.getBoundingClientRect = () => new DOMRect(0, 0, 400, 200);

    handle.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, clientX: 100, clientY: 190 }));
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 150, clientY: 190 }));
    window.dispatchEvent(new MouseEvent("mouseup", { clientX: 150, clientY: 190 }));

    expect(view.state.doc.toString()).toContain('"w=450"');
    expect(openLightbox).not.toHaveBeenCalled();
    expect(host.querySelector<HTMLButtonElement>(".cm-image-widget-resize")).not.toBeNull();
  } finally {
    view.destroy();
    host.remove();
  }
});

it("adjusts image width with arrow keys on the resize handle", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: '![image.png](attachments/image.png "w=400")',
      extensions: [imageWidgetPlugin(() => {})],
    }),
  });
  try {
    const content = host.querySelector<HTMLElement>(".cm-content")!;
    content.getBoundingClientRect = () => new DOMRect(0, 0, 700, 500);
    const handle = host.querySelector<HTMLButtonElement>(".cm-image-widget-resize")!;
    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    expect(view.state.doc.toString()).toContain('"w=410"');
  } finally {
    view.destroy();
    host.remove();
  }
});

it("renders an existing image in the full Markdown editor", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const content = `# Guide\n\n![image.png](data:image/png;base64,${"A".repeat(1_000_000)})`;
  await act(async () => root.render(React.createElement(Editor, {
    tabs: [{ id: "note", path: "Guide.md", name: "Guide", isModified: false }],
    activeTabId: "note",
    content,
    viewMode: "editor",
    onAdjustFontSize: vi.fn(),
    onTabSelect: vi.fn(),
    onTabClose: vi.fn(),
    onContentChange: vi.fn(),
    onViewModeChange: vi.fn(),
    onLinkClick: vi.fn(),
  })));
  expect(host.querySelector(".cm-image-widget-image")).not.toBeNull();
  await act(async () => root.unmount());
});

it("inserts one attachment link for one image paste", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onImagePaste = vi.fn(async () => "attachments/image.png");
  let view: EditorView | null = null;
  await act(async () => root.render(React.createElement(Editor, {
    tabs: [{ id: "note", path: "Guide.md", name: "Guide", isModified: false }],
    activeTabId: "note",
    content: "# Guide\n",
    viewMode: "editor",
    onAdjustFontSize: vi.fn(),
    onTabSelect: vi.fn(),
    onTabClose: vi.fn(),
    onContentChange: vi.fn(),
    onViewModeChange: vi.fn(),
    onLinkClick: vi.fn(),
    onImagePaste,
    onEditorViewReady: current => { view = current; },
  })));
  const file = new File([new Uint8Array([1, 2, 3])], "image.png", { type: "image/png" });
  const paste = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(paste, "clipboardData", { value: { items: [{ type: "image/png", getAsFile: () => file }] } });
  await act(async () => {
    host.querySelector(".cm-content")?.dispatchEvent(paste);
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  expect(paste.defaultPrevented).toBe(true);
  expect(onImagePaste).toHaveBeenCalledTimes(1);
  expect((view as EditorView | null)?.state.doc.toString().match(/!\[image\.png\]\(attachments\/image\.png\)/g)).toHaveLength(1);
  expect(host.querySelector<HTMLImageElement>(".cm-image-widget-image")?.getAttribute("src")).toContain("attachments/image.png");
  await act(async () => root.unmount());
});
