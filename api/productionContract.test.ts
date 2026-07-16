import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as confirm from './auth/confirm';
import * as requestPasswordReset from './auth/request-password-reset';
import * as signIn from './auth/sign-in';
import * as signOut from './auth/sign-out';
import * as signUp from './auth/sign-up';
import * as player from './player';
import * as playerCommands from './player/commands';
import * as playerReset from './player/reset';

const root = process.cwd();
const productionRoots = ['src', 'api'] as const;
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);

const routes = [
  { path: 'api/auth/confirm.ts', method: 'GET', handler: confirm.GET, module: confirm },
  { path: 'api/auth/request-password-reset.ts', method: 'POST', handler: requestPasswordReset.POST, module: requestPasswordReset },
  { path: 'api/auth/sign-in.ts', method: 'POST', handler: signIn.POST, module: signIn },
  { path: 'api/auth/sign-out.ts', method: 'POST', handler: signOut.POST, module: signOut },
  { path: 'api/auth/sign-up.ts', method: 'POST', handler: signUp.POST, module: signUp },
  { path: 'api/player.ts', method: 'GET', handler: player.GET, module: player },
  { path: 'api/player/commands.ts', method: 'POST', handler: playerCommands.POST, module: playerCommands },
  { path: 'api/player/reset.ts', method: 'POST', handler: playerReset.POST, module: playerReset },
] as const;

const extensionOf = (path: string): string => {
  const match = path.match(/\.[^.]+$/);
  return match?.[0] ?? '';
};

const listFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return files.flat();
};

const readProductionSource = async (): Promise<string> => {
  const paths = (await Promise.all(productionRoots.map((directory) => listFiles(join(root, directory)))))
    .flat()
    .filter((path) => sourceExtensions.has(extensionOf(path)))
    .filter((path) => !path.includes('.test.'));
  const contents = await Promise.all(paths.map(async (path) => `${relative(root, path)}\n${await readFile(path, 'utf8')}`));
  return contents.join('\n');
};

describe('production source contract', () => {
  it('keeps browser game persistence and embedded service credentials out of production source', async () => {
    const source = await readProductionSource();
    expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB/i);
    expect(source).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*['"][^'"]+/);
  });

  it('keeps game clients on same-origin API routes instead of direct browser Supabase access', async () => {
    const browserSource = await Promise.all((await listFiles(join(root, 'src')))
      .filter((path) => sourceExtensions.has(extensionOf(path)))
      .filter((path) => !path.includes('.test.'))
      .map((path) => readFile(path, 'utf8')));
    const source = browserSource.join('\n');
    expect(source).not.toMatch(/from ['"]@supabase\/(?:ssr|supabase-js)['"]/);
    expect(source).not.toMatch(/document\.cookie/);
  });

  it.each(routes)('$path exports $method as its Vercel Web Handler without a default export', ({ handler, module }) => {
    expect(handler).toEqual(expect.any(Function));
    expect(module).not.toHaveProperty('default');
  });
});
