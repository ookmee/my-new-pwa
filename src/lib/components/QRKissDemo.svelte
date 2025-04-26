<!-- QRKissDemo.svelte -->
<script>
    import { onMount } from 'svelte';
    import QRKiss from './QRKiss.svelte';
    
    let transactionMode = 'sender'; // Default to sender mode
    let transactionResult = null;
    let userId = 'user-' + Math.random().toString(36).substring(2, 9);
    
    function handleTransactionComplete(transaction) {
      transactionResult = transaction;
      console.log('Transaction completed:', transaction);
    }
    
    function toggleMode() {
      transactionMode = transactionMode === 'sender' ? 'receiver' : 'sender';
    }
  </script>
  
  <div class="qr-kiss-demo-container">
    <div class="header">
      <h1>QR Kiss Demo</h1>
      <div class="mode-toggle">
        <span>Mode: <strong>{transactionMode}</strong></span>
        <button on:click={toggleMode} class="toggle-button">
          Switch to {transactionMode === 'sender' ? 'Receiver' : 'Sender'} Mode
        </button>
      </div>
    </div>
    
    <div class="qr-kiss-wrapper">
      <QRKiss 
        mode={transactionMode}
        userId={userId}
        onTransactionComplete={handleTransactionComplete}
      />
    </div>
    
    {#if transactionResult}
      <div class="transaction-result">
        <h2>Transaction Result</h2>
        <div class="result-card">
          <div class="result-row">
            <span class="label">Transaction ID:</span>
            <span class="value">{transactionResult.id}</span>
          </div>
          <div class="result-row">
            <span class="label">Amount:</span>
            <span class="value">{transactionResult.amount} JUICE</span>
          </div>
          <div class="result-row">
            <span class="label">Sender:</span>
            <span class="value">{transactionResult.sender}</span>
          </div>
          <div class="result-row">
            <span class="label">Receiver:</span>
            <span class="value">{transactionResult.receiver}</span>
          </div>
          <div class="result-row">
            <span class="label">Status:</span>
            <span class="value status-{transactionResult.status}">{transactionResult.status}</span>
          </div>
          <div class="result-row">
            <span class="label">Timestamp:</span>
            <span class="value">{new Date(transactionResult.timestamp).toLocaleString()}</span>
          </div>
        </div>
      </div>
    {/if}
    
    <div class="instructions">
      <h3>Instructions</h3>
      <ul>
        <li>Use two devices to test the QR Kiss</li>
        <li>Set one device as 'Sender' and the other as 'Receiver'</li>
        <li>Point the front cameras at each other's QR codes</li>
        <li>Follow the on-screen prompts to complete the transaction</li>
      </ul>
      
      <div class="debug-info">
        <strong>Your User ID:</strong> {userId}
      </div>
    </div>
  </div>
  
  <style>
    .qr-kiss-demo-container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      font-family: sans-serif;
    }
    
    .header {
      margin-bottom: 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    
    h1 {
      margin: 0;
      font-size: 24px;
      color: #333;
    }
    
    .mode-toggle {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    
    .toggle-button {
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px 12px;
      cursor: pointer;
    }
    
    .toggle-button:hover {
      background-color: #0069d9;
    }
    
    .qr-kiss-wrapper {
      height: 500px;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      margin-bottom: 20px;
    }
    
    .transaction-result {
      margin-top: 30px;
      padding: 15px;
      background-color: #f9f9f9;
      border-radius: 8px;
    }
    
    h2 {
      margin-top: 0;
      font-size: 20px;
      color: #333;
    }
    
    .result-card {
      background-color: white;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }
    
    .result-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    
    .result-row:last-child {
      border-bottom: none;
    }
    
    .label {
      font-weight: bold;
      color: #666;
    }
    
    .value {
      color: #333;
    }
    
    .status-completed {
      color: #4CAF50;
      font-weight: bold;
    }
    
    .instructions {
      margin-top: 30px;
      padding: 15px;
      background-color: #f5f5f5;
      border-radius: 8px;
    }
    
    .instructions h3 {
      margin-top: 0;
      color: #333;
    }
    
    .instructions ul {
      padding-left: 20px;
    }
    
    .instructions li {
      margin-bottom: 8px;
    }
    
    .debug-info {
      margin-top: 15px;
      padding: 10px;
      background-color: #e9e9e9;
      border-radius: 4px;
      font-size: 14px;
    }
  </style>
