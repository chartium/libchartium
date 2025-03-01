import { type Flock, type Signal } from "@typek/signalhead";
import { enumerate, filter, Option, yeet } from "@typek/typek";

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

/**
 * Merges multiple iterables into a single iterable using a custom matching strategy.
 *
 * This function iterates over multiple input iterables simultaneously and determines
 * which elements to process together based on a user-defined matching rule.
 *
 * - The `by` function extracts a key from each item, which is used for matching.
 * - The `select` function chooses one key from the available ones, determining which
 *   iterators should advance.
 * - The `combine` function receives the selected key and its corresponding items,
 *   then produces the final output for that iteration.
 *
 * This process repeats until all iterators are exhausted.
 */
export function* joinSeq<T, K, R>({
  iterables,
  by,
  select,
  combine,
}: {
  /** The array of iterables that are to be joined together into a single iterable. */
  iterables: Iterable<T>[];
  /** Transform items into keys to be selected from. */
  by: (item: T) => K;
  /** From all currently available keys, pick the one to be yielded now. */
  select: (keys: K[]) => K;
  /**
   * Transform the items-to-join into an unified result.
   * @param key the current selected key
   * @param items array of current items that match the key. In order to keep indices
   * the same as in `iterables`, the array is padded with `Option.None` for each iterator
   * whose current item wasn't selected for this iteration.
   */
  combine(key: K, items: Array<Option<T>>): R;
}): Iterable<R> {
  const iterators = iterables.map((it) => it[Symbol.iterator]());
  const items = iterators.map((it) => it.next());
  const values = items.map(
    (el): Option<K> => (el.done ? Option.None : Option.Some(by(el.value))),
  );

  while (items.some((it) => !it.done)) {
    const selectedValue = select(
      values.filter((v) => v.isSome).map((v) => v.inner),
    );
    const selected = values.map((v) => v.isSome && v.inner === selectedValue);
    if (!selected.some((_) => _)) yeet("No key selected");

    yield combine(
      selectedValue,
      items.map((el, i) =>
        !selected[i] || el.done ? Option.None : Option.Some(el.value),
      ),
    );

    // iterate over indices of all selected items / iterators
    for (const [i] of filter(enumerate(selected), ([_, s]) => s)) {
      const next = iterators[i].next();
      items[i] = next;
      values[i] = next.done ? Option.None : Option.Some(by(next.value));
    }
  }
}
