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
        
        // 核心持久化邏輯：從本地儲存讀取
        const ghToken = ref(localStorage.getItem('gh_token') || '');
        const ghRepo = ref(localStorage.getItem('gh_repo') || '');
        const dataSha = ref(''); 
        
        // 只要本地有 Token，就預設為已登入狀態，不再輕易跳回登入頁
        const isInitialized = ref(!!(ghToken.value && ghRepo.value));
        
        const isSyncing = ref(false);
        const showSettingsModal = ref(false);
        const showAddModal = ref(false);
        const toast = ref({ show: false, message: '' });

        const editingIndex = ref(-1); 
        const dragSourceIndex = ref(-1); 
        const newItem = ref({ hour: '09', minute: '00', title: '', address: '', note: '' });

        const currentDayItems = computed(() => days.value[currentDayIndex.value]?.items || []);
        const showToast = (msg) => { toast.value = { show: true, message: msg }; setTimeout(() => toast.value.show = false, 2500); };

        const scrollToActive = () => {
            nextTick(() => {
                const container = scrollContainer.value;
                const activeCard = document.getElementById(`day-card-${currentDayIndex.value}`);
                if (container && activeCard) {
                    const scrollLeft = activeCard.offsetLeft - (container.offsetWidth / 2) + (activeCard.offsetWidth / 2);
                    container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
                }
            });
        };

        // --- 核心：從 GitHub 讀取最新資料 ---
        const loadFromGitHub = async () => {
            if (!ghToken.value || !ghRepo.value) return false;
            isSyncing.value = true;
            try {
                const res = await fetch(`https://api.github.com/repos/${ghRepo.value}/contents/data.json`, { 
                    headers: { 'Authorization': `token ${ghToken.value}`, 'Cache-Control': 'no-cache' } 
                });
                if (res.ok) {
                    const data = await res.json(); 
                    dataSha.value = data.sha;
                    const content = JSON.parse(decodeURIComponent(escape(atob(data.content))));
                    if (content.days) days.value = content.days;
                    if (content.destination) destination.value = content.destination;
                    if (content.startDate) startDate.value = content.startDate;
                    return true;
                }
                return false;
            } catch (e) { return false; }
            finally { isSyncing.value = false; }
        };

        const saveToGitHub = async () => {
            if (!ghToken.value || !ghRepo.value) return;
            isSyncing.value = true;
            const contentObj = { days: days.value, destination: destination.value, startDate: startDate.value, updatedAt: new Date().toISOString() };
            const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(contentObj))));
            try {
                const res = await fetch(`https://api.github.com/repos/${ghRepo.value}/contents/data.json`, { 
                    method: 'PUT', 
                    headers: { 'Authorization': `token ${ghToken.value}`, 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ message: "Sync from device", content: contentBase64, sha: dataSha.value }) 
                });
                if (res.ok) { 
                    const resData = await res.json(); 
                    dataSha.value = resData.content.sha; 
                    showToast("已同步至雲端"); 
                }
            } catch (e) { showToast("同步失敗，請檢查網路"); }
            isSyncing.value = false;
        };

        // --- 登入與設定 ---
        const saveSettings = async () => {
            if (!ghToken.value || !ghRepo.value) return showToast("請填寫 GitHub 資訊");
            
            // 儲存至本地，確保下次重新整理不用再打一次
            localStorage.setItem('gh_token', ghToken.value);
            localStorage.setItem('gh_repo', ghRepo.value);
            
            const success = await loadFromGitHub();
            
            if (loginMode.value === 'quick') {
                if (success) {
                    isInitialized.value = true;
                    showToast("歡迎回來");
                } else {
                    showToast("雲端尚無資料，請改用 New Journey 模式");
                }
            } else {
                // 新旅程模式：立刻建立雲端檔案
                isInitialized.value = true;
                await saveToGitHub();
                showToast("新旅程已建立");
            }
        };

        // --- 手機觸控拖移 ---
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

        onMounted(() => { 
            if (isInitialized.value) loadFromGitHub(); 
        });

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
            deleteDay: (i) => { if (days.value.length <= 1) return; if (confirm("確定刪除此天？")) { days.value.splice(i, 1); currentDayIndex.value = 0; saveToGitHub(); } },
            handleTouchStart, handleTouchMove, handleTouchEnd,
            onFabClick: () => { editingIndex.value = -1; newItem.value = { hour: '09', minute: '00', title: '', address: '', note: '' }; showAddModal.value = true; },
            logout: () => { if(confirm("確定登出？這會清除此裝置的登入資訊")){localStorage.clear(); location.reload();} },
            saveToGitHub
        };
    }
}).mount('#app');
