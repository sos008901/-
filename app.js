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
        const toast = ref({ show: false, message: '' });

        const members = ref(['我', '旅伴']);
        const newItem = ref({ hour: '09', minute: '00', title: '', address: '', note: '' });
        const newItemExpense = ref({ title: '', amount: 0, date: '', time: '', payer: '我', type: '共同' });

        const currentDayItems = computed(() => days.value[currentDayIndex.value]?.items || []);
        
        // 記帳計算
        const totalJPY = computed(() => expenses.value.reduce((sum, e) => sum + Number(e.amount), 0));
        const totalTWD = computed(() => Math.round(totalJPY.value * 0.21));

        const getMemberTotal = (name) => {
            const jpy = expenses.value.filter(e => e.payer === name).reduce((sum, e) => sum + Number(e.amount), 0);
            const shared = expenses.value.filter(e => e.payer === name && e.type === '共同').reduce((sum, e) => sum + Number(e.amount), 0);
            const privateExp = expenses.value.filter(e => e.payer === name && e.type === '自費').reduce((sum, e) => sum + Number(e.amount), 0);
            return {
                jpy,
                twd: Math.round(jpy * 0.21),
                shared,
                private: privateExp,
                percent: totalJPY.value > 0 ? (jpy / totalJPY.value) * 100 : 0
            };
        };

        const onFabClick = () => {
            if (currentTab.value === 'money') {
                // 初始化記帳表單
                newItemExpense.value = {
                    title: '',
                    amount: 0,
                    date: new Date().toISOString().split('T')[0],
                    time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                    payer: '我',
                    type: '共同'
                };
            } else {
                // 初始化行程表單
                newItem.value = { hour: '09', minute: '00', title: '', address: '', note: '' };
            }
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
                    const data = await res.json();
                    dataSha.value = data.sha;
                    const content = JSON.parse(decodeURIComponent(escape(atob(data.content))));
                    days.value = content.days || [{ items: [] }];
                    expenses.value = content.expenses || [];
                    destination.value = content.destination || '';
                    startDate.value = content.startDate || '';
                }
            } finally { isSyncing.value = false; }
        };

        const saveToGitHub = async () => {
            const contentObj = { days: days.value, expenses: expenses.value, destination: destination.value, startDate: startDate.value };
            const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(contentObj))));
            isSyncing.value = true;
            try {
                const res = await fetch(`https://api.github.com/repos/${ghRepo.value.trim()}/contents/data.json`, {
                    method: 'PUT',
                    headers: { 'Authorization': `token ${ghToken.value.trim()}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: "Update", content: contentBase64, sha: dataSha.value })
                });
                if (res.ok) {
                    const d = await res.json();
                    dataSha.value = d.content.sha;
                    toast.value = { show: true, message: "SYNCED SUCCESS" };
                    setTimeout(() => toast.value.show = false, 2000);
                }
            } finally { isSyncing.value = false; }
        };

        const addExpense = () => {
            expenses.value.push({ ...newItemExpense.value });
            showAddModal.value = false;
            saveToGitHub();
        };

        const addItem = () => {
            days.value[currentDayIndex.value].items.push({ time: `${newItem.value.hour}:${newItem.value.minute}`, title: newItem.value.title });
            showAddModal.value = false;
            saveToGitHub();
        };

        const saveSettings = () => {
            localStorage.setItem('gh_token', ghToken.value);
            localStorage.setItem('gh_repo', ghRepo.value);
            isInitialized.value = true;
            loadFromGitHub();
        };

        onMounted(() => { if (isInitialized.value) loadFromGitHub(); });

        return {
            isInitialized, currentTab, days, expenses, currentDayIndex, currentDayItems, destination, startDate, 
            ghToken, ghRepo, isSyncing, showAddModal, toast, newItem, newItemExpense, members, totalJPY, totalTWD,
            onFabClick, saveSettings, addItem, addExpense, getMemberTotal, selectDay: (i) => currentDayIndex.value = i,
            addNewDay: () => { days.value.push({ items: [] }); saveToGitHub(); },
            getDayInfo: (i) => { if (!startDate.value) return { date: '-' }; const d = new Date(startDate.value); d.setDate(d.getDate() + i); return { date: `${d.getMonth() + 1}/${d.getDate()}` }; }
        };
    }
}).mount('#app');
