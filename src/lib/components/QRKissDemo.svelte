<!-- QRKissDemo.svelte (Updated with Transaction History) -->
<script>
  import { onMount } from 'svelte';
  import QRKiss from './QRKiss.svelte';
  import transactionManager from './TransactionManager.js';
  
  let transactionMode = 'sender'; // Default to sender mode
  let transactionResult = null;
  let userId = 'user-' + Math.random().toString(36).substring(2, 9);
  let transactionHistory = [];
  let showHistory = false;
  
  onMount(() => {
    // Load transaction history
    updateTransactionHistory();
  });
  
  function handleTransactionComplete(transaction) {
    transactionResult = transaction;
    console.log('Transaction completed:', transaction);
    
    // Update transaction history
    updateTransactionHistory();
  }
  
  function updateTransactionHistory() {
    transactionHistory = transactionManager.getTransactionHistory(userId);
  }
  
  function toggleMode() {
    transactionMode = transactionMode === 'sender' ? 'receiver' : 'sender';
  }
  
  function toggleHistory() {
    showHistory = !showHistory;
    if (showHistory) {
      updateTransactionHistory();
    }
  }
  
  function resetBalances() {
    if (confirm('Are you sure you want to reset all balances and transaction history?')) {
      transactionManager.resetAllBalances();
      updateTransactionHistory();
      transactionResult = null;
      window.location.reload(); // Reload to update balance display
    }
  }
  
  function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
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
  
  <div class="actions">
    <button on:click={toggleHistory} class="action-button history-button">
      {showHistory ? 'Hide' : 'Show'} Transaction History
    </button>
    <button on:click={resetBalances} class="action-button reset-button">
      Reset All Balances
    </button>
  </div>
  
  {#if showHistory}
    <div class="transaction-history">
      <h2>Transaction History</h2>
      {#if transactionHistory.length === 0}
        <p class="no-transactions">No transactions found.</p>
      {:else}
        <div class="history-list">
          {#each transactionHistory as tx}
            <div class="history-item">
              <div class="tx-details">
                <span class="tx-id">ID: {tx.id.substring(0, 8)}...</span>
                <span class="tx-time">{formatTimestamp(tx.timestamp)}</span>
              </div>
              <div class="tx-amount {tx.sender === userId ? 'sent' : 'received'}">
                {tx.sender === userId ? '-' : '+'}{tx.amount} JUICE
              </div>
              <div class="tx-participants">
                {tx.sender === userId ? 
                  `To: ${tx.receiver.substring(0, 8)}...` : 
                  `From: ${tx.sender.substring(0, 8)}...`}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
  
  <div class="qr-kiss-wrapper">
    <QRKiss 
      mode={transactionMode}
      userId={userId}
      onTransactionComplete={handleTransactionComplete}
    />
  </div>
  
  {#if transactionResult}
    <div class="transaction-result">
      <h2>Last Transaction</h2>
      <div class="result-card">
        <div class="result-row">
          <span class="label">Transaction ID:</span>
          <span class="value">{transactionResult.id.substring(0, 12)}...</span>
        </div>
        <div class="result-row">
          <span class="label">Amount:</span>
          <span class="value">{transactionResult.amount} JUICE</span>
        </div>
        <div class="result-row">
          <span class="label">Sender:</span>
          <span class="value">{transactionResult.sender.substring(0, 12)}...</span>
        </div>
        <div class="result-row">
          <span class="label">Receiver:</span>
          <span class="value">{transactionResult.receiver.substring(0, 12)}...</span>
        </div>
        <div class="result-row">
          <span class="label">Status:</span>
          <span class="value status-{transactionResult.status}">{transactionResult.status}</span>
        </div>
        <div class="result-row">
          <span class="label">Timestamp:</span>
          <span class="value">{formatTimestamp(transactionResult.timestamp)}</span>
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
  
  h2 {
    margin-top: 0;
    font-size: 20px;
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
  
  .actions {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
  }
  
  .action-button {
    flex: 1;
    padding: 8px 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }
  
  .history-button {
    background-color: #17a2b8;
    color: white;
  }
  
  .history-button:hover {
    background-color: #138496;
  }
  
  .reset-button {
    background-color: #dc3545;
    color: white;
  }
  
  .reset-button:hover {
    background-color: #c82333;
  }
  
  .transaction-history {
    margin-bottom: 20px;
    padding: 15px;
    background-color: #f8f9fa;
    border-radius: 8px;
    max-height: 300px;
    overflow-y: auto;
  }
  
  .history-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .history-item {
    background-color: white;
    border-radius: 6px;
    padding: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  .tx-details {
    display: flex;
    justify-content: space-between;
    margin-bottom: 5px;
    font-size: 12px;
    color: #666;
  }
  
  .tx-amount {
    font-size: 18px;
    font-weight: bold;
    margin: 5px 0;
  }
  
  .tx-amount.sent {
    color: #dc3545;
  }
  
  .tx-amount.received {
    color: #28a745;
  }
  
  .tx-participants {
    font-size: 12px;
    color: #666;
  }
  
  .no-transactions {
    text-align: center;
    color: #666;
    padding: 20px 0;
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