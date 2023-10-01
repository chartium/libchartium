pnpm build-wasm
svelte-package -i src/lib -o dist/lib
rm -rf src/utils/*.d.ts
