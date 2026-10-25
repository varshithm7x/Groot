// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const headingCalls = vi.hoisted(() => ({ count: 0 }));
vi.mock("../src/utils/markdownHeadings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/utils/markdownHeadings")>();
  return {
    ...actual,
    extractMarkdownHeadings: (content: string) => {
      headingCalls.count++;
      return actual.extractMarkdownHeadings(content);
    },
  };
});

import { Editor } from "../src/components/editor/Editor";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => new DOMRect();

it("does not rescan a media-heavy note for headings while scrolling", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const frames: FrameRequestCallback[] = [];
  const originalRaf = window.requestAnimationFrame;
  const originalCancelRaf = window.cancelAnimationFrame;
  window.requestAnimationFrame = (callback) => { frames.push(callback); return frames.length; };
  window.cancelAnimationFrame = vi.fn();
  try {
    await act(async () => root.render(React.createElement(Editor, {
      tabs: [{ id: "media", path: "media.md", name: "Media", isModified: false }],
      activeTabId: "media",
      content: `# Heading\n![image](data:image/png;base64,${"A".repeat(100_000)})\n## Second`,
      viewMode: "preview",
      onAdjustFontSize: vi.fn(),
      onTabSelect: vi.fn(),
      onTabClose: vi.fn(),
      onContentChange: vi.fn(),
      onViewModeChange: vi.fn(),
      onLinkClick: vi.fn(),
    })));
    const scroller = host.querySelector(".markdown-preview")?.parentElement;
    expect(scroller).toBeTruthy();
    const scansBeforeScroll = headingCalls.count;
    await act(async () => {
      for (let index = 0; index < 12; index++) {
        scroller!.dispatchEvent(new Event("scroll"));
        frames.splice(0).forEach((callback) => callback(0));
      }
    });
    expect(headingCalls.count).toBe(scansBeforeScroll);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    window.requestAnimationFrame = originalRaf;
    window.cancelAnimationFrame = originalCancelRaf;
  }
});
