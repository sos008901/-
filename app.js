(function() {
    const { createApp, ref, computed, onMounted } = Vue;

    createApp({
        setup() {
            const isAppReady = ref(false);
            const currentTab = ref('money');
            const currentDayIndex = ref(0);
            const days = ref([{ items: [] }]);
            const expenses = ref([]);
            const members = ref(['我', '旅伴']);
            const destination = ref('');
            const startDate = ref('');
            
            const collapsedDates = ref({}); 
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
            const editingExpenseIndex = ref(-1);
            const tempMembers = ref([]);
            const newItem = ref({ hour: '09', minute: '00', title: '' });
            const newItemExpense = ref({ title: '', amount: 0, date: '', time: '', payer: '', type: '共同', splitWith: [], note: '' });

            const safeB64Decode = (str) => {
                try {
                    const bin = window.atob(str.replace(/\s/g, ''));
                    const bytes = new Uint8Array(bin.length);
                    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                    return JSON.parse(new TextDecoder().decode(bytes));
                } catch (e) { console.error("Decode Failed", e); return null; }
            };

            const safeB64Encode = (obj) => {
                const json = JSON.stringify(obj);
                const bytes = new TextEncoder().encode(json);
                let bin = "";
                bytes.forEach(b => bin += String.fromCharCode(b));
                return window.btoa(bin);
            };

            const totalJPY = computed(() => (expenses.value || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0));
            const totalTWD = computed(() => Math.round(totalJPY.value * 0.21));

            const getMemberStats = (name) => {
                let shared = 0;
                let privateVal = 0;
                (expenses.value || []).forEach(e => {
                    const amt = Number(e.amount) || 0;
                    const splitWith = (e.splitWith && e.splitWith.length > 0) ? e.splitWith : members.value;
                    if (e.type === '共同') {
                        if (splitWith.includes(name)) shared += amt / splitWith.length;
                    } else if (e.type === '自費') {
                        if (e.payer === name) privateVal += amt;
                    } else if (e.type === '代墊') {
                        const beneficiaries = splitWith.filter(m => m !== e.payer);
                        if (beneficiaries.includes(name)) privateVal += amt / beneficiaries.length;
                    }
                });
                const total = shared + privateVal;
                return {
                    total: Math.round(total),
                    shared: Math.round(shared),
                    private: Math.round(privateVal),
                    percent: totalJPY.value > 0 ? (total / totalJPY.value) * 100 : 0,
                    twd: Math.round(total * 0.21)
                };
            };

            const settlement = computed(() => {
                const balances = {};
                members.value.forEach(m => balances[m] = 0);
                (expenses.value || []).forEach(e => {
                    const amt = Number(e.amount) || 0;
                    const payer = e.payer;
                    const splitWith = (e.splitWith && e.splitWith.length > 0) ? e.splitWith : members.value;
                    if (e.type === '共同') {
                        const per = amt / splitWith.length;
                        splitWith.forEach(m => { if (m !== payer) { balances[m] -= per; balances[payer] += per; } });
                    } else if (e.type === '代墊') {
                        const beneficiaries = splitWith.filter(m => m !== payer);
                        if (beneficiaries.length > 0) {
                            const per = amt / beneficiaries.length;
                            beneficiaries.forEach(m => { balances[m] -= per; balances[payer] += per; });
                        }
                    }
                });
                const myBal = balances['我'] || 0;
                if (Math.abs(myBal) < 1) return { amount: 0 };
                return { amount: Math.round(Math.abs(myBal)), from: myBal > 0 ? (members.value.find(n => n !== '我') || '旅伴') : '我', to: myBal > 0 ? '我' : (members.value.find(n => n !== '我') || '旅伴') };
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

            const currentDayItems = computed(() => (days.value[currentDayIndex.value]?.items || []));
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
                        const content = safeB64Decode(d.content);
                        if (content) {
                            days.value = content.days || [{ items: [] }];
                            expenses.value = content.expenses || [];
                            members.value = content.members || ['我', '旅伴'];
                            destination.value = content.destination || '';
                            startDate.value = content.startDate || '';
                        }
                    }
                } catch (e) { showToast("Load Failed"); }
                finally { isSyncing.value = false; }
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
                    const res = await fetch(`https://api.github.com/repos/${ghRepo.value.trim()}/contents/data.json`, {
                        method: 'PUT',
                        headers: { 'Authorization': `token ${ghToken.value.trim()}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: "Sync", content: safeB64Encode(dataObj), sha: dataSha.value || undefined })
                    });
                    if (res.ok) { const d = await res.json(); dataSha.value = d.content.sha; showToast("Synced"); }
                } catch (e) { showToast("Sync Error"); }
                finally { isSyncing.value = false; }
            };

            onMounted(async () => {
                // 安全機制：不論讀取成功與否，3秒後一定關閉載入畫面
                setTimeout(() => { isAppReady.value = true; }, 3000);
                if (isInitialized.value) await loadFromGitHub();
                isAppReady.value = true;
            });

            return {
                isAppReady, isInitialized, currentTab, days, expenses, members, currentDayIndex, currentDayItems, destination, startDate,
                ghToken, ghRepo, isSyncing, showAddModal, showSettingsModal, showTravelerModal, toast, 
                newItem, newItemExpense, tempMembers, totalJPY, totalTWD, settlement, groupedExpenses, editingExpenseIndex,
                collapsedDates,
                toggleDateCollapse: (date) => { collapsedDates.value[date] = !collapsedDates.value[date]; },
                onFabClick: () => {
                    const n = new Date();
                    if (currentTab.value === 'money') {
                        editingExpenseIndex.value = -1;
                        newItemExpense.value = { title: '', amount: 0, date: n.toISOString().split('T')[0], time: n.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), payer: members.value[0], type: '共同', splitWith: [...members.value], note: '' };
                    } else { 
                        newItem.value = { hour: '09', minute: '00', title: '' }; 
                        editingIndex.value = -1; 
                    }
                    showAddModal.value = true;
                },
                openEditExpenseModal: (exp) => {
                    editingExpenseIndex.value = expenses.value.indexOf(exp);
                    newItemExpense.value = { ...exp };
                    showAddModal.value = true;
                },
                toggleSplitMember: (name) => {
                    const idx = newItemExpense.value.splitWith.indexOf(name);
                    if (idx > -1) { if(newItemExpense.value.splitWith.length > 1) newItemExpense.value.splitWith.splice(idx, 1); }
                    else { newItemExpense.value.splitWith.push(name); }
                },
                openTravelerModal: () => { tempMembers.value = [...members.value]; showTravelerModal.value = true; },
                addTraveler: () => tempMembers.value.push(''),
                removeTraveler: (i) => { if(tempMembers.value.length > 1) tempMembers.value.splice(i, 1); },
                saveTravelers: () => { members.value = tempMembers.value.filter(n => n.trim() !== ''); showTravelerModal.value = false; saveToGitHub(); },
                addExpense: () => { 
                    if(!newItemExpense.value.title) return; 
                    if (editingExpenseIndex.value === -1) expenses.value.push({ ...newItemExpense.value });
                    else expenses.value[editingExpenseIndex.value] = { ...newItemExpense.value };
                    showAddModal.value = false; saveToGitHub(); 
                },
                confirmDeleteExpense: (exp) => { 
                    if(confirm("確定刪除？")) { 
                        expenses.value = expenses.value.filter(e => e !== exp); 
                        showAddModal.value = false; 
                        saveToGitHub(); 
                    } 
                },
                addItem: () => { 
                    const it = { time: `${newItem.value.hour}:${newItem.value.minute}`, title: newItem.value.title };
                    if (editingIndex.value === -1) days.value[currentDayIndex.value].items.push(it);
                    else days.value[currentDayIndex.value].items[editingIndex.value] = it;
                    showAddModal.value = false; saveToGitHub();
                },
                deleteItem: () => { days.value[currentDayIndex.value].items.splice(editingIndex.value, 1); showAddModal.value = false; saveToGitHub(); },
                openEditModal: (i) => { editingIndex.value = i; const it = days.value[currentDayIndex.value].items[i]; const [h, m] = it.time.split(':'); newItem.value = { hour: h, minute: m, title: it.title }; showAddModal.value = true; },
                saveSettings: () => { localStorage.setItem('gh_token', ghToken.value); localStorage.setItem('gh_repo', ghRepo.value); isInitialized.value = true; loadFromGitHub(); },
                selectDay: (i) => currentDayIndex.value = i,
                addNewDay: () => { days.value.push({ items: [] }); saveToGitHub(); },
                getDayInfo: (idx) => { if (!startDate.value) return { date: '-' }; const d = new Date(startDate.value); d.setDate(d.getDate() + idx); return { date: `${d.getMonth()+1}/${d.getDate()}` }; },
                formatDisplayDate: (str) => { const d = new Date(str); const ws=['週日','週一','週二','週三','週四','週五','週六']; return `${d.getMonth()+1}月${d.getDate()}日 ${ws[d.getDay()]}`; },
                logout: () => { localStorage.clear(); location.reload(); },
                getMemberStats
            };
        }
    }).mount('#app');
})();
