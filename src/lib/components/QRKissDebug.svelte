<!-- src/lib/components/QRKissDebug.svelte -->
<script>
    import { onMount, onDestroy } from 'svelte';
    import QRScannerDebug from './QRScannerDebug.svelte';
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
    
    // Get initial balance and scroll to QR
    onMount(() => {
      generateInitialQR();
      balance = transactionManager.getBalance(userId);
      
      // Scroll to QR code after a short delay
      setTimeout(() => {
        const qrElement = document.getElementById('qr-anchor');
        if (qrElement) {
          qrElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    });
    
    async function generateInitialQR() {
      const initialData = JSON.stringify({
        type: 'identity',
        user_id: userId,
        mode: mode
      });
      
      qrCodeData = initialData;
      qrImageSrc = await QRCode.toDataURL(initialData);
      
      // Scroll to QR when available
      setTimeout(() => {
        const qrElement = document.getElementById('qr-anchor');
        if (qrElement) {
          qrElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
    
    function handleQRScan(data) {
      try {
        // Add visual feedback that something was scanned
        console.log("QR Scanned:", data);
        lastScannedQR = data.substring(0, 30) + (data.length > 30 ? '...' : '');
        scanCount++;
        
        // Add a log message
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
      
      // Scroll to QR code
      setTimeout(() => {
        const qrElement = document.getElementById('qr-anchor');
        if (qrElement) {
          qrElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
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
      
      // Scroll to QR code
      setTimeout(() => {
        const qrElement = document.getElementById('qr-anchor');
        if (qrElement) {
          qrElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      
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
  </script>
  
  <div class="qr-kiss-container">
    <!-- QR Scanner with bordered box -->
    <div class="scanner-container">
      <QRScannerDebug onScan={handleQRScan} boxSize={240} debounceTime={200}>
        <div class="qr-content" style="border-color: {boxColor}">
          <!-- QR Code with ID for scroll anchoring -->
          <div id="qr-anchor" class="qr-container">
            {#if qrImageSrc}
              <img src={qrImageSrc} alt="QR Code" class="qr-image" />
            {/if}
          </div>
          
          <!-- Status indicator -->
          <div class="status-indicator" style="background-color: {boxColor}"></div>
        </div>
      </QRScannerDebug>
    </div>
    
    <!-- Balance display (outside QR scanner) -->
    <div class="balance-display">
      Balance: {balance} JUICE
    </div>
    
    <!-- Current QR data (helpful for debugging) -->
    <div class="qr-data-display">
      <div class="qr-data-label">Current QR Data:</div>
      <div class="qr-data-content">{qrCodeData.substring(0, 50)}{qrCodeData.length > 50 ? '...' : ''}</div>
    </div>
    
    <!-- Controls section (completely outside the scanner) -->
    <div class="controls-container">
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
    </div>
    
    <!-- Debug info panel - MOVED TO BOTTOM -->
    <div class="debug-info-panel">
      <h3>Debug Info</h3>
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
      <div class="debug-row">
        <span class="debug-label">User ID:</span>
        <span class="debug-value">{userId.substring(0, 10)}...</span>
      </div>
      <div class="debug-row">
        <span class="debug-label">Last QR:</span>
        <span class="debug-value">{lastScannedQR || 'None'}</span>
      </div>
      <div class="debug-row">
        <span class="debug-label">Scan Count:</span>
        <span class="debug-value">{scanCount}</span>
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
      gap: 20px;
    }
    
    .debug-info-panel {
      background-color: #f0f0f0;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 15px;
    }
    
    .debug-info-panel h3 {
      margin-top: 0;
      margin-bottom: 8px;
      font-size: 16px;
      color: #333;
    }
    
    .debug-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px solid #eee;
    }
    
    .debug-label {
      font-weight: bold;
      color: #555;
    }
    
    .debug-value {
      font-family: monospace;
    }
    
    .scanner-container {
      width: 100%;
      height: 350px;
      position: relative;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    
    .qr-content {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
      border-width: 20px;
      border-style: solid;
      position: relative;
    }
    
    .qr-container {
      width: 100%;
      display: flex;
      justify-content: center;
    }
    
    .qr-image {
      width: 180px;
      height: 180px;
    }
    
    .qr-data-display {
      background-color: #333;
      color: #fff;
      padding: 10px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      margin-bottom: 15px;
      word-break: break-all;
    }
    
    .qr-data-label {
      font-weight: bold;
      margin-bottom: 5px;
      color: #aaa;
    }
    
    .balance-display {
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 8px 12px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: bold;
      text-align: center;
      margin-bottom: 10px;
    }
    
    .controls-container {
      width: 100%;
      padding: 15px;
      background-color: #f5f5f5;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    .input-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      gap: 10px;
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
      margin-top: 5px;
    }
    
    .agree-button:hover {
      background-color: #45a049;
    }
    
    .success-message {
      font-size: 18px;
      font-weight: bold;
      color: #4CAF50;
      margin-top: 10px;
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
    
    .status-indicator {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 15px;
      transition: background-color 0.3s ease;
    }
  </style>