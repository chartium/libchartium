export function startsWith<P extends string>(
  str: string,
  pattern: P
): str is `${P}${string}` {
  return str.startsWith(pattern);
}
