<script lang="ts">
  import { toPng } from "html-to-image";
  import { faCamera } from "@fortawesome/free-solid-svg-icons";
  import ToolbarButton from "./ToolbarButton.svelte";
  import { toolKey } from "./toolKey.js";
  import { getContext } from "../../utils/svelte-context.js";
  import { yeet } from "@typek/typek";

  const { getWrapDiv, getTitle } =
    getContext(toolKey) ??
    yeet("Attempting to use a chart tool outside of a chart.");

  const takeScreenshot = () => {
    const wrappingDiv = getWrapDiv!();
    const filename = getTitle?.() || "chartium";
    if (!wrappingDiv) {
      return;
    }

    toPng(wrappingDiv, {
      width: wrappingDiv.clientWidth,
      height: wrappingDiv.clientHeight,
      filter: (node) =>
        !(node instanceof HTMLElement && node.classList.contains("toolbar")),
    }).then((dataUrl: string) => {
      const link = document.createElement("a");
      link.download = filename + ".png";
      link.href = dataUrl;
      link.click();
    });
  };
</script>

<ToolbarButton
  on:click={takeScreenshot}
  icon={faCamera}
  title="Export to PNG"
/>
