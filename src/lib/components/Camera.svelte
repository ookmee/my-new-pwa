<script>
  import { onMount, onDestroy } from 'svelte';
  
  export let facingMode = 'user'; // 'user' for front camera, 'environment' for back
  
  let videoElement;
  let stream = null;
  let cameraActive = false;
  let errorMessage = '';
  
  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode }
      });
      
      if (videoElement) {
        videoElement.srcObject = stream;
        cameraActive = true;
        errorMessage = '';
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      errorMessage = 'Failed to access camera';
    }
  }
  
  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
      cameraActive = false;
    }
  }
  
  onMount(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      errorMessage = 'Camera not supported in this browser';
    }
  });
  
  onDestroy(() => {
    stopCamera();
  });
</script>

<div class="camera-container w-full max-w-lg mx-auto p-4">
  {#if errorMessage}
    <div class="bg-red-100 text-red-700 p-4 rounded mb-4">
      {errorMessage}
    </div>
  {/if}
  
  <div class="mb-4">
    {#if !cameraActive}
      <button 
        class="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors"
        on:click={startCamera}
      >
        Start Camera
      </button>
    {:else}
      <button 
        class="bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 transition-colors"
        on:click={stopCamera}
      >
        Stop Camera
      </button>
    {/if}
  </div>
  
  <div class="bg-black rounded overflow-hidden">
    <video 
      bind:this={videoElement} 
      autoplay 
      playsinline 
      class="w-full"
    ></video>
  </div>
</div>
