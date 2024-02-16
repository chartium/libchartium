<script lang="ts">
  import domtoimage from "dom-to-image-more";

  import { faCamera } from "@fortawesome/free-solid-svg-icons";
  import ToolbarButton from "./ToolbarButton.svelte";
  import { toolKey } from "./toolKey.js";
  import { getContext } from "svelte-typed-context";

  const dti: DomToImage = domtoimage as any;
  const takeScreenshot = () => {
    const wrappingDiv = getContext(toolKey)?.getWrapDiv();
    const filename = getContext(toolKey)?.getTitle?.() ?? "chartium";
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
