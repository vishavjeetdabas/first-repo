/* ===================================
   EXPENSE TRACKER - MAIN APPLICATION
   =================================== */

// ====== DATA MODELS & DEFAULTS ======

const DEFAULT_CATEGORIES = {
    expense: [
        { id: 'food', name: 'Food', type: 'expense', isDefault: true },
        { id: 'transport', name: 'Transport', type: 'expense', isDefault: true },
        { id: 'rent', name: 'Rent', type: 'expense', isDefault: true },
        { id: 'shopping', name: 'Shopping', type: 'expense', isDefault: true },
        { id: 'bills', name: 'Bills', type: 'expense', isDefault: true },
        { id: 'entertainment', name: 'Entertainment', type: 'expense', isDefault: true },
        { id: 'health', name: 'Health', type: 'expense', isDefault: true }
    ],
    income: [
        { id: 'salary', name: 'Salary', type: 'income', isDefault: true },
        { id: 'freelance', name: 'Freelance', type: 'income', isDefault: true },
        { id: 'business', name: 'Business', type: 'income', isDefault: true },
        { id: 'investment', name: 'Investment', type: 'income', isDefault: true },
        { id: 'other', name: 'Other', type: 'income', isDefault: true }
    ]
};

const CURRENCY_CONFIG = {
    INR: { symbol: '₹', rate: 1 },
    USD: { symbol: '$', rate: 0.012 } // 1 INR = 0.012 USD (approximate)
};

// ====== STATE MANAGEMENT ======

const state = {
    transactions: [],
    categories: { expense: [], income: [] },
    settings: {
        currency: 'INR'
    },
    currentPage: 'home',
    currentCategoryTab: 'expense',
    editingCategoryId: null,
    charts: {
        bar: null,
        pie: null,
        line: null
    }
};

// ====== LOCAL STORAGE ======

const Storage = {
    keys: {
        transactions: 'expense_tracker_transactions',
        categories: 'expense_tracker_categories',
        settings: 'expense_tracker_settings'
    },

    load() {
        try {
            const transactions = localStorage.getItem(this.keys.transactions);
            const categories = localStorage.getItem(this.keys.categories);
            const settings = localStorage.getItem(this.keys.settings);

            state.transactions = transactions ? JSON.parse(transactions) : [];
            state.categories = categories ? JSON.parse(categories) : this.initDefaultCategories();
            state.settings = settings ? JSON.parse(settings) : { currency: 'INR' };
        } catch (e) {
            console.error('Error loading data:', e);
            state.categories = this.initDefaultCategories();
        }
    },

    initDefaultCategories() {
        const categories = {
            expense: [...DEFAULT_CATEGORIES.expense],
            income: [...DEFAULT_CATEGORIES.income]
        };
        this.saveCategories(categories);
        return categories;
    },

    saveTransactions(transactions) {
        localStorage.setItem(this.keys.transactions, JSON.stringify(transactions));
    },

    saveCategories(categories) {
        localStorage.setItem(this.keys.categories, JSON.stringify(categories));
    },

    saveSettings(settings) {
        localStorage.setItem(this.keys.settings, JSON.stringify(settings));
    },

    clearAll() {
        localStorage.removeItem(this.keys.transactions);
        localStorage.removeItem(this.keys.categories);
        localStorage.removeItem(this.keys.settings);
    }
};

// ====== CURRENCY UTILITIES ======

const Currency = {
    format(amount, currency = state.settings.currency) {
        const config = CURRENCY_CONFIG[currency];
        const converted = amount * config.rate;
        return `${config.symbol}${converted.toLocaleString('en-IN', { 
            minimumFractionDigits: 0,
            maximumFractionDigits: 2 
        })}`;
    },

    getSymbol() {
        return CURRENCY_CONFIG[state.settings.currency].symbol;
    }
};

// ====== DATE UTILITIES ======

const DateUtils = {
    formatDisplay(dateStr) {
        const date = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (this.isSameDay(date, today)) return 'Today';
        if (this.isSameDay(date, yesterday)) return 'Yesterday';

        return date.toLocaleDateString('en-IN', { 
            day: 'numeric', 
            month: 'short' 
        });
    },

    isSameDay(d1, d2) {
        return d1.getDate() === d2.getDate() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getFullYear() === d2.getFullYear();
    },

    getToday() {
        return new Date().toISOString().split('T')[0];
    },

    getStartOfWeek() {
        const date = new Date();
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(date.setDate(diff));
    },

    getStartOfMonth() {
        const date = new Date();
        return new Date(date.getFullYear(), date.getMonth(), 1);
    },

    getLastNMonths(n) {
        const months = [];
        const date = new Date();
        for (let i = n - 1; i >= 0; i--) {
            const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
            months.push({
                key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                label: d.toLocaleDateString('en-IN', { month: 'short' })
            });
        }
        return months;
    }
};

// ====== TRANSACTION OPERATIONS ======

const Transactions = {
    add(transaction) {
        const newTransaction = {
            id: Date.now().toString(),
            ...transaction,
            createdAt: new Date().toISOString()
        };
        state.transactions.unshift(newTransaction);
        Storage.saveTransactions(state.transactions);
        return newTransaction;
    },

    delete(id) {
        state.transactions = state.transactions.filter(t => t.id !== id);
        Storage.saveTransactions(state.transactions);
    },

    getFiltered(filters = {}) {
        let result = [...state.transactions];

        if (filters.search) {
            const search = filters.search.toLowerCase();
            result = result.filter(t => 
                t.category.toLowerCase().includes(search) ||
                t.note?.toLowerCase().includes(search) ||
                t.amount.toString().includes(search)
            );
        }

        if (filters.dateFrom) {
            result = result.filter(t => t.date >= filters.dateFrom);
        }

        if (filters.dateTo) {
            result = result.filter(t => t.date <= filters.dateTo);
        }

        if (filters.type) {
            result = result.filter(t => t.type === filters.type);
        }

        return result.sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    getTotal(type, transactions = state.transactions) {
        return transactions
            .filter(t => t.type === type)
            .reduce((sum, t) => sum + t.amount, 0);
    },

    getBalance(transactions = state.transactions) {
        const income = this.getTotal('income', transactions);
        const expense = this.getTotal('expense', transactions);
        return income - expense;
    },

    getByCategory(type = 'expense') {
        const byCategory = {};
        state.transactions
            .filter(t => t.type === type)
            .forEach(t => {
                byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
            });
        return byCategory;
    },

    getTopCategory() {
        const byCategory = this.getByCategory('expense');
        const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
        return sorted.length > 0 ? sorted[0][0] : null;
    },

    getWeeklySpending() {
        const startOfWeek = DateUtils.getStartOfWeek();
        return state.transactions
            .filter(t => t.type === 'expense' && new Date(t.date) >= startOfWeek)
            .reduce((sum, t) => sum + t.amount, 0);
    },

    getMonthlySpending() {
        const startOfMonth = DateUtils.getStartOfMonth();
        return state.transactions
            .filter(t => t.type === 'expense' && new Date(t.date) >= startOfMonth)
            .reduce((sum, t) => sum + t.amount, 0);
    },

    getMonthlyData(months = 6) {
        const monthsData = DateUtils.getLastNMonths(months);
        const data = { income: [], expense: [], labels: [] };

        monthsData.forEach(month => {
            const monthTransactions = state.transactions.filter(t => 
                t.date.startsWith(month.key)
            );
            data.labels.push(month.label);
            data.income.push(this.getTotal('income', monthTransactions));
            data.expense.push(this.getTotal('expense', monthTransactions));
        });

        return data;
    },

    getCashFlowData(days = 30) {
        const data = { labels: [], values: [] };
        const today = new Date();
        let runningBalance = 0;

        // Get transactions from last N days
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - days);

        for (let i = 0; i < days; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            
            const dayTransactions = state.transactions.filter(t => t.date === dateStr);
            const dayIncome = dayTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
            const dayExpense = dayTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
            
            runningBalance += dayIncome - dayExpense;
            
            if (i % 5 === 0 || i === days - 1) { // Sample every 5 days for cleaner chart
                data.labels.push(date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
                data.values.push(runningBalance);
            }
        }

        return data;
    }
};

// ====== CATEGORY OPERATIONS ======

const Categories = {
    getAll(type = 'expense') {
        return state.categories[type] || [];
    },

    add(name, type) {
        const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
        const category = { id, name, type, isDefault: false };
        state.categories[type].push(category);
        Storage.saveCategories(state.categories);
        return category;
    },

    update(id, name) {
        ['expense', 'income'].forEach(type => {
            const cat = state.categories[type].find(c => c.id === id);
            if (cat) {
                cat.name = name;
            }
        });
        Storage.saveCategories(state.categories);
    },

    delete(id) {
        ['expense', 'income'].forEach(type => {
            state.categories[type] = state.categories[type].filter(c => c.id !== id);
        });
        Storage.saveCategories(state.categories);
    }
};

// ====== UI COMPONENTS ======

const UI = {
    elements: {},

    init() {
        this.cacheElements();
        this.bindEvents();
        this.setDefaultDate();
        this.render();
    },

    cacheElements() {
        this.elements = {
            // Navigation
            navItems: document.querySelectorAll('.nav-item'),
            pages: document.querySelectorAll('.page'),
            
            // Home
            totalBalance: document.getElementById('totalBalance'),
            totalIncome: document.getElementById('totalIncome'),
            totalExpense: document.getElementById('totalExpense'),
            recentTransactions: document.getElementById('recentTransactions'),
            
            // Transactions
            allTransactions: document.getElementById('allTransactions'),
            searchInput: document.getElementById('searchInput'),
            filterDateFrom: document.getElementById('filterDateFrom'),
            filterDateTo: document.getElementById('filterDateTo'),
            
            // Analytics
            weeklySpending: document.getElementById('weeklySpending'),
            monthlySpending: document.getElementById('monthlySpending'),
            topCategory: document.getElementById('topCategory'),
            barChart: document.getElementById('barChart'),
            pieChart: document.getElementById('pieChart'),
            lineChart: document.getElementById('lineChart'),
            exportCSV: document.getElementById('exportCSV'),
            exportPDF: document.getElementById('exportPDF'),
            
            // Categories
            categoryList: document.getElementById('categoryList'),
            categoryTabs: document.querySelectorAll('.category-tabs .tab-btn'),
            addCategoryBtn: document.getElementById('addCategoryBtn'),
            
            // Settings
            currencyToggle: document.getElementById('currencyToggle'),
            currencyBtns: document.querySelectorAll('.currency-btn'),
            clearDataBtn: document.getElementById('clearDataBtn'),
            
            // Transaction Modal
            transactionModal: document.getElementById('transactionModal'),
            transactionForm: document.getElementById('transactionForm'),
            fabAdd: document.getElementById('fabAdd'),
            closeModal: document.getElementById('closeModal'),
            typeBtns: document.querySelectorAll('.transaction-form .type-btn'),
            amountInput: document.getElementById('amount'),
            categorySelect: document.getElementById('category'),
            dateInput: document.getElementById('date'),
            noteInput: document.getElementById('note'),
            currencySymbol: document.getElementById('currencySymbol'),
            
            // Category Modal
            categoryModal: document.getElementById('categoryModal'),
            categoryForm: document.getElementById('categoryForm'),
            closeCategoryModal: document.getElementById('closeCategoryModal'),
            categoryNameInput: document.getElementById('categoryName'),
            catTypeExpense: document.getElementById('catTypeExpense'),
            catTypeIncome: document.getElementById('catTypeIncome'),
            editCategoryId: document.getElementById('editCategoryId'),
            categoryModalTitle: document.getElementById('categoryModalTitle'),
            categorySubmitText: document.getElementById('categorySubmitText'),
            
            // Toast
            toast: document.getElementById('toast'),
            toastMessage: document.getElementById('toastMessage')
        };
    },

    bindEvents() {
        // Navigation
        this.elements.navItems.forEach(item => {
            item.addEventListener('click', () => this.navigateTo(item.dataset.page));
        });

        // FAB
        this.elements.fabAdd.addEventListener('click', () => this.openTransactionModal());
        this.elements.closeModal.addEventListener('click', () => this.closeTransactionModal());
        this.elements.transactionModal.addEventListener('click', (e) => {
            if (e.target === this.elements.transactionModal) this.closeTransactionModal();
        });

        // Transaction Form
        this.elements.typeBtns.forEach(btn => {
            btn.addEventListener('click', () => this.setTransactionType(btn.dataset.type));
        });
        this.elements.transactionForm.addEventListener('submit', (e) => this.handleTransactionSubmit(e));

        // Search & Filters
        this.elements.searchInput.addEventListener('input', () => this.renderAllTransactions());
        this.elements.filterDateFrom.addEventListener('change', () => this.renderAllTransactions());
        this.elements.filterDateTo.addEventListener('change', () => this.renderAllTransactions());

        // Export
        this.elements.exportCSV.addEventListener('click', () => Export.toCSV());
        this.elements.exportPDF.addEventListener('click', () => Export.toPDF());

        // Categories
        this.elements.categoryTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.elements.categoryTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                state.currentCategoryTab = tab.dataset.type;
                this.renderCategories();
            });
        });
        this.elements.addCategoryBtn.addEventListener('click', () => this.openCategoryModal());
        this.elements.closeCategoryModal.addEventListener('click', () => this.closeCategoryModal());
        this.elements.categoryModal.addEventListener('click', (e) => {
            if (e.target === this.elements.categoryModal) this.closeCategoryModal();
        });
        this.elements.categoryForm.addEventListener('submit', (e) => this.handleCategorySubmit(e));
        this.elements.catTypeExpense.addEventListener('click', () => this.setCategoryType('expense'));
        this.elements.catTypeIncome.addEventListener('click', () => this.setCategoryType('income'));

        // Settings
        this.elements.currencyBtns.forEach(btn => {
            btn.addEventListener('click', () => this.setCurrency(btn.dataset.currency));
        });
        this.elements.clearDataBtn.addEventListener('click', () => this.clearAllData());
    },

    setDefaultDate() {
        this.elements.dateInput.value = DateUtils.getToday();
    },

    // Navigation
    navigateTo(page) {
        state.currentPage = page;
        this.elements.navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });
        this.elements.pages.forEach(p => {
            p.classList.toggle('active', p.id === `page-${page}`);
        });
        
        if (page === 'analytics') {
            this.renderCharts();
        }
    },

    // Render Methods
    render() {
        this.renderSummary();
        this.renderRecentTransactions();
        this.renderAllTransactions();
        this.renderAnalyticsSummary();
        this.renderCategories();
        this.updateCurrencySymbols();
    },

    renderSummary() {
        const balance = Transactions.getBalance();
        const income = Transactions.getTotal('income');
        const expense = Transactions.getTotal('expense');

        this.elements.totalBalance.textContent = Currency.format(balance);
        this.elements.totalIncome.textContent = Currency.format(income);
        this.elements.totalExpense.textContent = Currency.format(expense);
    },

    renderRecentTransactions() {
        const recent = state.transactions.slice(0, 5);
        if (recent.length === 0) {
            this.elements.recentTransactions.innerHTML = '<p class="empty-state">No transactions yet. Tap + to add one.</p>';
            return;
        }

        this.elements.recentTransactions.innerHTML = recent.map(t => this.createTransactionItem(t)).join('');
        this.bindTransactionActions(this.elements.recentTransactions);
    },

    renderAllTransactions() {
        const filters = {
            search: this.elements.searchInput.value,
            dateFrom: this.elements.filterDateFrom.value,
            dateTo: this.elements.filterDateTo.value
        };
        const filtered = Transactions.getFiltered(filters);

        if (filtered.length === 0) {
            this.elements.allTransactions.innerHTML = '<p class="empty-state">No transactions found.</p>';
            return;
        }

        this.elements.allTransactions.innerHTML = filtered.map(t => this.createTransactionItem(t, true)).join('');
        this.bindTransactionActions(this.elements.allTransactions);
    },

    createTransactionItem(transaction, showActions = false) {
        const actionsHtml = showActions ? `
            <div class="transaction-actions">
                <button class="action-delete" data-id="${transaction.id}" title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                </button>
            </div>
        ` : '';

        return `
            <div class="transaction-item animate-slide-up">
                <div class="transaction-left">
                    <div class="transaction-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            ${transaction.type === 'expense' 
                                ? '<path d="M12 19V5M5 12l7-7 7 7"/>'
                                : '<path d="M12 5v14M5 12l7 7 7-7"/>'}
                        </svg>
                    </div>
                    <div class="transaction-info">
                        <span class="transaction-category">${transaction.category}</span>
                        ${transaction.note ? `<span class="transaction-note">${transaction.note}</span>` : ''}
                        <span class="transaction-date">${DateUtils.formatDisplay(transaction.date)}</span>
                    </div>
                </div>
                <div class="transaction-right">
                    <span class="transaction-amount ${transaction.type}">${Currency.format(transaction.amount)}</span>
                </div>
                ${actionsHtml}
            </div>
        `;
    },

    bindTransactionActions(container) {
        container.querySelectorAll('.action-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete this transaction?')) {
                    Transactions.delete(btn.dataset.id);
                    this.render();
                    this.showToast('Transaction deleted');
                }
            });
        });
    },

    renderAnalyticsSummary() {
        this.elements.weeklySpending.textContent = Currency.format(Transactions.getWeeklySpending());
        this.elements.monthlySpending.textContent = Currency.format(Transactions.getMonthlySpending());
        
        const topCategory = Transactions.getTopCategory();
        this.elements.topCategory.textContent = topCategory || '-';
    },

    renderCharts() {
        this.renderBarChart();
        this.renderPieChart();
        this.renderLineChart();
    },

    renderBarChart() {
        const data = Transactions.getMonthlyData(6);
        
        if (state.charts.bar) {
            state.charts.bar.destroy();
        }

        state.charts.bar = new Chart(this.elements.barChart, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: 'Income',
                        data: data.income,
                        backgroundColor: '#4a4a4a',
                        borderRadius: 4
                    },
                    {
                        label: 'Expense',
                        data: data.expense,
                        backgroundColor: '#a8a8a8',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 15,
                            font: { size: 11, family: 'Inter' }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 10, family: 'Inter' } }
                    },
                    y: {
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: { font: { size: 10, family: 'Inter' } }
                    }
                }
            }
        });
    },

    renderPieChart() {
        const categoryData = Transactions.getByCategory('expense');
        const labels = Object.keys(categoryData);
        const values = Object.values(categoryData);

        if (state.charts.pie) {
            state.charts.pie.destroy();
        }

        const colors = ['#2d2d2d', '#4a4a4a', '#6b6b6b', '#8a8a8a', '#a8a8a8', '#c5c5c5', '#e0e0e0'];

        state.charts.pie = new Chart(this.elements.pieChart, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors.slice(0, labels.length),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            boxWidth: 10,
                            padding: 10,
                            font: { size: 10, family: 'Inter' }
                        }
                    }
                }
            }
        });
    },

    renderLineChart() {
        const data = Transactions.getCashFlowData(30);

        if (state.charts.line) {
            state.charts.line.destroy();
        }

        state.charts.line = new Chart(this.elements.lineChart, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Cash Flow',
                    data: data.values,
                    borderColor: '#2d2d2d',
                    backgroundColor: 'rgba(45, 45, 45, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: '#2d2d2d'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 10, family: 'Inter' } }
                    },
                    y: {
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: { font: { size: 10, family: 'Inter' } }
                    }
                }
            }
        });
    },

    renderCategories() {
        const categories = Categories.getAll(state.currentCategoryTab);
        
        if (categories.length === 0) {
            this.elements.categoryList.innerHTML = '<p class="empty-state">No categories yet.</p>';
            return;
        }

        this.elements.categoryList.innerHTML = categories.map(cat => `
            <div class="category-item">
                <span class="category-name">${cat.name}</span>
                <div class="category-actions">
                    <button class="action-edit" data-id="${cat.id}" data-name="${cat.name}" title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    ${!cat.isDefault ? `
                        <button class="action-delete" data-id="${cat.id}" title="Delete">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                            </svg>
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');

        // Bind actions
        this.elements.categoryList.querySelectorAll('.action-edit').forEach(btn => {
            btn.addEventListener('click', () => {
                this.openCategoryModal(btn.dataset.id, btn.dataset.name);
            });
        });

        this.elements.categoryList.querySelectorAll('.action-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('Delete this category?')) {
                    Categories.delete(btn.dataset.id);
                    this.renderCategories();
                    this.showToast('Category deleted');
                }
            });
        });
    },

    // Modal Methods
    openTransactionModal() {
        this.updateCategorySelect('expense');
        this.elements.transactionModal.classList.add('active');
        this.elements.amountInput.focus();
    },

    closeTransactionModal() {
        this.elements.transactionModal.classList.remove('active');
        this.elements.transactionForm.reset();
        this.setDefaultDate();
        this.setTransactionType('expense');
    },

    setTransactionType(type) {
        this.elements.typeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });
        this.updateCategorySelect(type);
    },

    updateCategorySelect(type) {
        const categories = Categories.getAll(type);
        this.elements.categorySelect.innerHTML = categories.map(cat => 
            `<option value="${cat.name}">${cat.name}</option>`
        ).join('');
    },

    handleTransactionSubmit(e) {
        e.preventDefault();
        
        const activeTypeBtn = document.querySelector('.transaction-form .type-btn.active');
        const type = activeTypeBtn.dataset.type;
        
        const transaction = {
            amount: parseFloat(this.elements.amountInput.value),
            type: type,
            category: this.elements.categorySelect.value,
            date: this.elements.dateInput.value,
            note: this.elements.noteInput.value || ''
        };

        Transactions.add(transaction);
        this.closeTransactionModal();
        this.render();
        this.showToast('Transaction added!');
    },

    openCategoryModal(id = null, name = '') {
        state.editingCategoryId = id;
        this.elements.editCategoryId.value = id || '';
        this.elements.categoryNameInput.value = name;
        this.elements.categoryModalTitle.textContent = id ? 'Edit Category' : 'Add Category';
        this.elements.categorySubmitText.textContent = id ? 'Save Changes' : 'Add Category';
        this.setCategoryType(state.currentCategoryTab);
        this.elements.categoryModal.classList.add('active');
        this.elements.categoryNameInput.focus();
    },

    closeCategoryModal() {
        this.elements.categoryModal.classList.remove('active');
        this.elements.categoryForm.reset();
        state.editingCategoryId = null;
    },

    setCategoryType(type) {
        this.elements.catTypeExpense.classList.toggle('active', type === 'expense');
        this.elements.catTypeIncome.classList.toggle('active', type === 'income');
    },

    handleCategorySubmit(e) {
        e.preventDefault();
        
        const name = this.elements.categoryNameInput.value.trim();
        const type = this.elements.catTypeExpense.classList.contains('active') ? 'expense' : 'income';
        const editId = this.elements.editCategoryId.value;

        if (!name) return;

        if (editId) {
            Categories.update(editId, name);
            this.showToast('Category updated!');
        } else {
            Categories.add(name, type);
            this.showToast('Category added!');
        }

        this.closeCategoryModal();
        this.renderCategories();
    },

    // Settings Methods
    setCurrency(currency) {
        state.settings.currency = currency;
        Storage.saveSettings(state.settings);
        
        this.elements.currencyBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.currency === currency);
        });
        
        this.updateCurrencySymbols();
        this.render();
    },

    updateCurrencySymbols() {
        this.elements.currencySymbol.textContent = Currency.getSymbol();
    },

    clearAllData() {
        if (confirm('Are you sure you want to delete all data? This cannot be undone.')) {
            Storage.clearAll();
            state.transactions = [];
            state.categories = Storage.initDefaultCategories();
            state.settings = { currency: 'INR' };
            this.render();
            this.showToast('All data cleared');
        }
    },

    // Toast
    showToast(message) {
        this.elements.toastMessage.textContent = message;
        this.elements.toast.classList.add('active');
        setTimeout(() => {
            this.elements.toast.classList.remove('active');
        }, 2000);
    }
};

// ====== EXPORT UTILITIES ======

const Export = {
    toCSV() {
        const transactions = state.transactions;
        if (transactions.length === 0) {
            UI.showToast('No data to export');
            return;
        }

        const headers = ['Date', 'Type', 'Category', 'Amount', 'Note'];
        const rows = transactions.map(t => [
            t.date,
            t.type,
            t.category,
            t.amount,
            t.note || ''
        ]);

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        this.download(csv, 'expense_tracker_export.csv', 'text/csv');
        UI.showToast('CSV exported!');
    },

    toPDF() {
        const transactions = state.transactions;
        if (transactions.length === 0) {
            UI.showToast('No data to export');
            return;
        }

        // Create a printable HTML document
        const income = Transactions.getTotal('income');
        const expense = Transactions.getTotal('expense');
        const balance = Transactions.getBalance();

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Expense Report</title>
                <style>
                    body { font-family: 'Inter', sans-serif; padding: 40px; color: #0a0a0a; }
                    h1 { font-size: 24px; margin-bottom: 10px; }
                    .date { color: #8a8a8a; font-size: 14px; margin-bottom: 30px; }
                    .summary { display: flex; gap: 40px; margin-bottom: 40px; }
                    .summary-item { text-align: center; }
                    .summary-label { font-size: 12px; color: #8a8a8a; text-transform: uppercase; }
                    .summary-value { font-size: 24px; font-weight: 700; margin-top: 5px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
                    th { font-size: 12px; text-transform: uppercase; color: #8a8a8a; }
                    .expense { color: #0a0a0a; }
                    .income { color: #4a4a4a; }
                </style>
            </head>
            <body>
                <h1>Expense Report</h1>
                <p class="date">Generated on ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>
                
                <div class="summary">
                    <div class="summary-item">
                        <div class="summary-label">Total Income</div>
                        <div class="summary-value">${Currency.format(income)}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">Total Expense</div>
                        <div class="summary-value">${Currency.format(expense)}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">Balance</div>
                        <div class="summary-value">${Currency.format(balance)}</div>
                    </div>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Category</th>
                            <th>Amount</th>
                            <th>Note</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${transactions.map(t => `
                            <tr>
                                <td>${t.date}</td>
                                <td>${t.type}</td>
                                <td>${t.category}</td>
                                <td class="${t.type}">${Currency.format(t.amount)}</td>
                                <td>${t.note || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
        UI.showToast('PDF exported!');
    },

    download(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
};

// ====== INITIALIZATION ======

document.addEventListener('DOMContentLoaded', () => {
    Storage.load();
    UI.init();
});
