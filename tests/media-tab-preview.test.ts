// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { compactTabPreviewSource, tabPreviewImageSrc } from "../src/components/layout/TabPreviewCard";
import { MarkdownPreview, extractInlinePreviewImages } from "../src/components/editor/MarkdownPreview";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("media-heavy tab previews", () => {
  it("bounds hover-card parsing and excludes inline image data", () => {
    const source = `# Fast note\n![diagram](data:image/png;base64,${"A".repeat(2_000_000)})\n## Later`;
    const compact = compactTabPreviewSource(source);
    expect(compact).toContain("Fast note");
    expect(compact.length).toBeLessThan(1_000);
    expect(compact).not.toContain("data:image/png");
    expect(tabPreviewImageSrc(source)).toBe(`data:image/png;base64,${"A".repeat(2_000_000)}`);
  });

  it("keeps image payloads out of the rich Markdown parser while retaining the source", () => {
    const source = `# New note\n![image](data:image/png;base64,${"A".repeat(100_000)})\nA paragraph`;
    const extracted = extractInlinePreviewImages(source);
    expect(extracted.text.length).toBeLessThan(200);
    expect(extracted.sources[0]).toHaveLength("data:image/png;base64,".length + 100_000);
    expect(extracted.text).toContain("openonyx-inline-image.invalid/0");
  });

  it("switches directly to the new rich note with its image", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const render = (documentId: string, content: string) => root.render(
      React.createElement(MarkdownPreview, { documentId, content, onLinkClick: vi.fn() }),
    );
    try {
      await act(async () => render("first.md", "# First document"));
      await act(async () => render("second.md", "# Second document\n![large](data:image/png;base64,AAAA)"));
      expect(host.textContent).toContain("Second document");
      expect(host.textContent).not.toContain("First document");
      expect(host.querySelector("img")?.getAttribute("src")).toBe("data:image/png;base64,AAAA");
      expect(host.textContent).not.toContain("Loading media");
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });
});
