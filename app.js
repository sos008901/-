import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, onSnapshot, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { createApp, ref, computed, onMounted, watch, nextTick, getCurrentInstance } from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";

const firebaseConfig = {
  apiKey: "AIzaSyAuSZftA_x822_SLh7292lEutuLr9KFteM",
  authDomain: "trip-new-36c48.firebaseapp.com",
  projectId: "trip-new-36c48",
  storageBucket: "trip-new-36c48.firebasestorage.app",
  messagingSenderId: "189989466738",
  appId: "1:189989466738:web:a2d1412b213caadb6408eb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const TRIP_DOC_ID = "shared_trip_data"; 
const tripDocRef = doc(db, "trips", TRIP_DOC_ID);

function debounce(func, wait) {
    let timeout;
    return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), wait); };
}

createApp({
    setup() {
        const currentTab = ref('schedule');
        const currentDayIndex = ref(0);
        const days = ref([{ items: [] }]);
        const travelers = ref(['我', '旅伴']);
        const expenses = ref([]);
        
        const notes = ref([]); 
        const shoppingList = ref([]);
        const newShopName = ref('');
        
        const showShoppingEditModal = ref(false);
        const editForm = ref({ shopId: null, itemId: null, text: '', link: '', note: '', images: [] });
        const viewingImage = ref(null);

        const exchangeRate = ref(0.21);
        const startDate = ref('');
        const destination = ref('');
        const currencySymbol = ref('¥');
        const showWizard = ref(false);
        const showItemModal = ref(false), showExpenseModal = ref(false), showSettingsModal = ref(false), showNoteModal = ref(false), showTravelerModal = ref(false);
        const isEditing = ref(false), isNoteEditing = ref(false), isExpenseEditing = ref(false);
        const toast = ref({ show: false, message: '', type: 'success' });
        const confirmModal = ref({ show: false, title: '', message: '', callback: null });
        const expandedItemId = ref(null);
        const expandedNoteId = ref(null); 
        const expandedDates = ref([]); 
        const editingTravelers = ref([]);

        const isExporting = ref(false); // 控制 PDF 渲染
        const isSyncing = ref(false);
        const isRemoteUpdate = ref(false); 
        const permissionError = ref(false);
        let unsubscribeSnapshot = null;

        const tempDestination = ref(''), tempStartDate = ref('');
        const tempHour = ref('09'), tempMinute = ref('00'), tempHourExp = ref('09'), tempMinuteExp = ref('00');
        const formItem = ref({ id: null, time: '', title: '', location: '', note: '', dayIndex: 0, oldDayIndex: 0 });
        const formExpense = ref({ id: null, title: '', amount: '', payer: travelers.value[0], beneficiaries: [], type: 'shared', date: '', time: '', note: '' });
        const formNote = ref({ id: null, title: '', content: '', updatedAt: '', images: [] });
        
        const currentDayItems = computed(() => days.value[currentDayIndex.value]?.items || []);
        const totalExpense = computed(() => expenses.value.reduce((sum, exp) => sum + Number(exp.amount), 0));
        
        const toggleExpand = (id) => expandedItemId.value = expandedItemId.value === id ? null : id;
        const toggleExpandNote = (id) => expandedNoteId.value = expandedNoteId.value === id ? null : id; 
        const collapsedDates = ref([]);
        const dragIndex = ref(null);

        const openMap = (loc) => {
            if (!loc) return;
            const url = (loc.startsWith('http') || loc.startsWith('www')) ? loc : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`;
            window.open(url, '_blank');
        };
        
        const renderNote = (note) => {
            if (!note) return '';
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            return note.replace(urlRegex, (url) => `<a href="${url}" target="_blank" class="text-theme-accent underline break-all">${url}</a>`);
        };

        const showToast = (msg) => { toast.value = { show: true, message: msg, type: 'success' }; setTimeout(() => toast.value.show = false, 3000); };
        const toTWD = (val) => Math.round(val * exchangeRate.value).toLocaleString();
        const getDayDate = (index) => { 
            if(!startDate.value) return ''; 
            const d = new Date(startDate.value); d.setDate(d.getDate() + index); 
            return `${d.getMonth() + 1}/${d.getDate()}`; 
        };
        
        const finishWizard = () => { destination.value = tempDestination.value; startDate.value = tempStartDate.value; showWizard.value = false; };
        
        const saveToCloud = debounce(async () => {
            if (isRemoteUpdate.value) return;
            isSyncing.value = true;
            try {
                const dataToSave = {
                    days: JSON.parse(JSON.stringify(days.value)), expenses: JSON.parse(JSON.stringify(expenses.value)),
                    notes: JSON.parse(JSON.stringify(notes.value)), shoppingList: JSON.parse(JSON.stringify(shoppingList.value)), 
                    startDate: startDate.value, destination: destination.value, exchangeRate: exchangeRate.value,
                    currencySymbol: currencySymbol.value, travelers: JSON.parse(JSON.stringify(travelers.value))
                };
                await setDoc(tripDocRef, dataToSave, { merge: true });
                isSyncing.value = false;
            } catch (e) {
                console.error(e); isSyncing.value = false;
            }
        }, 800);

        watch([days, expenses, notes, shoppingList, startDate, destination, exchangeRate, currencySymbol, travelers], () => {
            if (!isRemoteUpdate.value) saveToCloud();
        }, { deep: true });

        const setupFirestoreListener = () => {
            if (unsubscribeSnapshot) return; 
            unsubscribeSnapshot = onSnapshot(tripDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const d = docSnap.data();
                    isRemoteUpdate.value = true;
                    days.value = d.days || [{items:[]}]; 
                    expenses.value = d.expenses || []; 
                    notes.value = d.notes || [];
                    shoppingList.value = d.shoppingList || [];
                    startDate.value = d.startDate || ''; 
                    destination.value = d.destination || ''; 
                    currencySymbol.value = d.currencySymbol || '¥'; 
                    travelers.value = d.travelers || ['我', '旅伴'];
                    showWizard.value = !(destination.value && startDate.value);
                    nextTick(() => isRemoteUpdate.value = false);
                } else {
                    showWizard.value = true;
                }
            });
        };

        onMounted(() => {
            onAuthStateChanged(auth, (user) => {
                if (user) setupFirestoreListener();
                else signInAnonymously(auth).then(setupFirestoreListener);
            });
        });
        
        const addDay = () => { days.value.push({ items: [] }); currentDayIndex.value = days.value.length - 1; };
        const confirmDeleteDay = () => days.value.length <= 1 ? showToast('最少保留一天') : days.value.splice(currentDayIndex.value, 1);
        const confirmDeleteItem = (id) => days.value[currentDayIndex.value].items = days.value[currentDayIndex.value].items.filter(i => i.id !== id);
        
        const onFabClick = () => {
            if(currentTab.value === 'schedule') { 
                formItem.value = { id: Date.now(), time: '09:00', title: '', location: '', note: '', dayIndex: currentDayIndex.value }; 
                showItemModal.value = true; 
            }
            if(currentTab.value === 'money') showExpenseModal.value = true;
            if(currentTab.value === 'memo') showNoteModal.value = true;
        };

        const saveItem = () => {
            const newItem = { ...formItem.value, time: `${tempHour.value}:${tempMinute.value}` };
            if(isEditing.value) { 
                const oldIndex = formItem.value.oldDayIndex;
                const newIndex = formItem.value.dayIndex;
                if (oldIndex === newIndex) {
                    const idx = days.value[oldIndex].items.findIndex(i => i.id === formItem.value.id);
                    if (idx !== -1) days.value[oldIndex].items.splice(idx, 1, newItem);
                } else {
                    days.value[oldIndex].items = days.value[oldIndex].items.filter(i => i.id !== formItem.value.id);
                    if(!days.value[newIndex].items) days.value[newIndex].items = []; 
                    days.value[newIndex].items.push(newItem);
                }
            } else { 
                if(!days.value[newItem.dayIndex].items) days.value[newItem.dayIndex].items = []; 
                days.value[newItem.dayIndex].items.push(newItem); 
            }
            showItemModal.value = false;
        };

        const saveExpense = () => {
            formExpense.value.id = Date.now();
            expenses.value.unshift(formExpense.value);
            showExpenseModal.value = false;
        };

        const saveNote = () => {
            formNote.value.id = Date.now();
            notes.value.unshift(formNote.value);
            showNoteModal.value = false;
        };
        
        const addShop = () => {
            if (newShopName.value.trim()) shoppingList.value.push({ id: Date.now(), shopName: newShopName.value, items: [], expanded: true });
            newShopName.value = '';
        };

        const addItemToShop = (shop) => {
            if (shop.tempItemInput) shop.items.push({ id: Date.now(), text: shop.tempItemInput, done: false });
            shop.tempItemInput = '';
        };

        const removeItem = (shopId, itemId) => { const shop = shoppingList.value.find(s => s.id === shopId); if (shop) shop.items = shop.items.filter(i => i.id !== itemId); };
        const toggleItem = (shopId, item) => { item.done = !item.done; };
        const toggleShop = (shop) => { shop.expanded = !shop.expanded; };
        const removeShop = (id) => shoppingList.value = shoppingList.value.filter(s => s.id !== id);
        
        const editItem = (item) => { 
            formItem.value = {...item, dayIndex: currentDayIndex.value, oldDayIndex: currentDayIndex.value}; 
            [tempHour.value, tempMinute.value] = item.time.split(':'); 
            isEditing.value=true; 
            showItemModal.value=true; 
        };
        
        const editExpense = (exp) => { formExpense.value = {...exp}; isExpenseEditing.value=true; showExpenseModal.value=true; };
        const editNote = (note) => { formNote.value = {...note}; isNoteEditing.value=true; showNoteModal.value=true; };
        const closeAllModals = () => { showItemModal.value = false; showExpenseModal.value = false; showNoteModal.value = false; showSettingsModal.value = false; };
        
        const getModalTitle = () => {
            if(showItemModal.value) return 'Event';
            if(showExpenseModal.value) return 'Expense';
            if(showNoteModal.value) return 'Note';
            if(showSettingsModal.value) return 'Settings';
        };

        const groupedExpenses = computed(() => {
            const groups = {};
            expenses.value.forEach(exp => {
                const dateKey = exp.date || 'no-date';
                if (!groups[dateKey]) groups[dateKey] = [];
                groups[dateKey].push(exp);
            });
            return Object.keys(groups).map(date => ({
                date, displayDate: date, items: groups[date], total: groups[date].reduce((sum, item) => sum + Number(item.amount), 0)
            }));
        });

        // 🚨 修正：加入 setTimeout，等待 Vue 與瀏覽器排版完成才進行截圖
        const exportToPDF = () => {
            isExporting.value = true;
            showSettingsModal.value = false; 
            showToast("正在準備版面與圖片，請稍候...");
            
            // 給予 1 秒鐘的延遲，確保圖片載入與 Vue 把隱藏版面渲染完畢
            setTimeout(() => {
                const element = document.getElementById('pdf-export-content');
                if (!element) return;
                
                const opt = {
                    margin:       10, 
                    filename:     `${destination.value || 'MyTrip'}_旅程手冊.pdf`,
                    image:        { type: 'jpeg', quality: 0.98 }, 
                    html2canvas:  { scale: 2, useCORS: true, logging: false }, 
                    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' } 
                };

                window.html2pdf().set(opt).from(element).save().then(() => {
                    isExporting.value = false; 
                    showToast("🎉 PDF 匯出成功！");
                }).catch(err => {
                    console.error(err);
                    isExporting.value = false;
                    showToast("匯出失敗，請重試");
                });
            }, 1000); 
        };

        return { 
            currentTab, currentDayIndex, days, currentDayItems, totalExpense, notes, destination, currencySymbol, startDate, exchangeRate, expenses,
            showWizard, tempDestination, tempStartDate, finishWizard, 
            showItemModal, showExpenseModal, showSettingsModal, showNoteModal, closeAllModals, getModalTitle,
            formItem, formExpense, formNote, tempHour, tempMinute, travelers,
            saveItem, saveExpense, saveNote, editItem, editExpense, editNote, confirmDeleteItem, 
            onFabClick, addDay, confirmDeleteDay, openMap, renderNote,
            toast, confirmModal, toTWD, getDayDate,
            toggleExpand, expandedItemId, isEditing, isExpenseEditing, isNoteEditing, dragIndex, 
            groupedExpenses, collapsedDates, 
            isSyncing, permissionError, expandedNoteId, toggleExpandNote,
            shoppingList, newShopName, addShop, removeShop, addItemToShop, removeItem, toggleItem, toggleShop,
            isExporting, exportToPDF // 開放匯出函式
        };
    }
}).mount('#app');
