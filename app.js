const { createApp, ref, computed, onMounted } = Vue;

createApp({
    setup() {
        const currentTab = ref('schedule');
        const currentDayIndex = ref(0);
        const days = ref([{ items: [] }]);
        const destination = ref('');
        
        const ghToken = ref(localStorage.getItem('gh_token') || '');
        const ghRepo = ref(localStorage.getItem('gh_repo') || '');
        const dataSha = ref(''); 
        
        // 【新增：控制是否進入主介面的狀態】
        const isInitialized = ref(!!(ghToken.value && ghRepo.value));
        
        const isSyncing = ref(false);
        const showSettingsModal = ref(false);
        const showAddModal = ref(false);
        const toast = ref({ show: false, message: '' });
        const newItem = ref({ time: '', title: '' });

        const currentDayItems = computed(() => days.value[currentDayIndex.value]?.items || []);
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
                    days.value = content.days || [{ items: [] }];
                    destination.value = content.destination || '';
                    showToast("同步成功");
                }
            } catch (e) { console.error(e); }
            isSyncing.value = false;
        };

        const saveToGitHub = async () => {
            if (!ghToken.value || !ghRepo.value) return;
            isSyncing.value = true;
            const contentObj = { days: days.value, destination: destination.value, updatedAt: new Date().toISOString() };
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
                    showToast("雲端已更新");
                    showSettingsModal.value = false;
                }
            } catch (e) { showToast("同步失敗"); }
            isSyncing.value = false;
        };

        const saveSettings = () => {
            if (!ghToken.value || !ghRepo.value) {
                showToast("請完整填寫資訊");
                return;
            }
            localStorage.setItem('gh_token', ghToken.value);
            localStorage.setItem('gh_repo', ghRepo.value);
            
            // 只有按下按鈕執行 saveSettings 後，才把這個狀態設為 true
            isInitialized.value = true; 
            
            loadFromGitHub().then(() => {
                if (!dataSha.value) saveToGitHub();
            });
        };

        const clearJourney = () => {
            if (confirm("確定要刪除行程嗎？")) {
                days.value = [{ items: [] }];
                destination.value = "";
                saveToGitHub();
                showSettingsModal.value = false;
            }
        };

        const logout = () => {
            if (confirm("確定要登出並清除連線資訊嗎？")) {
                localStorage.clear();
                ghToken.value = '';
                ghRepo.value = '';
                isInitialized.value = false; // 回到登入畫面
                showSettingsModal.value = false;
            }
        };

        const addItem = () => {
            if (!newItem.value.title) return;
            days.value[currentDayIndex.value].items.push({ ...newItem.value });
            newItem.value = { time: '', title: '' };
            showAddModal.value = false;
            saveToGitHub();
        };

        onMounted(loadFromGitHub);

        return {
            isInitialized, currentTab, days, currentDayItems, destination,
            ghToken, ghRepo, isSyncing, showSettingsModal, showAddModal, toast,
            newItem, addItem, saveSettings, saveToGitHub, clearJourney, logout,
            onFabClick: () => showAddModal.value = true
        };
    }
}).mount('#app');
