const { createApp, ref, computed, onMounted } = Vue;

createApp({
    setup() {
        const currentTab = ref('money');
        const currentDayIndex = ref(0);
        const days = ref([{ items: [] }]);
        const expenses = ref([]);
        const destination = ref('');
        const startDate = ref('');
        const members = ref(['我', '旅伴']);
        
        const ghToken = ref(localStorage.getItem('gh_token') || '');
        const ghRepo = ref(localStorage.getItem('gh_repo') || '');
        const dataSha = ref(''); 
        const isInitialized = ref(!!(ghToken.value && ghRepo.value));
        const isSyncing = ref(false);
        const showAddModal = ref(false);

        const newItemExpense = ref({ title: '', amount: 0, date: '', time: '', payer: '我', type: '共同' });

        // 計算總額 (JPY/TWD)
        const totalJPY = computed(() => expenses.value.reduce((sum, e) => sum + Number(e.amount), 0));
        const totalTWD = computed(() => Math.round(totalJPY.value * 0.21));

        // 成員支出計算
        const getMemberTotal = (name) => {
            const total = expenses.value.filter(e => e.payer === name).reduce((sum, e) => sum + Number(e.amount), 0);
            const shared = expenses.value.filter(e => e.payer === name && e.type === '共同').reduce((sum, e) => sum + Number(e.amount), 0);
            const privateExp = expenses.value.filter(e => e.payer === name && (e.type === '自費' || e.type === '代墊')).reduce((sum, e) => sum + Number(e.amount), 0);
            return {
                total, shared, private: privateExp,
                sharedPercent: total > 0 ? (shared / total) * 100 : 0,
                privatePercent: total > 0 ? (privateExp / total) * 100 : 0
            };
        };

        // 自動結算邏輯
        const settlement = computed(() => {
            let balance = 0; // 正代表旅伴欠我
            expenses.value.forEach(exp => {
                const amt = Number(exp.amount);
                if (exp.payer === '我') {
                    if (exp.type === '共同') balance += amt / 2;
                    if (exp.type === '代墊') balance += amt;
                } else {
                    if (exp.type === '共同') balance -= amt / 2;
                    if (exp.type === '代墊') balance -= amt;
                }
            });
            return {
                amount: Math.round(Math.abs(balance)),
                from: balance > 0 ? '旅伴' : '我',
                to: balance > 0 ? '我' : '旅伴'
            };
        });

        // 明細分組 (按日期)
        const groupedExpenses = computed(() => {
            const groups = {};
            expenses.value.forEach(exp => {
                if (!groups[exp.date]) groups[exp.date] = { items: [], total: 0 };
                groups[exp.date].items.push(exp);
                groups[exp.date].total += Number(exp.amount);
            });
            return groups;
        });

        const formatDisplayDate = (dateStr) => {
            const date = new Date(dateStr);
            const weeks = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
            return `${date.getMonth() + 1}月${date.getDate()}日 ${weeks[date.getDay()]}`;
        };

        const onFabClick = () => {
            const now = new Date();
            newItemExpense.value = { title: '', amount: 0, date: now.toISOString().split('T')[0], 
                time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), payer: '我', type: '共同' };
            showAddModal.value = true;
        };

        const addExpense = () => {
            if (!newItemExpense.value.title || newItemExpense.value.amount <= 0) return;
            expenses.value.push({ ...newItemExpense.value });
            showAddModal.value = false;
            saveToGitHub();
        };

        // GitHub 同步功能維持原樣
        const loadFromGitHub = async () => {
            if (!ghToken.value || !ghRepo.value) return;
            isSyncing.value = true;
            try {
                const res = await fetch(`https://api.github.com/repos/${ghRepo.value.trim()}/contents/data.json?t=${Date.now()}`, {
                    headers: { 'Authorization': `token ${ghToken.value.trim()}` }
                });
                if (res.ok) {
                    const data = await res.json(); dataSha.value = data.sha;
                    const content = JSON.parse(decodeURIComponent(escape(atob(data.content))));
                    days.value = content.days || [{ items: [] }];
                    expenses.value = content.expenses || [];
                    destination.value = content.destination || '';
                    startDate.value = content.startDate || '';
                }
            } finally { isSyncing.value = false; }
        };

        const saveToGitHub = async () => {
            isSyncing.value = true;
            const contentObj = { days: days.value, expenses: expenses.value, destination: destination.value, startDate: startDate.value };
            const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(contentObj))));
            try {
                const res = await fetch(`https://api.github.com/repos/${ghRepo.value.trim()}/contents/data.json`, {
                    method: 'PUT',
                    headers: { 'Authorization': `token ${ghToken.value.trim()}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: "Update Budget", content: contentBase64, sha: dataSha.value })
                });
                if (res.ok) { const d = await res.json(); dataSha.value = d.content.sha; }
            } finally { isSyncing.value = false; }
        };

        const saveSettings = () => {
            localStorage.setItem('gh_token', ghToken.value);
            localStorage.setItem('gh_repo', ghRepo.value);
            isInitialized.value = true;
            loadFromGitHub();
        };

        onMounted(() => { if (isInitialized.value) loadFromGitHub(); });

        return {
            isInitialized, currentTab, days, expenses, currentDayIndex, destination, startDate, members,
            ghToken, ghRepo, isSyncing, showAddModal, newItemExpense,
            totalJPY, totalTWD, settlement, groupedExpenses, 
            onFabClick, addExpense, getMemberTotal, formatDisplayDate, saveSettings,
            selectDay: (i) => currentDayIndex.value = i,
            getDayInfo: (i) => { if (!startDate.value) return { date: '-' }; const d = new Date(startDate.value); d.setDate(d.getDate() + i); return { date: `${d.getMonth() + 1}/${d.getDate()}` }; }
        };
    }
}).mount('#app');
