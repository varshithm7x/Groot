// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { FileEntry } from "../src/types";
import { Sidebar } from "../src/components/layout/Sidebar";

const apiMock = vi.hoisted(() => ({ startFileDrag: vi.fn(), showItemInFolder: vi.fn(async () => {}) }));
vi.mock("../src/utils/api", () => ({ getAPI: () => ({ readFile: () => Promise.resolve("# Binary and Data Representation"), ...apiMock }) }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const notePath = "Engineers/Foundations/Binary and Data Representation.md";
const entry = (name: string, path: string, isDirectory: boolean, children?: FileEntry[]): FileEntry => ({
  name, path, absolutePath: path, isDirectory, extension: isDirectory ? "" : ".md", children, modifiedAt: 0, size: 0,
});
const fileTree = [entry("Engineers", "Engineers", true, [
  entry("Foundations", "Engineers/Foundations", true, [entry("Binary and Data Representation.md", notePath, false)]),
])];

it("reveals the active note inside its folder and keeps Library actions discoverable", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const reveal = vi.fn();
  const upload = vi.fn();
  const handled = vi.fn();
  const frames: FrameRequestCallback[] = [];
  const oldFrame = window.requestAnimationFrame;
  const oldCancel = window.cancelAnimationFrame;
  const oldScroll = HTMLElement.prototype.scrollIntoView;
  const scrolled = vi.fn();
  window.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
  window.cancelAnimationFrame = vi.fn();
  HTMLElement.prototype.scrollIntoView = scrolled;
  const props = {
    visible: true,
    fileTree,
    activeFilePath: notePath,
    starredNotes: [],
    onFileSelect: vi.fn(), onNewNote: vi.fn(), onNewFolder: vi.fn(),
    onDeleteFile: vi.fn(), onRenameFile: vi.fn(), onMoveFile: vi.fn(),
    onRefresh: vi.fn(), onToggleStar: vi.fn(), onCollapse: vi.fn(),
    vaultPath: "/vault/Engineers", onRevealCurrentNote: reveal, onUploadFiles: upload,
    onRevealFolderHandled: handled,
  };
  try {
    await act(async () => root.render(React.createElement(Sidebar, props)));
    const revealButton = container.querySelector<HTMLButtonElement>('[aria-label="Reveal current note in Library"]')!;
    expect(revealButton.title).toContain(notePath);
    expect(revealButton.previousElementSibling?.getAttribute("aria-label")).toBe("New folder");
    act(() => revealButton.click());
    expect(reveal).toHaveBeenCalledWith(notePath);
    const uploadButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent?.includes("Upload files"))!;
    act(() => uploadButton.click());
    expect(upload).toHaveBeenCalledWith("Engineers/Foundations");
    expect(container.querySelector('[aria-label="New note"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="New folder"]')).not.toBeNull();
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Library options"]')!.click());
    expect(container.querySelector('[role="menuitem"]')?.textContent).toBe("Refresh Library");
    expect(document.activeElement?.getAttribute("role")).toBe("menuitemradio");
    act(() => document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    expect(document.activeElement?.textContent).toContain("File name (Z to A)");
    act(() => document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(container.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Library options");

    await act(async () => root.render(React.createElement(Sidebar, { ...props, revealFolderRequest: { path: "Engineers/Foundations", filePath: notePath, nonce: 1 } })));
    const card = container.querySelector<HTMLElement>(`[data-sidebar-note-path="${notePath}"]`);
    expect(card?.classList.contains("active")).toBe(true);
    act(() => card?.querySelector<HTMLButtonElement>(".studio-file-drag-handle")?.dispatchEvent(new Event("dragstart", { bubbles: true, cancelable: true })));
    expect(apiMock.startFileDrag).toHaveBeenCalledWith(notePath);
    act(() => frames.shift()?.(0));
    expect(scrolled).toHaveBeenCalled();
    expect(handled).toHaveBeenCalledTimes(1);
  } finally {
    act(() => root.unmount());
    container.remove();
    window.requestAnimationFrame = oldFrame;
    window.cancelAnimationFrame = oldCancel;
    HTMLElement.prototype.scrollIntoView = oldScroll;
  }
});
