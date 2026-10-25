import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileSystemManager } from "../electron/fileSystem";

const temporaryDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

describe("vault file import", () => {
  it("imports files into a selected folder and never overwrites a matching note", async () => {
    const directory = await mkdtemp(join(tmpdir(), "openonyx-import-"));
    temporaryDirectories.push(directory);
    const source = join(directory, "source.md");
    const vault = join(directory, "vault");
    await writeFile(source, "# Original");
    const manager = new FileSystemManager();
    manager.setVaultPath(vault);

    expect(await manager.importDocument("note.md", "Foundations", source)).toBe("Foundations/note.md");
    expect(await manager.importDocument("note.md", "Foundations", new TextEncoder().encode("# Second"))).toBe("Foundations/note (1).md");
    expect(await readFile(join(vault, "Foundations", "note.md"), "utf8")).toBe("# Original");
    expect(await readFile(join(vault, "Foundations", "note (1).md"), "utf8")).toBe("# Second");
  });

  it("rejects unsupported files and a target outside the vault", async () => {
    const directory = await mkdtemp(join(tmpdir(), "openonyx-import-"));
    temporaryDirectories.push(directory);
    const manager = new FileSystemManager();
    manager.setVaultPath(join(directory, "vault"));
    await expect(manager.importDocument("script.js", "", new Uint8Array())).rejects.toThrow("Only Markdown");
    await expect(manager.importDocument("note.md", "../outside", new Uint8Array())).rejects.toThrow();
  });
});
