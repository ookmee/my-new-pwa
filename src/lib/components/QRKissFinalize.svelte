<!-- src/lib/components/QRKissFinalize.svelte
 * Escrow/Agreement finalization component
 * Uses a direct approach to resolve agreements like escrow
 * Releases tokens that are in suspense on devices of both parties
 */
-->
<script>
    import { onMount, onDestroy } from 'svelte';
    import jsQR from 'jsqr';
    import QRCode from 'qrcode';
    
    // Props
    export let mode = 'initiator'; // 'initiator' or 'responder'
    export let agreementId = 'AGR-' + Math.random().toString(36).substring(2, 6).toUpperCase(); // Short agreement ID
    export let onFinalize = (agreement) => console.log('Agreement finalized:', agreement);
    export let agreementType = 'transaction'; // Could be 'transaction', 'contract', 'access', etc.
    export let agreementDescription = 'Token release'; // Human-readable description
    
    // Local state
    let videoElement;
    let canvasElement;
    let canvasContext;
    let animationFrameId = null;
    let stream = null;
    let qrCodeData = '';
    let qrImageSrc = '';
    let state = 'initial'; // 'initial', 'detected', 'verified', 'completed', 'failed'
    let boxColor = '#3498db'; // Blue for initial state
    
    // Debug state
    let lastScannedQR = '';
    let scanCount = 0;
    let lastScanTime = 0;
    let error = '';
    
    // Initialize QR and camera
    onMount(async () => {
      await generateQRCode();
      await startCamera();
    });
    
    onDestroy(() => {
      stopScanning();
      stopCamera();
    });
    
    async function generateQRCode() {
      // Very simple QR with minimal data for better scanning
      // Format: [MODE][AGREEMENT_ID]
      const codePrefix = mode === 'initiator' ? 'I' : 'R';
      qrCodeData = `${codePrefix}${agreementId}`;
      
      // Generate QR with large blocks and max error correction
      qrImageSrc = await QRCode.toDataURL(qrCodeData, {
        errorCorrectionLevel: 'H', // Highest error correction
        margin: 1, // Small margin
        scale: 16, // Very large scale for better visibility
        version: 2 // Force low version (fewer modules = larger blocks)
      });
      
      console.log("Generated finalize QR:", qrCodeData);
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
          
          canvasElement.width = videoElement.videoWidth;
          canvasElement.height = videoElement.videoHeight;
          canvasContext = canvasElement.getContext('2d');
          
          console.log("Camera started successfully");
          startScanning();
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        error = "Camera error: " + err.message;
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
      if (!videoElement || !canvasContext || !videoElement.srcObject) {
        animationFrameId = requestAnimationFrame(scan);
        return;
      }
      
      if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
        // Draw video frame to canvas
        canvasContext.drawImage(
          videoElement,
          0, 0,
          canvasElement.width, canvasElement.height
        );
        
        // Get image data from the entire canvas
        const imageData = canvasContext.getImageData(
          0, 0,
          canvasElement.width, canvasElement.height
        );
        
        // Draw a rectangle on the canvas to show where we're scanning
        const centerX = canvasElement.width / 2 - 120;
        const centerY = canvasElement.height / 2 - 120;
        canvasContext.strokeStyle = boxColor;
        canvasContext.lineWidth = 4;
        canvasContext.strokeRect(centerX, centerY, 240, 240);
        
        try {
          // Attempt to find a QR code in the image
          const code = jsQR(
            imageData.data,
            imageData.width,
            imageData.height,
            { inversionAttempts: "dontInvert" }
          );
          
          if (code) {
            // We found a QR code!
            console.log("QR code detected:", code.data);
            
            // Update scan stats
            scanCount++;
            lastScannedQR = code.data;
            lastScanTime = Date.now();
            
            // Add vibration feedback
            if (navigator.vibrate) {
              navigator.vibrate(50);
            }
            
            // Draw the found QR location
            drawQRCodeOutline(code.location);
            
            // Process the QR code data
            processQRData(code.data);
          }
        } catch (error) {
          console.error('Error processing QR data:', error);
        }
      }
      
      // Schedule next scan
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
    
    function processQRData(data) {
      try {
        // Very simplified format processing
        // Format: [MODE][AGREEMENT_ID] - e.g. 'IAGR-12345'
        const firstChar = data.charAt(0);
        const scannedAgreementId = data.substring(1);
        
        // Check if this is a valid counterparty
        const expectedOtherMode = mode === 'initiator' ? 'R' : 'I';
        
        if (firstChar !== expectedOtherMode) {
          console.log(`Wrong party type: ${firstChar}, expected: ${expectedOtherMode}`);
          return;
        }
        
        // Check if this is for our agreement
        if (scannedAgreementId !== agreementId) {
          console.log(`Agreement ID mismatch: ${scannedAgreementId}, ours: ${agreementId}`);
          return;
        }
        
        // If we get here, it's a valid counterparty for our agreement
        console.log("Valid finalization counterparty found!");
        
        if (state !== 'completed') {
          state = 'verified';
          boxColor = '#f39c12'; // Orange for verification
          
          // Auto-complete after a short delay for user feedback
          setTimeout(() => {
            completeFinalization();
          }, 800);
        }
      } catch (err) {
        console.error('Error processing QR data format:', err);
        error = err.message;
      }
    }
    
    function completeFinalization() {
      state = 'completed';
      boxColor = '#2ecc71'; // Green for completed
      
      // Provide haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([100, 30, 100, 30, 100]); // Pattern for success
      }
      
      // Generate result object
      const result = {
        agreementId,
        agreementType,
        timestamp: Date.now(),
        status: 'completed',
        role: mode,
        description: agreementDescription
      };
      
      // Notify parent component after a brief delay for visual feedback
      setTimeout(() => {
        onFinalize(result);
      }, 500);
    }
    
    function toggleMode() {
      mode = mode === 'initiator' ? 'responder' : 'initiator';
      // Reset state
      state = 'initial';
      boxColor = '#3498db';
      // Generate new QR code
      generateQRCode();
    }
    
    function getTimeSince(timestamp) {
      if (!timestamp) return 'N/A';
      const seconds = Math.floor((Date.now() - timestamp) / 1000);
      return seconds + 's ago';
    }
    
    function getStateDescription() {
      switch (state) {
        case 'initial': return 'Ready to scan';
        case 'detected': return 'QR code detected';
        case 'verified': return 'Verifying agreement...';
        case 'completed': return 'Agreement finalized!';
        case 'failed': return 'Finalization failed';
        default: return state;
      }
    }
  </script>
  
  <div class="qrkiss-container">
    <div class="agreement-info">
      <div class="agreement-type">{agreementType.toUpperCase()}</div>
      <div class="agreement-id">{agreementId}</div>
      <div class="agreement-description">{agreementDescription}</div>
    </div>
  
    <!-- Fixed layout - QR on top, camera on bottom for both roles -->
    <div class="layout-container">
      <!-- QR Code display -->
      <div class="qr-display" style="border-color: {boxColor}">
        {#if qrImageSrc}
          <img src={qrImageSrc} alt="QR Code" class="qr-image" />
        {/if}
        
        <!-- QR Label -->
        <div class="qr-label">
          {mode === 'initiator' ? 'INITIATOR CODE' : 'RESPONDER CODE'}
        </div>
        
        <!-- Show current QR data for debug -->
        <div class="qr-data-display">
          {qrCodeData}
        </div>
      </div>
      
      <!-- Direct QR Scanner -->
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
            {getStateDescription()}
          </div>
        </div>
      </div>
    </div>
    
    <!-- Mode selection -->
    <div class="mode-selector">
      <button 
        class="mode-button {mode === 'initiator' ? 'active' : ''}" 
        on:click={() => toggleMode()}
      >
        {mode === 'initiator' ? '✓ Initiator' : 'Switch to Initiator'}
      </button>
      <button 
        class="mode-button {mode === 'responder' ? 'active' : ''}" 
        on:click={() => toggleMode()}
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
    {:else if state === 'failed'}
      <div class="error-message">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <span>Finalization Failed: {error}</span>
      </div>
    {/if}
    
    <div class="instructions">
      <div class="instruction-step">
        <div class="step-number">1</div>
        <div class="step-text">Each party selects their role: Initiator or Responder</div>
      </div>
      <div class="instruction-step">
        <div class="step-number">2</div>
        <div class="step-text">Hold devices so each camera can see the other's QR code</div>
      </div>
      <div class="instruction-step">
        <div class="step-number">3</div>
        <div class="step-text">When both codes are scanned, the agreement will finalize automatically</div>
      </div>
    </div>
    
    <!-- QR Detection Debug -->
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
        <span class="debug-label">Last Scan:</span>
        <span class="debug-value">{getTimeSince(lastScanTime)}</span>
      </div>
      <div class="debug-row">
        <span class="debug-label">Last QR:</span>
        <span class="debug-value">{lastScannedQR || 'None'}</span>
      </div>
      {#if error}
        <div class="error-row">
          <span class="error-label">Error:</span>
          <span class="error-value">{error}</span>
        </div>
      {/if}
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
      margin-bottom: 10px;
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
      width: 280px;
      height: 280px;
    }
    
    .qr-label {
      margin-top: 10px;
      font-weight: bold;
      color: #555;
      font-size: 14px;
    }
    
    .qr-data-display {
      margin-top: 5px;
      font-family: monospace;
      font-size: 12px;
      color: #666;
      background-color: #f5f5f5;
      padding: 4px 8px;
      border-radius: 4px;
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
      margin-bottom: 15px;
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
    
    .mode-button:hover:not(.active) {
      background-color: #e0e0e0;
    }
    
    .success-message, .error-message {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 12px;
      border-radius: 8px;
      font-weight: bold;
      margin: 10px 0;
    }
    
    .success-message {
      background-color: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    
    .error-message {
      background-color: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
    
    .instructions {
      background-color: #e8f4fd;
      border-radius: 8px;
      padding: 12px;
      margin: 10px 0;
    }
    
    .instruction-step {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .instruction-step:last-child {
      margin-bottom: 0;
    }
    
    .step-number {
      width: 24px;
      height: 24px;
      background-color: #3498db;
      color: white;
      border-radius: 50%;
      display: flex;
      justify-content: center;
      align-items: center;
      font-weight: bold;
      margin-right: 10px;
      flex-shrink: 0;
    }
    
    .step-text {
      font-size: 14px;
      color: #2c3e50;
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
    
    .error-row {
      margin-top: 8px;
      padding: 4px 8px;
      background-color: rgba(244, 67, 54, 0.2);
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
    }
    
    .error-label {
      color: #ff8a80;
    }
    
    .error-value {
      color: #ff8a80;
      font-family: monospace;
      max-width: 70%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  </style>