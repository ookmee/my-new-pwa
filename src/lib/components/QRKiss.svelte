<!-- QRKiss.svelte -->
<script>
    import { onMount, onDestroy } from 'svelte';
    import QRScanner from './QRScanner.svelte';
    import QRCode from 'qrcode';
    
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
    
    // Generate initial QR code with user ID for identification
    onMount(() => {
      generateInitialQR();
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
        const scannedData = JSON.parse(data);
        
        // Process based on current state and received data
        switch (transactionState) {
          case 'initial':
            // Check if this is an identity QR from the opposite role
            if (scannedData.type === 'identity' && 
                scannedData.mode !== mode) {
              
              // We've detected the other party
              transactionState = 'aligned';
              boxColor = 'orange';
              
              // If sender, generate trade offer (Blob2)
              if (mode === 'sender' && amount) {
                setTimeout(generateBlob2, 200);
              }
            }
            break;
            
          case 'aligned':
            // Receiver detects Blob2 from sender
            if (mode === 'receiver' && 
                scannedData.type === 'blob2') {
              
              // Generate response (Blob3)
              setTimeout(() => generateBlob3(scannedData), 200);
            }
            break;
            
          case 'blob2':
            // Sender detects Blob3 from receiver
            if (mode === 'sender' && 
                scannedData.type === 'blob3' && 
                scannedData.transaction_id === transactionId) {
              
              // Transaction complete
              completeTransaction(scannedData);
            }
            break;
        }
      } catch (error) {
        console.error('Error processing QR data:', error);
      }
    }
    
    async function generateBlob2() {
      // Generate a unique transaction ID
      transactionId = 'tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
      
      const blob2 = {
        type: 'blob2',
        user_id: userId,
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
        receiver_id: userId,
        timestamp: Date.now()
      };
      
      // Store transaction ID
      transactionId = blob2Data.transaction_id;
      
      qrCodeData = JSON.stringify(blob3);
      qrImageSrc = await QRCode.toDataURL(qrCodeData);
      transactionState = 'blob3';
      
      // Flash effect on border
      flashBox();
      
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
      
      // Prepare transaction summary
      const transaction = {
        id: transactionId,
        amount: parseFloat(amount),
        sender: mode === 'sender' ? userId : finalData.user_id,
        receiver: mode === 'receiver' ? userId : finalData.receiver_id,
        timestamp: Date.now(),
        status: 'completed'
      };
      
      // Notify parent component
      setTimeout(() => {
        onTransactionComplete(transaction);
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
      if (transactionState === 'aligned' && mode === 'sender') {
        generateBlob2();
      } else if (transactionState === 'initial' && mode === 'receiver') {
        // Receiver is showing they're ready to receive
        boxColor = 'orange';
        transactionState = 'aligned';
      }
    }
  </script>
  
  <div class="qr-kiss-container">
    <QRScanner onScan={handleQRScan} boxSize={240}>
      <div class="qr-content" style="border-color: {boxColor}">
        {#if qrImageSrc}
          <img src={qrImageSrc} alt="QR Code" class="qr-image" />
        {/if}
        
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
                Agree
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
              Agree to Show Public Key
            </button>
          {:else if transactionState === 'complete'}
            <div class="success-message">
              Payment Received!
            </div>
          {/if}
        {/if}
      </div>
    </QRScanner>
  </div>
  
  <style>
    .qr-kiss-container {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 400px;
    }
    
    .qr-content {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
      padding: 20px;
      box-sizing: border-box;
    }
    
    .qr-image {
      width: 150px;
      height: 150px;
      margin-bottom: 10px;
    }
    
    .input-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      gap: 10px;
    }
    
    .amount-input {
      width: 100%;
      padding: 8px;
      border-radius: 4px;
      border: 1px solid #ccc;
      font-size: 16px;
    }
    
    .agree-button {
      width: 100%;
      padding: 10px;
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
      margin-top: 10px;
    }
  </style>