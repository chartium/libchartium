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
