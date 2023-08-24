<button on:click>
  <slot />
</button>

<style>
  button {
    background: none;
    outline: none;
    border: none;

    padding: 0.5em;

    opacity: 0.6;
  }

  button:hover {
    opacity: 1;
  }
</style>
