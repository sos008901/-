// 全域錯誤捕獲
window.onerror = function(msg, url, line) {
    const errorDiv = document.createElement('div');
    errorDiv.style = "position:fixed; bottom:0; background:red; color:white; font-size:10px; z-index:9999; width:100%; padding:10px;";
    errorDiv.innerText = "CRASH: " + msg + " (L" + line + ")";
    document.body.appendChild(errorDiv);
};

(function() {
    const { createApp, ref, computed, onMounted } = Vue;

    createApp({
        setup() {
            const isAppReady = ref(false);
            const errorMessage = ref("");
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

            const tempMembers = ref([]);
            const newItemExpense = ref({ title: '', amount: 0, date: '', time: '', payer: '', type: '共同' });

            // --- 容錯計算 ---
            const totalJPY = computed(() => {
                const list = expenses.value || [];
                return list.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
            });
            const totalTWD = computed(() => Math.round(totalJPY.value * 0.21));

            const getMemberTotal = (name) => {
                const list = (expenses.value || []).filter(e => e.payer === name);
                const total = list.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
                return {
                    total,
                    percent: totalJPY.value > 0 ? (total / totalJPY.value) * 100 : 0,
                    shared: list.filter(e => e.type === '共同').reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
                    private: list.filter(e => e.type !== '共同').reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
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
                return { amount: Math.round(Math.abs(bal)), from: bal > 0 ? '旅伴' : '我', to: bal > 0 ? '我' : '旅伴' };
            });

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
                        // 萬能 Base64 Unicode 解碼
                        const base64 = d.content.replace(/\s/g, '');
                        const bin = window.atob(base64);
                        const bytes = new Uint8Array(bin.length);
                        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                        const content = JSON.parse(new TextDecoder().decode(bytes));
                        
                        days.value = content.days || [{ items: [] }];
                        expenses.value = content.expenses || [];
                        members.value = content.members || ['我', '旅伴'];
                        destination.value = content.destination || '';
                        startDate.value = content.startDate || '';
                    }
                } catch (e) { errorMessage.value = "Load: " + e.message; }
                finally { isSyncing.value = false; }
            };

            const saveToGitHub = async () => {
                isSyncing.value = true;
                try {
                    const dataObj = { days: days.value, expenses: expenses.value, members: members.value, destination: destination.value, startDate: startDate.value };
                    const json = JSON.stringify(dataObj);
                    const bytes = new TextEncoder().encode(json);
                    let bin = "";
                    bytes.forEach(b => bin += String.fromCharCode(b));
                    const base64 = window.btoa(bin);

                    const check = await fetch(`https://api.github.com/repos/${ghRepo.value.trim()}/contents/data.json?t=${Date.now()}`, {
                        headers: { 'Authorization': `token ${ghToken.value.trim()}` }
                    });
                    if (check.ok) { const d = await check.json(); dataSha.value = d.sha; }

                    const res = await fetch(`https://api.github.com/repos/${ghRepo.value.trim()}/contents/data.json`, {
                        method: 'PUT',
                        headers: { 'Authorization': `token ${ghToken.value.trim()}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: "Sync", content: base64, sha: dataSha.value || undefined })
                    });
                    if (res.ok) { const d = await res.json(); dataSha.value = d.content.sha; showToast("Synced"); }
                } catch (e) { showToast("Error"); }
                finally { isSyncing.value = false; }
            };

            onMounted(async () => {
                setTimeout(() => isAppReady.value = true, 2000); // 兩秒後強行移除 Loading
                if (isInitialized.value) await loadFromGitHub();
                isAppReady.value = true;
            });

            return {
                isAppReady, errorMessage, isInitialized, currentTab, days, expenses, members, currentDayIndex, currentDayItems, destination, startDate,
                ghToken, ghRepo, isSyncing, showAddModal, showSettingsModal, showTravelerModal, toast, 
                newItemExpense, tempMembers, totalJPY, totalTWD, settlement, groupedExpenses,
                onFabClick: () => {
                    const now = new Date();
                    newItemExpense.value = { title: '', amount: 0, date: now.toISOString().split('T')[0], time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), payer: members.value[0], type: '共同' };
                    showAddModal.value = true;
                },
                openTravelerModal: () => { tempMembers.value = [...members.value]; showTravelerModal.value = true; },
                addTraveler: () => tempMembers.value.push(''),
                removeTraveler: (i) => { if(tempMembers.value.length > 1) tempMembers.value.splice(i, 1); },
                saveTravelers: () => { members.value = tempMembers.value.filter(n => n.trim() !== ''); showTravelerModal.value = false; saveToGitHub(); },
                addExpense: () => { if(!newItemExpense.value.title) return; expenses.value.push({ ...newItemExpense.value }); showAddModal.value = false; saveToGitHub(); },
                saveSettings: () => { localStorage.setItem('gh_token', ghToken.value); localStorage.setItem('gh_repo', ghRepo.value); isInitialized.value = true; loadFromGitHub(); },
                selectDay: (i) => currentDayIndex.value = i,
                addNewDay: () => { days.value.push({ items: [] }); saveToGitHub(); },
                getDayInfo: (idx) => { if (!startDate.value) return { date: '-' }; const d = new Date(startDate.value); d.setDate(d.getDate() + idx); return { date: `${d.getMonth()+1}/${d.getDate()}` }; },
                formatDisplayDate: (str) => { const d = new Date(str); const ws=['週日','週一','週二','週三','週四','週五','週六']; return `${d.getMonth()+1}月${d.getDate()}日 ${ws[d.getDay()]}`; },
                logout: () => { localStorage.clear(); location.reload(); },
                getMemberTotal, saveToGitHub
            };
        }
    }).mount('#app');
})();
