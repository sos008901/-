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
        const isSyncing = ref(false);
        const showSettingsModal = ref(false);
        const toast = ref({ show: false, message: '' });

        const currentDayItems = computed(() => days.value[currentDayIndex.value]?.items || []);
        const showToast = (msg) => { toast.value = { show: true, message: msg }; setTimeout(() => toast.value.show = false, 2500); };

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
                    destination.value = content.destination || '未命名旅程';
                    showToast("已從 GitHub 更新資料");
                }
            } catch (e) { showToast("讀取失敗"); }
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
                    showToast("同步成功！");
                }
            } catch (e) { showToast("連線 GitHub 失敗"); }
            isSyncing.value = false;
        };

        const saveSettings = () => {
            localStorage.setItem('gh_token', ghToken.value);
            localStorage.setItem('gh_repo', ghRepo.value);
            showSettingsModal.value = false;
            loadFromGitHub();
        };

        onMounted(loadFromGitHub);

        return {
            currentTab, currentDayIndex, days, currentDayItems, destination,
            ghToken, ghRepo, isSyncing, showSettingsModal, toast,
            saveSettings, onFabClick: () => showToast("點擊新增"),
            closeAllModals: () => showSettingsModal.value = false
        };
    }
}).mount('#app');
