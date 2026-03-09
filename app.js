const { createApp, ref, computed, onMounted } = Vue;

createApp({
    setup() {
        const currentTab = ref('schedule');
        const currentDayIndex = ref(0);
        const days = ref([{ items: [] }]);
        const destination = ref('');
        
        // 從 LocalStorage 載入設定
        const ghToken = ref(localStorage.getItem('gh_token') || '');
        const ghRepo = ref(localStorage.getItem('gh_repo') || '');
        const dataSha = ref(''); 
        
        // UI 狀態
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

        // --- GitHub 讀取 ---
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

        // --- GitHub 儲存 ---
        const saveToGitHub = async () => {
            if (!ghToken.value || !ghRepo.value) return;
            isSyncing.value = true;
            const contentObj = { 
                days: days.value, 
                destination: destination.value, 
                updatedAt: new Date().toISOString() 
            };
            const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(contentObj))));
            try {
                const res = await fetch(`https://api.github.com/repos/${ghRepo.value}/contents/data.json`, {
                    method: 'PUT',
                    headers: { 'Authorization': `token ${ghToken.value}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        message: "Sync Journey", 
                        content: contentBase64, 
                        sha: dataSha.value 
                    })
                });
                if (res.ok) {
                    const resData = await res.json();
                    dataSha.value = resData.content.sha;
                }
            } catch (e) { showToast("連線失敗"); }
            isSyncing.value = false;
        };

        // --- 儲存設定（初次登入或修改） ---
        const saveSettings = () => {
            if (!ghToken.value || !ghRepo.value) {
                showToast("請填寫完整 GitHub 資訊");
                return;
            }
            localStorage.setItem('gh_token', ghToken.value);
            localStorage.setItem('gh_repo', ghRepo.value);
            showSettingsModal.value = false;
            // 嘗試載入舊資料，若無資料則初始化新旅程
            loadFromGitHub().then(() => {
                if (days.value.length === 0) days.value = [{ items: [] }];
                saveToGitHub(); // 強制初始化雲端檔案
            });
        };

        // --- 【一鍵清除旅程】 ---
        const clearJourney = () => {
            if (confirm("確定要清除整趟旅程的所有行程嗎？此動作無法復原。")) {
                days.value = [{ items: [] }]; // 重置為只有一天空白行程
                destination.value = ""; // 清除目的地
                saveToGitHub();
                showSettingsModal.value = false;
                showToast("旅程已重置");
            }
        };

        const addItem = () => {
            if (!newItem.value.title) return;
            if (!days.value[currentDayIndex.value]) days.value[currentDayIndex.value] = { items: [] };
            days.value[currentDayIndex.value].items.push({
                time: newItem.value.time || '--:--',
                title: newItem.value.title
            });
            newItem.value = { time: '', title: '' };
            showAddModal.value = false;
            saveToGitHub();
        };

        onMounted(loadFromGitHub);

        return {
            currentTab, currentDayIndex, days, currentDayItems, destination,
            ghToken, ghRepo, isSyncing, showSettingsModal, showAddModal, toast,
            newItem, addItem, saveSettings, clearJourney,
            onFabClick: () => showAddModal.value = true
        };
    }
}).mount('#app');
