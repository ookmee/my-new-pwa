<!-- src/lib/components/QRKissDirect.svelte
 * Direct version that uses the basic QR scanner without mirroring
 * With consistent layout (no position switching between sender/receiver)
 */
-->
<script>
    import { onMount, onDestroy } from 'svelte';
    import jsQR from 'jsqr';
    import QRCode from 'qrcode';
    import transactionManager from './TransactionManager.js';
    
    // Props
    export let mode = 'sender'; // 'sender' or 'receiver'
    export let userId = 'user-' + Math.random().toString(36).substring(2, 5).toUpperCase(); // Very short ID
    export let onTransactionComplete = (transaction) => console.log('Transaction complete:', transaction);
    
    // Local state
    let videoElement;
    let canvasElement;
    let canvasContext;
    let animationFrameId = null;
    let qrCodeData = '';
    let qrImageSrc = '';
    let amount = '10'; // Default amount for testing
    let transactionState = 'initial';
    let transactionId = '';
    let boxColor = 'red';
    
    // Transaction result
    let transactionResult = null;
    let balance = 0;
    
    // Debug state
    let lastScannedQR = '';
    let scanCount = 0;
    let lastScanTime = 0;
    let qrScanError = '';
    
    // Get initial balance and generate QR
    onMount(async () => {
      await generateSimplifiedQR();
      balance = transactionManager.getBalance(userId);
      
      await startCamera();
      startScanning();
    });
    
    onDestroy(() => {
      stopScanning();
      stopCamera();
    });
    
    async function generateSimplifiedQR() {
      // Create extremely simple data with minimal fields
      // Using uppercase, short IDs, and minimal format
      let initialData;
      
      if (mode === 'sender') {
        initialData = `S${userId}`; // S for sender + ID
      } else {
        initialData = `R${userId}`; // R for receiver + ID
      }
      
      qrCodeData = initialData;
      
      // Generate QR with largest possible blocks and max error correction
      qrImageSrc = await QRCode.toDataURL(initialData, {
        errorCorrectionLevel: 'H', // Highest error correction
        margin: 1, // Small margin for better scanning
        scale: 16, // Very large scale
        version: 3 // Force low version (fewer modules = larger blocks)
      });
      
      console.log("Generated simplified QR with data:", initialData);
    }
    
    // For step 2 - even simpler data format
    async function generateBlob2(receiverId) {
      // Generate a simple, short transaction ID
      transactionId = 'TX' + Date.now().toString().substring(8, 13);
      
      // Create minimal data for blob2
      const blob2 = `S${userId}${amount}${transactionId}`;
      
      qrCodeData = blob2;
      qrImageSrc = await generateSimpleQR(blob2);
      transactionState = 'blob2';
      
      // Flash effect on border
      flashBox();
    }
    
    // For step 3 - receiver response
    async function generateBlob3(simpleData) {
      // Parse simple format data: SuserIdamounttxId
      // Example: SABC10TX12345
      const senderIdEnd = simpleData.indexOf('TX') - 2; // 2 is the amount digits
      const senderId = simpleData.substring(1, senderIdEnd); 
      const amountValue = simpleData.substring(senderIdEnd, senderIdEnd + 2);
      const txId = simpleData.substring(senderIdEnd + 2);
      
      // Store transaction ID
      transactionId = txId;
      
      // Create minimal data for blob3
      const blob3 = `R${senderId}${userId}${amountValue}${txId}`;
      
      qrCodeData = blob3;
      qrImageSrc = await generateSimpleQR(blob3);
      transactionState = 'blob3';
      
      // Flash effect on border
      flashBox();
      
      // Process transaction on receiver side
      const transaction = {
        id: txId,
        amount: parseFloat(amountValue),
        sender: senderId,
        receiver: userId,
        timestamp: Date.now()
      };
      
      // Process the transaction
      const result = transactionManager.processTransaction(transaction);
      
      if (result.success) {
        transactionResult = result.transaction;
        balance = result.receiverBalance;
      }
      
      // Auto-complete for receiver after a short delay
      setTimeout(() => {
        if (transactionState === 'blob3') {
          completeTransaction(blob3);
        }
      }, 1000);
    }
    
    // Helper to generate simplified QR
    async function generateSimpleQR(data) {
      return await QRCode.toDataURL(data, {
        errorCorrectionLevel: 'H',
        margin: 1,
        scale: 16,
        version: 3
      });
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
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (videoElement) {
          videoElement.srcObject = stream;
          await videoElement.play();
          
          canvasElement.width = videoElement.videoWidth;
          canvasElement.height = videoElement.videoHeight;
          canvasContext = canvasElement.getContext('2d');
          
          console.log("Camera started successfully");
        }
      } catch (error) {
        console.error('Error starting camera:', error);
        qrScanError = "Camera error: " + error.message;
      }
    }
    
    function stopCamera() {
      if (videoElement && videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach(track => track.stop());
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
    }
    
    function scan() {
      if (!videoElement || !canvasContext) {
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
          qrScanError = error.message;
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
        const firstChar = data.charAt(0);
        
        // Process based on current state and the simplified format
        switch (transactionState) {
          case 'initial':
            // Check if opposite role (S vs R)
            if ((mode === 'sender' && firstChar === 'R') || 
                (mode === 'receiver' && firstChar === 'S')) {
              
              console.log("Detected opposite party identity QR");
              
              // We've detected the other party
              transactionState = 'aligned';
              boxColor = 'orange';
              
              // If sender, generate blob2
              if (mode === 'sender' && amount) {
                setTimeout(generateBlob2, 200);
              }
            }
            break;
            
          case 'aligned':
            // Receiver detects Blob2 from sender
            if (mode === 'receiver' && firstChar === 'S' && data.includes('TX')) {
              console.log("Receiver detected Blob2");
              setTimeout(() => generateBlob3(data), 200);
            }
            break;
            
          case 'blob2':
            // Sender detects Blob3 from receiver
            if (mode === 'sender' && firstChar === 'R' && data.includes(transactionId)) {
              console.log("Sender detected Blob3");
              completeTransaction(data);
            }
            break;
        }
      } catch (error) {
        console.error('Error processing QR data format:', error);
      }
    }
    
    function completeTransaction(finalData) {
      transactionState = 'complete';
      boxColor = 'green';
      
      // Provide haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(500); // Long vibration for success
      }
      
      // If sender, process the transaction at this point
      if (mode === 'sender') {
        // Parse the received data
        // Format: RsenderIdreceiverIdamountTxId
        const txStart = finalData.indexOf('TX');
        const amountStr = finalData.substring(txStart - 2, txStart);
        const receiverId = finalData.substring(finalData.indexOf(userId) + userId.length, txStart - 2);
        
        const transaction = {
          id: transactionId,
          amount: parseFloat(amountStr),
          sender: userId,
          receiver: receiverId,
          timestamp: Date.now()
        };
        
        // Process the transaction
        const result = transactionManager.processTransaction(transaction);
        
        if (result.success) {
          transactionResult = result.transaction;
          balance = result.senderBalance;
        }
      }
      
      // Notify parent component
      setTimeout(() => {
        onTransactionComplete(transactionResult);
      }, 1000);
    }
    
    function flashBox() {
      const originalColor = boxColor;
      boxColor = 'white';
      setTimeout(() => {
        boxColor = originalColor;
      }, 200);
    }
    
    function handleAgreeClick() {
      console.log("Agree button clicked, mode:", mode, "state:", transactionState);
      
      if (mode === 'sender' && !amount) {
        alert('Please enter an amount first.');
        return;
      }
      
      // Ready to proceed
      if (mode === 'sender') {
        if (transactionState === 'aligned') {
          generateBlob2();
        } else if (transactionState === 'initial') {
          boxColor = 'orange';
          transactionState = 'aligned';
          generateBlob2(); 
        }
      } else if (transactionState === 'initial' && mode === 'receiver') {
        boxColor = 'orange';
        transactionState = 'aligned';
      }
    }
    
    function toggleMode() {
      mode = mode === 'sender' ? 'receiver' : 'sender';
      // Reset state
      transactionState = 'initial';
      boxColor = 'red';
      transactionResult = null;
      // Generate new QR code
      generateSimplifiedQR();
    }
    
    function getTimeSince(timestamp) {
      if (!timestamp) return 'N/A';
      const seconds = Math.floor((Date.now() - timestamp) / 1000);
      return seconds + 's ago';
    }
  </script>
  
  <div class="qr-kiss-container">
    <!-- Fixed layout - QR on top, camera on bottom for both sender and receiver -->
    <div class="layout-container">
      <!-- QR Code display -->
      <div class="qr-display" style="border-color: {boxColor}">
        {#if qrImageSrc}
          <img src={qrImageSrc} alt="QR Code" class="qr-image" />
        {/if}
        
        <!-- QR Label -->
        <div class="qr-label">
          {mode === 'sender' ? 'SENDER QR (SCAN ME)' : 'RECEIVER QR (SCAN ME)'}
        </div>
        
        <!-- Show current QR data for debug -->
        <div class="qr-data-display">
          {qrCodeData}
        </div>
      </div>
      
      <!-- Direct QR Scanner without using QRScannerMirrored -->
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
            SCAN OTHER DEVICE
          </div>
          <div class="status-indicator" style="background-color: {boxColor}"></div>
        </div>
      </div>
    </div>
    
    <!-- Distance guide -->
    <div class="distance-guide">
      For best results, hold devices 12-18 inches apart
    </div>
    
    <!-- Balance display -->
    <div class="balance-display">
      Balance: {balance} JUICE
    </div>
    
    <!-- Mode selection -->
    <div class="mode-selector">
      <button 
        class="mode-button {mode === 'sender' ? 'active' : ''}" 
        on:click={() => toggleMode()}
      >
        {mode === 'sender' ? '✓ Sender' : 'Switch to Sender'}
      </button>
      <button 
        class="mode-button {mode === 'receiver' ? 'active' : ''}" 
        on:click={() => toggleMode()}
      >
        {mode === 'receiver' ? '✓ Receiver' : 'Switch to Receiver'}
      </button>
    </div>
    
    <!-- Controls section -->
    <div class="controls-container">
      <!-- Current state -->
      <div class="state-indicator">
        Current state: <span class="state-value">{transactionState}</span>
      </div>
      
      <!-- Sender UI -->
      {#if mode === 'sender'}
        {#if transactionState === 'initial' || transactionState === 'aligned'}
          <div class="input-container">
            <input 
              type="number" 
              bind:value={amount} 
              placeholder="Amount" 
              class="amount-input"
            />
            <button on:click={handleAgreeClick} class="agree-button">
              Agree to Send
            </button>
          </div>
        {:else if transactionState === 'complete'}
          <div class="success-message">
            Transaction Complete!
          </div>
        {/if}
      {/if}
      
      <!-- Receiver UI -->
      {#if mode === 'receiver'}
        {#if transactionState === 'initial'}
          <button on:click={handleAgreeClick} class="agree-button">
            Agree to Receive
          </button>
        {:else if transactionState === 'complete'}
          <div class="success-message">
            Payment Received!
          </div>
        {/if}
      {/if}
      
      <!-- Transaction result -->
      {#if transactionResult && transactionState === 'complete'}
        <div class="transaction-info">
          <p class="amount-transferred">
            {mode === 'sender' ? '-' : '+'}{transactionResult.amount} JUICE
          </p>
        </div>
      {/if}
      
      <!-- QR Detection Debug -->
      <div class="debug-panel">
        <h3>QR Scan Debug</h3>
        <div class="debug-row">
          <span class="debug-label">Detected:</span>
          <span class="debug-value">{scanCount}</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Last Scan:</span>
          <span class="debug-value">{getTimeSince(lastScanTime)}</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Data:</span>
          <span class="debug-value">{lastScannedQR || 'None'}</span>
        </div>
        {#if qrScanError}
          <div class="error-row">
            <span class="error-label">Error:</span>
            <span class="error-value">{qrScanError}</span>
          </div>
        {/if}
      </div>
    </div>
  </div>
  
  <style>
    .qr-kiss-container {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 500px;
      display: flex;
      flex-direction: column;
      gap: 15px;
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
      width: 280px; /* Very large for extreme visibility */
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
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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
      object-fit: cover;
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
    
    .status-indicator {
      height: 15px;
      width: 100%;
      transition: background-color 0.3s ease;
    }
    
    .distance-guide {
      text-align: center;
      background-color: #e0f7fa;
      padding: 8px;
      border-radius: 8px;
      font-size: 14px;
      color: #00838f;
      margin-bottom: 10px;
    }
    
    .balance-display {
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 8px 12px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: bold;
      text-align: center;
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
      background-color: #4CAF50;
      color: white;
    }
    
    .mode-button:hover:not(.active) {
      background-color: #e0e0e0;
    }
    
    .controls-container {
      width: 100%;
      padding: 15px;
      background-color: #f5f5f5;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    .state-indicator {
      text-align: center;
      margin-bottom: 10px;
      font-weight: bold;
      color: #666;
    }
    
    .state-value {
      color: #333;
      text-transform: uppercase;
    }
    
    .input-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      gap: 10px;
      margin-bottom: 10px;
    }
    
    .amount-input {
      width: 100%;
      padding: 12px;
      border-radius: 4px;
      border: 1px solid #ccc;
      font-size: 16px;
      appearance: textfield;
    }
    
    .agree-button {
      width: 100%;
      padding: 12px;
      background-color: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      cursor: pointer;
    }
    
    .agree-button:hover {
      background-color: #45a049;
    }
    
    .success-message {
      font-size: 18px;
      font-weight: bold;
      color: #4CAF50;
      margin: 10px 0;
      text-align: center;
    }
    
    .transaction-info {
      margin-top: 10px;
      text-align: center;
    }
    
    .amount-transferred {
      font-size: 24px;
      font-weight: bold;
      margin: 5px 0;
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