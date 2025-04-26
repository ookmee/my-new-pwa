<script lang="ts">
  import svelteLogo from './assets/svelte.svg'
  import viteLogo from '/vite.svg'
  import Counter from './lib/Counter.svelte'
  import { _ } from 'svelte-i18n';
  import Camera from './lib/components/Camera.svelte';
</script>

<main class="container mx-auto p-4">
  <!-- Camera Test Section -->
  <div class="max-w-lg mx-auto mb-10 p-4 bg-gray-50 rounded-lg shadow">
    <h2 class="text-xl font-semibold mb-4">{$_('camera.title', { default: 'Camera Test' })}</h2>
    <Camera />
  </div>
  
  <!-- Original Vite Demo Content -->
  <div class="text-center">
    <div class="flex justify-center">
      <a href="https://vite.dev" target="_blank" rel="noreferrer">
        <img src={viteLogo} class="logo" alt="Vite Logo" />
      </a>
      <a href="https://svelte.dev" target="_blank" rel="noreferrer">
        <img src={svelteLogo} class="logo svelte" alt="Svelte Logo" />
      </a>
    </div>
    <h1 class="text-3xl font-bold my-4">Vite + Svelte</h1>

    <div class="card">
      <Counter />
    </div>

    <p class="my-4">
      Check out <a href="https://github.com/sveltejs/kit#readme" target="_blank" rel="noreferrer" class="text-blue-600 hover:underline">SvelteKit</a>, the official Svelte app framework powered by Vite!
    </p>

    <p class="read-the-docs">
      Click on the Vite and Svelte logos to learn more
    </p>
  </div>
</main>

<style>
  .logo {
    height: 6em;
    padding: 1.5em;
    will-change: filter;
    transition: filter 300ms;
  }
  .logo:hover {
    filter: drop-shadow(0 0 2em #646cffaa);
  }
  .logo.svelte:hover {
    filter: drop-shadow(0 0 2em #ff3e00aa);
  }
  .read-the-docs {
    color: #888;
  }
</style>