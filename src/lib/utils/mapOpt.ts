/**
 * The bind operation for the "Maybe Monad", in TS represented by `T | undefined`
 */
export function mapOpt<T, S>(
  value: T | undefined,
  fn: (value: T) => S | undefined,
): S | undefined;
export function mapOpt<T, S>(
  value: T | undefined,
  fn: (value: T) => S | undefined,
  def: S,
): S;
export function mapOpt<T, S>(
  value: T | undefined,
  fn: (value: T) => S | undefined,
  def?: S,
): S | undefined {
  return (value === undefined ? undefined : fn(value)) ?? def;
}
