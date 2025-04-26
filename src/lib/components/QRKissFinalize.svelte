<!-- src/lib/components/QRKissFinalize.svelte
 * Simplified Escrow Finalization Component
 * Basic functionality with working camera
 */
-->
<script>
    import { onMount, onDestroy } from 'svelte';
    import jsQR from 'jsqr';
    import QRCode from 'qrcode';
    
    // Props
    export let mode = 'initiator'; // 'initiator' or 'responder'
    export let agreementId = 'AGR-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    export let onFinalize = (agreement) => console.log('Agreement finalized:', agreement);
    export let agreementType = 'transaction';
    export let agreementDescription = 'Token release';
    
    // Local state
    let videoElement;
    let canvasElement;
    let canvasContext;
    let animationFrameId = null;
    let stream = null;
    let qrCodeData = '';
    let qrImageSrc = '';
    let state = 'initial'; // 'initial', 'detected', 'completed', 'failed'
    let boxColor = '#3498db'; // Blue for initial state
    
    // Debug state
    let lastScannedQR = '';
    let scanCount = 0;
    
    // Initialize QR and camera
    onMount(async () => {
      await generateQR();
      await startCamera();
    });
    
    onDestroy(() => {
      stopScanning();
      stopCamera();
    });
    
    async function generateQR() {
      // Create a simple QR with role + agreement ID
      const prefix = mode === 'initiator' ? 'I' : 'R';
      qrCodeData = `${prefix}${agreementId}`;
      
      // Generate QR code
      qrImageSrc = await QRCode.toDataURL(qrCodeData, {
        errorCorrectionLevel: 'H',
        margin: 1,
        scale: 10,
      });
      
      console.log("QR generated:", qrCodeData);
    }
    
    async function startCamera() {
      try {
        const constraints = {
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        };
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (videoElement) {
          videoElement.srcObject = stream;
          await videoElement.play();
          
          // Set canvas dimensions based on video
          canvasElement.width = videoElement.videoWidth;
          canvasElement.height = videoElement.videoHeight;
          canvasContext = canvasElement.getContext('2d');
          
          console.log("Camera started with dimensions:", 
                      canvasElement.width, "x", canvasElement.height);
          
          // Start scanning after camera is initialized
          startScanning();
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
      }
    }
    
    function stopCamera() {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
    }
    
    function startScanning() {
      if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(scan);
      }
    }
    
    function stopScanning() {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    }
    
    function scan() {
      // Check if video and canvas elements are ready
      if (!videoElement || !canvasContext || videoElement.readyState < 2) {
        animationFrameId = requestAnimationFrame(scan);
        return;
      }
      
      // Draw video frame to canvas
      canvasContext.drawImage(
        videoElement, 
        0, 0, 
        canvasElement.width, canvasElement.height
      );
      
      // Get image data from the center portion
      const centerX = canvasElement.width / 2 - 120;
      const centerY = canvasElement.height / 2 - 120;
      
      try {
        const imageData = canvasContext.getImageData(
          0, 0, 
          canvasElement.width, canvasElement.height
        );
        
        // Draw scanning rectangle
        canvasContext.strokeStyle = boxColor;
        canvasContext.lineWidth = 4;
        canvasContext.strokeRect(centerX, centerY, 240, 240);
        
        // Attempt to find QR code
        const code = jsQR(
          imageData.data,
          imageData.width,
          imageData.height,
          { inversionAttempts: "dontInvert" }
        );
        
        if (code) {
          // We found a QR code!
          console.log("QR code detected:", code.data);
          scanCount++;
          lastScannedQR = code.data;
          
          // Add vibration feedback
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
          
          // Draw the QR code location
          drawQRCodeOutline(code.location);
          
          // Process the QR code
          processQRCode(code.data);
        }
      } catch (error) {
        console.error('Error processing scan:', error);
      }
      
      // Continue scanning
      animationFrameId = requestAnimationFrame(scan);
    }
    
    function drawQRCodeOutline(location) {
      if (!location || !canvasContext) return;
      
      canvasContext.strokeStyle = '#FF3B58';
      canvasContext.lineWidth = 4;
      
      // Draw the QR code outline
      canvasContext.beginPath();
      canvasContext.moveTo(location.topLeftCorner.x, location.topLeftCorner.y);
      canvasContext.lineTo(location.topRightCorner.x, location.topRightCorner.y);
      canvasContext.lineTo(location.bottomRightCorner.x, location.bottomRightCorner.y);
      canvasContext.lineTo(location.bottomLeftCorner.x, location.bottomLeftCorner.y);
      canvasContext.lineTo(location.topLeftCorner.x, location.topLeftCorner.y);
      canvasContext.stroke();
    }
    
    function processQRCode(data) {
      // Simple validation - check if this is the counterparty
      if (!data || data.length < 2) return;
      
      const firstChar = data.charAt(0);
      const scannedAgreementId = data.substring(1);
      
      // Check if this is the correct counterparty role
      const expectedOtherMode = mode === 'initiator' ? 'R' : 'I';
      
      if (firstChar !== expectedOtherMode) {
        console.log(`Wrong party type: ${firstChar}, expected: ${expectedOtherMode}`);
        return;
      }
      
      // Check if agreement ID matches
      if (scannedAgreementId !== agreementId) {
        console.log(`Agreement ID mismatch: ${scannedAgreementId}, ours: ${agreementId}`);
        return;
      }
      
      // We found a valid counterparty!
      console.log("Valid finalization counterparty found!");
      state = 'detected';
      boxColor = '#f39c12'; // Orange
      
      // Complete after a short delay
      setTimeout(() => {
        completeFinalization();
      }, 1000);
    }
    
    function completeFinalization() {
      state = 'completed';
      boxColor = '#2ecc71'; // Green
      
      // Vibration feedback
      if (navigator.vibrate) {
        navigator.vibrate([100, 30, 100, 30, 100]);
      }
      
      // Create result object
      const result = {
        agreementId,
        agreementType,
        timestamp: Date.now(),
        status: 'completed',
        role: mode
      };
      
      // Notify parent component
      setTimeout(() => {
        onFinalize(result);
      }, 500);
    }
    
    function toggleMode() {
      mode = mode === 'initiator' ? 'responder' : 'initiator';
      state = 'initial';
      boxColor = '#3498db';
      generateQR();
    }
  </script>
  
  <div class="qrkiss-container">
    <div class="agreement-info">
      <div class="agreement-type">{agreementType.toUpperCase()}</div>
      <div class="agreement-id">{agreementId}</div>
      <div class="agreement-description">{agreementDescription}</div>
    </div>
  
    <!-- Fixed layout - QR on top, camera on bottom -->
    <div class="layout-container">
      <!-- QR Code display -->
      <div class="qr-display" style="border-color: {boxColor}">
        {#if qrImageSrc}
          <img src={qrImageSrc} alt="QR Code" class="qr-image" />
        {/if}
        
        <div class="qr-label">
          {mode === 'initiator' ? 'INITIATOR CODE' : 'RESPONDER CODE'}
        </div>
      </div>
      
      <!-- QR Scanner -->
      <div class="scanner-container">
        <video 
          bind:this={videoElement} 
          autoplay 
          playsinline 
          muted
          class="scanner-video"
        ></video>
        <canvas 
          bind:this={canvasElement} 
          class="scanner-canvas"
        ></canvas>
        
        <div class="scanner-overlay">
          <div class="camera-label">
            SCAN COUNTERPARTY
          </div>
          
          <div class="state-indicator" style="background-color: {boxColor}">
            {state === 'initial' ? 'Ready to scan' : 
             state === 'detected' ? 'Counterparty detected' :
             state === 'completed' ? 'Finalization complete!' : state}
          </div>
        </div>
      </div>
    </div>
    
    <!-- Mode selection -->
    <div class="mode-selector">
      <button 
        class="mode-button {mode === 'initiator' ? 'active' : ''}" 
        on:click={() => toggleMode()}
        disabled={state === 'completed'}
      >
        {mode === 'initiator' ? '✓ Initiator' : 'Switch to Initiator'}
      </button>
      <button 
        class="mode-button {mode === 'responder' ? 'active' : ''}" 
        on:click={() => toggleMode()}
        disabled={state === 'completed'}
      >
        {mode === 'responder' ? '✓ Responder' : 'Switch to Responder'}
      </button>
    </div>
    
    <!-- Status display -->
    {#if state === 'completed'}
      <div class="success-message">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <span>Agreement Successfully Finalized!</span>
      </div>
    {/if}
    
    <!-- Debug info -->
    <div class="debug-panel">
      <h3>Debug Info</h3>
      <div class="debug-row">
        <span class="debug-label">State:</span>
        <span class="debug-value">{state}</span>
      </div>
      <div class="debug-row">
        <span class="debug-label">Scans:</span>
        <span class="debug-value">{scanCount}</span>
      </div>
      <div class="debug-row">
        <span class="debug-label">Last QR:</span>
        <span class="debug-value">{lastScannedQR || 'None'}</span>
      </div>
    </div>
  </div>
  
  <style>
    .qrkiss-container {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 500px;
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    
    .agreement-info {
      background-color: #f8f9fa;
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    
    .agreement-type {
      font-size: 12px;
      font-weight: bold;
      color: #6c757d;
      letter-spacing: 1px;
    }
    
    .agreement-id {
      font-size: 18px;
      font-weight: bold;
      font-family: monospace;
      color: #343a40;
      margin: 4px 0;
    }
    
    .agreement-description {
      font-size: 14px;
      color: #495057;
    }
    
    /* Layout container with fixed direction */
    .layout-container {
      display: flex;
      flex-direction: column;
      gap: 15px;
      width: 100%;
    }
    
    .qr-display {
      width: 100%;
      padding: 15px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background-color: white;
      border-radius: 12px;
      border-style: solid;
      border-width: 10px;
      box-sizing: border-box;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      transition: border-color 0.3s ease;
    }
    
    .qr-image {
      width: 200px;
      height: 200px;
    }
    
    .qr-label {
      margin-top: 10px;
      font-weight: bold;
      color: #555;
      font-size: 14px;
    }
    
    .scanner-container {
      width: 100%;
      height: 300px;
      position: relative;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    
    .scanner-video {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .scanner-canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }
    
    .scanner-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      pointer-events: none;
    }
    
    .camera-label {
      background-color: rgba(0, 0, 0, 0.5);
      color: white;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      margin-top: 10px;
    }
    
    .state-indicator {
      width: 100%;
      padding: 8px 0;
      text-align: center;
      color: white;
      font-weight: bold;
      font-size: 14px;
      transition: background-color 0.3s ease;
    }
    
    .mode-selector {
      display: flex;
      gap: 8px;
    }
    
    .mode-button {
      flex: 1;
      padding: 8px;
      border: none;
      border-radius: 4px;
      background-color: #f0f0f0;
      color: #333;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .mode-button.active {
      background-color: #3498db;
      color: white;
    }
    
    .mode-button:hover:not(.active):not(:disabled) {
      background-color: #e0e0e0;
    }
    
    .mode-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .success-message {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 12px;
      border-radius: 8px;
      font-weight: bold;
      background-color: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    
    /* Debug panel */
    .debug-panel {
      margin-top: 15px;
      padding: 10px;
      background-color: #333;
      border-radius: 8px;
      font-size: 13px;
      color: #fff;
    }
    
    .debug-panel h3 {
      margin: 0 0 8px 0;
      font-size: 15px;
      color: #4fc3f7;
      border-bottom: 1px solid #444;
      padding-bottom: 4px;
    }
    
    .debug-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px solid #444;
    }
    
    .debug-label {
      color: #aaa;
    }
    
    .debug-value {
      font-family: monospace;
      color: #8bc34a;
      max-width: 70%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  </style>