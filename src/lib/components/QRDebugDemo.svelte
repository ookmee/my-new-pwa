<!-- src/lib/components/QRDebugDemo.svelte -->
<script>
    import { onMount } from 'svelte';
    import QRTestPage from './QRTestPage.svelte';
    import QRKissDebug from './QRKissDebug.svelte';
    import transactionManager from './TransactionManager.js';
    
    let currentTab = 'qrscan'; // 'qrscan', 'qrkiss'
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
    
    function resetBalances() {
      if (confirm('Are you sure you want to reset all balances and transaction history?')) {
        transactionManager.resetAllBalances();
        updateTransactionHistory();
        transactionResult = null;
        window.location.reload(); // Reload to update balance display
      }
    }
    
    function switchTab(tab) {
      currentTab = tab;
    }
    
    function formatTimestamp(timestamp) {
      return new Date(timestamp).toLocaleString();
    }
  </script>
  
  <div class="debug-demo-container">
    <h1>QR Debug Tools</h1>
    
    <div class="tabs">
      <button 
        class="tab-button {currentTab === 'qrscan' ? 'active' : ''}" 
        on:click={() => switchTab('qrscan')}
      >
        QR Scanner Test
      </button>
      <button 
        class="tab-button {currentTab === 'qrkiss' ? 'active' : ''}" 
        on:click={() => switchTab('qrkiss')}
      >
        QR Kiss Debug
      </button>
    </div>
    
    <div class="tab-content">
      {#if currentTab === 'qrscan'}
        <QRTestPage />
      {:else if currentTab === 'qrkiss'}
        <div>
          <div class="actions">
            <button on:click={toggleMode} class="action-button mode-button">
              Switch to {transactionMode === 'sender' ? 'Receiver' : 'Sender'} Mode
            </button>
            <button on:click={resetBalances} class="action-button reset-button">
              Reset All Balances
            </button>
          </div>
          
          <div class="qrkiss-wrapper">
            <QRKissDebug 
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
        </div>
      {/if}
    </div>
  </div>
  
  <style>
    .debug-demo-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      font-family: sans-serif;
    }
    
    h1 {
      text-align: center;
      margin-bottom: 20px;
      color: #333;
    }
    
    .tabs {
      display: flex;
      margin-bottom: 20px;
      border-bottom: 1px solid #ddd;
    }
    
    .tab-button {
      padding: 10px 20px;
      background-color: #f5f5f5;
      border: none;
      border-radius: 4px 4px 0 0;
      cursor: pointer;
      font-size: 16px;
      margin-right: 5px;
    }
    
    .tab-button.active {
      background-color: #007bff;
      color: white;
    }
    
    .tab-content {
      background-color: #fff;
      border-radius: 0 0 4px 4px;
      padding: 20px 0;
    }
    
    .actions {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    
    .action-button {
      flex: 1;
      padding: 10px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    
    .mode-button {
      background-color: #007bff;
      color: white;
    }
    
    .mode-button:hover {
      background-color: #0069d9;
    }
    
    .reset-button {
      background-color: #dc3545;
      color: white;
    }
    
    .reset-button:hover {
      background-color: #c82333;
    }
    
    .qrkiss-wrapper {
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
  </style>