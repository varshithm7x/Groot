// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { importDocumentFile, pickDocumentFiles } from "../src/utils/documentImport";

function makeFile(name: string, content: string): File {
  const file = new File([content], name);
  Object.defineProperty(file, "arrayBuffer", { value: async () => new TextEncoder().encode(content).buffer });
  return file;
}

describe("document import across an Electron hot reload", () => {
  it("falls back to existing file IPC when the running main process lacks the import handler", async () => {
    const written = new Map<string, Uint8Array>();
    const api = {
      importFileBytes: vi.fn(async () => { throw new Error("No handler registered for 'fs:importFileBytes'"); }),
      fileExists: vi.fn(async (path: string) => path === "Notes/note.md" || written.has(path)),
      writeBinary: vi.fn(async (path: string, bytes: Uint8Array) => { written.set(path, bytes); }),
    };
    const result = await importDocumentFile(makeFile("note.md", "# New"), "Notes", api);
    expect(result).toEqual({ path: "Notes/note (1).md", usedLegacyBridge: true });
    expect(new TextDecoder().decode(written.get(result.path))).toBe("# New");
  });

  it("preserves native collision-safe imports when the handler is available", async () => {
    const api = {
      importFileBytes: vi.fn(async () => "Notes/note (2).md"),
      fileExists: vi.fn(),
      writeBinary: vi.fn(),
    };
    expect(await importDocumentFile(makeFile("note.md", "# New"), "Notes", api)).toEqual({
      path: "Notes/note (2).md", usedLegacyBridge: false,
    });
    expect(api.writeBinary).not.toHaveBeenCalled();
  });

  it("opens a multi-file picker and returns its selected files", async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (this: HTMLInputElement) {
      expect(this.multiple).toBe(true);
      expect(this.accept).toBe(".md,.canvas,.pdf");
      Object.defineProperty(this, "files", { value: [makeFile("one.md", "A"), makeFile("two.pdf", "B")] });
      this.dispatchEvent(new Event("change"));
    });
    try {
      expect((await pickDocumentFiles()).map(file => file.name)).toEqual(["one.md", "two.pdf"]);
      expect(document.querySelector('input[type="file"]')).toBeNull();
    } finally {
      click.mockRestore();
    }
  });
});
