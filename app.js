const { createApp, ref, computed, onMounted, nextTick } = Vue;

createApp({
    setup() {
        // --- 核心數據 ---
        const currentTab = ref('schedule');
        const currentDayIndex = ref(0);
        const days = ref([{ items: [] }]);
        const travelers = ref(['我', '旅伴']);
        const expenses = ref([]);
        const notes = ref([]); 
        const shoppingList = ref([]);
        const destination = ref(''), startDate = ref(''), currencySymbol = ref('¥'), exchangeRate = ref(0.21);
        
        const ghToken = ref(localStorage.getItem('gh_token') || '');
        const ghRepo = ref(localStorage.getItem('gh_repo') || '');
        const dataSha = ref(''); 

        const isSyncing = ref(false), showWizard = ref(false), viewingImage = ref(null), isEditing = ref(false);
        const toast = ref({ show: false, message: '' }), confirmModal = ref({ show: false, title: '', message: '', callback: null });
        const showItemModal = ref(false), showExpenseModal = ref(false), showNoteModal = ref(false), showSettingsModal = ref(false), showTravelerModal = ref(false);
        const expandedItemId = ref(null), expandedNoteId = ref(null);

        const tempDestination = ref(''), tempStartDate = ref(''), tempHour = ref('09'), tempMinute = ref('00');
        const formItem = ref({}), formExpense = ref({}), formNote = ref({}), newShopName = ref('');

        // --- 計算屬性 (Calculated) ---
        const currentDayItems = computed(() => days.value[currentDayIndex.value]?.items || []);
        const totalExpense = computed(() => expenses.value.reduce((sum, exp) => sum + Number(exp.amount), 0));
        
        const debts = computed(() => {
            let balances = {}; travelers.value.forEach(t => balances[t] = 0);
            expenses.value.forEach(exp => {
                const amt = Number(exp.amount), payer = exp.payer;
                const split = amt / (travelers.value.length || 1);
                balances[payer] += amt;
                travelers.value.forEach(t => balances[t] -= split);
            });
            let result = [], debtors = Object.entries(balances).filter(b => b[1] < -1), creditors = Object.entries(balances).filter(b => b[1] > 1);
            while (debtors.length && creditors.length) {
                let d = debtors[0], c = creditors[0], amt = Math.min(Math.abs(d[1]), c[1]);
                result.push({ from: d[0], to: c[0], amount: Math.round(amt) });
                d[1] += amt; c[1] -= amt;
                if (Math.abs(d[1]) < 1) debtors.shift(); if (c[1] < 1) creditors.shift();
            }
            return result;
        });

        const groupedExpenses = computed(() => {
            const groups = {};
            expenses.value.forEach(e => {
                const key = e.date || '無日期';
                if (!groups[key]) groups[key] = { displayDate: key, items: [], total: 0 };
                groups[key].items.push(e); groups[key].total += Number(e.amount);
            });
            return Object.values(groups).sort((a,b) => b.displayDate.localeCompare(a.displayDate));
        });

        // --- GitHub API 同步 ---
        const loadFromGitHub = async () => {
            if (!ghToken.value || !ghRepo.value) return;
            isSyncing.value = true;
            try {
                const res = await fetch(`https://api.github.com/repos/${ghRepo.value}/contents/data.json`, {
                    headers: { 'Authorization': `token ${ghToken.value}`, 'Accept': 'application/vnd.github.v3+json' }
                });
                if (res.ok) {
                    const data = await res.json(); dataSha.value = data.sha;
                    const content = JSON.parse(decodeURIComponent(escape(atob(data.content))));
                    days.value = content.days || [{items:[]}]; expenses.value = content.expenses || [];
                    notes.value = content.notes || []; shoppingList.value = content.shoppingList || [];
                    destination.value = content.destination || ''; startDate.value = content.startDate || '';
                    travelers.value = content.travelers || ['我', '旅伴'];
                    showWizard.value = !destination.value;
                }
            } catch (e) { console.error(e); }
            isSyncing.value = false;
        };

        const saveToGitHub = async () => {
            if (!ghToken.value || !ghRepo.value) return;
            isSyncing.value = true;
            const contentObj = { days: days.value, expenses: expenses.value, notes: notes.value, shoppingList: shoppingList.value, destination: destination.value, startDate: startDate.value, travelers: travelers.value, updatedAt: new Date().toISOString() };
            const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(contentObj))));
            try {
                const res = await fetch(`https://api.github.com/repos/${ghRepo.value}/contents/data.json`, {
                    method: 'PUT', headers: { 'Authorization': `token ${ghToken.value}` },
                    body: JSON.stringify({ message: "Sync Shiori", content: contentBase64, sha: dataSha.value })
                });
                if (res.ok) { const d = await res.json(); dataSha.value = d.content.sha; showToast("GitHub 同步完成"); }
            } catch (e) { showToast("同步失敗"); }
            isSyncing.value = false;
        };

        // --- 業務邏輯 ---
        const compressImage = (file) => new Promise(res => {
            const reader = new FileReader(); reader.onload = (e) => {
                const img = new Image(); img.onload = () => {
                    const canvas = document.createElement('canvas'); const MAX = 1200; let w = img.width, h = img.height;
                    if (w > h) { if(w > MAX){ h *= MAX/w; w = MAX; } } else { if(h > MAX){ w *= MAX/h; h = MAX; } }
                    canvas.width = w; canvas.height = h; canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    res(canvas.toDataURL('image/jpeg', 0.8));
                }; img.src = e.target.result;
            }; reader.readAsDataURL(file);
        });

        const saveItem = () => { days.value[currentDayIndex.value].items.push({ ...formItem.value, time: `${tempHour.value}:${tempMinute.value}` }); showItemModal.value = false; saveToGitHub(); };
        const saveExpense = () => { expenses.value.unshift({...formExpense.value, date: new Date().toISOString().split('T')[0]}); showExpenseModal.value = false; saveToGitHub(); };
        const saveNote = () => { notes.value.unshift({...formNote.value}); showNoteModal.value = false; saveToGitHub(); };
        const addItemToShop = (shop) => { if(shop.tempItemInput) { shop.items.push({ id: Date.now(), text: shop.tempItemInput, done: false }); shop.tempItemInput = ''; saveToGitHub(); } };
        const addShop = () => { if(newShopName.value) { shoppingList.value.push({ id: Date.now(), shopName: newShopName.value, items: [], expanded: true }); newShopName.value = ''; saveToGitHub(); } };
        
        onMounted(loadFromGitHub);

        return { 
            currentTab, currentDayIndex, days, currentDayItems, totalExpense, destination, currencySymbol, exchangeRate, travelers, startDate,
            ghToken, ghRepo, isSyncing, showWizard, showItemModal, showExpenseModal, showNoteModal, showSettingsModal, showTravelerModal,
            formItem, formExpense, formNote, tempHour, tempMinute, tempDestination, tempStartDate, toast, confirmModal,
            viewingImage, expandedItemId, expandedNoteId, debts, groupedExpenses, shoppingList, newShopName, isEditing,
            saveSettings: () => { localStorage.setItem('gh_token', ghToken.value); localStorage.setItem('gh_repo', ghRepo.value); showSettingsModal.value = false; loadFromGitHub(); },
            finishWizard: () => { destination.value = tempDestination.value; startDate.value = tempStartDate.value; showWizard.value = false; saveToGitHub(); },
            onFabClick: () => {
                if(currentTab.value === 'schedule') { formItem.value = { id: Date.now() }; showItemModal.value = true; }
                if(currentTab.value === 'money') { formExpense.value = { id: Date.now(), payer: travelers.value[0], amount: '' }; showExpenseModal.value = true; }
                if(currentTab.value === 'memo') { formNote.value = { id: Date.now(), images: [], title: '', content: '' }; showNoteModal.value = true; }
            },
            saveItem, saveExpense, saveNote, addShop, addItemToShop,
            getDayDate: (idx) => { if(!startDate.value) return `Day ${idx+1}`; const d = new Date(startDate.value); d.setDate(d.getDate() + idx); return `${d.getMonth()+1}/${d.getDate()}`; },
            toTWD: (v) => Math.round(v * exchangeRate.value).toLocaleString(),
            toggleExpand: (id) => expandedItemId.value = expandedItemId.value === id ? null : id,
            toggleExpandNote: (id) => expandedNoteId.value = expandedNoteId.value === id ? null : id,
            toggleItem: (sid, i) => { i.done = !i.done; saveToGitHub(); },
            removeItem: (sid, iid) => { const s = shoppingList.value.find(x => x.id === sid); s.items = s.items.filter(i => i.id !== iid); saveToGitHub(); },
            closeAllModals: () => { showItemModal.value = showExpenseModal.value = showNoteModal.value = showSettingsModal.value = showTravelerModal.value = false; },
            getModalTitle: () => (showItemModal.value ? 'New Event' : showExpenseModal.value ? 'Expense' : showNoteModal.value ? 'Memo' : showSettingsModal.value ? 'Settings' : 'Travelers'),
            onNoteImageChange: async (e) => { for(let f of e.target.files) { const b = await compressImage(f); formNote.value.images.push(b); } },
            viewImage: (i) => viewingImage.value = i,
            confirmDeleteItem: (id) => { confirmModal.value = { show: true, title: '刪除', message: '確定刪除？', callback: () => { days.value[currentDayIndex.value].items = days.value[currentDayIndex.value].items.filter(i => i.id !== id); saveToGitHub(); } }; },
            addDay: () => { days.value.push({ items: [] }); saveToGitHub(); },
            renderNote: (t) => t ? t.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-theme-accent underline">$1</a>') : '',
            executeConfirm: () => { confirmModal.value.callback(); confirmModal.value.show = false; },
            openTravelerModal: () => { showTravelerModal.value = true; },
            confirmResetData: () => { localStorage.clear(); location.reload(); }
        };
    }
}).mount('#app');
