<script lang="ts">
    import { Item, Divider } from "svelte-contextmenu";
    import type { ContextItem } from "../types";

    export let items: ContextItem[];

    function showSelf() {
        console.log("showSelf");
    }

    function closeSelf() {
        console.log("closeSelf");
    }
</script>

<div>
{#each items as item}
    {#if item.type === "leaf"}
        <Item on:click={item.callback}>{item.text}</Item>
    {/if}
    {#if item.type === "separator"}
        <Divider />
    {/if}
    {#if item.type === "branch"}
        <svelte:self items={item.children} />
    {/if}
{/each}
</div>