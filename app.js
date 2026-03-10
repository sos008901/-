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
        const showToast = (msg) => { toast.value = { show: true, message: msg }; setTimeout(() => toast.value.show = false, 3500); };

        const syncData = async (type = 'load') => {
            const token = ghToken.value.trim();
            const repo = ghRepo.value.trim();
            if (!token || !repo) return "EMPTY";
            isSyncing.value = true;
            try {
                const url = `https://api.github.com/repos/${repo}/contents/data.json?t=${Date.now()}`;
                const res = await fetch(url, { headers: { 'Authorization': `token ${token}`, 'Cache-Control': 'no-cache' } });
                if (res.status === 401) return "AUTH_ERROR";
                if (res.ok) {
                    const data = await res.json(); dataSha.value = data.sha;
                    if (type === 'load') {
                        const content = JSON.parse(decodeURIComponent(escape(atob(data.content))));
                        days.value = content.days || [{ items: [] }];
                        destination.value = content.destination || '';
                        startDate.value = content.startDate || '';
                        return "LOADED";
                    }
                }
                if (type === 'save') {
                    const contentObj = { days: days.value, destination: destination.value, startDate: startDate.value, updatedAt: new Date().toISOString() };
                    const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(contentObj))));
                    const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/data.json`, { 
                        method: 'PUT', headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: "Sync", content: contentBase64, sha: dataSha.value || undefined })
                    });
                    if (putRes.ok) { const putData = await putRes.json(); dataSha.value = putData.content.sha; return "SAVED"; }
                    if (putRes.status === 409) return "CONFLICT";
                }
                return res.status === 404 ? "NOT_FOUND" : "ERROR";
            } catch (e) { return "NETWORK_FAIL"; }
            finally { isSyncing.value = false; }
        };

        const saveToGitHub = async () => {
            const result = await syncData('save');
            if (result === "SAVED") showToast("同步成功");
            else if (result === "CONFLICT") { showToast("正在修復衝突..."); await syncData('save'); }
            else showToast(`同步失敗: ${result}`);
        };

        const saveSettings = async () => {
            ghToken.value = ghToken.value.trim(); ghRepo.value = ghRepo.value.trim();
            if (!ghToken.value || !ghRepo.value) return showToast("請完整填寫資訊");
            const res = await syncData('load');
            if (loginMode.value === 'quick') {
                if (res === "LOADED") { localStorage.setItem('gh_token', ghToken.value); localStorage.setItem('gh_repo', ghRepo.value); isInitialized.value = true; showToast("歡迎回來"); }
                else showToast(`錯誤: ${res}`);
            } else {
                isInitialized.value = true; localStorage.setItem('gh_token', ghToken.value); localStorage.setItem('gh_repo', ghRepo.value); await saveToGitHub();
            }
        };

        // --- 一鍵清除功能 ---
        const clearAllData = async () => {
            if (confirm("⚠️ 注意：這會刪除此旅程的所有行程、目的地與日期，且無法復原。確定要清空嗎？")) {
                destination.value = "";
                startDate.value = "";
                days.value = [{ items: [] }];
                currentDayIndex.value = 0;
                await saveToGitHub();
                showToast("資料已全數清空");
                showSettingsModal.value = false;
            }
        };

        // --- 拖移與其餘邏輯 ---
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

        onMounted(() => { if (isInitialized.value) syncData('load'); });

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
            logout: () => { if(confirm("確定登出此裝置？")){localStorage.clear(); location.reload();} }, saveToGitHub
        };
    }
}).mount('#app');
