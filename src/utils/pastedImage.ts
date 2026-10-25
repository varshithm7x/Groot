export async function persistPastedImage(
  file: File,
  saveImageDedup: (fileName: string, base64Data: string) => Promise<{ relativePath: string }>,
): Promise<string> {
  const extensionByMime: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/avif": "avif",
    "image/bmp": "bmp",
  };
  const baseName = file.name || "image";
  const fileName = /\.[a-z0-9]+$/i.test(baseName)
    ? baseName
    : `${baseName}.${extensionByMime[file.type] || "png"}`;
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read pasted image"));
    };
    reader.onerror = () => reject(reader.error || new Error("Could not read pasted image"));
    reader.readAsDataURL(file);
  });
  const separator = dataUrl.indexOf(",");
  if (separator < 0) throw new Error("Invalid pasted image data");
  const result = await saveImageDedup(fileName, dataUrl.slice(separator + 1));
  if (!result?.relativePath) throw new Error("Pasted image was not saved");
  return result.relativePath;
}
