const { createApp, ref, computed, onMounted } = Vue;

createApp({
    setup() {
        const currentTab = ref('money');
        const currentDayIndex = ref(0);
        const days = ref([{ items: [] }]);
        const expenses = ref([]);
        const members = ref(['我', '旅伴']);
        const destination = ref('');
        const startDate = ref('');
        
        const ghToken = ref(localStorage.getItem('gh_token') || '');
        const ghRepo = ref(localStorage.getItem('gh_repo') || '');
        const dataSha = ref(''); 
        const isInitialized = ref(!!(ghToken.value && ghRepo.value));
        const isSyncing = ref(false);
        const showAddModal = ref(false);
        const showSettingsModal = ref(false);
        const showTravelerModal = ref(false);
        const toast = ref({ show: false, message: '' });

        const tempMembers = ref([]);
        const newItem = ref({ hour: '09', minute: '00', title: '' });
        const newItemExpense = ref({ title: '', amount: 0, date: '', time: '', payer: '我', type: '共同' });

        const totalJPY = computed(() => expenses.value.reduce((sum, e) => sum + Number(e.amount), 0));
        const totalTWD = computed(() => Math.round(totalJPY.value * 0.21));

        const getMemberTotal = (name) => {
            const total = expenses.value.filter(e => e.payer === name).reduce((sum, e) => sum + Number(e.amount), 0);
            const shared = expenses.value.filter(e => e.payer === name && e.type === '共同').reduce((sum, e) => sum + Number(e.amount), 0);
            const priv = total - shared;
            return { total, shared, private: priv, sharedPercent: total > 0 ? (shared/total)*100 : 0, privatePercent: total > 0 ? (priv/total)*100 : 0 };
        };

        const settlement = computed(() => {
            let bal = 0; // 旅伴欠我為正
            expenses.value.forEach(e => {
                const a = Number(e.amount);
                if (e.payer === '我') { if(e.type === '共同') bal += a/2; if(e.type === '代墊') bal += a; }
                else { if(e.type === '共同') bal -= a/2; if(e.type === '代墊') bal -= a; }
            });
            return { amount: Math.round(Math.abs(bal)), from: bal > 0 ? '旅伴' : '我', to: bal > 0 ? '我' : '旅伴' };
        });

        const groupedExpenses = computed(() => {
            const g = {};
            expenses.value.forEach(e => { if(!g[e.date]) g[e.date] = { items: [], total: 0 }; g[e.date].items.push(e); g[e.date].total += Number(e.amount); });
            return g;
        });

        const openTravelerModal = () => { tempMembers.value = [...members.value]; showTravelerModal.value = true; };
        const addTraveler = () => tempMembers.value.push('');
        const removeTraveler = (i) => tempMembers.value.splice(i, 1);
        const saveTravelers = () => { members.value = tempMembers.value.filter(n => n.trim() !== ''); showTravelerModal.value = false; saveToGitHub(); };

        const onFabClick = () => {
            const n = new Date();
            if (currentTab.value === 'money') { newItemExpense.value = { title: '', amount: 0, date: n.toISOString().split('T')[0], time: n.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), payer: '我', type: '共同' }; }
            else { newItem.value = { hour: '09', minute: '00', title: '' }; }
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
                    const d = await res.json(); dataSha.value = d.sha;
                    const c = JSON.parse(decodeURIComponent(escape(atob(d.content))));
                    days.value = c.days || [{ items: [] }]; expenses.value = c.expenses || [];
                    members.value = c.members || ['我', '旅伴']; destination.value = c.destination || ''; startDate.value = c.startDate || '';
                }
            } finally { isSyncing.value = false; }
        };

        const saveToGitHub = async () => {
            isSyncing.value = true;
            const c = btoa(unescape(encodeURIComponent(JSON.stringify({ days: days.value, expenses: expenses.value, members: members.value, destination: destination.value, startDate: startDate.value }))));
            try {
                const check = await fetch(`https://api.github.com/repos/${ghRepo.value.trim()}/contents/data.json?t=${Date.now()}`, { headers: { 'Authorization': `token ${ghToken.value.trim()}` } });
                if (check.ok) { const d = await check.json(); dataSha.value = d.sha; }
                const res = await fetch(`https://api.github.com/repos/${ghRepo.value.trim()}/contents/data.json`, {
                    method: 'PUT', headers: { 'Authorization': `token ${ghToken.value.trim()}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: "Sync", content: c, sha: dataSha.value })
                });
                if (res.ok) { const d = await res.json(); dataSha.value = d.content.sha; }
            } finally { isSyncing.value = false; }
        };

        onMounted(() => { if (isInitialized.value) loadFromGitHub(); });

        return {
            isInitialized, currentTab, days, expenses, members, currentDayIndex, destination, startDate,
            ghToken, ghRepo, isSyncing, showAddModal, showSettingsModal, showTravelerModal, toast, 
            newItem, newItemExpense, tempMembers, totalJPY, totalTWD, settlement, groupedExpenses,
            onFabClick, openTravelerModal, addTraveler, removeTraveler, saveTravelers,
            addExpense: () => { expenses.value.push({ ...newItemExpense.value }); showAddModal.value = false; saveToGitHub(); },
            addItem: () => { days.value[currentDayIndex.value].items.push({ time: `${newItem.value.hour}:${newItem.value.minute}`, title: newItem.value.title }); showAddModal.value = false; saveToGitHub(); },
            saveSettings: () => { localStorage.setItem('gh_token', ghToken.value); localStorage.setItem('gh_repo', ghRepo.value); isInitialized.value = true; loadFromGitHub(); },
            selectDay: (i) => currentDayIndex.value = i,
            addNewDay: () => { days.value.push({ items: [] }); saveToGitHub(); },
            getDayInfo: (i) => { if (!startDate.value) return { date: '-' }; const d = new Date(startDate.value); d.setDate(d.getDate() + i); return { date: `${d.getMonth() + 1}/${d.getDate()}` }; },
            logout: () => { localStorage.clear(); location.reload(); }
        };
    }
}).mount('#app');
