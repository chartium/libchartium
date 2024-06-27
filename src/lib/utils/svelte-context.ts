import {
  getContext as getContext_,
  setContext as setContext_,
  hasContext as hasContext_,
} from "svelte";

// https://github.com/sveltejs/svelte/issues/8941#issuecomment-1927036924

export interface ContextKey<_T = unknown> {}

export function getContext<T>(key: ContextKey<T>): T {
  return getContext_(key);
}
export function setContext<T>(key: ContextKey<T>, value: T): T {
  return setContext_(key, value);
}
export function hasContext<T>(key: ContextKey<T>): boolean {
  return hasContext_(key);
}
