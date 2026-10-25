import type { ElectronAPI } from "../../electron/preload";

/** Renderer reloads can temporarily run against an older preload or main process. */
export async function persistResource(api: ElectronAPI, vaultPath: string, originalPath: string, bytes: Uint8Array, notePath: string | null, content: string): Promise<void> {
  const resourceAPI = api as ElectronAPI & { importResource?: (vaultPath: string, originalPath: string, bytes: Uint8Array, notePath: string | null, content: string) => Promise<void> };
  if (typeof resourceAPI.importResource === "function") {
    try {
      await resourceAPI.importResource(vaultPath, originalPath, bytes, notePath, content);
      return;
    } catch (error) {
      // A newer preload can expose the method while the running main process
      // still lacks its handler. Only this error guarantees no import ran.
      const message = error instanceof Error ? error.message : String(error);
      if (!/(?:^|:\s*)No handler registered for 'fs:importResource'$/.test(message)) throw error;
    }
  }
  if (![api.getVaultPath, api.fileExists, api.createDirectory, api.writeBinary, api.createFile, api.deleteFile].every(method => typeof method === "function")) {
    throw new Error("The running app cannot save uploads yet. Restart GROOT to load the updated file bridge.");
  }
  if (!/^Uploads\/[a-f0-9-]{36}\/[^/\\]+$/.test(originalPath)) throw new Error("Invalid upload path.");
  const folder = originalPath.slice(0, originalPath.lastIndexOf("/"));
  if (notePath && (notePath.slice(0, notePath.lastIndexOf("/")) !== folder || !notePath.endsWith(".md") || notePath === originalPath)) throw new Error("Invalid content path.");
  // Absolute destinations stay tied to the initiating vault. Existing native filesystem
  // handlers reject them if switching vaults would put them outside the active vault.
  const root = vaultPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const absolute = (path: string) => `${root}/${path}`;
  async function ensureVault() {
    if (await api.getVaultPath() !== vaultPath) throw new Error("The vault changed during upload. Please retry in the intended vault.");
  }
  await ensureVault();
  if (await api.fileExists(absolute(folder))) throw new Error("This upload directory already exists. Please retry.");
  await ensureVault();
  await api.createDirectory(absolute(folder));
  let originalAttempted = false;
  try {
    await ensureVault();
    originalAttempted = true;
    await api.writeBinary(absolute(originalPath), bytes);
    if (notePath) {
      await ensureVault();
      await api.createFile(absolute(notePath), content);
    }
  } catch (failure) {
    // Roll back only our unique import, and only while its vault is still active.
    // Avoid deleting anything in the newly selected vault during a switch.
    if (await api.getVaultPath().catch(() => null) === vaultPath) {
      if (notePath) await api.deleteFile(absolute(notePath)).catch(() => {});
      if (originalAttempted) await api.deleteFile(absolute(originalPath)).catch(() => {});
    }
    throw failure;
  }
}
