const { createApp, ref, computed, onMounted } = Vue;

createApp({
    setup() {
        const currentTab = ref('schedule');
        const currentDayIndex = ref(0);
        const days = ref([{ items: [] }]);
        const destination = ref('');
        const startDate = ref(''); 
        
        const ghToken = ref(localStorage.getItem('gh_token') || '');
        const ghRepo = ref(localStorage.getItem('gh_repo') || '');
        const dataSha = ref(''); 
        
        // 判斷是否顯示主介面
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

        // --- 讀取雲端 ---
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
                    
                    // 只有當雲端有資料時，才覆蓋本地內容
                    if (content.destination) destination.value = content.destination;
                    if (content.startDate) startDate.value = content.startDate;
                    if (content.days) days.value = content.days;
                    
                    showToast("已同步雲端資料");
                }
            } catch (e) { console.error("Load Error:", e); }
            isSyncing.value = false;
        };

        // --- 存入雲端 ---
        const saveToGitHub = async () => {
            if (!ghToken.value || !ghRepo.value) return;
            isSyncing.value = true;
            const contentObj = { 
                days: days.value, 
                destination: destination.value, 
                startDate: startDate.value,
                updatedAt: new Date().toISOString() 
            };
            const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(contentObj))));
            try {
                const res = await fetch(`https://api.github.com/repos/${ghRepo.value}/contents/data.json`, {
                    method: 'PUT',
                    headers: { 'Authorization': `token ${ghToken.value}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: "Journey Update", content: contentBase64, sha: dataSha.value })
                });
                if (res.ok) {
                    const resData = await res.json();
                    dataSha.value = resData.content.sha;
                    showToast("同步成功");
                    showSettingsModal.value = false;
                } else {
                    showToast("同步失敗，請檢查設定");
                }
            } catch (e) { showToast("網路連線失敗"); }
            isSyncing.value = false;
        };

        // --- 進入旅程按鈕 ---
        const saveSettings = async () => {
            if (!ghToken.value || !ghRepo.value) {
                showToast("請填寫 GitHub 連線資訊");
                return;
            }

            // 1. 先把填寫好的內容存進 localStorage（預防重整）
            localStorage.setItem('gh_token', ghToken.value);
            localStorage.setItem('gh_repo', ghRepo.value);
            
            // 2. 暫存這一次在畫面上填寫的內容
            const tempDest = destination.value;
            const tempDate = startDate.value;

            // 3. 跳轉頁面
            isInitialized.value = true;

            // 4. 背景執行讀取
            await loadFromGitHub();

            // 5. 如果讀完之後發現雲端目的地是空的，就把剛剛填的補上去並存檔
            if (!destination.value && tempDest) {
                destination.value = tempDest;
                startDate.value = tempDate;
                await saveToGitHub();
            }
        };

        const logout = () => {
            if (confirm("確定要登出並重置所有設定嗎？")) {
                localStorage.clear();
                location.reload(); // 重新整理頁面最乾淨
            }
        };

        const clearJourney = () => {
            if (confirm("確定要清空所有行程嗎？")) {
                days.value = [{ items: [] }];
                saveToGitHub();
            }
        };

        const addItem = () => {
            if (!newItem.value.title) return;
            if (!days.value[currentDayIndex.value]) days.value[currentDayIndex.value] = { items: [] };
            days.value[currentDayIndex.value].items.push({ ...newItem.value });
            newItem.value = { time: '', title: '' };
            showAddModal.value = false;
            saveToGitHub();
        };

        onMounted(() => {
            if (isInitialized.value) loadFromGitHub();
        });

        return {
            isInitialized, currentTab, days, currentDayItems, destination, startDate,
            ghToken, ghRepo, isSyncing, showSettingsModal, showAddModal, toast,
            newItem, addItem, saveSettings, saveToGitHub, clearJourney, logout,
            onFabClick: () => showAddModal.value = true
        };
    }
}).mount('#app');
