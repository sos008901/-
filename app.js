const { createApp, ref, computed, onMounted } = Vue;

createApp({
    setup() {
        const currentTab = ref('schedule');
        const currentDayIndex = ref(0);
        const days = ref([{ items: [] }]);
        const destination = ref('');
        
        // GitHub 設定
        const ghToken = ref(localStorage.getItem('gh_token') || '');
        const ghRepo = ref(localStorage.getItem('gh_repo') || '');
        const dataSha = ref(''); 
        
        // UI 狀態
        const isSyncing = ref(false);
        const showSettingsModal = ref(false);
        const showAddModal = ref(false); // 控制新增視窗
        const toast = ref({ show: false, message: '' });
        
        // 新增行程暫存
        const newItem = ref({ time: '', title: '' });

        const currentDayItems = computed(() => {
            return days.value[currentDayIndex.value]?.items || [];
        });
        
        const showToast = (msg) => { 
            toast.value = { show: true, message: msg }; 
            setTimeout(() => toast.value.show = false, 2500); 
        };

        // --- GitHub API 核心 ---
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
                    destination.value = content.destination || '我的旅程';
                    showToast("已從雲端同步");
                } else {
                    days.value = [{ items: [] }];
                }
            } catch (e) { 
                showToast("讀取失敗，請檢查設定"); 
            }
            isSyncing.value = false;
        };

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
                    headers: { 
                        'Authorization': `token ${ghToken.value}`, 
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({ 
                        message: "Sync from App", 
                        content: contentBase64, 
                        sha: dataSha.value 
                    })
                });
                if (res.ok) {
                    const resData = await res.json();
                    dataSha.value = resData.content.sha;
                    showToast("同步成功！");
                }
            } catch (e) { 
                showToast("同步失敗"); 
            }
            isSyncing.value = false;
        };

        const saveSettings = () => {
            localStorage.setItem('gh_token', ghToken.value);
            localStorage.setItem('gh_repo', ghRepo.value);
            showSettingsModal.value = false;
            loadFromGitHub();
        };

        // --- 新增行程 ---
        const addItem = () => {
            if (!newItem.value.title) {
                showToast("請輸入行程名稱");
                return;
            }
            // 確保資料結構
            if (!days.value[currentDayIndex.value]) {
                days.value[currentDayIndex.value] = { items: [] };
            }
            // 插入新行程
            days.value[currentDayIndex.value].items.push({
                time: newItem.value.time || '--:--',
                title: newItem.value.title
            });
            // 重置並關閉視窗
            newItem.value = { time: '', title: '' };
            showAddModal.value = false;
            // 存檔
            saveToGitHub();
        };

        onMounted(loadFromGitHub);

        return {
            currentTab, currentDayIndex, days, currentDayItems, destination,
            ghToken, ghRepo, isSyncing, showSettingsModal, showAddModal, toast,
            newItem, addItem,
            saveSettings, 
            onFabClick: () => {
                console.log("FAB 點擊了，開啟視窗"); // 可以在控制台看到這行
                showAddModal.value = true;
            },
            closeAllModals: () => {
                showSettingsModal.value = false;
                showAddModal.value = false;
            }
        };
    }
}).mount('#app');
