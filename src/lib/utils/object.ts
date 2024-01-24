export type MapOf<T extends {}> = Omit<
  Map<keyof T, T[keyof T]>,
  "has" | "get"
> & {
  has(x: unknown): x is keyof T;
  get<K extends keyof T>(k: K): T[K];
};

export function asMap<T extends {}>(obj: T): MapOf<T> {
  return new Map(Object.entries(obj)) as any;
}
