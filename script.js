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

// --- 表單控制 ---

function openAddForm() {
    if (!currentSelectedDate) return alert("請先新增旅遊天數");
    document.getElementById('form-title').innerText = "新增行程";
    document.getElementById('edit-id').value = ""; // 清空 ID 代表新增
    document.getElementById('itemDate').value = currentSelectedDate;
    document.getElementById('itemTime').value = "";
    document.getElementById('itemTitle').value = "";
    document.getElementById('itemNote').value = "";
    document.getElementById('itemLink').value = "";
    document.getElementById('modal-overlay').style.display = 'flex';
}

function editItem(id) {
    const item = itineraryData.find(i => i.id === id);
    if (!item) return;
    
    document.getElementById('form-title').innerText = "編輯行程";
    document.getElementById('edit-id').value = item.id;
    document.getElementById('itemDate').value = item.date;
    document.getElementById('itemTime').value = item.time;
    document.getElementById('itemTitle').value = item.title;
    document.getElementById('itemNote').value = item.note;
    document.getElementById('itemLink').value = item.link;
    document.getElementById('modal-overlay').style.display = 'flex';
}

function closeForm() {
    document.getElementById('modal-overlay').style.display = 'none';
}

function handleSave() {
    const title = document.getElementById('itemTitle').value;
    const editId = document.getElementById('edit-id').value;
    if (!title) return alert("請填寫景點名稱");

    const data = {
        id: editId ? parseInt(editId) : Date.now(),
        date: document.getElementById('itemDate').value,
        time: document.getElementById('itemTime').value,
        title: title,
        note: document.getElementById('itemNote').value,
        link: document.getElementById('itemLink').value
    };

    if (editId) {
        // 編輯模式：替換舊資料
        const index = itineraryData.findIndex(i => i.id === data.id);
        itineraryData[index] = data;
    } else {
        // 新增模式
        itineraryData.push(data);
    }

    saveAndRefresh();
    closeForm();
}

// --- 資料與渲染 ---

function saveAndRefresh() {
    localStorage.setItem('activeDates', JSON.stringify(activeDates));
    localStorage.setItem('itineraryData', JSON.stringify(itineraryData));
    localStorage.setItem('lastSelectedDate', currentSelectedDate);
    renderDateTabs();
    renderDailyList();
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

function renderDailyList() {
    const list = document.getElementById('daily-list');
    const dateTitle = document.getElementById('current-view-date');
    const deleteBtn = document.getElementById('delete-day-btn');
    list.innerHTML = '';

    if (!currentSelectedDate) {
        dateTitle.innerText = "尚未開啟天數";
        deleteBtn.style.display = "none";
        return;
    }

    dateTitle.innerText = currentSelectedDate;
    deleteBtn.style.display = "flex";

    const items = itineraryData
        .filter(item => item.date === currentSelectedDate)
        .sort((a, b) => (a.time > b.time ? 1 : -1));

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'itinerary-card';
        card.innerHTML = `
            <div class="card-time">${item.time || '--:--'}</div>
            <div class="card-content">
                <h3>${item.title}</h3>
                ${item.note ? `<p>${item.note}</p>` : ''}
                <div class="card-btns">
                    <span class="btn-small" onclick="editItem(${item.id})">編輯</span>
                    ${item.link ? `<a href="${item.link}" target="_blank" class="btn-small">地點</a>` : ''}
                    <span class="btn-small" style="color:#C66" onclick="deleteItem(${item.id})">移除</span>
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

// --- 輔助功能 ---

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
    if (!confirm("確定要移除此行程？")) return;
    itineraryData = itineraryData.filter(i => i.id !== id);
    saveAndRefresh();
}

function showTab(tabId, el) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if(el) el.classList.add('active');
}

function calculateBill() {
    const a = document.getElementById('billAmount').value;
    const p = document.getElementById('billPeople').value;
    if (a > 0 && p > 0) document.getElementById('billResultText').innerText = `平均：$ ${Math.ceil(a/p)}`;
}

function saveNote() {
    localStorage.setItem('travelNote', document.getElementById('noteInput').value);
    alert("內容已存檔");
}
