<!-- src/lib/components/QRKissFinalize.svelte
 * Escrow Finalization Component
 * With enhanced visual feedback for scanning progress
 */
-->
<script>
    import { onMount, onDestroy } from 'svelte';
    import jsQR from 'jsqr';
    import QRCode from 'qrcode';
    
    // Props
    export let escrowId = 'Ɉ' + Math.random().toString(36).substring(2, 6).toUpperCase();
    export let onFinalize = (result) => console.log('Escrow finalized:', result);
    export let amount = '500 JUICE';
    export let condition = 'Mutual Agreement';
    export let parties = 'Alice & Bob';
    
    // Local state
    let videoElement;
    let canvasElement;
    let canvasContext;
    let animationFrameId = null;
    let stream = null;
    let qrData = '';
    let qrImage = null;
    let state = 'initial'; // 'initial', 'detected', 'verified', 'completed'
    let boxColor = '#3498db'; // Blue for initial state
    let showModal = false;
    let securityCode = null;
    
    // Visual feedback state
    let progressPercent = 0;
    let detectionStartTime = 0;
    let requiredDetectionTime = 1000; // 1 second of continuous detection
    let detectionMessage = '';
    let showDetectionOverlay = false;
    
    // Scan box dimensions
    let boxSize = 280;
    
    // Debug state
    let lastScannedQR = '';
    let scanCount = 0;
    let error = '';
    
    // Tracking state - for active QR tracking
    let lastQRLocation = null;
    let trackingActive = false;
    
    // Generate QR code on mount
    onMount(() => {
      generateQR();
      // Start camera after a slight delay
      setTimeout(() => {
        startCamera();
      }, 200);
    });
    
    // Clean up resources on unmount
    onDestroy(() => {
      stopScanning();
      stopCamera();
    });
    
    // Generate a simple QR code
    async function generateQR() {
      try {
        qrData = `FINALIZE:${escrowId}`;
        console.log("Generating QR code with data:", qrData);
        
        qrImage = await QRCode.toDataURL(qrData, {
          errorCorrectionLevel: 'H',
          margin: 1,
          scale: 10 // Higher scale for larger blocks
        });
        
        console.log("QR code generated successfully");
      } catch (err) {
        console.error("Error generating QR:", err);
        error = "Failed to generate QR code: " + err.message;
      }
    }
    
    async function startCamera() {
      try {
        console.log("Starting camera...");
        
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
          
          videoElement.onloadedmetadata = () => {
            videoElement.play().then(() => {
              console.log("Video is playing");
              
              if (canvasElement) {
                canvasElement.width = videoElement.videoWidth;
                canvasElement.height = videoElement.videoHeight;
                canvasContext = canvasElement.getContext('2d');
                
                console.log("Canvas ready:", canvasElement.width, "x", canvasElement.height);
                startScanning();
              }
            }).catch(err => {
              console.error("Error playing video:", err);
            });
          };
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
      console.log("Starting QR scanning...");
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
      // Skip if not ready
      if (!videoElement || !canvasContext || videoElement.readyState < 2) {
        animationFrameId = requestAnimationFrame(scan);
        return;
      }
      
      try {
        // Draw video to canvas
        canvasContext.drawImage(
          videoElement, 
          0, 0, 
          canvasElement.width, canvasElement.height
        );
        
        // Get image data for the entire frame
        const imageData = canvasContext.getImageData(
          0, 0, 
          canvasElement.width, canvasElement.height
        );
        
        // Determine scan box location
        // If we've found a QR code before, try to track it
        let centerX, centerY;
        
        if (trackingActive && lastQRLocation) {
          // Use the last known QR location as the center of the scan box
          centerX = lastQRLocation.x - boxSize/2;
          centerY = lastQRLocation.y - boxSize/2;
          
          // Keep box within canvas boundaries
          centerX = Math.max(0, Math.min(canvasElement.width - boxSize, centerX));
          centerY = Math.max(0, Math.min(canvasElement.height - boxSize, centerY));
        } else {
          // Default to center of frame
          centerX = canvasElement.width / 2 - boxSize/2;
          centerY = canvasElement.height / 2 - boxSize/2;
        }
        
        // Draw scan box - Make it more visible
        canvasContext.strokeStyle = boxColor;
        canvasContext.lineWidth = 6; // Thicker line
        canvasContext.strokeRect(centerX, centerY, boxSize, boxSize);
        
        // Add corner highlights to make the scan area more visible
        const cornerSize = 20;
        canvasContext.strokeStyle = '#ffffff'; // White corners
        canvasContext.lineWidth = 3;
        
        // Top-left corner
        canvasContext.beginPath();
        canvasContext.moveTo(centerX, centerY + cornerSize);
        canvasContext.lineTo(centerX, centerY);
        canvasContext.lineTo(centerX + cornerSize, centerY);
        canvasContext.stroke();
        
        // Top-right corner
        canvasContext.beginPath();
        canvasContext.moveTo(centerX + boxSize - cornerSize, centerY);
        canvasContext.lineTo(centerX + boxSize, centerY);
        canvasContext.lineTo(centerX + boxSize, centerY + cornerSize);
        canvasContext.stroke();
        
        // Bottom-right corner
        canvasContext.beginPath();
        canvasContext.moveTo(centerX + boxSize, centerY + boxSize - cornerSize);
        canvasContext.lineTo(centerX + boxSize, centerY + boxSize);
        canvasContext.lineTo(centerX + boxSize - cornerSize, centerY + boxSize);
        canvasContext.stroke();
        
        // Bottom-left corner
        canvasContext.beginPath();
        canvasContext.moveTo(centerX + cornerSize, centerY + boxSize);
        canvasContext.lineTo(centerX, centerY + boxSize);
        canvasContext.lineTo(centerX, centerY + boxSize - cornerSize);
        canvasContext.stroke();
        
        // Scan for QR codes
        const code = jsQR(
          imageData.data,
          imageData.width,
          imageData.height,
          { inversionAttempts: "dontInvert" }
        );
        
        // Process any detected QR code
        if (code) {
          console.log("QR code detected:", code.data);
          scanCount++;
          lastScannedQR = code.data;
          
          // Update tracking information if we have a location
          if (code.location) {
            // Calculate center of QR code
            const qrCenterX = (code.location.topLeftCorner.x + code.location.bottomRightCorner.x) / 2;
            const qrCenterY = (code.location.topLeftCorner.y + code.location.bottomRightCorner.y) / 2;
            
            // Store for tracking
            lastQRLocation = { x: qrCenterX, y: qrCenterY };
            trackingActive = true;
            
            // Draw the QR code outline in a bright color
            drawQRCodeOutline(code.location);
          }
          
          // Vibration feedback
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
          
          // Process the QR code
          processQR(code.data);
        } else {
          // If we don't find a QR code, reset detection progress
          if (detectionStartTime !== 0) {
            detectionStartTime = 0;
            progressPercent = 0;
            showDetectionOverlay = false;
          }
          
          // If we don't find a QR code for several frames, reset tracking
          if (trackingActive) {
            // Reset tracking randomly when not finding QR
            if (Math.random() < 0.1) { // 10% chance to reset per frame
              trackingActive = false;
              lastQRLocation = null;
            }
          }
        }
      } catch (err) {
        console.error('Error during scan:', err);
      }
      
      // Continue scanning
      animationFrameId = requestAnimationFrame(scan);
    }
    
    function drawQRCodeOutline(location) {
      if (!location || !canvasContext) return;
      
      canvasContext.strokeStyle = '#FF3B58'; // Bright pink-red
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
    
    function processQR(data) {
      // Simple validation - check if this is a finalization QR for our escrow
      if (!data.startsWith('FINALIZE:')) return;
      
      const scannedEscrowId = data.substring(9); // Remove 'FINALIZE:' prefix
      
      // Check if escrow ID matches
      if (scannedEscrowId !== escrowId) {
        console.log(`Escrow ID mismatch: ${scannedEscrowId} vs ${escrowId}`);
        return;
      }
      
      // Process based on current state
      if (state === 'initial') {
        // First detection - start progress tracking
        if (detectionStartTime === 0) {
          detectionStartTime = Date.now();
          showDetectionOverlay = true;
          detectionMessage = 'Escrow Detected';
          state = 'detected';
          boxColor = '#f39c12'; // Orange
        }
        
        // Calculate progress
        const elapsedTime = Date.now() - detectionStartTime;
        progressPercent = Math.min(100, Math.floor((elapsedTime / requiredDetectionTime) * 100));
        
        // Check if we've maintained detection long enough
        if (elapsedTime >= requiredDetectionTime) {
          // Escrow verified after continuous detection
          state = 'verified';
          detectionMessage = 'Escrow Verified';
          boxColor = '#27ae60'; // Green
          
          // Generate security code
          securityCode = Math.random().toString(36).substring(2, 6).toUpperCase();
          
          // Complete after short delay
          setTimeout(() => {
            completeFinalization();
          }, 500);
        }
      }
    }
    
    function completeFinalization() {
      state = 'completed';
      boxColor = '#2ecc71'; // Bright green
      showDetectionOverlay = false;
      showModal = true;
      
      // Vibration feedback
      if (navigator.vibrate) {
        navigator.vibrate([100, 30, 100, 30, 100]);
      }
      
      // Create result object
      const result = {
        escrowId,
        timestamp: Date.now(),
        status: 'RELEASED',
        securityCode,
        parties: parties
      };
      
      // Notify parent component
      setTimeout(() => {
        onFinalize(result);
      }, 500);
    }
    
    function closeModal() {
      showModal = false;
    }
    
    function restart() {
      state = 'initial';
      boxColor = '#3498db';
      showModal = false;
      securityCode = null;
      lastScannedQR = '';
      scanCount = 0;
      trackingActive = false;
      lastQRLocation = null;
      progressPercent = 0;
      detectionStartTime = 0;
      showDetectionOverlay = false;
    }
  </script>
  
  <div class="escrow-container">
    <!-- Escrow header info - simplified for visibility -->
    <div class="escrow-header">
      <div class="escrow-id">{escrowId}</div>
      <div class="escrow-amount">{amount}</div>
    </div>
    
    <!-- QR Code display FIRST - now at top for cross-device scanning -->
    <div class="qr-display" style="border-color: {boxColor}">
      {#if qrImage}
        <img src={qrImage} alt="QR Code" class="qr-image" />
      {/if}
      
      <div class="qr-label">
        YOUR QR CODE (SHOW TO COUNTERPARTY)
      </div>
    </div>
    
    <!-- Camera view AFTER QR for scanning -->
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
      
      <!-- Detection overlay with visual progress -->
      {#if showDetectionOverlay}
        <div class="detection-overlay">
          <div class="detection-message">{detectionMessage}</div>
          <div class="progress-container">
            <div class="progress-bar" style="width: {progressPercent}%"></div>
          </div>
        </div>
      {/if}
      
      <div class="scanner-overlay">
        <div class="camera-label">
          SCAN COUNTERPARTY QR CODE
        </div>
        
        <div class="state-indicator" style="background-color: {boxColor}">
          {state === 'initial' ? 'Ready to scan' : 
           state === 'detected' ? 'Escrow QR detected' : 
           state === 'verified' ? 'Escrow verified' :
           state === 'completed' ? 'Escrow released!' : state}
        </div>
      </div>
    </div>
    
    {#if error}
      <div class="error-message">
        {error}
      </div>
    {/if}
    
    <!-- Compact escrow details -->
    <div class="escrow-details">
      <div class="detail-row">
        <span class="detail-label">Parties:</span>
        <span class="detail-value">{parties}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Condition:</span>
        <span class="detail-value">{condition}</span>
      </div>
    </div>
    
    <!-- Current state info (provides additional feedback) -->
    <div class="state-display" style="background-color: {boxColor}20">
      <div class="state-icon">
        {#if state === 'initial'}
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        {:else if state === 'detected'}
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
        {:else if state === 'verified'}
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        {:else if state === 'completed'}
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
        {/if}
      </div>
      <div class="state-info">
        <div class="state-title">
          {state === 'initial' ? 'Ready to Finalize' : 
           state === 'detected' ? 'Escrow QR Detected' : 
           state === 'verified' ? 'Escrow Verified' :
           state === 'completed' ? 'Escrow Released!' : state}
        </div>
        <div class="state-description">
          {state === 'initial' ? 'Scan counterparty\'s QR code to begin' : 
           state === 'detected' ? 'Hold steady while verifying...' : 
           state === 'verified' ? 'Escrow verification successful' :
           state === 'completed' ? 'Tokens have been released' : ''}
        </div>
      </div>
    </div>
    
    <!-- Success modal -->
    {#if showModal}
      <div class="modal-overlay" on:click={closeModal}>
        <div class="modal-content" on:click|stopPropagation>
          <div class="success-header">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <h3>Escrow Successfully Released!</h3>
          </div>
          
          <div class="success-details">
            <div class="detail-row">
              <span class="detail-label">Escrow ID:</span>
              <span class="detail-value">{escrowId}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Amount:</span>
              <span class="detail-value">{amount}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Security Code:</span>
              <span class="detail-value">{securityCode}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Timestamp:</span>
              <span class="detail-value">{new Date().toLocaleString()}</span>
            </div>
          </div>
          
          <div class="modal-actions">
            <button class="modal-button" on:click={closeModal}>
              Close
            </button>
            <button class="modal-button primary" on:click={restart}>
              New Verification
            </button>
          </div>
        </div>
      </div>
    {/if}
    
    <!-- Debug info (can be removed in production) -->
    <div class="debug-panel">
      <h3>Debug Info</h3>
      <div class="debug-row">
        <span class="debug-label">State:</span>
        <span class="debug-value">{state}</span>
      </div>
      <div class="debug-row">
        <span class="debug-label">Progress:</span>
        <span class="debug-value">{progressPercent}%</span>
      </div>
      <div class="debug-row">
        <span class="debug-label">Tracking:</span>
        <span class="debug-value">{trackingActive ? 'Active' : 'Inactive'}</span>
      </div>
      <div class="debug-row">
        <span class="debug-label">Scans:</span>
        <span class="debug-value">{scanCount}</span>
      </div>
    </div>
  </div>
  
  <style>
    .escrow-container {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 500px;
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    
    .escrow-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: #f8f9fa;
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    
    .escrow-id {
      font-size: 24px;
      font-weight: bold;
      font-family: monospace;
      color: #2c5282;
    }
    
    .escrow-amount {
      font-size: 20px;
      font-weight: bold;
      color: #2f855a;
      background-color: #f0fff4;
      padding: 4px 10px;
      border-radius: 20px;
    }
    
    .escrow-details {
      background-color: #f8f9fa;
      border-radius: 8px;
      padding: 12px;
    }
    
    .detail-row {
      display: flex;
      margin-bottom: 6px;
    }
    
    .detail-row:last-child {
      margin-bottom: 0;
    }
    
    .detail-label {
      width: 100px;
      font-weight: bold;
      color: #4a5568;
    }
    
    .detail-value {
      color: #2d3748;
    }
    
    /* QR display with larger size */
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
      border-width: 5px; /* Thinner border */
      box-sizing: border-box;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      transition: border-color 0.3s ease;
    }
    
    .qr-image {
      width: 300px; /* Larger QR */
      height: 300px; /* Larger QR */
      max-width: 100%;
      max-height: 50vh; /* Limit height on mobile */
    }
    
    .qr-label {
      margin-top: 10px;
      font-weight: bold;
      color: #555;
      font-size: 14px;
    }
    
    /* Scanner container with proper aspect ratio */
    .scanner-container {
      width: 100%;
      position: relative;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      /* Set aspect ratio with padding-bottom trick */
      padding-bottom: 75%; /* 4:3 aspect ratio */
    }
    
    .scanner-video {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover; /* Cover ensures full container is used */
    }
    
    .scanner-canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover; /* Match video dimensions */
    }
    
    /* Detection overlay */
    .detection-overlay {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: rgba(0, 0, 0, 0.7);
      border-radius: 12px;
      padding: 15px;
      width: 80%;
      max-width: 300px;
      text-align: center;
      z-index: 5;
    }
    
    .detection-message {
      color: white;
      font-weight: bold;
      font-size: 18px;
      margin-bottom: 10px;
    }
    
    .progress-container {
      width: 100%;
      background-color: rgba(255, 255, 255, 0.2);
      height: 8px;
      border-radius: 4px;
      overflow: hidden;
    }
    
    .progress-bar {
      height: 100%;
      background-color: #4CAF50;
      transition: width 0.1s ease;
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
      z-index: 10;
    }
    
    .state-indicator {
      width: 100%;
      padding: 8px 0;
      text-align: center;
      color: white;
      font-weight: bold;
      font-size: 14px;
      transition: background-color 0.3s ease;
      z-index: 10;
    }
    
    /* State display */
    .state-display {
      display: flex;
      align-items: center;
      gap: 15px;
      padding: 15px;
      border-radius: 10px;
      transition: background-color 0.3s ease;
    }
    
    .state-icon {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background-color: white;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
      color: #3498db; /* Blue default */
    }
    
    .state-icon svg {
      stroke: currentColor;
    }
    
    .state-info {
      flex: 1;
    }
    
    .state-title {
      font-weight: bold;
      font-size: 16px;
      margin-bottom: 3px;
    }
    
    .state-description {
      font-size: 14px;
      color: #555;
    }
    
    /* Error message */
    .error-message {
      padding: 10px;
      background-color: #fed7d7;
      color: #c53030;
      border-radius: 6px;
      font-weight: bold;
      margin-top: 10px;
    }
    
    /* Modal */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }
    
    .modal-content {
      background-color: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 90%;
      width: 400px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    }
    
    .success-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      color: #155724;
    }
    
    .success-header svg {
      color: #38a169;
    }
    
    .success-header h3 {
      margin: 0;
      font-size: 20px;
    }
    
    .success-details {
      background-color: #f0f5ff;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 20px;
    }
    
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    
    .modal-button {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      background-color: #e2e8f0;
      color: #4a5568;
      transition: all 0.2s ease;
    }
    
    .modal-button:hover {
      background-color: #cbd5e0;
    }
    
    .modal-button.primary {
      background-color: #4299e1;
      color: white;
    }
    
    .modal-button.primary:hover {
      background-color: #3182ce;
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
    
    /* Media query to adjust for really small screens */
    @media (max-width: 400px) {
      .escrow-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }
      
      .escrow-amount {
        align-self: flex-start;
      }
      
      .qr-image {
        width: 250px;
        height: 250px;
      }
    }
  </style>