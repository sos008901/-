const { createApp, ref, computed, onMounted } = Vue;

createApp({
    setup() {
        const currentTab = ref('schedule');
        const currentDayIndex = ref(0);
        const days = ref([{ items: [] }]);
        const destination = ref('');
        const startDate = ref(''); // 【旅程起始日期】
        
        const ghToken = ref(localStorage.getItem('gh_token') || '');
        const ghRepo = ref(localStorage.getItem('gh_repo') || '');
        const dataSha = ref(''); 
        
        // 判斷是否已經有存檔過的連線資訊
        const isInitialized = ref(!!(localStorage.getItem('gh_token') && localStorage.getItem('gh_repo')));
        
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

        // --- 核心同步：讀取 ---
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
                    startDate.value = content.startDate || ''; // 讀取日期
                    showToast("同步成功");
                }
            } catch (e) { console.error(e); }
            isSyncing.value = false;
        };

        // --- 核心同步：存檔 ---
        const saveToGitHub = async () => {
            if (!ghToken.value || !ghRepo.value) return;
            isSyncing.value = true;
            const contentObj = { 
                days: days.value, 
                destination: destination.value, 
                startDate: startDate.value, // 儲存日期
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
                    showToast("雲端同步完成");
                    showSettingsModal.value = false;
                }
            } catch (e) { showToast("同步失敗"); }
            isSyncing.value = false;
        };

        // --- 儲存設定並進入旅程 ---
        const saveSettings = () => {
            if (!ghToken.value || !ghRepo.value) {
                showToast("請填寫 GitHub 連線資訊");
                return;
            }
            // 立即存入 localStorage
            localStorage.setItem('gh_token', ghToken.value);
            localStorage.setItem('gh_repo', ghRepo.value);
            
            // 強制切換介面
            isInitialized.value = true; 
            
            // 非同步執行背景同步
            loadFromGitHub().then(() => {
                if (!dataSha.value) saveToGitHub(); // 若無檔案則建立新旅程
            });
        };

        const logout = () => {
            if (confirm("確定要登出帳號嗎？")) {
                localStorage.clear();
                ghToken.value = '';
                ghRepo.value = '';
                isInitialized.value = false;
                showSettingsModal.value = false;
            }
        };

        const clearJourney = () => {
            if (confirm("確定要刪除行程嗎？")) {
                days.value = [{ items: [] }];
                saveToGitHub();
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
            isInitialized, currentTab, days, currentDayItems, destination, startDate,
            ghToken, ghRepo, isSyncing, showSettingsModal, showAddModal, toast,
            newItem, addItem, saveSettings, saveToGitHub, clearJourney, logout,
            onFabClick: () => showAddModal.value = true
        };
    }
}).mount('#app');
