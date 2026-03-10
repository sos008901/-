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

        // --- 核心連線邏輯：加上 Cache-Control 確保抓到最新 SHA ---
        const loadFromGitHub = async () => {
            const token = ghToken.value.trim();
            const repo = ghRepo.value.trim();
            if (!token || !repo) return "EMPTY";

            isSyncing.value = true;
            try {
                const res = await fetch(`https://api.github.com/repos/${repo}/contents/data.json?t=${Date.now()}`, { 
                    headers: { 'Authorization': `token ${token}`, 'Cache-Control': 'no-cache' } 
                });
                
                if (res.status === 401) return "AUTH_FAILED";
                if (res.status === 404) return "FILE_NOT_FOUND";
                
                if (res.ok) {
                    const data = await res.json(); 
                    dataSha.value = data.sha; // 抓到身份證 SHA
                    const content = JSON.parse(decodeURIComponent(escape(atob(data.content))));
                    days.value = content.days || [{ items: [] }];
                    destination.value = content.destination || '';
                    startDate.value = content.startDate || '';
                    return "SUCCESS";
                }
                return `ERR_${res.status}`;
            } catch (e) { return "NETWORK_ERR"; }
            finally { isSyncing.value = false; }
        };

        // --- 儲存邏輯：修復 409 Conflict ---
        const saveToGitHub = async () => {
            const token = ghToken.value.trim();
            const repo = ghRepo.value.trim();
            if (!token || !repo) return;

            isSyncing.value = true;

            // 重要：儲存前先刷新一次 SHA，避免多裝置衝突 (409)
            await loadFromGitHub();

            const contentObj = { days: days.value, destination: destination.value, startDate: startDate.value, updatedAt: new Date().toISOString() };
            const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(contentObj))));
            
            try {
                const res = await fetch(`https://api.github.com/repos/${repo}/contents/data.json`, { 
                    method: 'PUT', 
                    headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ 
                        message: "Cloud Sync", 
                        content: contentBase64, 
                        sha: dataSha.value // 帶著最新抓到的 SHA 去儲存
                    }) 
                });
                
                if (res.ok) { 
                    const resData = await res.json(); 
                    dataSha.value = resData.content.sha; 
                    showToast("同步成功"); 
                } else if (res.status === 409) {
                    showToast("同步衝突 (409)，請重新整理頁面後再試");
                } else {
                    showToast(`同步失敗 (${res.status})，請確認 Token 權限`);
                }
            } catch (e) { showToast("網路異常"); }
            isSyncing.value = false;
        };

        const saveSettings = async () => {
            if (!ghToken.value || !ghRepo.value) return showToast("請完整填寫連線資訊");
            ghToken.value = ghToken.value.trim();
            ghRepo.value = ghRepo.value.trim();
            localStorage.setItem('gh_token', ghToken.value);
            localStorage.setItem('gh_repo', ghRepo.value);
            
            const result = await loadFromGitHub();
            
            if (loginMode.value === 'quick') {
                if (result === "SUCCESS") { isInitialized.value = true; showToast("歡迎回來"); }
                else if (result === "FILE_NOT_FOUND") { showToast("找不到雲端檔案，請使用 New Journey 建立"); }
                else { showToast(`連線失敗 (${result})`); }
            } else {
                // New Journey 模式
                isInitialized.value = true;
                // 如果檔案已存在，loadFromGitHub 已經幫我們拿到了 SHA，這時 saveToGitHub 就能順利覆蓋而不報 409
                await saveToGitHub();
            }
        };

        // --- 其餘拖移與操作邏輯維持不變 ---
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
            deleteItem: () => { days.value[currentDayIndex.value].items.splice(editingIndex.value, 1); showAddModal.value = false; saveToGitHub(); },
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
