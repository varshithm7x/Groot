// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { getWarmedImageSize, warmNoteImages } from '../src/utils/mediaWarmup';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

it('cancels offscreen decoding when the user switches away before idle work starts', () => {
  vi.useFakeTimers();
  const imageConstructor = vi.fn(() => ({ src: '', decoding: '', complete: false, decode: vi.fn() }));
  vi.stubGlobal('Image', imageConstructor);

  const cancel = warmNoteImages(['attachments/old-note.png']);
  expect(imageConstructor).not.toHaveBeenCalled();
  cancel();
  vi.runAllTimers();
  expect(imageConstructor).not.toHaveBeenCalled();
});

it('starts decoding the next image on the first idle turn without a fixed delay', async () => {
  vi.useFakeTimers();
  const decode = vi.fn().mockResolvedValue(undefined);
  const imageConstructor = vi.fn(() => ({ src: '', decoding: '', complete: false, decode }));
  vi.stubGlobal('Image', imageConstructor);

  const cancel = warmNoteImages(['attachments/next.png']);
  expect(imageConstructor).not.toHaveBeenCalled();
  vi.runOnlyPendingTimers();
  await Promise.resolve();
  expect(imageConstructor).toHaveBeenCalledTimes(1);
  expect(decode).toHaveBeenCalledTimes(1);
  cancel();
});

it('warms the displayed preview image directly instead of decoding a duplicate', async () => {
  vi.useFakeTimers();
  const imageConstructor = vi.fn();
  vi.stubGlobal('Image', imageConstructor);
  const image = document.createElement('img');
  image.src = 'attachments/below-fold.png';
  image.loading = 'lazy';
  const decode = vi.fn().mockResolvedValue(undefined);
  image.decode = decode;
  Object.defineProperty(image, 'complete', { value: false });
  Object.defineProperty(image, 'naturalWidth', { value: 1600 });
  Object.defineProperty(image, 'naturalHeight', { value: 900 });
  image.getBoundingClientRect = () => new DOMRect(0, window.innerHeight + 20, 100, 100);
  document.body.append(image);

  const cancel = warmNoteImages([image]);
  vi.runOnlyPendingTimers();
  await Promise.resolve();
  expect(image.loading).toBe('eager');
  expect(decode).toHaveBeenCalledTimes(1);
  expect(imageConstructor).not.toHaveBeenCalled();
  expect(getWarmedImageSize(image.src)).toEqual({ width: 1600, height: 900 });
  cancel();
});

it('decodes an offscreen image that has loaded but has not been painted yet', () => {
  vi.useFakeTimers();
  const image = document.createElement('img');
  image.src = 'attachments/loaded.png';
  const decode = vi.fn().mockResolvedValue(undefined);
  image.decode = decode;
  Object.defineProperty(image, 'complete', { value: true });
  Object.defineProperty(image, 'naturalWidth', { value: 800 });
  image.getBoundingClientRect = () => new DOMRect(0, window.innerHeight + 20, 100, 100);
  document.body.append(image);

  const cancel = warmNoteImages([image]);
  vi.runOnlyPendingTimers();
  expect(decode).toHaveBeenCalledTimes(1);
  cancel();
});

it('does not decode an image that is already visible in the preview', () => {
  vi.useFakeTimers();
  const imageConstructor = vi.fn(() => ({ src: '', decoding: '', complete: false, decode: vi.fn() }));
  vi.stubGlobal('Image', imageConstructor);
  const visible = document.createElement('img');
  visible.src = 'attachments/visible.png';
  Object.defineProperty(visible, 'complete', { value: false });
  visible.getBoundingClientRect = () => new DOMRect(0, 0, 100, 100);
  document.body.append(visible);

  const cancel = warmNoteImages([visible]);
  vi.runAllTimers();
  expect(imageConstructor).not.toHaveBeenCalled();
  cancel();
});
