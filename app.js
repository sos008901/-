const { createApp, ref, computed, onMounted, nextTick } = Vue;

createApp({
    setup() {
        // 分頁與天數狀態
        const currentTab = ref('schedule');
        const currentDayIndex = ref(0);
        const days = ref([{ items: [] }]);
        const destination = ref('');
        const startDate = ref('');
        const scrollContainer = ref(null);
        
        // GitHub 連線資訊
        const ghToken = ref(localStorage.getItem('gh_token') || '');
        const ghRepo = ref(localStorage.getItem('gh_repo') || '');
        const dataSha = ref(''); 
        const isInitialized = ref(!!(localStorage.getItem('gh_token') && localStorage.getItem('gh_repo')));
        
        // UI 控制狀態
        const isSyncing = ref(false);
        const showSettingsModal = ref(false);
        const showAddModal = ref(false);
        const toast = ref({ show: false, message: '' });

        // 新增行程暫存資料 (對應截圖欄位)
        const newItem = ref({ 
            timeHour: '09', 
            timeMinute: '00', 
            title: '', 
            address: '', 
            note: '' 
        });

        const currentDayItems = computed(() => days.value[currentDayIndex.value]?.items || []);

        const showToast = (msg) => { 
            toast.value = { show: true, message: msg }; 
            setTimeout(() => toast.value.show = false, 2500); 
        };

        // 自動捲動天數列
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
            if (!startDate.value) return { date: '-' };
            const date = new Date(startDate.value);
            date.setDate(date.getDate() + index);
            return { date: `${date.getMonth() + 1}/${date.getDate()}` };
        };

        // --- GitHub 同步功能 ---
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
                    if (content.destination) destination.value = content.destination;
                    if (content.startDate) startDate.value = content.startDate;
                    showToast("已從 GitHub 同步");
                }
            } catch (e) { console.error(e); }
            isSyncing.value = false;
        };

        const saveToGitHub = async () => {
            if (!ghToken.value || !ghRepo.value) return;
            isSyncing.value = true;
            const contentObj = { 
                days: days.value, destination: destination.value, 
                startDate: startDate.value, updatedAt: new Date().toISOString() 
            };
            const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(contentObj))));
            try {
                const res = await fetch(`https://api.github.com/repos/${ghRepo.value}/contents/data.json`, {
                    method: 'PUT',
                    headers: { 'Authorization': `token ${ghToken.value}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: "Update Journey", content: contentBase64, sha: dataSha.value })
                });
                if (res.ok) {
                    const resData = await res.json();
                    dataSha.value = resData.content.sha;
                    showToast("同步成功");
                }
            } catch (e) { showToast("同步失敗"); }
            isSyncing.value = false;
        };

        // --- 行程操作 ---
        const addItem = () => {
            if (!newItem.value.title) return;
            days.value[currentDayIndex.value].items.push({
                time: `${newItem.value.timeHour}:${newItem.value.timeMinute}`,
                title: newItem.value.title,
                address: newItem.value.address,
                note: newItem.value.note
            });
            newItem.value = { timeHour: '09', timeMinute: '00', title: '', address: '', note: '' };
            showAddModal.value = false;
            saveToGitHub();
        };

        const addNewDay = () => {
            days.value.push({ items: [] });
            currentDayIndex.value = days.value.length - 1;
            saveToGitHub();
            scrollToActive();
        };

        const moveDay = (index, dir) => {
            const newIdx = index + dir;
            if (newIdx < 0 || newIdx >= days.value.length) return;
            const arr = [...days.value];
            [arr[index], arr[newIdx]] = [arr[newIdx], arr[index]];
            days.value = arr;
            currentDayIndex.value = newIdx;
            saveToGitHub();
            scrollToActive();
        };

        const deleteDay = (index) => {
            if (days.value.length <= 1) return;
            if (confirm("確定刪除此天行程？")) {
                days.value.splice(index, 1);
                currentDayIndex.value = 0;
                saveToGitHub();
            }
        };

        onMounted(() => { if (isInitialized.value) loadFromGitHub(); });

        return {
            isInitialized, currentTab, days, currentDayIndex, currentDayItems, destination, startDate, scrollContainer,
            ghToken, ghRepo, isSyncing, showSettingsModal, showAddModal, toast,
            newItem, addItem, addNewDay, getDayInfo, selectDay, moveDay, deleteDay,
            saveSettings: async () => {
                localStorage.setItem('gh_token', ghToken.value);
                localStorage.setItem('gh_repo', ghRepo.value);
                isInitialized.value = true;
                await loadFromGitHub();
                if (!dataSha.value) saveToGitHub();
            },
            saveToGitHub,
            onFabClick: () => { showAddModal.value = true; }, // 修正：點擊 + 開啟彈窗
            logout: () => { localStorage.clear(); location.reload(); }
        };
    }
}).mount('#app');
