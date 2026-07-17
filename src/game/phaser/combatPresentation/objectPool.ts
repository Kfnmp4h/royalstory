export interface ObjectPool<T> {
  acquire(): T;
  release(item: T): void;
  activeCount(): number;
  inactiveCount(): number;
}

export function createObjectPool<T>(factory: () => T, reset: (item: T) => void): ObjectPool<T> {
  const active = new Set<T>();
  const inactive: T[] = [];

  return {
    acquire(): T {
      const item = inactive.pop() ?? factory();
      active.add(item);
      return item;
    },

    release(item: T): void {
      if (!active.delete(item)) {
        throw new Error('Cannot release an inactive pool item.');
      }

      reset(item);
      inactive.push(item);
    },

    activeCount(): number {
      return active.size;
    },

    inactiveCount(): number {
      return inactive.length;
    },
  };
}
