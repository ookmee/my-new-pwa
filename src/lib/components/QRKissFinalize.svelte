<!-- src/lib/components/QRKissFinalize.svelte
 * Improved version with drastically different QR presentations
 * Supports the full agreement finalization flow
 * Prevents confusion between devices with unique shapes
 */
-->
<script>
    import { onMount, onDestroy } from 'svelte';
    import jsQR from 'jsqr';
    import QRCode from 'qrcode';
    
    // Props
    export let agreementId = 'A' + Math.random().toString(36).substring(2, 6).toUpperCase();
    export let onFinalize = (result) => console.log('Agreement finalized:', result);
    export let amount = '500 JUICE';
    export let agreementType = 'escrow'; // 'escrow', 'bet', 'settlement', 'transaction'
    export let details = 'Mutual Agreement';
    export let parties = 'Alice & Bob';
    
    // Local state
    let videoElement;
    let canvasElement;
    let canvasContext;
    let animationFrameId = null;
    let stream = null;
    let qrData = '';
    let qrImage = null;
    let state = 'initial'; // 'initial', 'scanning', 'detected', 'verified', 'completed'
    let boxColor = '#3498db'; // Blue for initial state
    let showModal = false;
    let confirmationCode = null;
    
    // Visual feedback state
    let progressPercent = 0;
    let detectionStartTime = 0;
    let requiredDetectionTime = 1500; // 1.5 seconds of continuous detection
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
    
    // NEW: QR presentation role and state
    export let role = 'A'; // 'A' or 'B' to determine presentation shape
    let otherRole = role === 'A' ? 'B' : 'A';
    let focusedOnWrongQR = false;
    
    // NEW: Flow state for agreement setup
    let flowStep = 'prepare'; // 'prepare', 'configure', 'finalize'
    let counterpartyIdentified = false;
    let counterpartyId = '';
    let agreementConfigured = false;
    
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
    
    // Generate a QR code with the appropriate shape and data
    async function generateQR() {
      try {
        // Include role in QR data for identification
        qrData = `FINALIZE:${agreementId}:${role}`;
        console.log("Generating QR code with data:", qrData);
        
        // Generate the QR code
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
        
        // Draw scan box - adjusted color based on whether we might be looking at wrong QR
        canvasContext.strokeStyle = focusedOnWrongQR ? '#ff0000' : boxColor; // Red if wrong QR
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
          
          // Check if this is our own QR code by looking for our role in the QR data
          const scannedData = code.data;
          if (scannedData.includes(`:${role}`)) {
            focusedOnWrongQR = true;
            console.log("Warning: Detected own QR code, try scanning the other device");
            
            // Reset tracking to encourage looking elsewhere
            trackingActive = false;
            lastQRLocation = null;
            
            // Display warning to user
            detectionMessage = "Move camera to scan other party's QR!";
            showDetectionOverlay = true;
            progressPercent = 0;
            
            // Vibration warning
            if (navigator.vibrate) {
              navigator.vibrate([50, 100, 50]); // Warning pattern
            }
            
            // Continue to next frame
            animationFrameId = requestAnimationFrame(scan);
            return;
          }
          
          // Reset wrong QR warning if we're now looking at the right one
          focusedOnWrongQR = false;
          
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
          
          // Process the QR code based on flow step
          if (flowStep === 'prepare') {
            // In preparation step, identify counterparty
            processCounterpartyQR(code.data);
          } else if (flowStep === 'finalize') {
            // In finalization step, verify agreement
            processFinalizationQR(code.data);
          }
        } else {
          // If we don't find a QR code, reset detection progress
          if (detectionStartTime !== 0 && !focusedOnWrongQR) {
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
    
    // Process counterparty identification QR (preparation step)
    function processCounterpartyQR(data) {
      // Parse identification QR
      if (!data.startsWith('FINALIZE:')) return;
      
      const parts = data.split(':');
      if (parts.length < 3) return;
      
      const scannedAgreementId = parts[1];
      const scannedRole = parts[2];
      
      // Make sure the roles are complementary
      if (scannedRole === role) {
        console.log("Detected same role QR, ignoring");
        focusedOnWrongQR = true;
        return;
      }
      
      // Store counterparty info
      counterpartyId = scannedAgreementId;
      
      // Update status - identified counterparty
      counterpartyIdentified = true;
      detectionMessage = 'Counterparty Identified';
      showDetectionOverlay = true;
      
      // Finalize identification after a short delay
      setTimeout(() => {
        showDetectionOverlay = false;
        // If we were in preparation step, move to configuration
        if (flowStep === 'prepare') {
          flowStep = 'configure';
        }
      }, 1500);
      
      // Success vibration
      if (navigator.vibrate) {
        navigator.vibrate(200);
      }
    }
    
    // Process finalization QR
    function processFinalizationQR(data) {
      // Validate QR is for finalization
      if (!data.startsWith('FINALIZE:')) return;
      
      const parts = data.split(':');
      if (parts.length < 3) return;
      
      const scannedAgreementId = parts[1];
      const scannedRole = parts[2];
      
      // Check if agreement ID matches
      if (scannedAgreementId !== agreementId) {
        console.log(`Agreement ID mismatch: ${scannedAgreementId} vs ${agreementId}`);
        return;
      }
      
      // Make sure we're scanning the other role's QR
      if (scannedRole === role) {
        console.log("Detected same role QR, ignoring");
        focusedOnWrongQR = true;
        return;
      }
      
      // Process based on current state
      if (state === 'initial') {
        // First detection - start progress tracking
        if (detectionStartTime === 0) {
          detectionStartTime = Date.now();
          showDetectionOverlay = true;
          detectionMessage = 'Agreement Detected';
          state = 'detected';
          boxColor = '#f39c12'; // Orange
        }
        
        // Calculate progress
        const elapsedTime = Date.now() - detectionStartTime;
        progressPercent = Math.min(100, Math.floor((elapsedTime / requiredDetectionTime) * 100));
        
        // Check if we've maintained detection long enough
        if (elapsedTime >= requiredDetectionTime) {
          // Agreement verified after continuous detection
          state = 'verified';
          detectionMessage = 'Agreement Verified';
          boxColor = '#27ae60'; // Green
          
          // Generate confirmation code
          confirmationCode = Math.random().toString(36).substring(2, 6).toUpperCase();
          
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
        agreementId,
        agreementType,
        timestamp: Date.now(),
        status: 'FINALIZED',
        confirmationCode,
        parties: parties,
        amount: amount
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
      confirmationCode = null;
      lastScannedQR = '';
      scanCount = 0;
      trackingActive = false;
      lastQRLocation = null;
      progressPercent = 0;
      detectionStartTime = 0;
      showDetectionOverlay = false;
      focusedOnWrongQR = false;
      flowStep = 'prepare';
      counterpartyIdentified = false;
      counterpartyId = '';
      agreementConfigured = false;
    }
    
    function toggleRole() {
      role = role === 'A' ? 'B' : 'A';
      otherRole = role === 'A' ? 'B' : 'A';
      generateQR(); // Regenerate QR with new role
    }
    
    // Configure the agreement and move to finalization step
    function configureAgreement() {
      // Here you would typically validate all required fields
      if (!counterpartyIdentified || !amount || !agreementType) {
        alert('Please complete all required fields');
        return;
      }
      
      agreementConfigured = true;
      flowStep = 'finalize';
      generateQR(); // Regenerate QR for finalization
    }
    
    // For first-time setup, generates a fresh agreement ID
    function generateNewAgreement() {
      agreementId = 'A' + Math.random().toString(36).substring(2, 6).toUpperCase();
      generateQR();
    }
  </script>
  
  <div class="agreement-container">
    <!-- Role toggle -->
    <div class="role-container">
      <span class="role-label">Your role:</span>
      <button class="role-toggle" on:click={toggleRole}>
        {role === 'A' ? '🔺 Triangle (A)' : '⬤ Circle (B)'}
      </button>
    </div>
    
    <!-- Agreement header -->
    <div class="agreement-header">
      <div class="agreement-id">{agreementId}</div>
      <div class="agreement-amount">{amount}</div>
    </div>
    
    <!-- Flow step indicator -->
    <div class="flow-step-container">
      <div class="step-indicator {flowStep === 'prepare' ? 'active' : ''}">
        <div class="step-number">1</div>
        <div class="step-label">Identify</div>
      </div>
      <div class="step-connector"></div>
      <div class="step-indicator {flowStep === 'configure' ? 'active' : ''}">
        <div class="step-number">2</div>
        <div class="step-label">Configure</div>
      </div>
      <div class="step-connector"></div>
      <div class="step-indicator {flowStep === 'finalize' ? 'active' : ''}">
        <div class="step-number">3</div>
        <div class="step-label">Finalize</div>
      </div>
    </div>
    
    <!-- Step content changes based on current flow step -->
    {#if flowStep === 'prepare'}
      <!-- Preparation step: Identify counterparty -->
      <div class="step-content">
        <h3>Identify Your Counterparty</h3>
        <p>Scan each other's QR codes to establish connection.</p>
        
        <!-- QR Code display with role-based shape -->
        <div class="qr-display role-{role}" style="border-color: {boxColor}">
          <div class="qr-wrapper role-{role}">
            {#if qrImage}
              <img src={qrImage} alt="QR Code" class="qr-image" />
            {/if}
          </div>
          
          <div class="qr-label">
            YOUR QR CODE ({role === 'A' ? 'TRIANGLE' : 'CIRCLE'})
          </div>
        </div>
        
        <!-- Camera view for scanning -->
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
          
          <!-- Detection overlay -->
          {#if showDetectionOverlay}
            <div class="detection-overlay">
              <div class="detection-message">{detectionMessage}</div>
              {#if progressPercent > 0}
                <div class="progress-container">
                  <div class="progress-bar" style="width: {progressPercent}%"></div>
                </div>
              {/if}
            </div>
          {/if}
          
          <div class="scanner-overlay">
            <div class="camera-label">
              SCAN {role === 'A' ? 'CIRCLE' : 'TRIANGLE'} QR CODE
            </div>
          </div>
        </div>
        
        <!-- Status for counterparty identification -->
        <div class="status-box {counterpartyIdentified ? 'success' : 'waiting'}">
          <div class="status-icon">
            {#if counterpartyIdentified}
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            {/if}
          </div>
          <div class="status-text">
            {counterpartyIdentified ? 'Counterparty identified' : 'Waiting for counterparty...'}
          </div>
        </div>
      </div>
    {:else if flowStep === 'configure'}
      <!-- Configuration step: Set up agreement details -->
      <div class="step-content">
        <h3>Configure Agreement Details</h3>
        
        <div class="config-form">
          <div class="form-group">
            <label for="agreement-type">Agreement Type</label>
            <select id="agreement-type" bind:value={agreementType} class="form-input">
              <option value="escrow">Escrow</option>
              <option value="bet">Bet</option>
              <option value="settlement">Settlement</option>
              <option value="transaction">Transaction</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="amount">Amount</label>
            <input type="text" id="amount" bind:value={amount} class="form-input" />
          </div>
          
          <div class="form-group">
            <label for="parties">Parties</label>
            <input type="text" id="parties" bind:value={parties} class="form-input" />
          </div>
          
          <div class="form-group">
            <label for="details">Details</label>
            <textarea id="details" bind:value={details} class="form-input textarea"></textarea>
          </div>
          
          <!-- Confirmation of counterparty -->
          <div class="counterparty-confirmation">
            <div class="confirmation-label">Counterparty Identified:</div>
            <div class="confirmation-value">{counterpartyId || 'None'}</div>
          </div>
          
          <button class="configure-button" on:click={configureAgreement}>
            Proceed to Finalization
          </button>
        </div>
      </div>
    {:else if flowStep === 'finalize'}
      <!-- Finalization step: Verify and finalize the agreement -->
      <div class="step-content">
        <h3>Finalize Agreement</h3>
        <p>Scan each other's QR codes simultaneously to finalize the agreement.</p>
        
        <!-- Agreement summary -->
        <div class="agreement-summary">
          <div class="summary-row">
            <span class="summary-label">Type:</span>
            <span class="summary-value">{agreementType}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Amount:</span>
            <span class="summary-value">{amount}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Parties:</span>
            <span class="summary-value">{parties}</span>
          </div>
        </div>
        
        <!-- QR Code display with role-based shape -->
        <div class="qr-display role-{role}" style="border-color: {boxColor}">
          <div class="qr-wrapper role-{role}">
            {#if qrImage}
              <img src={qrImage} alt="QR Code" class="qr-image" />
            {/if}
          </div>
          
          <div class="qr-label">
            YOUR QR CODE ({role === 'A' ? 'TRIANGLE' : 'CIRCLE'})
          </div>
        </div>
        
        <!-- Wrong QR alert -->
        {#if focusedOnWrongQR}
          <div class="wrong-qr-alert">
            <div class="alert-icon">⚠️</div>
            <div class="alert-text">
              You are scanning your own QR code! Please aim at the other device's QR code.
              <br>
              <strong>Look for the {role === 'A' ? 'circular' : 'triangular'} shaped QR.</strong>
            </div>
          </div>
        {/if}
        
        <!-- Camera view for scanning -->
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
              SCAN {role === 'A' ? 'CIRCLE' : 'TRIANGLE'} QR CODE
            </div>
            
            <div class="state-indicator" style="background-color: {boxColor}">
              {state === 'initial' ? 'Ready to scan' : 
               state === 'detected' ? 'Agreement QR detected' : 
               state === 'verified' ? 'Agreement verified' :
               state === 'completed' ? 'Agreement finalized!' : state}
            </div>
          </div>
        </div>
        
        <!-- Current state info -->
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
               state === 'detected' ? 'Agreement QR Detected' : 
               state === 'verified' ? 'Agreement Verified' :
               state === 'completed' ? 'Agreement Finalized!' : state}
            </div>
            <div class="state-description">
              {state === 'initial' ? 'Scan the other party\'s QR code to begin' : 
               state === 'detected' ? 'Hold steady while verifying...' : 
               state === 'verified' ? 'Agreement verification successful' :
               state === 'completed' ? 'Agreement has been finalized' : ''}
            </div>
          </div>
        </div>
      </div>
    {/if}
    
    {#if error}
      <div class="error-message">
        {error}
      </div>
    {/if}
    
    <!-- Success modal -->
    {#if showModal}
      <div class="modal-overlay" on:click={closeModal}>
        <div class="modal-content" on:click|stopPropagation>
          <div class="success-header">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <h3>Agreement Successfully Finalized!</h3>
          </div>
          
          <div class="success-details">
            <div class="detail-row">
              <span class="detail-label">Agreement ID:</span>
              <span class="detail-value">{agreementId}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Type:</span>
              <span class="detail-value">{agreementType}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Amount:</span>
              <span class="detail-value">{amount}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Confirmation Code:</span>
              <span class="detail-value">{confirmationCode}</span>
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
              New Agreement
            </button>
          </div>
        </div>
      </div>
    {/if}
    
    <!-- Debug info (can be removed in production) -->
    <div class="debug-panel">
      <h3>Debug Info</h3>
      <div class="debug-row">
        <span class="debug-label">Flow Step:</span>
        <span class="debug-value">{flowStep}</span>
      </div>
      <div class="debug-row">
        <span class="debug-label">Role:</span>
        <span class="debug-value">{role}</span>
      </div>
      <div class="debug-row">
        <span class="debug-label">State:</span>
        <span class="debug-value">{state}</span>
      </div>
      <div class="debug-row">
        <span class="debug-label">Progress:</span>
        <span class="debug-value">{progressPercent}%</span>
      </div>
      <div class="debug-row">
        <span class="debug-label">Wrong QR:</span>
        <span class="debug-value">{focusedOnWrongQR ? 'Yes' : 'No'}</span>
      </div>
      <div class="debug-row">
        <span class="debug-label">Last QR:</span>
        <span class="debug-value">{lastScannedQR}</span>
      </div>
    </div>
  </div>
  
  <style>
    .agreement-container {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 500px;
      display: flex;
      flex-direction: column;
      gap: 15px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    /* Role selector */
    .role-container {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 5px;
    }
    
    .role-label {
      font-weight: bold;
      color: #555;
    }
    
    .role-toggle {
      background-color: #3498db;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      cursor: pointer;
      transition: background-color 0.2s;
      font-size: 14px;
    }
    
    .role-toggle:hover {
      background-color: #2980b9;
    }
    
    /* Agreement header */
    .agreement-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: #f8f9fa;
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    
    .agreement-id {
      font-size: 24px;
      font-weight: bold;
      font-family: monospace;
      color: #2c5282;
    }
    
    .agreement-amount {
      font-size: 20px;
      font-weight: bold;
      color: #2f855a;
      background-color: #f0fff4;
      padding: 4px 10px;
      border-radius: 20px;
    }
    
    /* Flow step indicator */
    .flow-step-container {
      display: flex;
      align-items: center;
      margin: 10px 0;
    }
    
    .step-indicator {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 60px;
    }
    
    .step-number {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background-color: #e2e8f0;
      display: flex;
      justify-content: center;
      align-items: center;
      font-weight: bold;
      color: #4a5568;
      margin-bottom: 5px;
    }
    
    .step-indicator.active .step-number {
      background-color: #4299e1;
      color: white;
    }
    
    .step-label {
      font-size: 12px;
      color: #4a5568;
    }
    
    .step-indicator.active .step-label {
      color: #2b6cb0;
      font-weight: bold;
    }
    
    .step-connector {
      flex: 1;
      height: 2px;
      background-color: #e2e8f0;
    }
    
    .step-content {
      background-color: #f8f9fa;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    
    .step-content h3 {
      margin-top: 0;
      margin-bottom: 10px;
      color: #2d3748;
      font-size: 18px;
    }
    
    .step-content p {
      color: #4a5568;
      margin-bottom: 15px;
    }
    
    /* Wrong QR alert */
    .wrong-qr-alert {
      display: flex;
      gap: 10px;
      padding: 10px;
      background-color: #fff3cd;
      border: 1px solid #ffeeba;
      border-radius: 6px;
      color: #856404;
      align-items: center;
      margin-bottom: 10px;
    }
    
    .alert-icon {
      font-size: 24px;
    }
    
    .alert-text {
      font-size: 14px;
    }
    
    /* Agreement summary */
    .agreement-summary {
      background-color: #edf2f7;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 15px;
    }
    
    .summary-row {
      display: flex;
      margin-bottom: 6px;
    }
    
    .summary-row:last-child {
      margin-bottom: 0;
    }
    
    .summary-label {
      width: 100px;
      font-weight: bold;
      color: #4a5568;
    }
    
    .summary-value {
      color: #2d3748;
    }
    
    /* QR display with role-based shapes */
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
      border-width: 5px;
      box-sizing: border-box;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      transition: border-color 0.3s ease;
      margin-bottom: 15px;
    }
    
    /* Role A: Triangle shape */
    .qr-display.role-A {
      clip-path: polygon(0% 100%, 50% 0%, 100% 100%);
      padding-bottom: 40px; /* Extra space at bottom due to triangle shape */
    }
    
    /* Role B: Circle shape */
    .qr-display.role-B {
      border-radius: 50%;
      aspect-ratio: 1 / 1;
      padding: 20px;
    }
    
    .qr-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
    }
    
    /* Adjust QR code size based on role */
    .qr-wrapper.role-A .qr-image {
      width: 200px;
      height: 200px;
      max-width: 100%;
    }
    
    .qr-wrapper.role-B .qr-image {
      width: 220px;
      height: 220px;
      max-width: 100%;
    }
    
    .qr-label {
      margin-top: 10px;
      font-weight: bold;
      color: #555;
      font-size: 14px;
      text-align: center;
    }
    
    /* Config form */
    .config-form {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    
    .form-input {
      padding: 8px 12px;
      border: 1px solid #cbd5e0;
      border-radius: 4px;
      font-size: 16px;
    }
    
    .form-input.textarea {
      min-height: 80px;
      resize: vertical;
    }
    
    .counterparty-confirmation {
      background-color: #ebf8ff;
      border: 1px solid #bee3f8;
      border-radius: 4px;
      padding: 10px;
      margin: 10px 0;
    }
    
    .confirmation-label {
      font-weight: bold;
      color: #2c5282;
      margin-bottom: 5px;
    }
    
    .configure-button {
      background-color: #4299e1;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 12px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: background-color 0.2s;
      margin-top: 10px;
    }
    
    .configure-button:hover {
      background-color: #3182ce;
    }
    
    /* Status box for counterparty identification */
    .status-box {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px;
      border-radius: 6px;
      margin-top: 15px;
    }
    
    .status-box.waiting {
      background-color: #edf2f7;
      color: #4a5568;
    }
    
    .status-box.success {
      background-color: #f0fff4;
      color: #276749;
    }
    
    .status-icon {
      display: flex;
      align-items: center;
    }
    
    .status-text {
      font-weight: bold;
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
      margin-bottom: 15px;
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
    
    .detail-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    
    .detail-row:last-child {
      margin-bottom: 0;
    }
    
    .detail-label {
      font-weight: bold;
      color: #4a5568;
    }
    
    .detail-value {
      color: #2d3748;
      text-align: right;
      max-width: 60%;
      word-break: break-all;
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
      .agreement-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }
      
      .agreement-amount {
        align-self: flex-start;
      }
      
      .qr-wrapper.role-A .qr-image,
      .qr-wrapper.role-B .qr-image {
        width: 180px;
        height: 180px;
      }
    }
  </style>