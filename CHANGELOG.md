# Changelog

## [0.21.0](https://github.com/chartium/libchartium/compare/libchartium-v0.20.1...libchartium-v0.21.0) (2024-07-19)


### Features

* **trace-list.ts:** overloaded fromThresholds to accept ChartValues too ([95e09bb](https://github.com/chartium/libchartium/commit/95e09bb7dadbb34fcadd176e040519c9a90c11d9))

## [0.20.1](https://github.com/chartium/libchartium/compare/libchartium-v0.20.0...libchartium-v0.20.1) (2024-07-09)


### Bug Fixes

* **stats-table:** the typical JS this issue, had to swap `Uint32Array.from` -&gt; `(v)=>Uint32Array.from(v)` ([259f449](https://github.com/chartium/libchartium/commit/259f4492663eef1aab3a98c59109ee071d2e4a9b))

## [0.20.0](https://github.com/chartium/libchartium/compare/libchartium-v0.19.0...libchartium-v0.20.0) (2024-07-02)


### Features

* **axisRange.ts:** threshold traces are no longer considered in autoscale range, only in the default reset range. Fixes [#103](https://github.com/chartium/libchartium/issues/103) ([ef504c2](https://github.com/chartium/libchartium/commit/ef504c274d8361e9083bc7fb5e3b64b08959ba28))
* change .exportData to return an iterator, add @typek/typek, minor fixes & refactors ([537b199](https://github.com/chartium/libchartium/commit/537b199d19e191d4039417ebaddd11e5abd91ca9))
* **Chart.svelte:** add $ suffix to common*AxisWidth props ([be6a7a4](https://github.com/chartium/libchartium/commit/be6a7a4dca74945ad2b303993e970afe95c41934))
* export more types and formatting functions ([91ca50b](https://github.com/chartium/libchartium/commit/91ca50ba1787f6e4187ae96be53c35b65af7d06f))
* improve ExportRow interface, move Queue and yeet to [@typek](https://github.com/typek) ([dd0a5d6](https://github.com/chartium/libchartium/commit/dd0a5d6a0c21238b5b6d8b8baac84a3634e4b5f7))


### Bug Fixes

* **TraceList:** return an empty list when given an empty buffer ([72d9072](https://github.com/chartium/libchartium/commit/72d9072701a938b07022ae3a5d27a1f0e8980c59))

## [0.19.0](https://github.com/chartium/libchartium/compare/libchartium-v0.18.0...libchartium-v0.19.0) (2024-06-25)


### Features

* add enter selection to context menus ([7ca2976](https://github.com/chartium/libchartium/commit/7ca2976a0cff32c26c53b13475531c8d5f668606))


### Bug Fixes

* **Chart.svelte:** change .ts import to .js ([bf39c94](https://github.com/chartium/libchartium/commit/bf39c94d0ec2dfeb6cd501018bdc577e4780f2a3))
* context menu smoothness, branch caret ([0636ec4](https://github.com/chartium/libchartium/commit/0636ec4dadf3c14beee30c86a334078e5c87645d))
* context menu visual improvements ([0fd3a99](https://github.com/chartium/libchartium/commit/0fd3a99ac09eafe2d5117e31295fc6c8788e0471))
* make lmb and rmb axis drag actions identical, closes [#85](https://github.com/chartium/libchartium/issues/85) ([b0d90df](https://github.com/chartium/libchartium/commit/b0d90dff756bc5ad02e01e30ea82adf9c24dd235))
* **mouseActions.ts:** removed dependency on MouseEvent's movement, fixes [#101](https://github.com/chartium/libchartium/issues/101) ([cb97125](https://github.com/chartium/libchartium/commit/cb971258b644d484fe8ab835697a509d91b8d96d))
* **package.json:** change entry to mod.js ([3e0d2b3](https://github.com/chartium/libchartium/commit/3e0d2b35266ba13a6030a8c9fca4acb9d173303a))
* remove svelte-typed-context ([586ae3f](https://github.com/chartium/libchartium/commit/586ae3fd1a3af889d1922d904ab75d9b665a35de))
* removed debug code ([a3b568f](https://github.com/chartium/libchartium/commit/a3b568f92fcafdfe0fae22183e9f74d8074a9787))
* **TraceTooltip.svelte:** Displayed X now corresponds to actual hover X ([0ab3d90](https://github.com/chartium/libchartium/commit/0ab3d907a607f6cd1e890094208fa5885873a89b))

## [0.18.0](https://github.com/chartium/libchartium/compare/libchartium-v0.17.1...libchartium-v0.18.0) (2024-06-16)


### Features

* exporting some range stuffs ([cd2f0ad](https://github.com/chartium/libchartium/commit/cd2f0adbe065a9ed8fe9529aabad56e6c7e9c746))

## [0.17.1](https://github.com/chartium/libchartium/compare/libchartium-v0.17.0...libchartium-v0.17.1) (2024-06-16)


### Bug Fixes

* pipeline corrections ([25d0f6b](https://github.com/chartium/libchartium/commit/25d0f6b1583bd2e063631fa6dc445ecfbe35736a))

## [0.17.0](https://github.com/chartium/libchartium/compare/libchartium-v0.16.69...libchartium-v0.17.0) (2024-06-16)


### Features

* wake up from a collective hallucination ([41f5275](https://github.com/chartium/libchartium/commit/41f52750d3bb47c955a1ca252251bea0cff3e970))
