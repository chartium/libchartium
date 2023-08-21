<!-- Svelte component that represents one element of context menu that holds any information -->
<script lang="ts">
    export let callback: () => void;
</script>

<div on:click={callback} on:keypress={callback}>
    <slot />
</div>

<style>
</style>
