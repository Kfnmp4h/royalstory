import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(new URL('./live-login.css', import.meta.url), 'utf8');

describe('live login layout', () => {
  it('keeps the panel low and all controls inside a safe inner area', () => {
    expect(stylesheet).toContain('grid-template-rows: 1fr auto');
    expect(stylesheet).toContain('max-width: 100%');
    expect(stylesheet).toContain('box-sizing: border-box');
    expect(stylesheet).toContain('padding: 112px 58px 78px');
    expect(stylesheet).toContain('@media (max-width: 640px)');
    expect(stylesheet).toContain('@media (max-height: 760px) and (min-width: 641px)');
  });
});
