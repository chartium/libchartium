export function* concat<T>(...iters: Iterable<T>[]): Iterable<T> {
  for (const iter of iters) {
    yield* iter;
  }
}

export function* unique<T>(iter: Iterable<T>, used?: Set<T>): Iterable<T> {
  used ??= new Set<T>();

  for (const el of iter) {
    if (used.has(el)) continue;
    used.add(el);
    yield el;
  }
}

export function filter<S, T extends S>(
  iter: Iterable<S>,
  fn: (value: S) => value is T
): Iterable<T>;
export function filter<T>(
  iter: Iterable<T>,
  fn: (value: T) => boolean
): Iterable<T>;
export function* filter<T>(
  iter: Iterable<T>,
  fn: (value: T) => boolean
): Iterable<T> {
  for (const el of iter) {
    if (fn(el)) yield el;
  }
}

export function* map<S, T>(
  iter: Iterable<S>,
  fn: (value: S) => T
): Iterable<T> {
  for (const el of iter) {
    yield fn(el);
  }
}

export function* flatMap<S, T>(
  iter: Iterable<S>,
  mapFn: (value: S) => Iterable<T>
): Iterable<T> {
  for (const el of iter) {
    yield* mapFn(el);
  }
}

export function reduce<T>(iter: Iterable<T>, fn: (prev: T, curr: T) => T): T;
export function reduce<T>(
  iter: Iterable<T>,
  fn: (prev: T, curr: T) => T,
  initialValue: T
): T;
export function reduce<S, T>(
  iter: Iterable<S>,
  fn: (prev: T, curr: S) => T,
  initialValue: T
): T;
export function reduce<S, T>(
  iter: Iterable<S>,
  fn: (prev: T, curr: S) => T,
  initialValue?: T
): T {
  const initialProvided = arguments.length === 3;
  let first = true;
  let value = initialValue as T;

  for (const el of iter) {
    if (!initialProvided && first) {
      value = el as any;
      first = false;
      continue;
    }
    value = fn(value, el);
  }

  return value;
}

export function* zip<S, T>(
  iterable1: Iterable<S>,
  iterable2: Iterable<T>
): Iterable<[S, T]> {
  const iter1 = iterable1[Symbol.iterator]();
  const iter2 = iterable2[Symbol.iterator]();
  while (true) {
    const next1 = iter1.next();
    const next2 = iter2.next();
    if (next1.done || next2.done) return;
    yield [next1.value, next2.value];
  }
}

export function weakSetUnion<T extends object>(
  a: WeakSet<T>,
  b: WeakSet<T>
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
    }
  );
}

export function weakMapUnion<K extends object, V>(
  a: WeakMap<K, V>,
  b: WeakMap<K, V>
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
    }
  );
}
