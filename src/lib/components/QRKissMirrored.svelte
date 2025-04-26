<!-- src/lib/components/QRKissMirrored.svelte
 * Enhanced version with:
 * 1. Simplified QR codes with larger blocks for better scanning
 * 2. Explicit handling of mirroring issues
 * 3. Fixed camera image processing
 * 4. Minimal data in QR codes for testing
 */
-->
<script>
  import { onMount, onDestroy } from 'svelte';
  import QRScannerMirrored from './QRScannerMirrored.svelte';
  import QRCode from 'qrcode';
  import transactionManager from './TransactionManager.js';
  
  // Props
  export let mode = 'sender'; // 'sender' or 'receiver'
  export let userId = 'user-' + Math.random().toString(36).substring(2, 10).toUpperCase(); // Generate random short user ID
  export let onTransactionComplete = (transaction) => console.log('Transaction complete:', transaction);
  
  // Local state
  let qrCodeData = '';
  let qrImageSrc = '';
  let amount = '10'; // Default amount for testing
  let transactionState = 'initial'; // 'initial', 'aligned', 'blob2', 'blob3', 'complete'
  let transactionId = '';
  let boxColor = 'red';
  
  // Transaction result
  let transactionResult = null;
  let balance = 0;
  
  // Debug state
  let lastScannedQR = '';
  let lastProcessedQR = '';
  let lastRawQRData = '';
  let scanCount = 0;
  let processCount = 0;
  let lastScanTime = 0;
  let lastProcessTime = 0;
  let qrScanError = '';
  
  // Get initial balance and generate QR
  onMount(() => {
    generateSimplifiedQR();
    balance = transactionManager.getBalance(userId);
  });
  
  async function generateSimplifiedQR() {
    // Create extremely simple data with minimal fields
    // Using uppercase, short IDs, and minimal JSON structure
    let initialData;
    
    if (mode === 'sender') {
      initialData = `S:${userId}`; // S for sender + ID
    } else {
      initialData = `R:${userId}`; // R for receiver + ID
    }
    
    qrCodeData = initialData;
    
    // Generate QR with largest possible blocks and max error correction
    qrImageSrc = await QRCode.toDataURL(initialData, {
      errorCorrectionLevel: 'H', // Highest error correction
      margin: 2, // Wider margin for better scanning
      scale: 16, // Very large scale
      version: 2 // Force low version (fewer modules = larger blocks)
    });
    
    console.log("Generated simplified QR with data:", initialData);
  }
  
  // For step 2 - even simpler data format
  async function generateBlob2(receiverId) {
    // Generate a simple, short transaction ID
    transactionId = 'TX' + Date.now().toString().substring(8, 13);
    
    // Create minimal data for blob2
    const blob2 = `S:${userId}:${amount}:${transactionId}`;
    
    qrCodeData = blob2;
    qrImageSrc = await generateSimpleQR(blob2);
    transactionState = 'blob2';
    
    // Flash effect on border
    flashBox();
  }
  
  // For step 3 - receiver response
  async function generateBlob3(simpleData) {
    // Parse simple format data: S:userId:amount:txId
    const parts = simpleData.split(':');
    const senderId = parts[1];
    const amountValue = parts[2];
    const txId = parts[3];
    
    // Store transaction ID
    transactionId = txId;
    
    // Create minimal data for blob3
    const blob3 = `R:${senderId}:${userId}:${amountValue}:${txId}`;
    
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
    } else {
      console.error('Transaction failed:', result.error);
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
      margin: 2,
      scale: 16,
      version: 2
    });
  }
  
  function handleQRScan(data) {
    try {
      // Log the raw scanned data
      console.log("Raw QR Scanned:", data);
      lastRawQRData = data;
      lastScannedQR = data;
      scanCount++;
      lastScanTime = Date.now();
      qrScanError = '';
      
      // Add haptic feedback
      if (window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
      
      // Process based on simplified format
      processSimpleQRFormat(data);
      
    } catch (error) {
      console.error('Error handling QR scan:', error);
      qrScanError = error.message;
    }
  }
  
  function processSimpleQRFormat(data) {
    try {
      // Check data format for simplified format
      // Format: [S/R]:userId:[amount]:[txId]
      
      const firstChar = data.charAt(0);
      
      // Record that we processed this QR
      lastProcessedQR = `Type: ${firstChar}, data: ${data.substring(0, 20)}...`;
      processCount++;
      lastProcessTime = Date.now();
      
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
              setTimeout(generateBlob2, 200, data.split(':')[1]);
            }
          }
          break;
          
        case 'aligned':
          // Receiver detects Blob2 from sender (S:userId:amount:txId)
          if (mode === 'receiver' && firstChar === 'S' && data.split(':').length >= 4) {
            console.log("Receiver detected Blob2");
            setTimeout(() => generateBlob3(data), 200);
          }
          break;
          
        case 'blob2':
          // Sender detects Blob3 from receiver (R:senderId:receiverId:amount:txId)
          if (mode === 'sender' && firstChar === 'R') {
            const parts = data.split(':');
            if (parts.length >= 5 && parts[4] === transactionId) {
              console.log("Sender detected Blob3");
              completeTransaction(data);
            }
          }
          break;
      }
    } catch (parseError) {
      console.error('Error processing QR data:', parseError);
      lastProcessedQR = "ERROR: Invalid format";
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
      const parts = finalData.split(':');
      const amountValue = parts[3];
      const receiverId = parts[2];
      
      const transaction = {
        id: transactionId,
        amount: parseFloat(amountValue),
        sender: userId,
        receiver: receiverId,
        timestamp: Date.now()
      };
      
      // Process the transaction
      const result = transactionManager.processTransaction(transaction);
      
      if (result.success) {
        transactionResult = result.transaction;
        balance = result.senderBalance;
      } else {
        console.error('Transaction failed:', result.error);
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
  <!-- Layout changes based on mode - QR at bottom for receiver for better alignment -->
  <div class="layout-container {mode === 'receiver' ? 'receiver-layout' : 'sender-layout'}">
    <!-- QR Code display -->
    <div class="qr-display" style="border-color: {boxColor}">
      {#if qrImageSrc}
        <img src={qrImageSrc} alt="QR Code" class="qr-image" />
      {/if}
      
      <!-- QR Label -->
      <div class="qr-label">
        {mode === 'sender' ? 'YOUR QR (SCAN ME)' : 'YOUR QR (SCAN ME)'}
      </div>
      
      <!-- Show current QR data for debug -->
      <div class="qr-data-display">
        {qrCodeData}
      </div>
    </div>
    
    <!-- QR Scanner with mirrored view -->
    <div class="scanner-container">
      <QRScannerMirrored onScan={handleQRScan} boxSize={240} mirrored={true}>
        <div class="scanner-overlay">
          <div class="camera-label">
            CAMERA VIEW
          </div>
          <div class="scan-indicator" class:active={lastScannedQR !== ''}>
            {lastProcessedQR ? '✓' : ''}
          </div>
          <div class="status-indicator" style="background-color: {boxColor}"></div>
        </div>
      </QRScannerMirrored>
    </div>
  </div>
  
  <!-- Distance guide -->
  <div class="distance-guide">
    For best results, hold devices 12-18 inches apart
  </div>
  
  <!-- Balance display (outside QR scanner) -->
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
    
    <!-- DEBUG: Raw QR data display -->
    <div class="raw-data-display">
      <h4>RAW SCANNED DATA:</h4>
      <div class="raw-data">{lastRawQRData || 'None'}</div>
      {#if qrScanError}
        <div class="error-message">{qrScanError}</div>
      {/if}
    </div>
    
    <!-- Debug info - Enhanced with read vs. processed distinction -->
    <div class="debug-info">
      <h3>Debug Info</h3>
      <div class="debug-section">
        <div class="debug-row">
          <span class="debug-label">Mode:</span>
          <span class="debug-value">{mode}</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">State:</span>
          <span class="debug-value">{transactionState}</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Box Color:</span>
          <span class="debug-value" style="color: {boxColor};">{boxColor}</span>
        </div>
      </div>
      
      <div class="debug-section">
        <h4>QR Reading</h4>
        <div class="debug-row">
          <span class="debug-label">Scan Count:</span>
          <span class="debug-value">{scanCount}</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Last Scan:</span>
          <span class="debug-value">{getTimeSince(lastScanTime)}</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Last QR Read:</span>
          <span class="debug-value">{lastScannedQR || 'None'}</span>
        </div>
      </div>
      
      <div class="debug-section">
        <h4>QR Processing</h4>
        <div class="debug-row">
          <span class="debug-label">Process Count:</span>
          <span class="debug-value">{processCount}</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Last Process:</span>
          <span class="debug-value">{getTimeSince(lastProcessTime)}</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Last QR Processed:</span>
          <span class="debug-value">{lastProcessedQR || 'None'}</span>
        </div>
      </div>
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
  
  /* Layout container with flexible direction based on mode */
  .layout-container {
    display: flex;
    flex-direction: column;
    gap: 15px;
    width: 100%;
  }
  
  /* Reverse order for receiver mode for better alignment */
  .receiver-layout {
    flex-direction: column-reverse;
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
    transform: scaleX(1); /* Ensure not mirrored */
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
  
  .scanner-overlay {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
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
  
  .scan-indicator {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: rgba(0, 0, 0, 0.3);
    color: white;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 20px;
    font-weight: bold;
    opacity: 0;
    transition: opacity 0.3s, background-color 0.3s;
  }
  
  .scan-indicator.active {
    opacity: 1;
    background-color: rgba(76, 175, 80, 0.7);
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
  
  /* Raw data display */
  .raw-data-display {
    margin-top: 15px;
    padding: 8px;
    background-color: #fffde7;
    border: 1px solid #ffd54f;
    border-radius: 4px;
  }
  
  .raw-data-display h4 {
    margin: 0 0 5px 0;
    font-size: 14px;
    color: #ff6f00;
  }
  
  .raw-data {
    font-family: monospace;
    font-size: 12px;
    word-break: break-all;
  }
  
  .error-message {
    color: #d32f2f;
    font-size: 12px;
    margin-top: 5px;
  }
  
  /* Enhanced debug info styling with sections */
  .debug-info {
    margin-top: 15px;
    padding: 10px;
    background-color: #333;
    border-radius: 8px;
    font-size: 14px;
    font-family: monospace;
    color: #eee;
  }
  
  .debug-info h3 {
    margin: 0 0 10px 0;
    font-size: 16px;
    color: #fff;
    border-bottom: 1px solid #555;
    padding-bottom: 5px;
  }
  
  .debug-info h4 {
    margin: 10px 0 5px 0;
    font-size: 14px;
    color: #8bc34a;
  }
  
  .debug-section {
    margin-bottom: 10px;
    padding: 5px;
    border-radius: 4px;
    background-color: rgba(255, 255, 255, 0.05);
  }
  
  .debug-row {
    display: flex;
    justify-content: space-between;
    padding: 3px 0;
  }
  
  .debug-label {
    color: #888;
  }
  
  .debug-value {
    font-weight: bold;
    max-width: 70%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>