import { beforeEach, describe, expect, it } from 'vitest';
import { resetLocalData } from './localData';

describe('resetLocalData', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem(k: string, v: string) { store.set(k, v); Object.assign(this, { [k]: v }); },
      removeItem(k: string) { store.delete(k); delete (this as Record<string, unknown>)[k]; },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() { return store.size; },
      clear() {
        for (const k of Array.from(store.keys())) delete (this as Record<string, unknown>)[k];
        store.clear();
      },
    } as Storage;
    globalThis.localStorage = storage;
  });

  it('borra datos locales psp y escenarios históricos del simulador', () => {
    localStorage.setItem('psp-planeacion-v3', 'x');
    localStorage.setItem('sm-sim-scen-v1', 'x');
    localStorage.setItem('otra-app', 'x');

    resetLocalData();

    expect(localStorage.getItem('psp-planeacion-v3')).toBeNull();
    expect(localStorage.getItem('sm-sim-scen-v1')).toBeNull();
    expect(localStorage.getItem('otra-app')).toBe('x');
  });
});
