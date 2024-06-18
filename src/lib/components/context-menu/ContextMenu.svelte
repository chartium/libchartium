<!-- Context menu component -->

<script lang="ts" generics="T">
  import type { ContextItem } from "./contextMenu.js";
  import GenericContextMenu from "./GenericContextMenu.svelte";

  export let items: ContextItem<T>[];
</script>

<GenericContextMenu {items} />
