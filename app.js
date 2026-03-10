const { createApp, ref, computed, onMounted, nextTick } = Vue;

createApp({
    setup() {
        const currentTab = ref('schedule');
        const currentDayIndex = ref(0);
        const days = ref([{ items: [] }]);
        const expenses = ref([]); // 新增：記帳資料存放
        const destination = ref('');
        const startDate = ref('');
        const scrollContainer = ref(null);
        const loginMode = ref('quick'); 
        const members = ref(['我', '旅伴']);
        
        const ghToken = ref(localStorage.getItem('gh_token') || '');
        const ghRepo = ref(localStorage.getItem('gh_repo') || '');
        const dataSha = ref(''); 
        const isInitialized = ref(!!(ghToken.value && ghRepo.value));
        const isSyncing = ref(false);
        const showSettingsModal = ref(false);
        const showAddModal = ref(false);
        const toast = ref({ show: false, message: '' });

        const editingIndex = ref(-1); 
        const newItem = ref({ hour: '09', minute: '00', title: '', address: '', note: '' });
        
        // 新增：記帳表單綁定資料
        const newItemExpense = ref({
            title: '', amount: 0, date: new Date().toISOString().split('T')[0],
            time: '20:07', payer: '我', type: '共同'
        });

        const currentDayItems = computed(() => days.value[currentDayIndex.value]?.items || []);
        
        // 記帳計算邏輯
        const exchangeRate = 0.21;
        const totalJPY = computed(() => expenses.value.reduce((sum, e) => sum + Number(e.amount), 0));
        const totalTWD = computed(() => Math.round(totalJPY.value * exchangeRate));

        const getMemberTotal = (name) => {
            const jpy = expenses.value.filter(e => e.payer === name).reduce((sum, e) => sum + Number(e.amount), 0);
            const shared = expenses.value.filter(e => e.payer === name && e.type === '共同').reduce((sum, e) => sum + Number(e.amount), 0);
            const privateExp = expenses.value.filter(e => e.payer === name && e.type === '自費').reduce((sum, e) => sum + Number(e.amount), 0);
            return {
                jpy,
                twd: Math.round(jpy * exchangeRate),
                shared,
                private: privateExp,
                percent: totalJPY.value > 0 ? (jpy / totalJPY.value) * 100 : 0
            };
        };

        const showToast = (msg) => { toast.value = { show: true, message: msg }; setTimeout(() => toast.value.show = false, 3000); };

        const loadFromGitHub = async () => {
            if (!ghToken.value || !ghRepo.value) return false;
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
                    expenses.value = content.expenses || []; // 讀取支出
                    destination.value = content.destination || '';
                    startDate.value = content.startDate || '';
                    return true;
                }
                return false;
            } catch (e) { return false; }
            finally { isSyncing.value = false; }
        };

        const saveToGitHub = async () => {
            if (!ghToken.value || !ghRepo.value) return;
            isSyncing.value = true;
            try {
                // 每次存之前先獲取最新的 SHA 避免衝突
                const check = await fetch(`https://api.github.com/repos/${ghRepo.value.trim()}/contents/data.json?t=${Date.now()}`, {
                    headers: { 'Authorization': `token ${ghToken.value.trim()}` }
                });
                if (check.ok) { const d = await check.json(); dataSha.value = d.sha; }

                const contentObj = { 
                    days: days.value, 
                    expenses: expenses.value, 
                    destination: destination.value, 
                    startDate: startDate.value 
                };
                const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(contentObj))));
                
                const res = await fetch(`https://api.github.com/repos/${ghRepo.value.trim()}/contents/data.json`, {
                    method: 'PUT',
                    headers: { 'Authorization': `token ${ghToken.value.trim()}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: "Sync Data", content: contentBase64, sha: dataSha.value || undefined })
                });
                if (res.ok) {
                    const resData = await res.json();
                    dataSha.value = resData.content.sha;
                    showToast("同步成功");
                }
            } catch (e) { showToast("連線錯誤"); }
            finally { isSyncing.value = false; }
        };

        const addExpense = () => {
            if (!newItemExpense.value.title || !newItemExpense.value.amount) return;
            expenses.value.push({ ...newItemExpense.value });
            newItemExpense.value = { title: '', amount: 0, date: new Date().toISOString().split('T')[0], time: '20:07', payer: '我', type: '共同' };
            showAddModal.value = false;
            saveToGitHub();
        };

        const addItem = () => {
            if (!newItem.value.title) return;
            const ev = { time: `${newItem.value.hour}:${newItem.value.minute}`, title: newItem.value.title, address: newItem.value.address, note: newItem.value.note };
            if (editingIndex.value === -1) days.value[currentDayIndex.value].items.push(ev);
            else days.value[currentDayIndex.value].items[editingIndex.value] = ev;
            showAddModal.value = false;
            saveToGitHub();
        };

        const saveSettings = async () => {
            localStorage.setItem('gh_token', ghToken.value);
            localStorage.setItem('gh_repo', ghRepo.value);
            if (loginMode.value === 'quick') {
                const ok = await loadFromGitHub();
                if (ok) isInitialized.value = true;
            } else {
                isInitialized.value = true;
                await saveToGitHub();
            }
        };

        onMounted(() => { if (isInitialized.value) loadFromGitHub(); });

        return {
            isInitialized, currentTab, days, expenses, currentDayIndex, currentDayItems, destination, startDate, 
            ghToken, ghRepo, isSyncing, showSettingsModal, showAddModal, toast, newItem, newItemExpense, 
            editingIndex, loginMode, members, totalJPY, totalTWD,
            saveSettings, addItem, addExpense, getMemberTotal, saveToGitHub,
            openEditModal: (i) => { editingIndex.value = i; const it = days.value[currentDayIndex.value].items[i]; const [h, m] = it.time.split(':'); newItem.value = { hour: h, minute: m, title: it.title, address: it.address || '', note: it.note || '' }; showAddModal.value = true; },
            onFabClick: () => { editingIndex.value = -1; showAddModal.value = true; },
            addNewDay: () => { days.value.push({ items: [] }); currentDayIndex.value = days.value.length - 1; saveToGitHub(); },
            getDayInfo: (i) => { if (!startDate.value) return { date: '-' }; const d = new Date(startDate.value); d.setDate(d.getDate() + i); return { date: `${d.getMonth() + 1}/${d.getDate()}` }; },
            selectDay: (i) => { currentDayIndex.value = i; },
            deleteDay: (i) => { if (days.value.length > 1 && confirm("Delete Day?")) { days.value.splice(i, 1); currentDayIndex.value = 0; saveToGitHub(); } },
            logout: () => { localStorage.clear(); location.reload(); }
        };
    }
}).mount('#app');
