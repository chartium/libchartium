import { BiMap } from "@risai/bim";

import type { VariantHandle } from "../types.js";
export const variantIds = new BiMap<VariantHandle, string>();

let nextVariantHandle: VariantHandle = 1;
export function registerNewVariantHandle(id: string): VariantHandle {
  const handle = nextVariantHandle++;
  variantIds.set(handle, id);
  return handle;
}
