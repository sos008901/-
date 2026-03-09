const { createApp, ref, computed, onMounted } = Vue;

createApp({
    setup() {
        const currentTab = ref('schedule');
        const currentDayIndex = ref(0);
        const days = ref([{ items: [] }]);
        const expenses = ref([]); // 記帳資料
        const memos = ref([]);    // 備忘錄資料
        const destination = ref('');
        const startDate = ref(''); 
        
        const ghToken = ref(localStorage.getItem('gh_token') || '');
        const ghRepo = ref(localStorage.getItem('gh_repo') || '');
        const dataSha = ref(''); 
        const isInitialized = ref(!!(localStorage.getItem('gh_token') && localStorage.getItem('gh_repo')));
        
        const isSyncing = ref(false);
        const showSettingsModal = ref(false);
        const showAddModal = ref(false); // 行程彈窗
        const showMoneyModal = ref(false); // 記帳彈窗
        const showMemoModal = ref(false); // 備忘彈窗
        const toast = ref({ show: false, message: '' });

        // 暫存新資料
        const newItem = ref({ time: '', title: '' });
        const newExpense = ref({ item: '', amount: '' });
        const newMemo = ref({ content: '' });

        const currentDayItems = computed(() => days.value[currentDayIndex.value]?.items || []);

        // --- 工具：計算星期與日期 ---
        const getDayInfo = (index) => {
            if (!startDate.value) return { date: `Day ${index + 1}`, week: '' };
            const date = new Date(startDate.value);
            date.setDate(date.getDate() + index);
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
            const week = weekDays[date.getDay()];
            return { date: `${month}/${day}`, week: `週${week}` };
        };

        const showToast = (msg) => { 
            toast.value = { show: true, message: msg }; 
            setTimeout(() => toast.value.show = false, 2500); 
        };

        // --- GitHub 同步邏輯 ---
        const loadFromGitHub = async () => {
            if (!ghToken.value || !ghRepo.value) return;
            isSyncing.value = true;
            try {
                const res = await fetch(`https://api.github.com/repos/${ghRepo.value}/contents/data.json`, {
                    headers: { 'Authorization': `token ${ghToken.value}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    dataSha.value = data.sha;
                    const content = JSON.parse(decodeURIComponent(escape(atob(data.content))));
                    if (content.days) days.value = content.days;
                    if (content.expenses) expenses.value = content.expenses;
                    if (content.memos) memos.value = content.memos;
                    if (content.destination) destination.value = content.destination;
                    if (content.startDate) startDate.value = content.startDate;
                }
            } catch (e) { console.error(e); }
            isSyncing.value = false;
        };

        const saveToGitHub = async () => {
            if (!ghToken.value || !ghRepo.value) return;
            isSyncing.value = true;
            const contentObj = { 
                days: days.value, 
                expenses: expenses.value,
                memos: memos.value,
                destination: destination.value, 
                startDate: startDate.value,
                updatedAt: new Date().toISOString() 
            };
            const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(contentObj))));
            try {
                const res = await fetch(`https://api.github.com/repos/${ghRepo.value}/contents/data.json`, {
                    method: 'PUT',
                    headers: { 'Authorization': `token ${ghToken.value}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: "Update Data", content: contentBase64, sha: dataSha.value })
                });
                if (res.ok) {
                    const resData = await res.json();
                    dataSha.value = resData.content.sha;
                    showToast("同步成功");
                }
            } catch (e) { showToast("連線失敗"); }
            isSyncing.value = false;
        };

        const saveSettings = async () => {
            localStorage.setItem('gh_token', ghToken.value);
            localStorage.setItem('gh_repo', ghRepo.value);
            isInitialized.value = true;
            await loadFromGitHub();
            if (!dataSha.value) saveToGitHub();
        };

        // --- 各分頁新增功能 ---
        const addItem = () => { // 新增行程
            if (!newItem.value.title) return;
            days.value[currentDayIndex.value].items.push({ ...newItem.value });
            newItem.value = { time: '', title: '' };
            showAddModal.value = false;
            saveToGitHub();
        };

        const addExpense = () => { // 新增記帳
            if (!newExpense.value.item || !newExpense.value.amount) return;
            expenses.value.push({ ...newExpense.value, id: Date.now() });
            newExpense.value = { item: '', amount: '' };
            showMoneyModal.value = false;
            saveToGitHub();
        };

        const addMemo = () => { // 新增備忘
            if (!newMemo.value.content) return;
            memos.value.push({ content: newMemo.value.content, id: Date.now() });
            newMemo.value = { content: '' };
            showMemoModal.value = false;
            saveToGitHub();
        };

        const addNewDay = () => {
            days.value.push({ items: [] });
            currentDayIndex.value = days.value.length - 1;
            saveToGitHub();
        };

        onMounted(() => { if (isInitialized.value) loadFromGitHub(); });

        return {
            isInitialized, currentTab, days, currentDayIndex, currentDayItems, 
            expenses, memos, destination, startDate,
            ghToken, ghRepo, isSyncing, 
            showSettingsModal, showAddModal, showMoneyModal, showMemoModal, toast,
            newItem, newExpense, newMemo,
            addItem, addExpense, addMemo, addNewDay, getDayInfo,
            saveSettings, saveToGitHub,
            onFabClick: () => {
                if (currentTab.value === 'schedule') showAddModal.value = true;
                else if (currentTab.value === 'money') showMoneyModal.value = true;
                else if (currentTab.value === 'memo') showMemoModal.value = true;
            },
            logout: () => { localStorage.clear(); location.reload(); }
        };
    }
}).mount('#app');
