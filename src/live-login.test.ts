import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(join(process.cwd(), 'src', 'live-login.css'), 'utf8');

function getBlock(source: string, header: string) {
  const pattern = header
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+');
  const match = new RegExp(`${pattern}\\s*\\{`).exec(source);

  if (!match || match.index === undefined) {
    throw new Error(`Missing CSS block for: ${header}`);
  }

  const openingBrace = match.index + match[0].length - 1;
  let depth = 0;

  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(openingBrace + 1, index);
  }

  throw new Error(`Unclosed CSS block for: ${header}`);
}

describe('live login layout', () => {
  it('keeps the panel low and all controls inside a safe inner area', () => {
    expect(stylesheet).toContain('grid-template-rows: 1fr auto');
    expect(stylesheet).toContain('max-width: 100%');
    expect(stylesheet).toContain('box-sizing: border-box');
    expect(stylesheet).toContain('padding: 112px 58px 78px');
    expect(stylesheet).toContain('@media (max-width: 640px)');
    expect(stylesheet).toContain('@media (max-height: 760px) and (min-width: 641px)');
  });

  it('scopes the desktop panel and control safe-area contract to their selectors', () => {
    const panel = getBlock(stylesheet, '.auth-panel');
    const controls = getBlock(stylesheet, '.auth-panel input,\n.auth-panel .primary-action');

    expect(panel).toContain('justify-self: center;');
    expect(panel).toContain('width: min(92vw, 410px);');
    expect(panel).toContain('min-height: 520px;');
    expect(panel).toContain('max-width: 100%;');
    expect(panel).toContain('box-sizing: border-box;');
    expect(panel).toContain('padding: 112px 58px 78px;');
    expect(controls).toContain('max-width: 100%;');
    expect(controls).toContain('box-sizing: border-box;');
  });

  it('scopes the mobile panel safe-area values to the mobile media query', () => {
    const mobileRules = getBlock(stylesheet, '@media (max-width: 640px)');
    const panel = getBlock(mobileRules, '.auth-panel');

    expect(panel).toContain('width: min(94vw, 370px);');
    expect(panel).toContain('min-height: 500px;');
    expect(panel).toContain('padding: 104px 48px 76px;');
  });

  it('scopes the short-height panel safe-area values to its media query', () => {
    const shortHeightRules = getBlock(stylesheet, '@media (max-height: 760px) and (min-width: 641px)');
    const panel = getBlock(shortHeightRules, '.auth-panel');

    expect(panel).toContain('width: min(88vw, 370px);');
    expect(panel).toContain('min-height: 470px;');
    expect(panel).toContain('padding: 94px 48px 68px;');
    expect(panel).toContain('gap: 7px;');
  });
});
