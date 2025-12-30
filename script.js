// --- 資料持久化 ---
let itineraryData = JSON.parse(localStorage.getItem('itineraryData')) || [];
let activeDates = JSON.parse(localStorage.getItem('activeDates')) || [];
let currentSelectedDate = localStorage.getItem('lastSelectedDate') || "";

const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

window.onload = () => {
    if (activeDates.length > 0 && !currentSelectedDate) currentSelectedDate = activeDates[0];
    renderDateTabs();
    renderDailyList();
    document.getElementById('noteInput').value = localStorage.getItem('travelNote') || "";
};

// --- 分頁隔離功能 ---
function showTab(tabId, el) {
    const allTabs = document.querySelectorAll('.tab-content');
    allTabs.forEach(tab => tab.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    const allBtns = document.querySelectorAll('.nav-btn');
    allBtns.forEach(btn => btn.classList.remove('active'));
    if (el) el.classList.add('active');
    
    document.getElementById('scroll-area').scrollTop = 0;
}

// --- 表單控制 ---
function openForm(mode, id = null) {
    if (!currentSelectedDate && mode === 'add') return alert("請先新增旅遊天數");
    document.getElementById('modal-overlay').style.display = 'flex';
    const title = document.getElementById('form-title');
    const editIdInput = document.getElementById('edit-id');
    
    if (mode === 'edit') {
        const item = itineraryData.find(i => i.id === id);
        title.innerText = "編輯行程內容";
        editIdInput.value = item.id;
        document.getElementById('itemDate').value = item.date;
        document.getElementById('itemTime').value = item.time;
        document.getElementById('itemTitle').value = item.title;
        document.getElementById('itemNote').value = item.note;
        document.getElementById('itemLink').value = item.link;
    } else {
        title.innerText = "新增行程項目";
        editIdInput.value = "";
        document.getElementById('itemDate').value = currentSelectedDate;
        document.getElementById('itemTime').value = "";
        document.getElementById('itemTitle').value = "";
        document.getElementById('itemNote').value = "";
        document.getElementById('itemLink').value = "";
    }
}

function closeForm() {
    document.getElementById('modal-overlay').style.display = 'none';
}

function handleSave() {
    const title = document.getElementById('itemTitle').value;
    const editId = document.getElementById('edit-id').value;
    if (!title) return alert("請填寫地點名稱");

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

// --- 渲染與拖拽邏輯 ---
function saveAndRefresh() {
    localStorage.setItem('activeDates', JSON.stringify(activeDates));
    localStorage.setItem('itineraryData', JSON.stringify(itineraryData));
    localStorage.setItem('lastSelectedDate', currentSelectedDate);
    renderDateTabs();
    renderDailyList();
}

function renderDailyList() {
    const list = document.getElementById('daily-list');
    const dateTitle = document.getElementById('current-view-date');
    const deleteBtn = document.getElementById('delete-day-btn');
    list.innerHTML = '';

    if (!currentSelectedDate) {
        dateTitle.innerText = "尚未開啟";
        deleteBtn.style.display = "none";
        return;
    }

    dateTitle.innerText = currentSelectedDate;
    deleteBtn.style.display = "flex";

    const items = itineraryData.filter(item => item.date === currentSelectedDate);

    items.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'itinerary-card';
        card.draggable = true; // 開啟拖拽
        card.dataset.id = item.id;
        
        // 綁定拖拽事件
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('drop', handleDrop);
        card.addEventListener('dragend', handleDragEnd);

        card.innerHTML = `
            <div class="card-time">${item.time || '--:--'}</div>
            <div class="card-content">
                <h3>${item.title}</h3>
                ${item.note ? `<p>${item.note}</p>` : ''}
                <div class="card-btns">
                    <span class="btn-mini" onclick="openForm('edit', ${item.id})">編輯</span>
                    ${item.link ? `<a href="${item.link}" target="_blank" class="btn-mini">地點</a>` : ''}
                    <span class="btn-mini" style="color:#C66" onclick="deleteItem(${item.id})">移除</span>
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

// --- 拖拽核心功能 ---
let draggedId = null;

function handleDragStart(e) {
    draggedId = this.dataset.id;
    this.classList.add('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDrop(e) {
    e.preventDefault();
    const targetId = this.dataset.id;
    if (draggedId === targetId) return;

    const draggedIndex = itineraryData.findIndex(i => i.id == draggedId);
    const targetIndex = itineraryData.findIndex(i => i.id == targetId);

    // 在陣列中交換位置
    const [removed] = itineraryData.splice(draggedIndex, 1);
    itineraryData.splice(targetIndex, 0, removed);

    saveAndRefresh();
}

function handleDragEnd() {
    this.classList.remove('dragging');
}

// --- 其他功能 ---
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
