const { createApp, ref, computed, onMounted } = Vue;

createApp({
    setup() {
        const currentTab = ref('schedule');
        const currentDayIndex = ref(0);
        const days = ref([{ items: [] }]);
        const destination = ref('');
        
        // --- 狀態管理 ---
        const ghToken = ref(localStorage.getItem('gh_token') || '');
        const ghRepo = ref(localStorage.getItem('gh_repo') || '');
        const dataSha = ref(''); 
        
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

        // --- 從 GitHub 讀取資料 ---
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
                    // 解碼 Base64 (支援中文)
                    const content = JSON.parse(decodeURIComponent(escape(atob(data.content))));
                    days.value = content.days || [{ items: [] }];
                    destination.value = content.destination || '';
                    showToast("同步成功");
                }
            } catch (e) { console.error("Load Failed:", e); }
            isSyncing.value = false;
        };

        // --- 儲存資料到 GitHub ---
        const saveToGitHub = async () => {
            if (!ghToken.value || !ghRepo.value) return;
            isSyncing.value = true;
            const contentObj = { 
                days: days.value, 
                destination: destination.value, 
                updatedAt: new Date().toISOString() 
            };
            // 編碼 Base64 (支援中文)
            const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(contentObj))));
            try {
                const res = await fetch(`https://api.github.com/repos/${ghRepo.value}/contents/data.json`, {
                    method: 'PUT',
                    headers: { 
                        'Authorization': `token ${ghToken.value}`, 
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({ 
                        message: "Journey Sync", 
                        content: contentBase64, 
                        sha: dataSha.value 
                    })
                });
                if (res.ok) {
                    const resData = await res.json();
                    dataSha.value = resData.content.sha; // 更新 SHA 以防衝突
                }
            } catch (e) { showToast("連線 GitHub 失敗"); }
            isSyncing.value = false;
        };

        // --- 儲存設定 ---
        const saveSettings = () => {
            if (!ghToken.value || !ghRepo.value) {
                showToast("請填寫 Token 與 Repo");
                return;
            }
            localStorage.setItem('gh_token', ghToken.value);
            localStorage.setItem('gh_repo', ghRepo.value);
            showSettingsModal.value = false;
            
            loadFromGitHub().then(() => {
                // 如果是新開的，強迫建立一個檔案在 GitHub 上
                if (!dataSha.value) saveToGitHub();
            });
        };

        // --- 【一鍵清除行程】 ---
        const clearJourney = () => {
            if (confirm("確定要刪除所有行程內容嗎？（您的連線設定會保留）")) {
                days.value = [{ items: [] }];
                destination.value = "";
                saveToGitHub();
                showSettingsModal.value = false;
                showToast("行程已重置");
            }
        };

        // --- 【登出並重置】 ---
        const logout = () => {
            if (confirm("確定要登出帳號嗎？這會清除此裝置上的所有連線設定。")) {
                // 清除 LocalStorage
                localStorage.removeItem('gh_token');
                localStorage.removeItem('gh_repo');
                // 清空 reactive 變數
                ghToken.value = '';
                ghRepo.value = '';
                dataSha.value = '';
                days.value = [{ items: [] }];
                destination.value = '';
                showSettingsModal.value = false;
                showToast("已清除連線資訊");
            }
        };

        const addItem = () => {
            if (!newItem.value.title) return;
            if (!days.value[currentDayIndex.value]) {
                days.value[currentDayIndex.value] = { items: [] };
            }
            days.value[currentDayIndex.value].items.push({
                time: newItem.value.time || '--:--',
                title: newItem.value.title
            });
            newItem.value = { time: '', title: '' };
            showAddModal.value = false;
            saveToGitHub(); // 新增完自動上傳
        };

        onMounted(loadFromGitHub);

        return {
            currentTab, currentDayIndex, days, currentDayItems, destination,
            ghToken, ghRepo, isSyncing, showSettingsModal, showAddModal, toast,
            newItem, addItem, saveSettings, clearJourney, logout,
            onFabClick: () => showAddModal.value = true
        };
    }
}).mount('#app');
