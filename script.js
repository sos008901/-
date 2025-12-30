// --- 核心安全防護：禁止縮放 ---
document.addEventListener('touchstart', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
let lastEnd = 0;
document.addEventListener('touchend', (e) => {
    let now = Date.now();
    if (now - lastEnd <= 300) e.preventDefault();
    lastEnd = now;
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
    initSwipeClose();
};

// --- 行程渲染：復刻 IMG_2142 結構 ---
function renderDailyList() {
    const list = document.getElementById('daily-list');
    list.innerHTML = '';
    if (!currentSelectedDate) return;

    const items = itineraryData.filter(item => item.date === currentSelectedDate);
    
    items.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'itinerary-card';
        card.dataset.id = item.id;
        card.onclick = () => openForm('edit', item.id);
        
        card.innerHTML = `
            <div class="drag-handle"><span class="material-icons-outlined">drag_indicator</span></div>
            <div class="card-time">${item.time || '--:--'}</div>
            <div class="card-body">
                <h3>${item.title}</h3>
                ${item.link ? `<div class="card-info"><span class="material-icons-outlined">place</span><a href="${item.link}" target="_blank" onclick="event.stopPropagation()">${item.link}</a></div>` : ''}
                ${item.note ? `<div class="card-info"><span class="material-icons-outlined">sticky_note_2</span><p>${item.note}</p></div>` : ''}
            </div>
        `;
        list.appendChild(card);
    });
}

function initDragDrop() {
    Sortable.create(document.getElementById('daily-list'), {
        handle: '.drag-handle', animation: 250,
        onEnd: function () {
            const newIds = Array.from(document.querySelectorAll('.itinerary-card')).map(c => parseInt(c.dataset.id));
            const others = itineraryData.filter(i => i.date !== currentSelectedDate);
            const sorted = newIds.map(id => itineraryData.find(i => i.id === id)).filter(Boolean);
            itineraryData = [...others, ...sorted];
            localStorage.setItem('itineraryData', JSON.stringify(itineraryData));
        }
    });
}

// --- 日期管理 ---
function renderDateTabs() {
    const nav = document.getElementById('date-navigator');
    nav.innerHTML = '';
    activeDates.forEach((dateStr, idx) => {
        let d = new Date(dateStr);
        const div = document.createElement('div');
        div.className = `date-item ${dateStr === currentSelectedDate ? 'active' : ''}`;
        div.onclick = () => { currentSelectedDate = dateStr; saveRefresh(); };
        div.innerHTML = `<span>DAY ${idx+1}</span><strong>${d.getMonth()+1}/${d.getDate()}</strong>`;
        nav.appendChild(div);
    });
}

function addNewDay() {
    let next;
    if (activeDates.length === 0) next = new Date().toISOString().split('T')[0];
    else {
        let last = new Date(activeDates[activeDates.length-1]);
        last.setDate(last.getDate()+1);
        next = last.toISOString().split('T')[0];
    }
    activeDates.push(next);
    currentSelectedDate = next;
    saveRefresh();
}

function deleteCurrentDay() {
    if (!confirm("確定移除這天？")) return;
    itineraryData = itineraryData.filter(i => i.date !== currentSelectedDate);
    activeDates = activeDates.filter(d => d !== currentSelectedDate);
    currentSelectedDate = activeDates.length > 0 ? activeDates[0] : "";
    saveRefresh();
}

// --- 表單邏輯 ---
function openForm(mode, id = null) {
    if (!currentSelectedDate && mode === 'add') return;
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('bottom-drawer').style.transform = 'translateY(0)';
    
    if (mode === 'edit') {
        const i = itineraryData.find(x => x.id === id);
        document.getElementById('edit-id').value = i.id;
        document.getElementById('itemDate').value = i.date;
        document.getElementById('itemTime').value = i.time;
        document.getElementById('itemTitle').value = i.title;
        document.getElementById('itemNote').value = i.note;
        document.getElementById('itemLink').value = i.link;
        document.getElementById('btn-delete-item').style.display = 'block';
    } else {
        document.getElementById('edit-id').value = "";
        document.getElementById('itemDate').value = currentSelectedDate;
        document.getElementById('itemTime').value = "";
        document.getElementById('itemTitle').value = "";
        document.getElementById('itemNote').value = "";
        document.getElementById('itemLink').value = "";
        document.getElementById('btn-delete-item').style.display = 'none';
    }
}

function handleSave() {
    const title = document.getElementById('itemTitle').value;
    const editId = document.getElementById('edit-id').value;
    if (!title) return;
    const data = { id: editId ? parseInt(editId) : Date.now(), date: document.getElementById('itemDate').value, time: document.getElementById('itemTime').value, title, note: document.getElementById('itemNote').value, link: document.getElementById('itemLink').value };
    if (editId) {
        const idx = itineraryData.findIndex(x => x.id === data.id);
        itineraryData[idx] = data;
    } else { itineraryData.push(data); }
    saveRefresh();
    closeForm();
}

function handleDeleteItem() {
    const id = parseInt(document.getElementById('edit-id').value);
    itineraryData = itineraryData.filter(x => x.id !== id);
    saveRefresh();
    closeForm();
}

function closeForm() {
    document.getElementById('bottom-drawer').style.transform = 'translateY(100%)';
    setTimeout(() => { document.getElementById('modal-overlay').style.display = 'none'; }, 250);
}

function saveRefresh() {
    localStorage.setItem('activeDates', JSON.stringify(activeDates));
    localStorage.setItem('itineraryData', JSON.stringify(itineraryData));
    localStorage.setItem('lastSelectedDate', currentSelectedDate);
    renderDateTabs();
    renderDailyList();
}

function showTab(tabId, el) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('floating-add-btn').style.display = (tabId === 'itinerary') ? 'flex' : 'none';
}

function initSwipeClose() {
    const bar = document.getElementById('swipe-bar');
    const drawer = document.getElementById('bottom-drawer');
    let startY = 0;
    bar.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; });
    bar.addEventListener('touchmove', (e) => {
        let dy = e.touches[0].clientY - startY;
        if (dy > 0) drawer.style.transform = `translateY(${dy}px)`;
    });
    bar.addEventListener('touchend', (e) => {
        if (e.changedTouches[0].clientY - startY > 100) closeForm();
        else drawer.style.transform = `translateY(0)`;
    });
}

function calculateBill() {
    const a = document.getElementById('billAmount').value;
    const p = document.getElementById('billPeople').value;
    if (a > 0 && p > 0) document.getElementById('billResultText').innerText = `$ ${Math.ceil(a/p)}`;
}

function saveNote() { localStorage.setItem('travelNote', document.getElementById('noteInput').value); alert("Saved!"); }
