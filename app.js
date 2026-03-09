const { createApp, ref, computed, onMounted, nextTick } = Vue;

createApp({
    setup() {
        const currentTab = ref('schedule');
        const currentDayIndex = ref(0);
        const days = ref([{ items: [] }]);
        const destination = ref('');
        const startDate = ref('');
        const scrollContainer = ref(null);
        
        const ghToken = ref(localStorage.getItem('gh_token') || '');
        const ghRepo = ref(localStorage.getItem('gh_repo') || '');
        const dataSha = ref(''); 
        const isSyncing = ref(false);
        const showSettingsModal = ref(false);
        const showAddModal = ref(false); // 控制新增頁面顯示
        const toast = ref({ show: false, message: '' });

        // 還原截圖要求的資料結構
        const newItem = ref({ 
            timeHour: '09', 
            timeMinute: '00', 
            title: '', 
            address: '', 
            note: '' 
        });

        const currentDayItems = computed(() => days.value[currentDayIndex.value]?.items || []);
        const showToast = (msg) => { toast.value = { show: true, message: msg }; setTimeout(() => toast.value.show = false, 2500); };

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
                    startDate.value = content.startDate || '';
                    showToast("已從 GitHub 更新資料");
                }
            } catch (e) { showToast("讀取失敗"); }
            isSyncing.value = false;
        };

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

        const addItem = () => {
            if (!newItem.value.title) return;
            days.value[currentDayIndex.value].items.push({
                time: `${newItem.value.timeHour}:${newItem.value.timeMinute}`,
                title: newItem.value.title,
                address: newItem.value.address,
                note: newItem.value.note
            });
            // 重置
            newItem.value = { timeHour: '09', timeMinute: '00', title: '', address: '', note: '' };
            showAddModal.value = false;
            saveToGitHub();
        };

        const saveSettings = () => {
            localStorage.setItem('gh_token', ghToken.value);
            localStorage.setItem('gh_repo', ghRepo.value);
            showSettingsModal.value = false;
            loadFromGitHub();
        };

        onMounted(loadFromGitHub);

        return {
            currentTab, currentDayIndex, days, currentDayItems, destination, startDate,
            ghToken, ghRepo, isSyncing, showSettingsModal, showAddModal, toast, newItem,
            saveSettings, addItem, 
            onFabClick: () => showAddModal.value = true, // 修復：點擊後開啟新增頁面
            getDayInfo: (i) => {
                if (!startDate.value) return { date: '-' };
                const d = new Date(startDate.value);
                d.setDate(d.getDate() + i);
                return { date: `${d.getMonth()+1}/${d.getDate()}` };
            }
        };
    }
}).mount('#app');
