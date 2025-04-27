<!-- src/App.svelte -->
<script>
  import svelteLogo from './assets/svelte.svg'
  import viteLogo from '/vite.svg'
  import Counter from './lib/Counter.svelte'
  import Camera from './lib/components/Camera.svelte'
  import QRKiss from './lib/components/QRKiss.svelte'
  import QRKissDirect from './lib/components/QRKissDirect.svelte'
  import QRKissFinalize from './lib/components/QRKissFinalize.svelte'
  import QRDebugDemo from './lib/components/QRDebugDemo.svelte'
  import SimpleQRTest from './lib/components/SimpleQRTest.svelte'
  import JuiceTokenActionInitializer from './lib/components/JuiceTokenActionInitializer.svelte'
  
  // Simple navigation
  let currentPage = 'home';
  
  function navigate(page) {
    currentPage = page;
  }
  
  // Handle agreement finalization
  function handleFinalize(agreement) {
    console.log('Agreement finalized:', agreement);
    alert(`Agreement ${agreement.agreementId} successfully finalized!`);
  }
  
  // Handle token action initialization
  function handleTokenActionInitialized(event) {
    const action = event.detail.action;
    console.log('Token action initialized:', action);
    alert(`Token action ${action.id} initialized successfully! Type: ${action.type}, Amount: ${action.amount || 'N/A'}`);
  }
</script>

<main class="container mx-auto p-4">
  <!-- Navigation -->
  <nav class="mb-8">
    <ul class="flex space-x-4 justify-center flex-wrap">
      <li>
        <button 
          class="px-4 py-2 rounded {currentPage === 'home' ? 'bg-blue-500 text-white' : 'bg-gray-200'}"
          on:click={() => navigate('home')}
        >
          Home
        </button>
      </li>
      <li>
        <button 
          class="px-4 py-2 rounded {currentPage === 'camera' ? 'bg-blue-500 text-white' : 'bg-gray-200'}"
          on:click={() => navigate('camera')}
        >
          Camera
        </button>
      </li>
      <li>
        <button 
          class="px-4 py-2 rounded {currentPage === 'qrkiss' ? 'bg-blue-500 text-white' : 'bg-gray-200'}"
          on:click={() => navigate('qrkiss')}
        >
          QR Kiss
        </button>
      </li>
      <li>
        <button 
          class="px-4 py-2 rounded {currentPage === 'qrkiss-direct' ? 'bg-blue-500 text-white' : 'bg-gray-200'}"
          on:click={() => navigate('qrkiss-direct')}
        >
          QR Kiss (Direct)
        </button>
      </li>
      <li>
        <button 
          class="px-4 py-2 rounded {currentPage === 'qrkiss-finalize' ? 'bg-blue-500 text-white' : 'bg-gray-200'}"
          on:click={() => navigate('qrkiss-finalize')}
        >
          QR Kiss (Finalize)
        </button>
      </li>
      <li>
        <button 
          class="px-4 py-2 rounded {currentPage === 'debug' ? 'bg-blue-500 text-white' : 'bg-gray-200'}"
          on:click={() => navigate('debug')}
        >
          Debug Tools
        </button>
      </li>
      <li>
        <button 
          class="px-4 py-2 rounded {currentPage === 'simpletest' ? 'bg-blue-500 text-white' : 'bg-gray-200'}"
          on:click={() => navigate('simpletest')}
        >
          Simple QR Test
        </button>
      </li>
      <li>
        <button 
          class="px-4 py-2 rounded {currentPage === 'tokenactions' ? 'bg-blue-500 text-white' : 'bg-gray-200'}"
          on:click={() => navigate('tokenactions')}
        >
          Token Actions
        </button>
      </li>
    </ul>
  </nav>
  
  <!-- Pages -->
  {#if currentPage === 'home'}
    <!-- Original Vite Demo Content -->
    <div class="text-center">
      <div class="flex justify-center">
        <a href="https://vitejs.dev" target="_blank" rel="noreferrer">
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
  {:else if currentPage === 'camera'}
    <!-- Camera Test Section -->
    <div class="max-w-lg mx-auto p-4 bg-gray-50 rounded-lg shadow">
      <h2 class="text-xl font-semibold mb-4">Camera Test</h2>
      <Camera />
    </div>
  {:else if currentPage === 'qrkiss'}
    <!-- QR Kiss Section (Original) -->
    <div class="max-w-lg mx-auto p-4 bg-gray-50 rounded-lg shadow">
      <h2 class="text-xl font-semibold mb-4">QR Kiss</h2>
      <QRKiss />
    </div>
  {:else if currentPage === 'qrkiss-direct'}
    <!-- QR Kiss Section (Direct Version) -->
    <div class="max-w-lg mx-auto p-4 bg-gray-50 rounded-lg shadow">
      <h2 class="text-xl font-semibold mb-4">QR Kiss (Direct Version)</h2>
      <p class="text-sm text-gray-600 mb-4">This version uses a simplified approach without mirroring for better QR detection.</p>
      <QRKissDirect />
    </div>
  {:else if currentPage === 'qrkiss-finalize'}
    <!-- QR Kiss Finalization Section -->
    <div class="max-w-lg mx-auto p-4 bg-gray-50 rounded-lg shadow">
      <h2 class="text-xl font-semibold mb-4">QR Kiss (Finalization)</h2>
      <p class="text-sm text-gray-600 mb-4">Agreement finalization handshake mechanism.</p>
      <QRKissFinalize 
        agreementId="JUICE-123456"
        agreementType="transaction"
        agreementDescription="Transfer of 25 JUICE tokens"
        onFinalize={handleFinalize}
      />
    </div>
  {:else if currentPage === 'debug'}
    <!-- Debug Tools Section -->
    <div class="w-full mx-auto p-4 bg-gray-50 rounded-lg shadow">
      <h2 class="text-xl font-semibold mb-4">QR Debug Tools</h2>
      <QRDebugDemo />
    </div>
  {:else if currentPage === 'simpletest'}
    <!-- Simple QR Test Section -->
    <div class="w-full mx-auto p-4 bg-gray-50 rounded-lg shadow">
      <h2 class="text-xl font-semibold mb-4">Simple QR Test</h2>
      <SimpleQRTest />
    </div>
  {:else if currentPage === 'tokenactions'}
    <!-- Token Actions Section -->
    <div class="w-full mx-auto p-4 bg-gray-50 rounded-lg shadow">
      <h2 class="text-xl font-semibold mb-4">Ɉ Token Actions</h2>
      <p class="text-sm text-gray-600 mb-4">Initialize and manage Juice token actions using QR codes.</p>
      <JuiceTokenActionInitializer on:initialized={handleTokenActionInitialized} />
    </div>
  {/if}
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