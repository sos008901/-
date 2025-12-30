// --- 核心資料與禁止縮放 ---
document.addEventListener('touchstart', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
    let now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
}, false);
document.addEventListener('gesturestart', (e) => e.preventDefault());

let itineraryData = JSON.parse(localStorage.getItem('itineraryData')) || [];
let activeDates = JSON.parse(localStorage.getItem('activeDates')) || [];
let currentSelectedDate = localStorage.getItem('lastSelectedDate') || "";

window.onload = () => {
    if (activeDates.length > 0 && !currentSelectedDate) currentSelectedDate = activeDates[0];
    renderDateTabs();
    renderDailyList();
    initDragDrop();
    initSwipeToClose();
};

// --- 行程渲染 (匹配 IMG_2142 結構) ---
function renderDailyList() {
    const list = document.getElementById('daily-list');
    list.innerHTML = '';
    if (!currentSelectedDate) return;

    const items = itineraryData.filter(item => item.date === currentSelectedDate);
    
    items.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'itinerary-card';
        card.dataset.id = item.id;
        card.onclick = () => openForm('edit', item.id); // 點擊卡片任何地方開啟編輯
        
        card.innerHTML = `
            <div class="drag-handle"><span class="material-icons-outlined">drag_indicator</span></div>
            <div class="card-time">${item.time || '--:--'}</div>
            <div class="card-content">
                <h3>${item.title}</h3>
                ${item.link ? `
                    <div class="card-info-item">
                        <span class="material-icons-outlined">place</span>
                        <a href="${item.link}" target="_blank" onclick="event.stopPropagation()">${item.link}</a>
                    </div>
                ` : ''}
                ${item.note ? `
                    <div class="card-info-item">
                        <span class="material-icons-outlined">sticky_note_2</span>
                        <p>${item.note}</p>
                    </div>
                ` : ''}
            </div>
        `;
        list.appendChild(card);
    });
}

// --- 拖拽功能 ---
function initDragDrop() {
    const el = document.getElementById('daily-list');
    Sortable.create(el, {
        handle: '.drag-handle', animation: 250, ghostClass: 'sortable-ghost',
        onEnd: function () {
            const newOrderIds = Array.from(el.querySelectorAll('.itinerary-card')).map(card => parseInt(card.dataset.id));
            const otherDates = itineraryData.filter(i => i.date !== currentSelectedDate);
            const thisDate = newOrderIds.map(id => itineraryData.find(i => i.id === id)).filter(Boolean);
            itineraryData = [...otherDates, ...thisDate];
            localStorage.setItem('itineraryData', JSON.stringify(itineraryData));
        }
    });
}

// --- 日期導覽渲染 ---
function renderDateTabs() {
    const nav = document.getElementById('date-navigator');
    nav.innerHTML = '';
    activeDates.forEach((dateStr, index) => {
        let dateObj = new Date(dateStr);
        const div = document.createElement('div');
        div.className = `date-item ${dateStr === currentSelectedDate ? 'active' : ''}`;
        div.onclick = () => { currentSelectedDate = dateStr; saveAndRefresh(); };
        div.innerHTML = `<span>DAY ${index + 1}</span><strong>${(dateObj.getMonth()+1)}/${dateObj.getDate()}</strong>`;
        nav.appendChild(div);
    });
}

// --- 介面管理 ---
function showTab(tabId, el) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (el) el.classList.add('active');
    document.getElementById('floating-add-btn').style.display = (tabId === 'itinerary') ? 'flex' : 'none';
}

function openForm(mode, id = null) {
    if (!currentSelectedDate && mode === 'add') return;
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('bottom-drawer').style.transform = 'translateY(0)';
    const delBtn = document.getElementById('btn-delete-item');
    
    if (mode === 'edit') {
        const item = itineraryData.find(i => i.id === id);
        document.getElementById('edit-id').value = item.id;
        document.getElementById('itemDate').value = item.date;
        document.getElementById('itemTime').value = item.time;
        document.getElementById('itemTitle').value = item.title;
        document.getElementById('itemNote').value = item.note;
        document.getElementById('itemLink').value = item.link;
        delBtn.style.display = 'block';
    } else {
        document.getElementById('edit-id').value = "";
        document.getElementById('itemDate').value = currentSelectedDate;
        document.getElementById('itemTime').value = "";
        document.getElementById('itemTitle').value = "";
        document.getElementById('itemNote').value = "";
        document.getElementById('itemLink').value = "";
        delBtn.style.display = 'none';
    }
}

function handleSave() {
    const title = document.getElementById('itemTitle').value;
    const editId = document.getElementById('edit-id').value;
    if (!title) return;
    const data = { id: editId ? parseInt(editId) : Date.now(), date: document.getElementById('itemDate').value, time: document.getElementById('itemTime').value, title, note: document.getElementById('itemNote').value, link: document.getElementById('itemLink').value };
    if (editId) { const idx = itineraryData.findIndex(i => i.id === data.id); itineraryData[idx] = data; }
    else { itineraryData.push(data); }
    saveAndRefresh();
    closeForm();
}

function saveAndRefresh() {
    localStorage.setItem('activeDates', JSON.stringify(activeDates));
    localStorage.setItem('itineraryData', JSON.stringify(itineraryData));
    localStorage.setItem('lastSelectedDate', currentSelectedDate);
    renderDateTabs();
    renderDailyList();
}

function closeForm() { 
    document.getElementById('bottom-drawer').style.transform = 'translateY(100%)';
    setTimeout(() => { document.getElementById('modal-overlay').style.display = 'none'; }, 250);
}

function addNewDay() {
    let next;
    if (activeDates.length === 0) next = new Date().toISOString().split('T')[0];
    else {
        let last = new Date(activeDates[activeDates.length - 1]);
        last.setDate(last.getDate() + 1);
        next = last.toISOString().split('T')[0];
    }
    activeDates.push(next);
    currentSelectedDate = next;
    saveAndRefresh();
}

function deleteCurrentDay() {
    if (!confirm("確定移除這天？")) return;
    itineraryData = itineraryData.filter(i => i.date !== currentSelectedDate);
    activeDates = activeDates.filter(d => d !== currentSelectedDate);
    currentSelectedDate = activeDates.length > 0 ? activeDates[0] : "";
    saveAndRefresh();
}

function handleDeleteItem() {
    const id = parseInt(document.getElementById('edit-id').value);
    itineraryData = itineraryData.filter(i => i.id !== id);
    saveAndRefresh();
    closeForm();
}

function calculateBill() {
    const a = document.getElementById('billAmount').value;
    const p = document.getElementById('billPeople').value;
    if (a > 0 && p > 0) document.getElementById('billResultText').innerText = `Result: $ ${Math.ceil(a/p)}`;
}

function saveNote() { localStorage.setItem('travelNote', document.getElementById('noteInput').value); alert("Saved!"); }

function initSwipeToClose() {
    const swipeBar = document.getElementById('swipe-bar');
    const drawer = document.getElementById('bottom-drawer');
    let startY = 0;
    swipeBar.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; });
    swipeBar.addEventListener('touchmove', (e) => {
        let deltaY = e.touches[0].clientY - startY;
        if (deltaY > 0) drawer.style.transform = `translateY(${deltaY}px)`;
    });
    swipeBar.addEventListener('touchend', (e) => { if (e.changedTouches[0].clientY - startY > 100) closeForm(); drawer.style.transform = `translateY(0)`; });
}

function addItem(type) {
    const input = document.getElementById('shoppingInput');
    const list = document.getElementById('shoppingList');
    if (!input.value.trim()) return;
    const li = document.createElement('li');
    li.style = "padding:15px 0; border-bottom:1px solid #EEE; display:flex; justify-content:space-between; font-size:14px;";
    li.innerHTML = `<span>${input.value}</span><span style="color:#C66" onclick="this.parentElement.remove()">remove</span>`;
    list.appendChild(li);
    input.value = '';
}
