import { describe, expect, it } from 'vitest';
import { createObjectPool } from './objectPool';

describe('createObjectPool', () => {
  it('reuses released objects and tracks active items', () => {
    let nextId = 0;
    const resetIds: number[] = [];
    const pool = createObjectPool(
      () => ({ id: nextId++ }),
      (item) => resetIds.push(item.id),
    );

    const first = pool.acquire();
    expect(pool.activeCount()).toBe(1);

    pool.release(first);
    expect(pool.activeCount()).toBe(0);
    expect(resetIds).toEqual([first.id]);

    const second = pool.acquire();
    expect(second).toBe(first);
    expect(pool.activeCount()).toBe(1);
  });

  it('rejects duplicate or foreign releases', () => {
    const pool = createObjectPool(() => ({ value: 1 }), () => undefined);
    const item = pool.acquire();

    pool.release(item);
    expect(() => pool.release(item)).toThrow(/inactive/i);
    expect(() => pool.release({ value: 1 })).toThrow(/inactive/i);
  });

  it('stays bounded during repeated acquire and release cycles', () => {
    let created = 0;
    const pool = createObjectPool(
      () => ({ id: created++ }),
      () => undefined,
    );

    for (let index = 0; index < 100; index += 1) {
      const item = pool.acquire();
      pool.release(item);
    }

    expect(created).toBe(1);
    expect(pool.activeCount()).toBe(0);
    expect(pool.inactiveCount()).toBe(1);
  });
});
