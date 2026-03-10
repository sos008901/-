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
        const isInitialized = ref(!!(localStorage.getItem('gh_token') && localStorage.getItem('gh_repo')));
        
        const isSyncing = ref(false);
        const showSettingsModal = ref(false);
        const showAddModal = ref(false);
        const toast = ref({ show: false, message: '' });

        // 編輯狀態
        const editingIndex = ref(-1); 
        const dragSourceIndex = ref(-1); 
        const newItem = ref({ hour: '09', minute: '00', title: '', address: '', note: '' });

        const currentDayItems = computed(() => days.value[currentDayIndex.value]?.items || []);
        
        const showToast = (msg) => { 
            toast.value = { show: true, message: msg }; 
            setTimeout(() => toast.value.show = false, 2500); 
        };

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

        const selectDay = (index) => {
            currentDayIndex.value = index;
            scrollToActive();
        };

        const getDayInfo = (index) => {
            if (!startDate.value) return { date: '-' };
            const date = new Date(startDate.value);
            date.setDate(date.getDate() + index);
            return { date: `${date.getMonth() + 1}/${date.getDate()}` };
        };

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
                    if (content.days) days.value = content.days;
                    if (content.destination) destination.value = content.destination;
                    if (content.startDate) startDate.value = content.startDate;
                }
            } catch (e) { console.error(e); }
            isSyncing.value = false;
        };

        const saveToGitHub = async () => {
            if (!ghToken.value || !ghRepo.value) return;
            isSyncing.value = true;
            const contentObj = { 
                days: days.value, destination: destination.value, 
                startDate: startDate.value, updatedAt: new Date().toISOString() 
            };
            const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(contentObj))));
            try {
                const res = await fetch(`https://api.github.com/repos/${ghRepo.value}/contents/data.json`, {
                    method: 'PUT',
                    headers: { 'Authorization': `token ${ghToken.value}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: "Journey Sync", content: contentBase64, sha: dataSha.value })
                });
                if (res.ok) {
                    const resData = await res.json();
                    dataSha.value = resData.content.sha;
                    showToast("同步成功");
                }
            } catch (e) { showToast("同步失敗"); }
            isSyncing.value = false;
        };

        const saveSettings = async () => {
            localStorage.setItem('gh_token', ghToken.value);
            localStorage.setItem('gh_repo', ghRepo.value);
            isInitialized.value = true;
            showSettingsModal.value = false;
            await loadFromGitHub();
            if (!dataSha.value) saveToGitHub();
        };

        // --- 行程操作 ---
        const openEditModal = (index) => {
            editingIndex.value = index;
            const item = days.value[currentDayIndex.value].items[index];
            const [h, m] = item.time.split(':');
            newItem.value = { hour: h, minute: m, title: item.title, address: item.address || '', note: item.note || '' };
            showAddModal.value = true;
        };

        const addItem = () => {
            if (!newItem.value.title) return;
            const eventData = {
                time: `${newItem.value.hour}:${newItem.value.minute}`,
                title: newItem.value.title,
                address: newItem.value.address,
                note: newItem.value.note
            };
            
            if (editingIndex.value === -1) {
                days.value[currentDayIndex.value].items.push(eventData);
            } else {
                days.value[currentDayIndex.value].items[editingIndex.value] = eventData;
            }
            
            newItem.value = { hour: '09', minute: '00', title: '', address: '', note: '' };
            editingIndex.value = -1;
            showAddModal.value = false;
            saveToGitHub();
        };

        const deleteItem = () => {
            if (editingIndex.value === -1) return;
            if (confirm("確定要刪除這個行程嗎？")) {
                days.value[currentDayIndex.value].items.splice(editingIndex.value, 1);
                showAddModal.value = false;
                editingIndex.value = -1;
                saveToGitHub();
            }
        };

        // --- 拖移排序邏輯 ---
        const handleDragStart = (index) => {
            dragSourceIndex.value = index;
        };

        const handleDrop = (targetIndex) => {
            if (dragSourceIndex.value === -1 || dragSourceIndex.value === targetIndex) return;
            const items = days.value[currentDayIndex.value].items;
            const [movedItem] = items.splice(dragSourceIndex.value, 1);
            items.splice(targetIndex, 0, movedItem);
            dragSourceIndex.value = -1;
            saveToGitHub();
        };

        // --- 天數操作 ---
        const addNewDay = () => {
            days.value.push({ items: [] });
            currentDayIndex.value = days.value.length - 1;
            saveToGitHub();
            scrollToActive();
        };

        const moveDay = (index, dir) => {
            const newIdx = index + dir;
            if (newIdx < 0 || newIdx >= days.value.length) return;
            const arr = [...days.value];
            [arr[index], arr[newIdx]] = [arr[newIdx], arr[index]];
            days.value = arr;
            currentDayIndex.value = newIdx;
            saveToGitHub();
            scrollToActive();
        };

        const deleteDay = (index) => {
            if (days.value.length <= 1) return showToast("需保留一天");
            if (confirm("確定刪除此天？")) {
                days.value.splice(index, 1);
                currentDayIndex.value = 0;
                saveToGitHub();
            }
        };

        onMounted(() => { if (isInitialized.value) loadFromGitHub(); });

        return {
            isInitialized, currentTab, days, currentDayIndex, currentDayItems, destination, startDate, scrollContainer,
            ghToken, ghRepo, isSyncing, showSettingsModal, showAddModal, toast, newItem, editingIndex,
            saveSettings, addItem, deleteItem, openEditModal, addNewDay, getDayInfo, selectDay, moveDay, deleteDay, 
            handleDragStart, handleDrop,
            onFabClick: () => { editingIndex.value = -1; showAddModal.value = true; },
            logout: () => { localStorage.clear(); location.reload(); }
        };
    }
}).mount('#app');
