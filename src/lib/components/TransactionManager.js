// TransactionManager.js
// A simple transaction manager to simulate token transfers

class TransactionManager {
    constructor() {
      // Initialize user balances from localStorage or with defaults
      this.balances = JSON.parse(localStorage.getItem('juice_balances')) || {};
      
      // Set default balance of 100 for new users
      this.DEFAULT_BALANCE = 100;
      
      // Transaction history
      this.transactions = JSON.parse(localStorage.getItem('juice_transactions')) || [];
      
      // Maximum number of transactions to keep in history
      this.MAX_TRANSACTIONS = 50;
    }
    
    // Get balance for a user
    getBalance(userId) {
      if (!this.balances[userId]) {
        this.balances[userId] = this.DEFAULT_BALANCE;
        this._saveBalances();
      }
      return this.balances[userId];
    }
    
    // Process a transaction between users
    processTransaction(transaction) {
      const { id, amount, sender, receiver, timestamp } = transaction;
      
      // Validate transaction
      if (!this._validateTransaction(transaction)) {
        return {
          success: false,
          error: 'Invalid transaction'
        };
      }
      
      // Initialize balances if needed
      this.getBalance(sender);
      this.getBalance(receiver);
      
      // Check if sender has enough funds
      if (this.balances[sender] < amount) {
        return {
          success: false,
          error: 'Insufficient funds'
        };
      }
      
      // Process the transaction
      this.balances[sender] -= amount;
      this.balances[receiver] += amount;
      
      // Record the transaction
      const completedTransaction = {
        ...transaction,
        status: 'completed',
        processedAt: Date.now()
      };
      
      this.transactions.unshift(completedTransaction);
      
      // Limit transaction history size
      if (this.transactions.length > this.MAX_TRANSACTIONS) {
        this.transactions = this.transactions.slice(0, this.MAX_TRANSACTIONS);
      }
      
      // Save to localStorage
      this._saveBalances();
      this._saveTransactions();
      
      return {
        success: true,
        transaction: completedTransaction,
        senderBalance: this.balances[sender],
        receiverBalance: this.balances[receiver]
      };
    }
    
    // Get transaction history
    getTransactionHistory(userId = null) {
      if (userId) {
        return this.transactions.filter(tx => 
          tx.sender === userId || tx.receiver === userId
        );
      }
      return this.transactions;
    }
    
    // Reset all balances (for testing)
    resetAllBalances() {
      this.balances = {};
      this.transactions = [];
      localStorage.removeItem('juice_balances');
      localStorage.removeItem('juice_transactions');
    }
    
    // Private: Validate transaction structure
    _validateTransaction(transaction) {
      const { id, amount, sender, receiver } = transaction;
      
      // Basic validation
      if (!id || !sender || !receiver) return false;
      if (sender === receiver) return false;
      if (isNaN(amount) || amount <= 0) return false;
      
      return true;
    }
    
    // Private: Save balances to localStorage
    _saveBalances() {
      localStorage.setItem('juice_balances', JSON.stringify(this.balances));
    }
    
    // Private: Save transactions to localStorage
    _saveTransactions() {
      localStorage.setItem('juice_transactions', JSON.stringify(this.transactions));
    }
  }
  
  // Create singleton instance
  const transactionManager = new TransactionManager();
  
  export default transactionManager;