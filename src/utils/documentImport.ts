import type { ElectronAPI } from "../../electron/preload";

const SUPPORTED_DOCUMENT = /\.(md|canvas|pdf)$/i;
const MISSING_HANDLER = /No handler registered for|not a function/i;

/** The browser picker yields File objects even when Electron has not restarted. */
export function pickDocumentFiles(): Promise<File[]> {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.canvas,.pdf";
    input.multiple = true;
    input.hidden = true;
    document.body.append(input);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      const files = Array.from(input.files || []);
      input.remove();
      resolve(files);
    };
    input.addEventListener("change", finish, { once: true });
    input.addEventListener("cancel", finish, { once: true });
    input.click();
  });
}

/** Import with the native collision-safe handler; retain a bridge for older running processes. */
export async function importDocumentFile(
  file: File,
  targetDir: string,
  api: Pick<ElectronAPI, "importFileBytes" | "fileExists" | "writeBinary">,
): Promise<{ path: string; usedLegacyBridge: boolean }> {
  if (!SUPPORTED_DOCUMENT.test(file.name)) throw new Error("Only Markdown, Canvas, and PDF files can be imported");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (typeof api.importFileBytes === "function") {
    try {
      return { path: await api.importFileBytes(file.name, targetDir, bytes), usedLegacyBridge: false };
    } catch (error) {
      if (!MISSING_HANDLER.test(String(error))) throw error;
    }
  }

  // A Vite hot reload can replace the renderer while Electron main is still old.
  // This path uses only IPC methods that existed before the import handlers.
  const stem = file.name.replace(/\.(md|canvas|pdf)$/i, "");
  const extension = file.name.slice(stem.length);
  for (let number = 0; number < 10000; number++) {
    const filename = number === 0 ? file.name : `${stem} (${number})${extension}`;
    const destination = targetDir ? `${targetDir.replace(/\/$/, "")}/${filename}` : filename;
    if (await api.fileExists(destination)) continue;
    await api.writeBinary(destination, bytes);
    return { path: destination, usedLegacyBridge: true };
  }
  throw new Error("Too many files with this name");
}
