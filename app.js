const { createApp, ref, computed, onMounted, nextTick } = Vue;

createApp({
    setup() {
        const currentTab = ref('schedule');
        const currentDayIndex = ref(0);
        const days = ref([{ items: [] }]);
        const destination = ref('');
        const startDate = ref('');
        const scrollContainer = ref(null);
        const loginMode = ref('quick'); 
        
        const ghToken = ref(localStorage.getItem('gh_token') || '');
        const ghRepo = ref(localStorage.getItem('gh_repo') || '');
        const dataSha = ref(''); 
        const isInitialized = ref(!!(ghToken.value && ghRepo.value));
        
        const isSyncing = ref(false);
        const showSettingsModal = ref(false);
        const showAddModal = ref(false);
        const toast = ref({ show: false, message: '' });

        const editingIndex = ref(-1); 
        const dragSourceIndex = ref(-1); 
        const newItem = ref({ hour: '09', minute: '00', title: '', address: '', note: '' });

        const currentDayItems = computed(() => days.value[currentDayIndex.value]?.items || []);
        const showToast = (msg) => { toast.value = { show: true, message: msg }; setTimeout(() => toast.value.show = false, 3000); };

        // --- 1. 最單純的讀取：只要 Token 對，就一定抓得到 ---
        const loadFromGitHub = async () => {
            if (!ghToken.value || !ghRepo.value) return false;
            isSyncing.value = true;
            try {
                const res = await fetch(`https://api.github.com/repos/${ghRepo.value.trim()}/contents/data.json?t=${Date.now()}`, {
                    headers: { 'Authorization': `token ${ghToken.value.trim()}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    dataSha.value = data.sha;
                    const content = JSON.parse(decodeURIComponent(escape(atob(data.content))));
                    days.value = content.days || [{ items: [] }];
                    destination.value = content.destination || '';
                    startDate.value = content.startDate || '';
                    return true;
                }
                return false;
            } catch (e) { return false; }
            finally { isSyncing.value = false; }
        };

        // --- 2. 最單純的儲存：存之前先補 SHA 防 409 ---
        const saveToGitHub = async () => {
            if (!ghToken.value || !ghRepo.value) return;
            isSyncing.value = true;

            // 存之前先抓一次最新的 SHA 
            const checkRes = await fetch(`https://api.github.com/repos/${ghRepo.value.trim()}/contents/data.json?t=${Date.now()}`, {
                headers: { 'Authorization': `token ${ghToken.value.trim()}` }
            });
            if (checkRes.ok) {
                const checkData = await checkRes.json();
                dataSha.value = checkData.sha;
            }

            const contentObj = { days: days.value, destination: destination.value, startDate: startDate.value };
            const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(contentObj))));
            
            try {
                const res = await fetch(`https://api.github.com/repos/${ghRepo.value.trim()}/contents/data.json`, {
                    method: 'PUT',
                    headers: { 'Authorization': `token ${ghToken.value.trim()}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: "Sync", content: contentBase64, sha: dataSha.value || undefined })
                });
                if (res.ok) {
                    const resData = await res.json();
                    dataSha.value = resData.content.sha;
                    showToast("同步成功");
                } else {
                    showToast("同步失敗，請檢查 Token 權限");
                }
            } catch (e) { showToast("網路錯誤"); }
            finally { isSyncing.value = false; }
        };

        // --- 3. 登入邏輯：不再區分，統一嘗試 load ---
        const saveSettings = async () => {
            const token = ghToken.value.trim();
            const repo = ghRepo.value.trim();
            if (!token || !repo) return showToast("請完整填寫");

            localStorage.setItem('gh_token', token);
            localStorage.setItem('gh_repo', repo);

            if (loginMode.value === 'quick') {
                const success = await loadFromGitHub();
                if (success) {
                    isInitialized.value = true;
                    showToast("歡迎回來");
                } else {
                    showToast("抓不到舊資料，請改用 New Journey");
                }
            } else {
                // New Journey 模式：直接進去並嘗試存檔
                isInitialized.value = true;
                await saveToGitHub();
            }
        };

        const clearAllData = async () => {
            if (confirm("⚠️ 確定要清空雲端資料嗎？")) {
                days.value = [{ items: [] }]; destination.value = ""; startDate.value = "";
                await saveToGitHub();
                showSettingsModal.value = false;
            }
        };

        // --- 其餘手柄拖移與操作維持不變 ---
        let startY = 0;
        const handleTouchStart = (e, index) => { dragSourceIndex.value = index; startY = e.touches[0].clientY; };
        const handleTouchMove = (e) => {
            if (dragSourceIndex.value === -1) return;
            const diff = e.touches[0].clientY - startY;
            if (Math.abs(diff) > 70) {
                const target = diff > 0 ? dragSourceIndex.value + 1 : dragSourceIndex.value - 1;
                const items = days.value[currentDayIndex.value].items;
                if (target >= 0 && target < items.length) {
                    const [m] = items.splice(dragSourceIndex.value, 1);
                    items.splice(target, 0, m);
                    dragSourceIndex.value = target; startY = e.touches[0].clientY;
                }
            }
        };
        const handleTouchEnd = () => { if (dragSourceIndex.value !== -1) { dragSourceIndex.value = -1; saveToGitHub(); } };
        const addItem = () => {
            if (!newItem.value.title) return;
            const ev = { time: `${newItem.value.hour}:${newItem.value.minute}`, title: newItem.value.title, address: newItem.value.address, note: newItem.value.note };
            if (editingIndex.value === -1) days.value[currentDayIndex.value].items.push(ev);
            else days.value[currentDayIndex.value].items[editingIndex.value] = ev;
            newItem.value = { hour: '09', minute: '00', title: '', address: '', note: '' };
            editingIndex.value = -1; showAddModal.value = false; saveToGitHub();
        };

        onMounted(() => { if (isInitialized.value) loadFromGitHub(); });

        return {
            isInitialized, currentTab, days, currentDayIndex, currentDayItems, destination, startDate, scrollContainer,
            ghToken, ghRepo, isSyncing, showSettingsModal, showAddModal, toast, newItem, editingIndex, dragSourceIndex,
            loginMode, saveSettings, addItem, clearAllData,
            deleteItem: () => { days.value[currentDayIndex.value].items.splice(editingIndex.value, 1); showAddModal.value = false; saveToGitHub(); },
            openEditModal: (i) => { editingIndex.value = i; const it = days.value[currentDayIndex.value].items[i]; const [h, m] = it.time.split(':'); newItem.value = { hour: h, minute: m, title: it.title, address: it.address || '', note: it.note || '' }; showAddModal.value = true; },
            addNewDay: () => { days.value.push({ items: [] }); currentDayIndex.value = days.value.length - 1; saveToGitHub(); },
            getDayInfo: (i) => { if (!startDate.value) return { date: '-' }; const d = new Date(startDate.value); d.setDate(d.getDate() + i); return { date: `${d.getMonth() + 1}/${d.getDate()}` }; },
            selectDay: (i) => { currentDayIndex.value = i; nextTick(() => { const c = scrollContainer.value; const a = document.getElementById(`day-card-${i}`); if (c && a) c.scrollTo({ left: a.offsetLeft - (c.offsetWidth/2) + (a.offsetWidth/2), behavior: 'smooth' }); }); },
            moveDay: (i, d) => { const n = i + d; if (n < 0 || n >= days.value.length) return; const a = [...days.value]; [a[i], a[n]] = [a[n], a[i]]; days.value = a; currentDayIndex.value = n; saveToGitHub(); },
            deleteDay: (i) => { if (days.value.length <= 1) return; if (confirm("Delete Day?")) { days.value.splice(i, 1); currentDayIndex.value = 0; saveToGitHub(); } },
            handleTouchStart, handleTouchMove, handleTouchEnd,
            onFabClick: () => { editingIndex.value = -1; newItem.value = { hour: '09', minute: '00', title: '', address: '', note: '' }; showAddModal.value = true; },
            logout: () => { if(confirm("確定登出？")){localStorage.clear(); location.reload();} }, saveToGitHub
        };
    }
}).mount('#app');
