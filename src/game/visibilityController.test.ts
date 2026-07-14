import { describe, expect, it, vi } from 'vitest';
import { subscribeToVisibility } from './visibilityController';

describe('subscribeToVisibility', () => {
  it('reports initial and changed hidden state and cleans up', () => {
    const listeners = new Set<EventListener>();
    const addedEvents: string[] = [];
    const removedEvents: string[] = [];
    const source = {
      hidden: false,
      addEventListener: (event: string, listener: EventListener) => {
        addedEvents.push(event);
        listeners.add(listener);
      },
      removeEventListener: (event: string, listener: EventListener) => {
        removedEvents.push(event);
        listeners.delete(listener);
      },
    } as unknown as Document;
    const onChange = vi.fn();
    const unsubscribe = subscribeToVisibility(source, onChange);
    expect(addedEvents).toEqual(['visibilitychange']);
    expect(onChange).toHaveBeenLastCalledWith(false);
    Object.defineProperty(source, 'hidden', { value: true, configurable: true });
    listeners.forEach((listener) => listener(new Event('visibilitychange')));
    expect(onChange).toHaveBeenLastCalledWith(true);
    unsubscribe();
    expect(removedEvents).toEqual(['visibilitychange']);
    expect(listeners.size).toBe(0);
  });
});
