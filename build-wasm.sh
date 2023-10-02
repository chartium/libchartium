#!/bin/sh

cd src/rust
cargo build --release --target wasm32-unknown-unknown && \
wasm-bindgen --weak-refs --reference-types target/wasm32-unknown-unknown/release/libchartium.wasm --out-dir ../../dist/wasm/ --target web
cd ../../dist/wasm
mv libchartium_bg.wasm libchartium.wasm
mv libchartium_bg.wasm.d.ts libchartium.wasm.d.ts
