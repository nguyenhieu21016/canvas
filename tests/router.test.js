// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { addRoute, parseRoute, mountCurrentRoute, registerCleanup, routes } from '../src/router.js';

describe('router', () => {
  it('parses route hash properly', () => {
    expect(parseRoute('#/learn')).toEqual({ name: 'learn', id: undefined });
    expect(parseRoute('#/assignment/123')).toEqual({ name: 'assignment', id: '123' });
    expect(parseRoute('')).toEqual({ name: 'learn', id: undefined });
  });

  it('invokes cleanup function on route transition', async () => {
    const cleanupSpy = vi.fn();
    registerCleanup(cleanupSpy);

    const testComponent = vi.fn().mockReturnValue(() => {});
    addRoute('test-route', testComponent);

    window.location.hash = '#/test-route';
    await mountCurrentRoute();

    expect(cleanupSpy).toHaveBeenCalledTimes(1);
    expect(testComponent).toHaveBeenCalledTimes(1);
  });
});
