import { describe, expect, it } from 'vitest';

describe('test setup', () => {
  it('provides the 2D canvas operations Phaser probes during import', () => {
    const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });

    expect(context).not.toBeNull();
    context!.fillStyle = 'rgba(10, 20, 30, 0.5)';
    context!.fillRect(0, 0, 1, 1);
    const image = context!.getImageData(0, 0, 1, 1);
    context!.putImageData(image, 1, 0);
    expect(context!.getImageData(1, 0, 1, 1).data).toEqual(image.data);
  });
});
