// 預留偵錯：防止 Vue 沒載入
if (typeof Vue === 'undefined') {
    document.body.innerHTML = "<div style='padding:50px; text-align:center;'>Vue Library Load Failed. Check internet connection.</div>";
}

try {
    const { createApp, ref, computed, onMounted } = Vue;

    const app = createApp({
        setup() {
            const isAppReady = ref(false); // 標載全域載入狀態
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

            // --- 結算邏輯 ---
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
                let bal = 0; 
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

            // --- 歷史明細分組 ---
            const groupedExpenses = computed(() => {
                const g = {};
                (expenses.value || []).forEach(e => {
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
                    const url = `https://api.github.com/repos/${ghRepo.value.trim()}/contents/data.json?t=${Date.now()}`;
                    const res = await fetch(url, { headers: { 'Authorization': `token ${ghToken.value.trim()}` } });
                    if (res.ok) {
                        const d = await res.json();
                        dataSha.value = d.sha;
                        const base64Str = d.content.replace(/\s/g, ''); // 過濾換行
                        const content = JSON.parse(decodeURIComponent(escape(atob(base64Str))));
                        days.value = content.days || [{ items: [] }];
                        expenses.value = content.expenses || [];
                        members.value = content.members || ['我', '旅伴'];
                        destination.value = content.destination || '';
                        startDate.value = content.startDate || '';
                    } else {
                        if (res.status === 401) { isInitialized.value = false; showToast("Token Expired"); }
                    }
                } catch (e) {
                    console.error("Load Failed:", e);
                    showToast("Cloud Data Error");
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
                    if (res.ok) { const d = await res.json(); dataSha.value = d.content.sha; showToast("Saved"); }
                } catch (e) { showToast("Sync Failed"); }
                finally { isSyncing.value = false; }
            };

            const onFabClick = () => {
                const now = new Date();
                if (currentTab.value === 'money') {
                    newItemExpense.value = { title: '', amount: 0, date: now.toISOString().split('T')[0], time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), payer: (members.value && members.value[0]) || '我', type: '共同' };
                } else { newItem.value = { hour: '09', minute: '00', title: '' }; editingIndex.value = -1; }
                showAddModal.value = true;
            };

            onMounted(async () => {
                try {
                    if (isInitialized.value) await loadFromGitHub();
                } catch(e) { console.error(e); }
                finally { isAppReady.value = true; } // 不管讀取成功與否，最終都要標記為 Ready 才能顯示畫面
            });

            return {
                isAppReady, isInitialized, currentTab, days, expenses, members, currentDayIndex, currentDayItems, destination, startDate,
                ghToken, ghRepo, isSyncing, showAddModal, showSettingsModal, showTravelerModal, toast, 
                newItem, newItemExpense, tempMembers, totalJPY, totalTWD, settlement, groupedExpenses,
                onFabClick, saveToGitHub, loadFromGitHub,
                openTravelerModal: () => { tempMembers.value = [...members.value]; showTravelerModal.value = true; },
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
                deleteItem: () => { days.value[currentDayIndex.value].items.splice(editingIndex.value, 1); showAddModal.value = false; saveToGitHub(); },
                openEditModal: (i) => { editingIndex.value = i; const it = days.value[currentDayIndex.value].items[i]; const [h, m] = it.time.split(':'); newItem.value = { hour: h, minute: m, title: it.title }; showAddModal.value = true; },
                saveSettings: () => { 
                    if(!ghToken.value || !ghRepo.value) return;
                    localStorage.setItem('gh_token', ghToken.value); localStorage.setItem('gh_repo', ghRepo.value); 
                    isInitialized.value = true; loadFromGitHub(); 
                },
                selectDay: (i) => currentDayIndex.value = i,
                addNewDay: () => { days.value.push({ items: [] }); saveToGitHub(); },
                getDayInfo: (idx) => { if (!startDate.value) return { date: '-' }; const d = new Date(startDate.value); d.setDate(d.getDate() + idx); return { date: `${d.getMonth()+1}/${d.getDate()}` }; },
                formatDisplayDate: (str) => { const d = new Date(str); const ws=['週日','週一','週二','週三','週四','週五','週六']; return `${d.getMonth()+1}月${d.getDate()}日 ${ws[d.getDay()]}`; },
                logout: () => { if(confirm("確定登出？")){localStorage.clear(); location.reload();} }
            };
        }
    }).mount('#app');

} catch (err) {
    alert("Critical Startup Error: " + err.message);
}
