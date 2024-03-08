<script lang="ts">
  import domtoimage from "dom-to-image-more";
  type DomToImage = typeof import("dom-to-image").default;

  import { faCamera } from "@fortawesome/free-solid-svg-icons";
  import ToolbarButton from "./ToolbarButton.svelte";
  import { toolKey } from "./toolKey.js";
  import { getContext } from "svelte-typed-context";
  const getWrapDiv = getContext(toolKey)?.getWrapDiv;
  const getTitle = getContext(toolKey)?.getTitle;
  const dti: DomToImage = domtoimage as any;
  const takeScreenshot = () => {
    const wrappingDiv = getWrapDiv!();
    const filename = getTitle?.() || "chartium";
    if (!wrappingDiv) {
      return;
    }
    dti.toPng(wrappingDiv).then((url) => {
      const link = document.createElement("a");
      link.download = filename + ".png";
      link.href = url;
      link.click();
    });
  };
</script>

<ToolbarButton
  on:click={takeScreenshot}
  icon={faCamera}
  title="Export to PNG"
/>
