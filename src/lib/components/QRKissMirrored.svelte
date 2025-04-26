<!-- src/lib/components/QRKissMirrored.svelte -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import QRScannerMirrored from './QRScannerMirrored.svelte';
  import QRCode from 'qrcode';
  import transactionManager from './TransactionManager.js';
  
  // Props
  export let mode = 'sender'; // 'sender' or 'receiver'
  export let userId = 'user-' + Math.random().toString(36).substring(2, 9); // Generate random user ID if not provided
  export let onTransactionComplete = (transaction) => console.log('Transaction complete:', transaction);
  
  // Local state
  let qrCodeData = '';
  let qrImageSrc = '';
  let amount = '';
  let transactionState = 'initial'; // 'initial', 'aligned', 'blob2', 'blob3', 'complete'
  let transactionId = '';
  let boxColor = 'red';
  let qrContainerElement;
  
  // Transaction result
  let transactionResult = null;
  let balance = 0;
  
  // Debug state
  let lastScannedQR = '';
  let scanCount = 0;
  
  // Get initial balance and generate QR
  onMount(() => {
    generateInitialQR();
    balance = transactionManager.getBalance(userId);
    console.log("QRKissMirrored mounted, mode:", mode);
  });
  
  async function generateInitialQR() {
    const initialData = JSON.stringify({
      type: 'identity',
      user_id: userId,
      mode: mode
    });
    
    qrCodeData = initialData;
    qrImageSrc = await QRCode.toDataURL(initialData);
  }
  
  function handleQRScan(data) {
    try {
      // Add visual feedback that something was scanned
      console.log("QR Scanned:", data);
      lastScannedQR = data.substring(0, 30) + (data.length > 30 ? '...' : '');
      scanCount++;
      
      // Add a log message and vibration
      if (window.navigator.vibrate) {
        window.navigator.vibrate(50); // Short vibration for scan feedback
      }
      
      const scannedData = JSON.parse(data);
      console.log("Parsed QR data:", scannedData);
      
      // Process based on current state and received data
      switch (transactionState) {
        case 'initial':
          // Check if this is an identity QR from the opposite role
          if (scannedData.type === 'identity' && 
              scannedData.mode !== mode) {
            
            console.log("Detected opposite party identity QR");
            
            // We've detected the other party
            transactionState = 'aligned';
            boxColor = 'orange';
            
            // If sender, generate trade offer (Blob2)
            if (mode === 'sender' && amount) {
              setTimeout(generateBlob2, 200, scannedData.user_id);
            }
          }
          break;
          
        case 'aligned':
          // Receiver detects Blob2 from sender
          if (mode === 'receiver' && 
              scannedData.type === 'blob2') {
            
            console.log("Receiver detected Blob2");
            
            // Generate response (Blob3)
            setTimeout(() => generateBlob3(scannedData), 200);
          }
          break;
          
        case 'blob2':
          // Sender detects Blob3 from receiver
          if (mode === 'sender' && 
              scannedData.type === 'blob3' && 
              scannedData.transaction_id === transactionId) {
            
            console.log("Sender detected Blob3");
            
            // Transaction complete
            completeTransaction(scannedData);
          }
          break;
      }
    } catch (error) {
      console.error('Error processing QR data:', error);
    }
  }
  
  async function generateBlob2(receiverId) {
    // Generate a unique transaction ID
    transactionId = 'tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    
    const blob2 = {
      type: 'blob2',
      user_id: userId,
      receiver_id: receiverId || 'unknown-receiver', // Use provided ID or fallback
      amount: parseFloat(amount),
      transaction_id: transactionId,
      timestamp: Date.now()
    };
    
    qrCodeData = JSON.stringify(blob2);
    qrImageSrc = await QRCode.toDataURL(qrCodeData);
    transactionState = 'blob2';
    
    // Flash effect on border
    flashBox();
  }
  
  async function generateBlob3(blob2Data) {
    const blob3 = {
      type: 'blob3',
      response: 'yes',
      transaction_id: blob2Data.transaction_id,
      sender_id: blob2Data.user_id,
      receiver_id: userId,
      amount: blob2Data.amount,
      timestamp: Date.now()
    };
    
    // Store transaction ID
    transactionId = blob2Data.transaction_id;
    
    qrCodeData = JSON.stringify(blob3);
    qrImageSrc = await QRCode.toDataURL(qrCodeData);
    transactionState = 'blob3';
    
    // Flash effect on border
    flashBox();
    
    // Process transaction on receiver side
    const transaction = {
      id: blob2Data.transaction_id,
      amount: blob2Data.amount,
      sender: blob2Data.user_id,
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
      // You could display an error message here
    }
    
    // Auto-complete for receiver after a short delay
    setTimeout(() => {
      if (transactionState === 'blob3') {
        completeTransaction(blob3);
      }
    }, 1000);
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
      const transaction = {
        id: transactionId,
        amount: parseFloat(amount),
        sender: userId,
        receiver: finalData.receiver_id,
        timestamp: Date.now()
      };
      
      // Process the transaction
      const result = transactionManager.processTransaction(transaction);
      
      if (result.success) {
        transactionResult = result.transaction;
        balance = result.senderBalance;
      } else {
        console.error('Transaction failed:', result.error);
        // You could display an error message here
      }
    }
    
    // Notify parent component
    setTimeout(() => {
      onTransactionComplete(transactionResult);
    }, 1000);
  }
  
  function flashBox() {
    const originalColor = boxColor;
    
    // Quick flash effect
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
        // Even if initial, show we're ready on sender side
        boxColor = 'orange';
        transactionState = 'aligned';
        generateBlob2(); // Auto-generate blob2 even without seeing receiver
      }
    } else if (transactionState === 'initial' && mode === 'receiver') {
      // Receiver is showing they're ready to receive
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
    amount = '';
    // Generate new QR code
    generateInitialQR();
  }
</script>

<div class="qr-kiss-container">
  <!-- QR Code display - positioned above the camera view -->
  <div class="qr-display" style="border-color: {boxColor}">
    {#if qrImageSrc}
      <img src={qrImageSrc} alt="QR Code" class="qr-image" />
    {/if}
  </div>
  
  <!-- QR Scanner with mirrored view -->
  <div class="scanner-container">
    <QRScannerMirrored onScan={handleQRScan} boxSize={240} mirrored={true}>
      <div class="scanner-overlay">
        <div class="status-indicator" style="background-color: {boxColor}"></div>
      </div>
    </QRScannerMirrored>
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
    
    <!-- Debug info -->
    <div class="debug-info">
      <div>Mode: <strong>{mode}</strong></div>
      <div>Last QR scan: {lastScannedQR || 'None'}</div>
      <div>Scan count: {scanCount}</div>
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
  
  .qr-display {
    width: 100%;
    padding: 15px;
    display: flex;
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
    width: 150px;
    height: 150px;
    /* Don't mirror the QR code itself - it needs to be readable */
    transform: scaleX(1);
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
    justify-content: flex-end;
  }
  
  .status-indicator {
    height: 15px;
    width: 100%;
    transition: background-color 0.3s ease;
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
  
  .debug-info {
    margin-top: 15px;
    padding: 10px;
    background-color: #e0e0e0;
    border-radius: 4px;
    font-size: 14px;
    font-family: monospace;
    color: #666;
  }
</style>