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
        const showToast = (msg) => { toast.value = { show: true, message: msg }; setTimeout(() => toast.value.show = false, 4000); };

        // --- 核心：深度診斷連線 ---
        const loadFromGitHub = async () => {
            const token = ghToken.value.trim();
            const repo = ghRepo.value.trim();
            if (!token || !repo) return "MISSING_INFO";

            isSyncing.value = true;
            try {
                // 增加隨機數防快取
                const url = `https://api.github.com/repos/${repo}/contents/data.json?cb=${Date.now()}`;
                const res = await fetch(url, { 
                    headers: { 
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Cache-Control': 'no-cache'
                    } 
                });
                
                if (res.status === 401) return "TOKEN_INVALID";
                if (res.status === 404) return "FILE_NOT_FOUND";
                if (res.status === 403) return "PERMISSION_DENIED";
                
                if (res.ok) {
                    const data = await res.json(); 
                    dataSha.value = data.sha; // 抓到檔案的 SHA 身分證
                    const content = JSON.parse(decodeURIComponent(escape(atob(data.content))));
                    days.value = content.days || [{ items: [] }];
                    destination.value = content.destination || '';
                    startDate.value = content.startDate || '';
                    return "SUCCESS";
                }
                return `ERR_${res.status}`;
            } catch (e) { 
                console.error(e);
                return "NETWORK_ERROR"; 
            } finally { isSyncing.value = false; }
        };

        const saveToGitHub = async () => {
            const token = ghToken.value.trim();
            const repo = ghRepo.value.trim();
            if (!token || !repo) return;

            isSyncing.value = true;
            
            // 儲存前先刷新 SHA
            await loadFromGitHub();

            const contentObj = { days: days.value, destination: destination.value, startDate: startDate.value, updatedAt: new Date().toISOString() };
            const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(contentObj))));
            
            try {
                const res = await fetch(`https://api.github.com/repos/${repo}/contents/data.json`, { 
                    method: 'PUT',
                    headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ 
                        message: "Device Sync", 
                        content: contentBase64, 
                        sha: dataSha.value // 帶著最新 SHA 才能解決 409
                    }) 
                });
                
                if (res.ok) { 
                    const resData = await res.json(); 
                    dataSha.value = resData.content.sha; 
                    showToast("同步成功"); 
                } else {
                    const errInfo = await res.json();
                    showToast(`同步失敗 (${res.status}): ${errInfo.message}`);
                }
            } catch (e) { showToast("網路異常"); }
            isSyncing.value = false;
        };

        const saveSettings = async () => {
            if (!ghToken.value || !ghRepo.value) return showToast("請完整填寫資訊");
            
            ghToken.value = ghToken.value.trim();
            ghRepo.value = ghRepo.value.trim();
            localStorage.setItem('gh_token', ghToken.value);
            localStorage.setItem('gh_repo', ghRepo.value);
            
            const result = await loadFromGitHub();
            
            if (loginMode.value === 'quick') {
                if (result === "SUCCESS") { 
                    isInitialized.value = true; 
                    showToast("連線成功！歡迎回來"); 
                } else {
                    showToast(`抓不到資料 (${result})，請檢查 Token 權限或改用 New Journey`);
                }
            } else {
                // New Journey 模式：不論有沒有都先嘗試讀取 SHA
                isInitialized.value = true;
                await saveToGitHub();
            }
        };

        // --- 其餘拖移與行程操作 (維持最新版邏輯) ---
        let startY = 0;
        const handleTouchStart = (e, index) => { dragSourceIndex.value = index; startY = e.touches[0].clientY; };
        const handleTouchMove = (e) => {
            if (dragSourceIndex.value === -1) return;
            const currentY = e.touches[0].clientY;
            const diff = currentY - startY;
            if (Math.abs(diff) > 70) {
                const targetIdx = diff > 0 ? dragSourceIndex.value + 1 : dragSourceIndex.value - 1;
                const items = days.value[currentDayIndex.value].items;
                if (targetIdx >= 0 && targetIdx < items.length) {
                    const [moved] = items.splice(dragSourceIndex.value, 1);
                    items.splice(targetIdx, 0, moved);
                    dragSourceIndex.value = targetIdx;
                    startY = currentY;
                }
            }
        };
        const handleTouchEnd = () => { if (dragSourceIndex.value !== -1) { dragSourceIndex.value = -1; saveToGitHub(); } };
        const addItem = () => {
            if (!newItem.value.title) return;
            const eventData = { time: `${newItem.value.hour}:${newItem.value.minute}`, title: newItem.value.title, address: newItem.value.address, note: newItem.value.note };
            if (editingIndex.value === -1) days.value[currentDayIndex.value].items.push(eventData);
            else days.value[currentDayIndex.value].items[editingIndex.value] = eventData;
            newItem.value = { hour: '09', minute: '00', title: '', address: '', note: '' };
            editingIndex.value = -1; showAddModal.value = false; saveToGitHub();
        };
        const scrollToActive = () => { nextTick(() => { const container = scrollContainer.value; const activeCard = document.getElementById(`day-card-${currentDayIndex.value}`); if (container && activeCard) { container.scrollTo({ left: activeCard.offsetLeft - (container.offsetWidth / 2) + (activeCard.offsetWidth / 2), behavior: 'smooth' }); } }); };
        onMounted(() => { if (isInitialized.value) loadFromGitHub(); });

        return {
            isInitialized, currentTab, days, currentDayIndex, currentDayItems, destination, startDate, scrollContainer,
            ghToken, ghRepo, isSyncing, showSettingsModal, showAddModal, toast, newItem, editingIndex, dragSourceIndex,
            loginMode, saveSettings, addItem,
            deleteItem: () => { if(confirm("確定刪除行程？")){days.value[currentDayIndex.value].items.splice(editingIndex.value, 1); showAddModal.value = false; saveToGitHub();} },
            openEditModal: (i) => { editingIndex.value = i; const item = days.value[currentDayIndex.value].items[i]; const [h, m] = item.time.split(':'); newItem.value = { hour: h, minute: m, title: item.title, address: item.address || '', note: item.note || '' }; showAddModal.value = true; },
            addNewDay: () => { days.value.push({ items: [] }); currentDayIndex.value = days.value.length - 1; saveToGitHub(); scrollToActive(); },
            getDayInfo: (i) => { if (!startDate.value) return { date: '-' }; const d = new Date(startDate.value); d.setDate(d.getDate() + i); return { date: `${d.getMonth() + 1}/${d.getDate()}` }; },
            selectDay: (i) => { currentDayIndex.value = i; scrollToActive(); },
            moveDay: (i, d) => { const n = i + d; if (n < 0 || n >= days.value.length) return; const a = [...days.value]; [a[i], a[n]] = [a[n], a[i]]; days.value = a; currentDayIndex.value = n; saveToGitHub(); scrollToActive(); },
            deleteDay: (i) => { if (days.value.length <= 1) return; if (confirm("Delete Day?")) { days.value.splice(i, 1); currentDayIndex.value = 0; saveToGitHub(); } },
            handleTouchStart, handleTouchMove, handleTouchEnd,
            onFabClick: () => { editingIndex.value = -1; newItem.value = { hour: '09', minute: '00', title: '', address: '', note: '' }; showAddModal.value = true; },
            logout: () => { if(confirm("確定登出？")){localStorage.clear(); location.reload();} },
            saveToGitHub
        };
    }
}).mount('#app');
