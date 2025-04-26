<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { _ } from 'svelte-i18n';
  import jsQR from 'jsqr';
  
  export let facingMode = 'environment'; // Default to back camera for QR scanning
  export let onScan = (data: string) => {}; // Callback for when QR code is detected
  
  let videoElement: HTMLVideoElement;
  let canvasElement: HTMLCanvasElement;
  let canvasContext: CanvasRenderingContext2D | null;
  let stream: MediaStream | null = null;
  let scanInterval: number;
  let cameraActive = false;
  let errorMessage = '';
  let lastResult = '';
  
  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode }
      });
      
      if (videoElement) {
        videoElement.srcObject = stream;
        cameraActive = true;
        errorMessage = '';
        startScanning();
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      errorMessage = $_('camera.error');
    }
  }
  
  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
      cameraActive = false;
      stopScanning();
    }
  }
  
  function startScanning() {
    if (!canvasContext) {
      canvasContext = canvasElement.getContext('2d');
    }
    
    scanInterval = setInterval(scanQrCode, 200);
  }
  
  function stopScanning() {
    clearInterval(scanInterval);
  }
  
  function scanQrCode() {
    if (!videoElement || !canvasElement || !canvasContext || !cameraActive) return;
    
    if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
      canvasElement.height = videoElement.videoHeight;
      canvasElement.width = videoElement.videoWidth;
      
      canvasContext.drawImage(
        videoElement, 
        0, 0, 
        canvasElement.width, 
        canvasElement.height
      );
      
      const imageData = canvasContext.getImageData(
        0, 0, 
        canvasElement.width, 
        canvasElement.height
      );
      
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      
      if (code && code.data !== lastResult) {
        lastResult = code.data;
        onScan(code.data);
      }
    }
  }
  
  onMount(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      errorMessage = $_('camera.notSupported');
    }
  });
  
  onDestroy(() => {
    stopCamera();
  });
</script>

<div class="qr-scanner w-full max-w-lg mx-auto p-4">
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
        {$_('qrScanner.start')}
      </button>
    {:else}
      <button 
        class="bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 transition-colors"
        on:click={stopCamera}
      >
        {$_('qrScanner.stop')}
      </button>
    {/if}
  </div>
  
  {#if !cameraActive}
    <div class="p-6 bg-gray-100 text-center rounded border border-gray-300">
      {$_('qrScanner.instructions')}
    </div>
  {:else}
    <div class="relative bg-black rounded overflow-hidden">
      <video 
        bind:this={videoElement} 
        autoplay 
        playsinline 
        class="w-full"
      ></video>
      
      <canvas 
        bind:this={canvasElement} 
        class="absolute top-0 left-0 w-full h-full opacity-0"
      ></canvas>
      
      {#if lastResult}
        <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white p-3">
          <div class="font-bold mb-1">{$_('qrScanner.detected')}</div>
          <div class="text-sm break-all">{lastResult}</div>
        </div>
      {/if}
    </div>
  {/if}
</div>
