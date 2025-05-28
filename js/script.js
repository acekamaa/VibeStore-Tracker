// TraderTrack - Smart Finance Tracker JavaScript
// Main application functionality
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Replace these with your actual Supabase credentials
const supabaseUrl = "https://tjyhlfppaebvozoupgis.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqeWhsZnBwYWVidm96b3VwZ2lzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgyODYxODEsImV4cCI6MjA2Mzg2MjE4MX0.784hEOR7qEd2P43_rMyo-DWNObpqmVo1aeBgSXNzGn0";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

class TraderTrack {
    constructor() {
        this.transactions = [];
        this.currentInputMethod = 'manual';
        this.recognition = null;
        this.isListening = false;
    }

    // Static method for async initialization
    static async create() {
        const instance = new TraderTrack();
        await instance.init();
        return instance;
    }

    async init() {
        try {
            this.bindEvents();
            this.initSpeechRecognition();
            this.setupInputMethods();

            // Show loading indicator
            this.showLoadingState();

            // Load transactions from Supabase
            this.transactions = await this.loadTransactions();

            // Update UI
            this.updateDisplay();
            this.hideLoadingState();

            console.log(`TraderTrack initialized with ${this.transactions.length} transactions`);
        } catch (error) {
            console.error('Initialization error:', error);
            this.handleInitError(error);
        }
    }

    // Event Binding
    bindEvents() {
        // Form submission
        document.getElementById('transactionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTransaction();
        });

        // Transaction type buttons
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectTransactionType(e.target);
            });
        });

        // Input method buttons
        document.getElementById('manualBtn').addEventListener('click', () => {
            this.setInputMethod('manual');
        });

        document.getElementById('voiceBtn').addEventListener('click', () => {
            this.setInputMethod('voice');
        });

        document.getElementById('photoBtn').addEventListener('click', () => {
            this.setInputMethod('photo');
        });

        // Camera input
        document.getElementById('cameraInput').addEventListener('change', (e) => {
            this.handleImageUpload(e);
        });

        // Voice modal close
        document.addEventListener('click', (e) => {
            if (e.target.id === 'voiceModal') {
                this.stopVoiceInput();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'i':
                        e.preventDefault();
                        this.selectTransactionType(document.querySelector('.type-btn[data-type="income"]'));
                        break;
                    case 'e':
                        e.preventDefault();
                        this.selectTransactionType(document.querySelector('.type-btn[data-type="expense"]'));
                        break;
                    case 'Enter':
                        e.preventDefault();
                        document.getElementById('transactionForm').dispatchEvent(new Event('submit'));
                        break;
                }
            }
        });
    }

    // Input Methods
    setupInputMethods() {
        this.setInputMethod('manual');
    }

    setInputMethod(method) {
        this.currentInputMethod = method;
        
        // Update active state
        document.querySelectorAll('.input-method').forEach(btn => {
            btn.classList.remove('active');
        });

        switch(method) {
            case 'manual':
                document.getElementById('manualBtn').classList.add('active');
                break;
            case 'voice':
                document.getElementById('voiceBtn').classList.add('active');
                this.startVoiceInput();
                break;
            case 'photo':
                document.getElementById('photoBtn').classList.add('active');
                document.getElementById('cameraInput').click();
                break;
        }
    }

    // Speech Recognition
    initSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';

            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript.toLowerCase();
                this.processVoiceInput(transcript);
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.showToast('Voice input error. Please try again.');
                this.stopVoiceInput();
            };

            this.recognition.onend = () => {
                this.isListening = false;
                this.stopVoiceInput();
            };
        }
    }

    startVoiceInput() {
        if (!this.recognition) {
            this.showToast('Voice input not supported in this browser');
            return;
        }

        document.getElementById('voiceModal').style.display = 'flex';
        this.isListening = true;
        
        try {
            this.recognition.start();
        } catch (error) {
            console.error('Error starting voice recognition:', error);
            this.showToast('Could not start voice input');
        }
    }

    stopVoiceInput() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
        
        document.getElementById('voiceModal').style.display = 'none';
        this.isListening = false;
        
        // Reset to manual input
        setTimeout(() => {
            this.setInputMethod('manual');
        }, 100);
    }

    processVoiceInput(transcript) {
        console.log('Voice transcript:', transcript);
        
        // Parse voice input for transaction details
        let type = 'income';
        let amount = 0;
        let description = '';

        // Detect transaction type
        if (transcript.includes('expense') || transcript.includes('spent') || transcript.includes('bought') || transcript.includes('paid')) {
            type = 'expense';
        }

        // Extract amount using regex
        const amountMatches = transcript.match(/(?:kes|ksh|shilling)?[\s]*(\d+(?:\.\d{2})?)/i);
        if (amountMatches) {
            amount = parseFloat(amountMatches[1]);
        }

        // Extract description (everything after amount or transaction type keywords)
        description = transcript
            .replace(/^(income|expense|spent|bought|paid|sold|earned|from|for)\s*/i, '')
            .replace(/kes|ksh|shilling/gi, '')
            .replace(/\d+(?:\.\d{2})?/, '')
            .trim();

        if (description === '') {
            description = type === 'income' ? 'Voice income entry' : 'Voice expense entry';
        }

        // Fill form with extracted data
        this.fillTransactionForm(type, amount, description);
        this.stopVoiceInput();
    }

    // Image Processing (OCR simulation)
    handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Simulate OCR processing
        this.showToast('Processing image... (OCR simulation)');
        
        setTimeout(() => {
            // Simulate extracted data from receipt/image
            const simulatedData = this.simulateOCRExtraction();
            this.fillTransactionForm(simulatedData.type, simulatedData.amount, simulatedData.description);
            this.showToast('Image processed! Review the extracted data.');
        }, 2000);
    }

    simulateOCRExtraction() {
        // Simulate OCR results
        const mockReceipts = [
            { type: 'expense', amount: 250.50, description: 'Grocery shopping at supermarket' },
            { type: 'expense', amount: 150.00, description: 'Fuel purchase' },
            { type: 'income', amount: 1200.00, description: 'Product sale' },
            { type: 'expense', amount: 85.75, description: 'Office supplies' },
            { type: 'income', amount: 500.00, description: 'Service payment received' }
        ];
        
        return mockReceipts[Math.floor(Math.random() * mockReceipts.length)];
    }

    // Form Management
    fillTransactionForm(type, amount, description) {
        // Set transaction type
        this.selectTransactionType(document.querySelector(`.type-btn[data-type="${type}"]`));
        
        // Fill amount and description
        document.getElementById('amount').value = amount;
        document.getElementById('description').value = description;
    }

    selectTransactionType(element) {
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        element.classList.add('active');
    }

    async addTransaction() {
        const amount = parseFloat(document.getElementById('amount').value);
        const description = document.getElementById('description').value.trim();
        const type = document.querySelector('.type-btn.active').dataset.type;

        if (!amount || amount <= 0) {
            this.showToast('Please enter a valid amount');
            return;
        }

        if (!description) {
            this.showToast('Please enter a description');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('transactions')
                .insert([{
                    type: type,
                    amount: amount,
                    note: description,
                    created_at: new Date().toISOString(),
                }])
                .select();

            if (error) throw error;

            // Add to local array
            const newTransaction = {
                id: data[0].id,
                type: type,
                amount: amount,
                description: description,
                date: data[0].created_at,
                timestamp: new Date(data[0].created_at).getTime()
            };

            this.transactions.unshift(newTransaction);
            this.updateDisplay();
            this.resetForm();
            
            const typeText = type === 'income' ? 'Income' : 'Expense';
            this.showToast(`${typeText} of Kes ${amount.toFixed(2)} added successfully!`);
            
        } catch (error) {
            console.error('Error adding transaction:', error);
            this.showToast('Failed to add transaction. Please try again.');
        }
    }

    resetForm() {
        document.getElementById('amount').value = '';
        document.getElementById('description').value = '';
        document.getElementById('amount').focus();
    }

    // Data Loading
    async loadTransactions() {
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!data || !Array.isArray(data)) {
                console.warn('No transaction data returned from Supabase');
                return [];
            }

            return data.map(row => {
                if (!row.id || !row.type || row.amount === undefined) {
                    console.warn('Invalid transaction row:', row);
                    return null;
                }

                return {
                    id: row.id,
                    type: row.type,
                    amount: parseFloat(row.amount) || 0,
                    description: row.note || 'No description',
                    date: row.created_at,
                    timestamp: row.created_at ? new Date(row.created_at).getTime() : Date.now()
                };
            }).filter(Boolean);

        } catch (error) {
            console.error('Supabase fetch error:', error);
            
            if (error.message) {
                this.showToast(`Load error: ${error.message}`);
            } else {
                this.showToast('Could not load transactions. Check your connection.');
            }
            
            throw error;
        }
    }

    // Loading States
    showLoadingState() {
        const container = document.getElementById('transactionsList');
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <div class="loading-icon">🔄</div>
                    <div>Loading transactions...</div>
                </div>
            `;
        }
    }

    hideLoadingState() {
        // Loading state will be replaced by updateDisplay()
    }

    handleInitError(error) {
        this.transactions = [];
        this.updateDisplay();
        this.hideLoadingState();
        
        // Show user-friendly error message
        if (error.message?.includes('fetch')) {
            this.showToast('Network error. Please check your internet connection.');
        } else {
            this.showToast('Failed to load data. Starting fresh.');
        }
    }

    // Display Updates
    updateDisplay() {
        this.updateStatistics();
        this.updateTransactionsList();
        this.updateProfitIndicator();
    }

    updateStatistics() {
        const totalIncome = this.transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const totalExpense = this.transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        document.getElementById('totalIncome').textContent = `Kes ${totalIncome.toFixed(2)}`;
        document.getElementById('totalExpense').textContent = `Kes ${totalExpense.toFixed(2)}`;
    }

    updateTransactionsList() {
        const container = document.getElementById('transactionsList');
        
        if (this.transactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📊</div>
                    <div>No transactions yet</div>
                    <div class="empty-state-message">Add your first income or expense above</div>
                </div>
            `;
            return;
        }

        // Sort transactions by timestamp (newest first)
        const sortedTransactions = [...this.transactions].sort((a, b) => b.timestamp - a.timestamp);

        container.innerHTML = sortedTransactions.map(transaction => {
            const date = new Date(transaction.date);
            const formattedDate = date.toLocaleDateString('en-KE', { 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
                <div class="transaction-item ${transaction.type}" data-id="${transaction.id}">
                    <div class="transaction-header">
                        <div class="transaction-amount ${transaction.type}">
                            ${transaction.type === 'income' ? '+' : '-'}Kes ${transaction.amount.toFixed(2)}
                        </div>
                        <div class="transaction-date">${formattedDate}</div>
                    </div>
                    <div class="transaction-description">${transaction.description}</div>
                    <button class="delete-btn" onclick="window.app.deleteTransaction(${transaction.id})" title="Delete transaction">
                        🗑️
                    </button>
                </div>
            `;
        }).join('');
    }

    updateProfitIndicator() {
        const totalIncome = this.transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const totalExpense = this.transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        const netProfit = totalIncome - totalExpense;
        
        document.getElementById('netProfit').textContent = `Kes ${netProfit.toFixed(2)}`;
        
        // Update color based on profit/loss
        const profitElement = document.querySelector('.floating-profit');
        if (netProfit > 0) {
            profitElement.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        } else if (netProfit < 0) {
            profitElement.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        } else {
            profitElement.style.background = 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)';
        }
    }

    // Transaction Management
    async deleteTransaction(id) {
        if (confirm('Are you sure you want to delete this transaction?')) {
            try {
                const { error } = await supabase
                    .from('transactions')
                    .delete()
                    .eq('id', id);

                if (error) throw error;

                this.transactions = this.transactions.filter(t => t.id !== id);
                this.updateDisplay();
                this.showToast('Transaction deleted successfully');
                
            } catch (error) {
                console.error('Error deleting transaction:', error);
                this.showToast('Failed to delete transaction');
            }
        }
    }

    // Utility Functions
    showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Export/Import functionality
    exportData() {
        const data = {
            transactions: this.transactions,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `tradertrack-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('Data exported successfully!');
    }

    importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.transactions && Array.isArray(data.transactions)) {
                    this.transactions = data.transactions;
                    this.updateDisplay();
                    this.showToast('Data imported successfully!');
                } else {
                    throw new Error('Invalid data format');
                }
            } catch (error) {
                this.showToast('Error importing data: ' + error.message);
            }
        };
        reader.readAsText(file);
    }

    // Analytics
    getAnalytics() {
        const analytics = {
            totalTransactions: this.transactions.length,
            totalIncome: this.transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
            totalExpense: this.transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
            avgIncome: 0,
            avgExpense: 0,
            mostExpensiveTransaction: null,
            largestIncome: null
        };

        const incomeTransactions = this.transactions.filter(t => t.type === 'income');
        const expenseTransactions = this.transactions.filter(t => t.type === 'expense');

        if (incomeTransactions.length > 0) {
            analytics.avgIncome = analytics.totalIncome / incomeTransactions.length;
            analytics.largestIncome = incomeTransactions.reduce((max, t) => t.amount > max.amount ? t : max);
        }

        if (expenseTransactions.length > 0) {
            analytics.avgExpense = analytics.totalExpense / expenseTransactions.length;
            analytics.mostExpensiveTransaction = expenseTransactions.reduce((max, t) => t.amount > max.amount ? t : max);
        }

        analytics.netProfit = analytics.totalIncome - analytics.totalExpense;

        return analytics;
    }
}

// Global functions for HTML onclick handlers
window.stopVoiceInput = function() {
    if (window.app) {
        window.app.stopVoiceInput();
    }
};

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    try {
        window.app = await TraderTrack.create();
        console.log('TraderTrack initialized successfully!');
    } catch (error) {
        console.error('Failed to initialize TraderTrack:', error);
        // Create a basic instance even if initialization fails
        window.app = new TraderTrack();
        window.app.transactions = [];
        window.app.bindEvents();
        window.app.initSpeechRecognition();
        window.app.setupInputMethods();
        window.app.updateDisplay();
    }
});

// Service Worker registration (for PWA functionality)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}