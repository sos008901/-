const { createApp, ref, computed, onMounted, nextTick } = Vue;

createApp({
    setup() {
        const currentTab = ref('schedule');
        const currentDayIndex = ref(0);
        const days = ref([{ items: [] }]);
        const expenses = ref([]);
        const memos = ref([]);
        const destination = ref('');
        const startDate = ref('');
        const scrollContainer = ref(null);
        
        const ghToken = ref(localStorage.getItem('gh_token') || '');
        const ghRepo = ref(localStorage.getItem('gh_repo') || '');
        const dataSha = ref(''); 
        const isInitialized = ref(!!(localStorage.getItem('gh_token') && localStorage.getItem('gh_repo')));
        
        const isSyncing = ref(false);
        const showSettingsModal = ref(false);
        const showAddModal = ref(false);
        const showMoneyModal = ref(false);
        const showMemoModal = ref(false);
        const toast = ref({ show: false, message: '' });

        const newItem = ref({ time: '', title: '' });
        const newExpense = ref({ item: '', amount: '' });
        const newMemo = ref({ content: '' });

        const currentDayItems = computed(() => days.value[currentDayIndex.value]?.items || []);

        // --- 自動捲動核心 ---
        const scrollToActive = () => {
            nextTick(() => {
                const container = scrollContainer.value;
                const activeCard = document.getElementById(`day-card-${currentDayIndex.value}`);
                if (container && activeCard) {
                    const scrollLeft = activeCard.offsetLeft - (container.offsetWidth / 2) + (activeCard.offsetWidth / 2);
                    container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
                }
            });
        };

        const selectDay = (index) => {
            currentDayIndex.value = index;
            scrollToActive();
        };

        const getDayInfo = (index) => {
            if (!startDate.value) return { date: '-', week: '' };
            const date = new Date(startDate.value);
            date.setDate(date.getDate() + index);
            const mm = date.getMonth() + 1;
            const dd = date.getDate();
            const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
            return { date: `${mm}/${dd}`, week: `週${weekDays[date.getDay()]}` };
        };

        const showToast = (msg) => { 
            toast.value = { show: true, message: msg }; 
            setTimeout(() => toast.value.show = false, 2500); 
        };

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
                days: days.value, expenses: expenses.value, memos: memos.value,
                destination: destination.value, startDate: startDate.value,
                updatedAt: new Date().toISOString() 
            };
            const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(contentObj))));
            try {
                const res = await fetch(`https://api.github.com/repos/${ghRepo.value}/contents/data.json`, {
                    method: 'PUT',
                    headers: { 'Authorization': `token ${ghToken.value}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: "Sync", content: contentBase64, sha: dataSha.value })
                });
                if (res.ok) {
                    const resData = await res.json();
                    dataSha.value = resData.content.sha;
                    showToast("同步成功");
                }
            } catch (e) { showToast("同步失敗"); }
            isSyncing.value = false;
        };

        const moveDay = (index, direction) => {
            const newIndex = index + direction;
            if (newIndex < 0 || newIndex >= days.value.length) return;
            const newDays = [...days.value];
            [newDays[index], newDays[newIndex]] = [newDays[newIndex], newDays[index]];
            days.value = newDays;
            currentDayIndex.value = newIndex;
            saveToGitHub();
            scrollToActive();
        };

        const deleteDay = (index) => {
            if (days.value.length <= 1) return showToast("至少需保留一天");
            if (confirm(`確定要刪除 Day ${index + 1} 嗎？`)) {
                days.value.splice(index, 1);
                currentDayIndex.value = Math.min(currentDayIndex.value, days.value.length - 1);
                saveToGitHub();
                scrollToActive();
            }
        };

        const addNewDay = () => {
            days.value.push({ items: [] });
            currentDayIndex.value = days.value.length - 1;
            saveToGitHub();
            scrollToActive();
        };

        const addItem = () => {
            if (!newItem.value.title) return;
            days.value[currentDayIndex.value].items.push({ ...newItem.value });
            newItem.value = { time: '', title: '' };
            showAddModal.value = false;
            saveToGitHub();
        };

        const addExpense = () => {
            if (!newExpense.value.item || !newExpense.value.amount) return;
            expenses.value.push({ ...newExpense.value, id: Date.now() });
            newExpense.value = { item: '', amount: '' };
            showMoneyModal.value = false;
            saveToGitHub();
        };

        const addMemo = () => {
            if (!newMemo.value.content) return;
            memos.value.push({ content: newMemo.value.content, id: Date.now() });
            newMemo.value = { content: '' };
            showMemoModal.value = false;
            saveToGitHub();
        };

        onMounted(() => { 
            if (isInitialized.value) loadFromGitHub(); 
        });

        return {
            isInitialized, currentTab, days, currentDayIndex, currentDayItems, 
            expenses, memos, destination, startDate, scrollContainer,
            ghToken, ghRepo, isSyncing, 
            showSettingsModal, showAddModal, showMoneyModal, showMemoModal, toast,
            newItem, newExpense, newMemo,
            addItem, addExpense, addMemo, addNewDay, getDayInfo, moveDay, deleteDay, selectDay,
            saveSettings: async () => {
                localStorage.setItem('gh_token', ghToken.value);
                localStorage.setItem('gh_repo', ghRepo.value);
                isInitialized.value = true;
                await loadFromGitHub();
                if (!dataSha.value) saveToGitHub();
            },
            saveToGitHub,
            onFabClick: () => {
                if (currentTab.value === 'schedule') showAddModal.value = true;
                else if (currentTab.value === 'money') showMoneyModal.value = true;
                else if (currentTab.value === 'memo') showMemoModal.value = true;
            },
            logout: () => { localStorage.clear(); location.reload(); }
        };
    }
}).mount('#app');
