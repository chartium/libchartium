import { type Flock, type Signal } from "@mod.js/signals";

export function weakSetUnion<T extends object>(
  a: WeakSet<T>,
  b: WeakSet<T>,
): WeakSet<T> {
  if (a === b) return a;
  const added = new WeakSet<T>();
  const deleted = new WeakSet<T>();
  return new Proxy(
    {
      [Symbol.toStringTag]: "WeakSetUnion",
      has(value) {
        if (deleted.has(value)) return false;
        return added.has(value) || a.has(value) || b.has(value);
      },
      add(value) {
        added.add(value);
        deleted.delete(value);
        return this;
      },
      delete(value) {
        if (!this.has(value)) return false;
        added.delete(value);
        deleted.add(value);
        return true;
      },
    },
    {
      getPrototypeOf() {
        return WeakSet.prototype;
      },
    },
  );
}

export function weakMapUnion<K extends object, V>(
  a: WeakMap<K, V>,
  b: WeakMap<K, V>,
): WeakMap<K, V> {
  if (a === b) return a;
  const modified = new WeakMap<K, V>();
  const deleted = new WeakSet<K>();
  return new Proxy(
    {
      [Symbol.toStringTag]: "WeakMapUnion",
      has(key) {
        return (
          !deleted.has(key) || modified.has(key) || a.has(key) || b.has(key)
        );
      },
      get(key) {
        if (deleted.has(key)) return undefined;
        if (modified.has(key)) return modified.get(key);
        if (b.has(key)) return b.get(key);
        return a.get(key);
      },
      set(key, value) {
        modified.set(key, value);
        deleted.delete(key);
        return this;
      },
      delete(key) {
        if (!this.has(key)) return false;
        modified.delete(key);
        deleted.add(key);
        return true;
      },
    },
    {
      getPrototypeOf() {
        return WeakMap.prototype;
      },
    },
  );
}

export function intersection<T>(a: Iterable<T>, ...sets: Set<T>[]): Set<T> {
  if (sets.length === 0) return new Set(a);
  const toReturn = new Set<T>();

  for (const el of a) {
    if (sets.every((set) => set.has(el))) toReturn.add(el);
  }

  return toReturn;
}

export function flockReduce<T>(
  flock: Flock<T>,
  callbackfn: (previousValue: T, currentValue: T) => T,
  initialValue: T,
): Signal<T>;
export function flockReduce<T, U>(
  flock: Flock<T>,
  callbackfn: (previousValue: U, currentValue: T) => T,
  initialValue: U,
): Signal<U>;

export function flockReduce<T, U>(
  flock: Flock<T>,
  callbackfn: (previousValue: any, currentValue: T) => T,
  initialValue: U,
): Signal<any> {
  return flock.toSet().map((s) => [...s].reduce(callbackfn, initialValue));
}
