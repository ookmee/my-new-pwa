<!-- src/lib/components/QRScannerDebug.svelte -->
<script>
    import { onMount, onDestroy } from 'svelte';
    import jsQR from 'jsqr';
    
    // Props
    export let onScan = (data) => console.log('QR Scanned:', data);
    export let facingMode = 'user'; // 'user' for front camera, 'environment' for back camera
    export let boxSize = 200; // Size of the QR box in pixels
    export let debounceTime = 200; // Debounce time in ms
    
    // Local state
    let videoElement;
    let canvasElement;
    let canvasContext;
    let scanInterval;
    let stream;
    let boxStatus = 'inactive'; // 'inactive', 'detected', 'confirmed', 'success'
    let lastDetectedQR = null;
    let debounceTimeout = null;
    
    // Debug info
    let scanCount = 0;
    let lastFrameTime = 0;
    let fps = 0;
    let qrDetected = false;
    let scanActive = false;
    
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
      scanActive = true;
      scan();
    }
    
    function stopScanning() {
      scanActive = false;
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
      const now = performance.now();
      if (lastFrameTime) {
        fps = Math.round(1000 / (now - lastFrameTime));
      }
      lastFrameTime = now;
      
      scanCount++;
      
      if (!videoElement || !canvasContext) {
        animationFrameId = requestAnimationFrame(scan);
        return;
      }
      
      if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
        // Draw video frame to canvas
        canvasContext.drawImage(
          videoElement, 
          0, 0, 
          canvasElement.width, 
          canvasElement.height
        );
        
        // Get image data from the center portion (where QR box is shown)
        const centerX = canvasElement.width / 2 - boxSize / 2;
        const centerY = canvasElement.height / 2 - boxSize / 2;
        
        const imageData = canvasContext.getImageData(
          centerX, 
          centerY, 
          boxSize, 
          boxSize
        );
        
        // Draw a rectangle on the canvas to show where we're scanning
        canvasContext.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        canvasContext.lineWidth = 2;
        canvasContext.strokeRect(centerX, centerY, boxSize, boxSize);
        
        // Attempt to detect QR code
        const code = jsQR(
          imageData.data, 
          imageData.width, 
          imageData.height, 
          {
            inversionAttempts: "dontInvert"
          }
        );
        
        qrDetected = !!code;
        
        // Process any detected QR code with debounce
        if (code) {
          const currentQRData = code.data;
          
          // Draw the QR code location
          if (code.location) {
            canvasContext.strokeStyle = '#FF3B58';
            canvasContext.lineWidth = 4;
            
            // Adjust for the offset
            const drawLine = (begin, end) => {
              canvasContext.beginPath();
              canvasContext.moveTo(begin.x + centerX, begin.y + centerY);
              canvasContext.lineTo(end.x + centerX, end.y + centerY);
              canvasContext.stroke();
            };
            
            drawLine(code.location.topLeftCorner, code.location.topRightCorner);
            drawLine(code.location.topRightCorner, code.location.bottomRightCorner);
            drawLine(code.location.bottomRightCorner, code.location.bottomLeftCorner);
            drawLine(code.location.bottomLeftCorner, code.location.topLeftCorner);
          }
          
          // Clear previous timeout
          if (debounceTimeout) {
            clearTimeout(debounceTimeout);
          }
          
          // Only process if it's a new QR code or if the previous one was debounced
          if (!lastDetectedQR || lastDetectedQR !== currentQRData) {
            boxStatus = 'detected';
            lastDetectedQR = currentQRData;
            
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
      if (scanActive) {
        animationFrameId = requestAnimationFrame(scan);
      }
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
  </script>
  
  <div class="qr-scanner-container">
    <video 
      bind:this={videoElement} 
      autoplay 
      playsinline 
      muted
      class="qr-video"
    ></video>
    
    <div 
      class="qr-box"
      style="width: {boxSize}px; height: {boxSize}px;"
    >
      <slot></slot>
    </div>
    
    <canvas bind:this={canvasElement} class="qr-canvas" width="400" height="300"></canvas>
  </div>
  
  <!-- Debug overlay - moved OUTSIDE the scanner container -->
  <div class="debug-overlay">
    <div class="debug-item">FPS: {fps}</div>
    <div class="debug-item">Scan Count: {scanCount}</div>
    <div class="debug-item">QR Detected: {qrDetected ? 'YES' : 'NO'}</div>
    <div class="debug-item">Status: {boxStatus}</div>
    <div class="debug-item">Last QR: {lastDetectedQR ? lastDetectedQR.substring(0, 20) + '...' : 'None'}</div>
  </div>
  
  <style>
    .qr-scanner-container {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    
    .qr-video {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
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
    
    .qr-canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 5;
    }
    
    .debug-overlay {
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 10px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 12px;
      margin-top: 10px;
    }
    
    .debug-item {
      margin: 5px 0;
    }
  </style>