<script lang="ts">
  import domtoimage, { DomToImage } from "dom-to-image-more";
  import { faCamera } from "@fortawesome/free-solid-svg-icons";
  // weird hack to import svelte-fa bc of NodeNext module resolution
  import { default as Fa_1, type Fa as Fa_2 } from "svelte-fa";
  import ToolbarButton from "./ToolbarButton.svelte";
  import { toolKey } from "./toolKey.js";
  import { getContext } from "svelte-typed-context";
  const Fa = Fa_1 as any as typeof Fa_2;

  const dti: DomToImage = domtoimage as any;
  const takeScreenshot = () => {
    const wrappingDiv = getContext(toolKey)?.getWrapDiv();
    if (!wrappingDiv) {
      return;
    }
    dti.toPng(wrappingDiv).then((url) => {
      const link = document.createElement("a");
      link.download = `graph.png`;
      link.href = url;
      link.click();
    });
  };
</script>

<ToolbarButton on:click={takeScreenshot} title="Screenshot">
  <Fa icon={faCamera} />
</ToolbarButton>
