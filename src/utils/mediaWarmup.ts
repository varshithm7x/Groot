const MAX_WARM_IMAGES = 2;
const warmImages = new Map<string, HTMLImageElement>();

export function getWarmedImageSize(source: string): { width: number; height: number } | null {
  const image = warmImages.get(source);
  return image?.naturalWidth && image.naturalHeight
    ? { width: image.naturalWidth, height: image.naturalHeight }
    : null;
}

/** Decode the next offscreen images after the caller's first paint. */
export function warmNoteImages(sources: Iterable<string | HTMLImageElement>): () => void {
  if (typeof Image === "undefined" || typeof window === "undefined") return () => {};
  const candidates = Array.from(sources);
  if (candidates.length === 0) return () => {};

  let cancelled = false;
  let idleId: number | null = null;
  let warmed = 0;
  const started: Array<{ source: string; image: HTMLImageElement; owned: boolean }> = [];
  const idleWindow = window as typeof window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };

  const nextSource = (): { source: string; image?: HTMLImageElement } | null => {
    while (candidates.length > 0) {
      const candidate = candidates.shift()!;
      if (typeof candidate === "string") {
        if (candidate) return { source: candidate };
        continue;
      }
      if (!candidate.isConnected || (candidate.complete && !candidate.naturalWidth)) continue;
      const rect = candidate.getBoundingClientRect();
      if (rect.bottom >= 0 && rect.top <= window.innerHeight) continue;
      const source = candidate.currentSrc || candidate.src;
      if (source) return { source, image: candidate };
    }
    return null;
  };

  const scheduleNext = () => {
    if (cancelled || warmed >= MAX_WARM_IMAGES || candidates.length === 0) return;
    if (idleWindow.requestIdleCallback) idleId = idleWindow.requestIdleCallback(decodeNext, { timeout: 200 });
    else idleId = window.setTimeout(decodeNext, 0);
  };

  const decodeNext = () => {
    idleId = null;
    if (cancelled) return;
    const candidate = nextSource();
    if (!candidate) return;
    const { source } = candidate;
    warmed++;
    const previous = warmImages.get(source);
    if (previous) {
      warmImages.delete(source);
      warmImages.set(source, previous);
      scheduleNext();
      return;
    }
    const image = candidate.image || new Image();
    image.decoding = "async";
    if (candidate.image) image.loading = "eager";
    else image.src = source;
    started.push({ source, image, owned: !candidate.image });
    warmImages.set(source, image);
    while (warmImages.size > MAX_WARM_IMAGES) {
      warmImages.delete(warmImages.keys().next().value!);
    }
    void Promise.resolve(image.decode?.()).catch(() => {
      if (warmImages.get(source) === image) warmImages.delete(source);
    }).finally(scheduleNext);
  };

  // Callers run this after their first animation frame. The old 300 ms timer
  // often left the next image undecoded when the first scroll arrived.
  scheduleNext();
  return () => {
    cancelled = true;
    if (idleId !== null) {
      if (idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId);
    }
    for (const { source, image, owned } of started) {
      if (image.complete || !owned) continue;
      if (warmImages.get(source) === image) warmImages.delete(source);
      image.src = "";
    }
  };
}
