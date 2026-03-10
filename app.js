// 全域報錯攔截：如果程式出錯，會跳出 alert
window.onerror = function(msg, url, line) {
    alert("程式發生錯誤：\n" + msg + "\n行號：" + line);
};

try {
    const { createApp, ref, computed, onMounted } = Vue;

    const app = createApp({
        setup() {
            // 基礎狀態
            const isAppReady = ref(false);
            const currentTab = ref('money');
            const currentDayIndex = ref(0);
            const days = ref([{ items: [] }]);
            const expenses = ref([]);
            const members = ref(['我', '旅伴']);
            const destination = ref('');
            const startDate = ref('');
            
            const ghToken = ref(localStorage.getItem('gh_token') || '');
            const ghRepo = ref(localStorage.getItem('gh_repo') || '');
            const dataSha = ref(''); 
            const isInitialized = ref(!!(ghToken.value && ghRepo.value));
            const isSyncing = ref(false);
            const showAddModal = ref(false);
            const showSettingsModal = ref(false);
            const showTravelerModal = ref(false);
            const toast = ref({ show: false, message: '' });

            const editingIndex = ref(-1);
            const tempMembers = ref([]);
            const newItem = ref({ hour: '09', minute: '00', title: '' });
            const newItemExpense = ref({ title: '', amount: 0, date: '', time: '', payer: '', type: '共同' });

            // --- 計算屬性：總額與結算 ---
            const totalJPY = computed(() => (expenses.value || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0));
            const totalTWD = computed(() => Math.round(totalJPY.value * 0.21));

            const getMemberTotal = (name) => {
                const list = (expenses.value || []).filter(e => e.payer === name);
                const total = list.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
                const shared = list.filter(e => e.type === '共同').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
                const priv = total - shared;
                return {
                    total, shared, private: priv,
                    sharedPercent: total > 0 ? (shared / total) * 100 : 0,
                    privatePercent: total > 0 ? (priv / total) * 100 : 0
                };
            };

            const settlement = computed(() => {
                let bal = 0; // 旅伴欠我為正
                (expenses.value || []).forEach(e => {
                    const a = Number(e.amount) || 0;
                    if (e.payer === '我') {
                        if(e.type === '共同') bal += a / 2;
                        if(e.type === '代墊') bal += a;
                    } else if (e.payer === '旅伴') {
                        if(e.type === '共同') bal -= a / 2;
                        if(e.type === '代墊') bal -= a;
                    }
                });
                if (Math.abs(bal) < 1) return { amount: 0 };
                return { amount: Math.round(Math.abs(bal)), from: bal > 0 ? '旅伴' : '我', to: bal > 0 ? '我' : '旅伴' };
            });

            const groupedExpenses = computed(() => {
                const g = {};
                (expenses.value || []).sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(e => {
                    if (!g[e.date]) g[e.date] = { items: [], total: 0 };
                    g[e.date].items.push(e);
                    g[e.date].total += (Number(e.amount) || 0);
                });
                return g;
            });

            const currentDayItems = computed(() => days.value[currentDayIndex.value]?.items || []);

            // --- 方法 ---
            const showToast = (m) => { toast.value = { show: true, message: m }; setTimeout(() => toast.value.show = false, 2000); };

            const loadFromGitHub = async () => {
                if (!ghToken.value || !ghRepo.value) return;
                isSyncing.value = true;
                try {
                    const res = await fetch(`https://api.github.com/repos/${ghRepo.value.trim()}/contents/data.json?t=${Date.now()}`, {
                        headers: { 'Authorization': `token ${ghToken.value.trim()}` }
                    });
                    if (res.ok) {
                        const d = await res.json();
                        dataSha.value = d.sha;
                        // 強化解碼邏輯，防範手機瀏覽器報錯
                        const base64 = d.content.replace(/\s/g, ''); 
                        const content = JSON.parse(decodeURIComponent(escape(window.atob(base64))));
                        days.value = content.days || [{ items: [] }];
                        expenses.value = content.expenses || [];
                        members.value = content.members || ['我', '旅伴'];
                        destination.value = content.destination || '';
                        startDate.value = content.startDate || '';
                    }
                } catch (e) {
                    console.error(e);
                } finally { isSyncing.value = false; }
            };

            const saveToGitHub = async () => {
                if (!ghToken.value || !ghRepo.value) return;
                isSyncing.value = true;
                try {
                    const check = await fetch(`https://api.github.com/repos/${ghRepo.value.trim()}/contents/data.json?t=${Date.now()}`, {
                        headers: { 'Authorization': `token ${ghToken.value.trim()}` }
                    });
                    if (check.ok) { const d = await check.json(); dataSha.value = d.sha; }

                    const dataObj = { days: days.value, expenses: expenses.value, members: members.value, destination: destination.value, startDate: startDate.value };
                    const base64 = btoa(unescape(encodeURIComponent(JSON.stringify(dataObj))));
                    
                    const res = await fetch(`https://api.github.com/repos/${ghRepo.value.trim()}/contents/data.json`, {
                        method: 'PUT',
                        headers: { 'Authorization': `token ${ghToken.value.trim()}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: "Sync", content: base64, sha: dataSha.value || undefined })
                    });
                    if (res.ok) { const d = await res.json(); dataSha.value = d.content.sha; showToast("Synced"); }
                } catch (e) { showToast("Sync Error"); }
                finally { isSyncing.value = false; }
            };

            onMounted(async () => {
                // 強制在 3 秒後移除 Loading 畫面，避免卡死
                setTimeout(() => isAppReady.value = true, 3000);
                if (isInitialized.value) await loadFromGitHub();
                isAppReady.value = true;
            });

            return {
                isAppReady, isInitialized, currentTab, days, expenses, members, currentDayIndex, currentDayItems, destination, startDate,
                ghToken, ghRepo, isSyncing, showAddModal, showSettingsModal, showTravelerModal, toast, 
                newItem, newItemExpense, tempMembers, totalJPY, totalTWD, settlement, groupedExpenses,
                onFabClick: () => {
                    const now = new Date();
                    if (currentTab.value === 'money') {
                        newItemExpense.value = { title: '', amount: 0, date: now.toISOString().split('T')[0], time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), payer: members.value[0], type: '共同' };
                    } else { newItem.value = { hour: '09', minute: '00', title: '' }; editingIndex.value = -1; }
                    showAddModal.value = true;
                },
                saveToGitHub, openTravelerModal: () => { tempMembers.value = [...members.value]; showTravelerModal.value = true; },
                addTraveler: () => tempMembers.value.push(''),
                removeTraveler: (i) => { if(tempMembers.value.length > 1) tempMembers.value.splice(i, 1); },
                saveTravelers: () => { members.value = tempMembers.value.filter(n => n.trim() !== ''); showTravelerModal.value = false; saveToGitHub(); },
                addExpense: () => { if(!newItemExpense.value.title) return; expenses.value.push({ ...newItemExpense.value }); showAddModal.value = false; saveToGitHub(); },
                addItem: () => { 
                    if(!newItem.value.title) return;
                    const it = { time: `${newItem.value.hour}:${newItem.value.minute}`, title: newItem.value.title };
                    if (editingIndex.value === -1) days.value[currentDayIndex.value].items.push(it);
                    else days.value[currentDayIndex.value].items[editingIndex.value] = it;
                    showAddModal.value = false; saveToGitHub();
                },
                saveSettings: () => { 
                    localStorage.setItem('gh_token', ghToken.value); localStorage.setItem('gh_repo', ghRepo.value); 
                    isInitialized.value = true; loadFromGitHub(); 
                },
                selectDay: (i) => currentDayIndex.value = i,
                addNewDay: () => { days.value.push({ items: [] }); saveToGitHub(); },
                getDayInfo: (idx) => { if (!startDate.value) return { date: '-' }; const d = new Date(startDate.value); d.setDate(d.getDate() + idx); return { date: `${d.getMonth()+1}/${d.getDate()}` }; },
                formatDisplayDate: (str) => { const d = new Date(str); const ws=['週日','週一','週二','週三','週四','週五','週六']; return `${d.getMonth()+1}月${d.getDate()}日 ${ws[d.getDay()]}`; },
                logout: () => { localStorage.clear(); location.reload(); }
            };
        }
    }).mount('#app');

} catch (e) {
    alert("Vue 啟動失敗：" + e.message);
}
