const { createApp, ref, computed, onMounted } = Vue;

createApp({
    setup() {
        const currentTab = ref('schedule');
        const currentDayIndex = ref(0);
        const days = ref([{ items: [] }]);
        const expenses = ref([]);
        const destination = ref('');
        const startDate = ref('');
        
        const ghToken = ref(localStorage.getItem('gh_token') || '');
        const ghRepo = ref(localStorage.getItem('gh_repo') || '');
        const dataSha = ref(''); 
        const isInitialized = ref(!!(ghToken.value && ghRepo.value));
        const isSyncing = ref(false);
        const showAddModal = ref(false);
        const showSettingsModal = ref(false);
        const toast = ref({ show: false, message: '' });

        const members = ref(['我', '旅伴']);
        const newItem = ref({ hour: '09', minute: '00', title: '' });
        const newItemExpense = ref({ title: '', amount: 0, date: '', time: '', payer: '我', type: '共同' });

        const currentDayItems = computed(() => days.value[currentDayIndex.value]?.items || []);
        
        // 1. 總額與匯率計算 (假設 1 JPY = 0.21 TWD)
        const totalJPY = computed(() => expenses.value.reduce((sum, e) => sum + Number(e.amount), 0));
        const totalTWD = computed(() => Math.round(totalJPY.value * 0.21));

        // 2. 自動結算邏輯 (誰該給誰多少)
        const settlement = computed(() => {
            let balance = 0; // 正數: 旅伴欠我, 負數: 我欠旅伴
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
            if (Math.abs(balance) < 1) return { amount: 0 };
            return { amount: Math.round(Math.abs(balance)), from: balance > 0 ? '旅伴' : '我', to: balance > 0 ? '我' : '旅伴' };
        });

        // 3. 按日期分組明細
        const groupedExpenses = computed(() => {
            const groups = {};
            [...expenses.value].sort((a,b) => new Date(`${b.date} ${b.time}`) - new Date(`${a.date} ${a.time}`))
                .forEach(exp => {
                    if (!groups[exp.date]) groups[exp.date] = [];
                    groups[exp.date].push(exp);
                });
            return groups;
        });

        const getMemberTotal = (name) => {
            const jpy = expenses.value.filter(e => e.payer === name).reduce((sum, e) => sum + Number(e.amount), 0);
            return { jpy, percent: totalJPY.value > 0 ? (jpy / totalJPY.value) * 100 : 0 };
        };

        const onFabClick = () => {
            if (currentTab.value === 'money') {
                const now = new Date();
                newItemExpense.value = { title: '', amount: 0, date: now.toISOString().split('T')[0], 
                    time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), payer: '我', type: '共同' };
            } else { newItem.value = { hour: '09', minute: '00', title: '' }; }
            showAddModal.value = true;
        };

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
                    days.value = content.days || [{ items: [] }]; expenses.value = content.expenses || [];
                    destination.value = content.destination || ''; startDate.value = content.startDate || '';
                }
            } finally { isSyncing.value = false; }
        };

        const saveToGitHub = async () => {
            isSyncing.value = true;
            const contentObj = { days: days.value, expenses: expenses.value, destination: destination.value, startDate: startDate.value };
            const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(contentObj))));
            try {
                const check = await fetch(`https://api.github.com/repos/${ghRepo.value.trim()}/contents/data.json?t=${Date.now()}`, {
                    headers: { 'Authorization': `token ${ghToken.value.trim()}` }
                });
                if (check.ok) { const d = await check.json(); dataSha.value = d.sha; }
                const res = await fetch(`https://api.github.com/repos/${ghRepo.value.trim()}/contents/data.json`, {
                    method: 'PUT', headers: { 'Authorization': `token ${ghToken.value.trim()}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: "Sync", content: contentBase64, sha: dataSha.value })
                });
                if (res.ok) { const d = await res.json(); dataSha.value = d.content.sha; showToast("SAVED"); }
            } finally { isSyncing.value = false; }
        };

        const addExpense = () => { expenses.value.push({ ...newItemExpense.value }); showAddModal.value = false; saveToGitHub(); };
        const addItem = () => { days.value[currentDayIndex.value].items.push({ time: `${newItem.value.hour}:${newItem.value.minute}`, title: newItem.value.title }); showAddModal.value = false; saveToGitHub(); };
        const showToast = (m) => { toast.value = { show: true, message: m }; setTimeout(() => toast.value.show = false, 2000); };
        const saveSettings = () => { localStorage.setItem('gh_token', ghToken.value); localStorage.setItem('gh_repo', ghRepo.value); isInitialized.value = true; loadFromGitHub(); };

        onMounted(() => { if (isInitialized.value) loadFromGitHub(); });

        return {
            isInitialized, currentTab, days, expenses, currentDayIndex, currentDayItems, destination, startDate, 
            ghToken, ghRepo, isSyncing, showAddModal, showSettingsModal, toast, newItem, newItemExpense, members, totalJPY, totalTWD,
            settlement, groupedExpenses, onFabClick, saveSettings, addItem, addExpense, getMemberTotal, saveToGitHub, 
            selectDay: (i) => currentDayIndex.value = i, addNewDay: () => { days.value.push({ items: [] }); saveToGitHub(); },
            getDayInfo: (i) => { if (!startDate.value) return { date: '-' }; const d = new Date(startDate.value); d.setDate(d.getDate() + i); return { date: `${d.getMonth() + 1}/${d.getDate()}` }; },
            logout: () => { localStorage.clear(); location.reload(); }
        };
    }
}).mount('#app');
