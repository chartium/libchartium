// https://github.com/sveltejs/svelte/issues/8941#issuecomment-1927036924
declare module "svelte" {
  export interface ContextKey<_T = unknown> {}

  export function getContext<T>(key: ContextKey<T>): T;
  export function setContext<T>(key: ContextKey<T>, value: T): void;
  export function hasContext<T>(key: ContextKey<T>): boolean;
}
