import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

const canvasContext = {
  fillStyle: '',
  globalCompositeOperation: 'source-over',
  drawImage: () => undefined,
  fillRect: () => undefined,
  getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  putImageData: () => undefined,
};

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value: (contextId: string) => contextId === '2d' ? canvasContext : null,
});

afterEach(() => {
  cleanup();
});
