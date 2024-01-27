<script lang="ts">
  import { faFileCsv } from "@fortawesome/free-solid-svg-icons";
  import ToolbarButton from "./ToolbarButton.svelte";
  import { toolKey } from "./toolKey.js";
  import { getContext } from "svelte-typed-context";
</script>

<ToolbarButton
  on:click={() => console.log("uwu not impleneted xd")}
  icon={faFileCsv}
  title="Export to PNG"
/>
