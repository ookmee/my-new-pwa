<!-- src/lib/components/QRScannerMirrored.svelte -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import jsQR from 'jsqr';
  
  // Props
  export let onScan = (data) => console.log('QR Scanned:', data);
  export let facingMode = 'user'; // 'user' for front camera, 'environment' for back camera
  export let boxSize = 200; // Size of the QR box in pixels
  export let debounceTime = 200; // Debounce time in ms
  export let mirrored = true; // Mirror the camera view for more intuitive use
  
  // Local state
  let videoElement;
  let canvasElement;
  let canvasContext;
  let scanInterval;
  let stream;
  let boxStatus = 'inactive'; // 'inactive', 'detected', 'confirmed', 'success'
  let lastDetectedQR = null;
  let debounceTimeout = null;
  
  // Create a stable reference to avoid re-renders
  let animationFrameId = null;
  
  onMount(async () => {
    await startCamera();
    startScanning();
  });
  
  onDestroy(() => {
    stopCamera();
    stopScanning();
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  });
  
  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      if (videoElement) {
        videoElement.srcObject = stream;
        await videoElement.play();
        
        // Set canvas dimensions to match video
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        canvasContext = canvasElement.getContext('2d');
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
    }
  }
  
  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  }
  
  function startScanning() {
    scan();
  }
  
  function stopScanning() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
      debounceTimeout = null;
    }
  }
  
  function scan() {
    if (!videoElement || !canvasContext) {
      animationFrameId = requestAnimationFrame(scan);
      return;
    }
    
    if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
      // Clear the canvas first
      canvasContext.clearRect(0, 0, canvasElement.width, canvasElement.height);
      
      if (mirrored && facingMode === 'user') {
        // Mirror the canvas for front camera
        canvasContext.save();
        canvasContext.translate(canvasElement.width, 0);
        canvasContext.scale(-1, 1);
        canvasContext.drawImage(
          videoElement, 
          0, 0, 
          canvasElement.width, 
          canvasElement.height
        );
        canvasContext.restore();
      } else {
        // Normal drawing for back camera
        canvasContext.drawImage(
          videoElement, 
          0, 0, 
          canvasElement.width, 
          canvasElement.height
        );
      }
      
      // Draw the scanning box for visual reference
      const centerX = canvasElement.width / 2 - boxSize / 2;
      const centerY = canvasElement.height / 2 - boxSize / 2;
      canvasContext.strokeStyle = getBoxStatusColor();
      canvasContext.lineWidth = 3;
      canvasContext.strokeRect(centerX, centerY, boxSize, boxSize);
      
      // Get image data from the center portion (where QR box is shown)
      const imageData = canvasContext.getImageData(
        centerX, 
        centerY, 
        boxSize, 
        boxSize
      );
      
      // For QR detection, we need the original (non-mirrored) data
      // jsQR library works on the actual pixel data, not what's displayed
      const code = jsQR(
        imageData.data, 
        imageData.width, 
        imageData.height, 
        {
          inversionAttempts: "dontInvert"
        }
      );
      
      // Process any detected QR code with debounce
      if (code) {
        const currentQRData = code.data;
        
        // Clear previous timeout
        if (debounceTimeout) {
          clearTimeout(debounceTimeout);
        }
        
        // Only process if it's a new QR code or if the previous one was debounced
        if (!lastDetectedQR || lastDetectedQR !== currentQRData) {
          boxStatus = 'detected';
          lastDetectedQR = currentQRData;
          
          // Draw the QR location if detected
          if (code.location) {
            // Get the QR code corners
            const { topLeftCorner, topRightCorner, bottomRightCorner, bottomLeftCorner } = code.location;
            
            // Draw the QR code outline
            canvasContext.beginPath();
            canvasContext.moveTo(centerX + topLeftCorner.x, centerY + topLeftCorner.y);
            canvasContext.lineTo(centerX + topRightCorner.x, centerY + topRightCorner.y);
            canvasContext.lineTo(centerX + bottomRightCorner.x, centerY + bottomRightCorner.y);
            canvasContext.lineTo(centerX + bottomLeftCorner.x, centerY + bottomLeftCorner.y);
            canvasContext.lineTo(centerX + topLeftCorner.x, centerY + topLeftCorner.y);
            canvasContext.strokeStyle = '#FF3B58';
            canvasContext.lineWidth = 2;
            canvasContext.stroke();
          }
          
          // Set debounce timeout
          debounceTimeout = setTimeout(() => {
            // Execute the callback with the QR data
            onScan(currentQRData);
            
            // Provide haptic feedback
            if (navigator.vibrate) {
              navigator.vibrate(50); // Short vibration
            }
            
            // Visual feedback
            boxStatus = 'confirmed';
            setTimeout(() => {
              boxStatus = 'detected';
            }, 200);
            
            debounceTimeout = null;
          }, debounceTime);
        }
      } else {
        // No QR code detected
        boxStatus = 'inactive';
        lastDetectedQR = null;
        
        if (debounceTimeout) {
          clearTimeout(debounceTimeout);
          debounceTimeout = null;
        }
      }
    }
    
    // Schedule next scan
    animationFrameId = requestAnimationFrame(scan);
  }
  
  function getBoxStatusColor() {
    switch (boxStatus) {
      case 'detected':
        return 'orange';
      case 'confirmed':
        return 'orange';
      case 'success':
        return 'green';
      default:
        return 'red';
    }
  }
  
  function setSuccess() {
    boxStatus = 'success';
    if (navigator.vibrate) {
      navigator.vibrate(500); // Long vibration on success
    }
  }
</script>

<div class="qr-scanner-container">
  <!-- Visible canvas with mirrored view -->
  <canvas bind:this={canvasElement} class="qr-canvas-visible"></canvas>
  
  <!-- Hidden video element used for capturing -->
  <video 
    bind:this={videoElement} 
    autoplay 
    playsinline 
    muted
    class="hidden-video"
  ></video>
  
  <!-- Box for content (like QR code) -->
  <div 
    class="qr-box"
    style="width: {boxSize}px; height: {boxSize}px;"
  >
    <slot></slot>
  </div>
</div>

<style>
  .qr-scanner-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  
  .qr-canvas-visible {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .hidden-video {
    position: absolute;
    top: 0;
    left: 0;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }
  
  .qr-box {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 10;
    width: 100%;
    height: 100%;
  }
</style>