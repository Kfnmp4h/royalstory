import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const productionRoots = ['src', 'api'] as const;
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);

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

  it('removes the temporary password reset diagnostic while preserving the reset-password rewrite', async () => {
    const [passwordResetSource, vercelConfigSource] = await Promise.all([
      readFile(join(root, 'api', 'auth', 'request-password-reset.ts'), 'utf8'),
      readFile(join(root, 'vercel.json'), 'utf8'),
    ]);
    const vercelConfig = JSON.parse(vercelConfigSource) as {
      rewrites?: Array<{ source?: string; destination?: string }>;
    };

    expect(passwordResetSource).not.toContain('password-reset redirect diagnostic');
    expect(vercelConfig.rewrites).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: '/reset-password', destination: '/index.html' }),
    ]));
  });
});
