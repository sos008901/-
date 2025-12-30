let itineraryData = JSON.parse(localStorage.getItem('itineraryData')) || [];
let activeDates = JSON.parse(localStorage.getItem('activeDates')) || [];
let currentSelectedDate = localStorage.getItem('lastSelectedDate') || "";

const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

window.onload = () => {
    if (activeDates.length > 0 && !currentSelectedDate) currentSelectedDate = activeDates[0];
    renderDateTabs();
    renderDailyList();
    initDragDrop();
    initSwipeToClose(); // 初始化下滑關閉
    document.getElementById('noteInput').value = localStorage.getItem('travelNote') || "";
};

// --- 修正：拖拽手柄功能 ---
function initDragDrop() {
    const el = document.getElementById('daily-list');
    Sortable.create(el, {
        handle: '.drag-handle', // 只有點擊手柄才能拖動
        animation: 200,
        ghostClass: 'sortable-ghost',
        onEnd: function () {
            const newOrderIds = Array.from(el.querySelectorAll('.itinerary-card')).map(card => parseInt(card.dataset.id));
            const otherDatesData = itineraryData.filter(i => i.date !== currentSelectedDate);
            const thisDateData = newOrderIds.map(id => itineraryData.find(i => i.id === id)).filter(Boolean);
            itineraryData = [...otherDatesData, ...thisDateData];
            localStorage.setItem('itineraryData', JSON.stringify(itineraryData));
        }
    });
}

// --- 智能：下滑關閉功能 ---
function initSwipeToClose() {
    const swipeBar = document.getElementById('swipe-bar');
    const drawer = document.getElementById('bottom-drawer');
    let startY = 0;

    swipeBar.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
    });

    swipeBar.addEventListener('touchmove', (e) => {
        let deltaY = e.touches[0].clientY - startY;
        if (deltaY > 0) {
            drawer.style.transform = `translateY(${deltaY}px)`;
        }
    });

    swipeBar.addEventListener('touchend', (e) => {
        let deltaY = e.changedTouches[0].clientY - startY;
        if (deltaY > 80) { // 下拉超過 80px 就關閉
            closeForm();
        }
        drawer.style.transform = `translateY(0)`; // 回彈
    });
}

// --- 渲染功能 ---
function renderDailyList() {
    const list = document.getElementById('daily-list');
    const dateTitle = document.getElementById('current-view-date');
    const deleteBtn = document.getElementById('delete-day-btn');
    list.innerHTML = '';

    if (!currentSelectedDate) {
        dateTitle.innerText = "開始規劃";
        deleteBtn.style.display = "none";
        return;
    }

    dateTitle.innerText = currentSelectedDate;
    deleteBtn.style.display = "flex";

    const items = itineraryData.filter(item => item.date === currentSelectedDate);

    items.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'itinerary-card';
        card.dataset.id = item.id;
        card.innerHTML = `
            <div class="drag-handle">
                <span class="material-icons-round">drag_indicator</span>
            </div>
            <div class="card-time">${item.time || '--:--'}</div>
            <div class="card-content">
                <h3>${item.title}</h3>
                ${item.note ? `<p>${item.note}</p>` : ''}
                <div class="card-actions">
                    <span class="btn-m" onclick="openForm('edit', ${item.id})">編輯</span>
                    ${item.link ? `<a href="${item.link}" target="_blank" class="btn-m">地點</a>` : ''}
                    <span class="btn-m" style="color:#C66" onclick="deleteItem(${item.id})">移除</span>
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

// --- 核心邏輯維持 ---
function showTab(tabId, el) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (el) el.classList.add('active');
}

function openForm(mode, id = null) {
    if (!currentSelectedDate && mode === 'add') return alert("請先新增天數");
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('bottom-drawer').style.transform = 'translateY(0)';
    const editIdInput = document.getElementById('edit-id');
    
    if (mode === 'edit') {
        const item = itineraryData.find(i => i.id === id);
        editIdInput.value = item.id;
        document.getElementById('itemDate').value = item.date;
        document.getElementById('itemTime').value = item.time;
        document.getElementById('itemTitle').value = item.title;
        document.getElementById('itemNote').value = item.note;
        document.getElementById('itemLink').value = item.link;
    } else {
        editIdInput.value = "";
        document.getElementById('itemDate').value = currentSelectedDate;
        document.getElementById('itemTime').value = "";
        document.getElementById('itemTitle').value = "";
        document.getElementById('itemNote').value = "";
        document.getElementById('itemLink').value = "";
    }
}

function handleSave() {
    const title = document.getElementById('itemTitle').value;
    const editId = document.getElementById('edit-id').value;
    if (!title) return alert("請輸入行程名稱");

    const data = {
        id: editId ? parseInt(editId) : Date.now(),
        date: document.getElementById('itemDate').value,
        time: document.getElementById('itemTime').value,
        title: title,
        note: document.getElementById('itemNote').value,
        link: document.getElementById('itemLink').value
    };

    if (editId) {
        const idx = itineraryData.findIndex(i => i.id === data.id);
        itineraryData[idx] = data;
    } else {
        itineraryData.push(data);
    }

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
    setTimeout(() => {
        document.getElementById('modal-overlay').style.display = 'none';
    }, 200);
}

function renderDateTabs() {
    const nav = document.getElementById('date-navigator');
    nav.innerHTML = '';
    activeDates.forEach(dateStr => {
        let dateObj = new Date(dateStr);
        const div = document.createElement('div');
        div.className = `date-item ${dateStr === currentSelectedDate ? 'active' : ''}`;
        div.onclick = () => { currentSelectedDate = dateStr; saveAndRefresh(); };
        div.innerHTML = `<strong>${dateObj.getDate()}</strong><span>${weekdays[dateObj.getDay()]}</span>`;
        nav.appendChild(div);
    });
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
    if (!confirm("確定要移除整天的規劃嗎？")) return;
    itineraryData = itineraryData.filter(i => i.date !== currentSelectedDate);
    activeDates = activeDates.filter(d => d !== currentSelectedDate);
    currentSelectedDate = activeDates.length > 0 ? activeDates[0] : "";
    saveAndRefresh();
}

function deleteItem(id) {
    if (!confirm("移除行程？")) return;
    itineraryData = itineraryData.filter(i => i.id !== id);
    saveAndRefresh();
}

function calculateBill() {
    const a = document.getElementById('billAmount').value;
    const p = document.getElementById('billPeople').value;
    if (a > 0 && p > 0) document.getElementById('billResultText').innerText = `平均每人：$ ${Math.ceil(a/p)}`;
}

function saveNote() {
    localStorage.setItem('travelNote', document.getElementById('noteInput').value);
    alert("儲存成功");
}

function addItem(type) {
    const input = document.getElementById('shoppingInput');
    const list = document.getElementById('shoppingList');
    if (!input.value.trim()) return;
    const li = document.createElement('li');
    li.style = "background:white; padding:15px; margin-bottom:10px; border-radius:12px; display:flex; justify-content:space-between; border:1px solid #EEE;";
    li.innerHTML = `<span>${input.value}</span><span style="color:#C66" onclick="this.parentElement.remove()">移除</span>`;
    list.appendChild(li);
    input.value = '';
}
