const { createApp, ref, computed, onMounted, nextTick } = Vue;

createApp({
    setup() {
        // --- 狀態定義 ---
        const currentTab = ref('schedule');
        const currentDayIndex = ref(0);
        const days = ref([{ items: [] }]);
        const destination = ref('');
        
        // GitHub 設定
        const ghToken = ref(localStorage.getItem('gh_token') || '');
        const ghRepo = ref(localStorage.getItem('gh_repo') || '');
        const dataSha = ref(''); 

        const isSyncing = ref(false);
        const showSettingsModal = ref(false);
        const showItemModal = ref(false);
        const formItem = ref({});
        const tempHour = ref('09'), tempMinute = ref('00');
        const toast = ref({ show: false, message: '' });
        const confirmModal = ref({ show: false, title: '', message: '', callback: null });

        // --- 工具方法 ---
        const showToast = (msg) => { toast.value = { show: true, message: msg }; setTimeout(() => toast.value.show = false, 2500); };

        // --- GitHub API 核心邏輯 ---

        // 讀取 GitHub 上的 data.json
        const loadFromGitHub = async () => {
            if (!ghToken.value || !ghRepo.value) return;
            isSyncing.value = true;
            try {
                const res = await fetch(`https://api.github.com/repos/${ghRepo.value}/contents/data.json`, {
                    headers: { 'Authorization': `token ${ghToken.value}`, 'Accept': 'application/vnd.github.v3+json' }
                });
                if (res.ok) {
                    const data = await res.json();
                    dataSha.value = data.sha;
                    // 解碼 Base64 (支援 UTF-8 中文)
                    const content = JSON.parse(decodeURIComponent(escape(atob(data.content))));
                    days.value = content.days || [{ items: [] }];
                    destination.value = content.destination || '';
                    showToast("已從 GitHub 同步最新資料");
                }
            } catch (e) { console.error(e); showToast("GitHub 讀取失敗"); }
            isSyncing.value = false;
        };

        // 更新資料到 GitHub
        const saveToGitHub = async () => {
            if (!ghToken.value || !ghRepo.value) return;
            isSyncing.value = true;
            
            const contentObj = { days: days.value, destination: destination.value, updatedAt: new Date().toISOString() };
            const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(contentObj))));

            try {
                const res = await fetch(`https://api.github.com/repos/${ghRepo.value}/contents/data.json`, {
                    method: 'PUT',
                    headers: { 'Authorization': `token ${ghToken.value}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: "Sync from Shiori App",
                        content: contentBase64,
                        sha: dataSha.value
                    })
                });

                if (res.ok) {
                    const resData = await res.json();
                    dataSha.value = resData.content.sha;
                    showToast("同步成功！");
                } else { showToast("同步失敗，請確認 data.json 是否存在"); }
            } catch (e) { showToast("連線 GitHub 失敗"); }
            isSyncing.value = false;
        };

        // --- UI 操作 ---
        const saveSettings = () => {
            localStorage.setItem('gh_token', ghToken.value);
            localStorage.setItem('gh_repo', ghRepo.value);
            showSettingsModal.value = false;
            loadFromGitHub();
        };

        const saveItem = () => {
            if(!formItem.value.title) return showToast("請輸入名稱");
            days.value[currentDayIndex.value].items.push({
                id: Date.now(),
                title: formItem.value.title,
                time: `${tempHour.value}:${tempMinute.value}`
            });
            showItemModal.value = false;
            saveToGitHub();
        };

        const deleteItem = (id) => {
            days.value[currentDayIndex.value].items = days.value[currentDayIndex.value].items.filter(i => i.id !== id);
            saveToGitHub();
        };

        const executeConfirm = () => { if(confirmModal.value.callback) confirmModal.value.callback(); confirmModal.value.show = false; };

        const confirmResetData = () => {
            confirmModal.value = { show: true, title: '重設', message: '這會清空本地快取，資料不會從 GitHub 消失。', callback: () => { localStorage.clear(); location.reload(); } };
        };

        onMounted(loadFromGitHub);

        return {
            currentTab, currentDayIndex, days, destination,
            ghToken, ghRepo, isSyncing, showSettingsModal, showItemModal,
            formItem, tempHour, tempMinute, toast, confirmModal,
            saveSettings, saveItem, deleteItem, executeConfirm, confirmResetData,
            getDayDate: (idx) => `Day ${idx+1}` // 簡化版日期
        };
    }
}).mount('#app');
