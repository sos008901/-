// --- 核心資料邏輯 ---
let itineraryData = JSON.parse(localStorage.getItem('itineraryData')) || [];
let activeDates = JSON.parse(localStorage.getItem('activeDates')) || [];
let currentSelectedDate = localStorage.getItem('lastSelectedDate') || "";

const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

window.onload = () => {
    if (activeDates.length > 0 && !currentSelectedDate) {
        currentSelectedDate = activeDates[0];
    }
    renderDateTabs();
    renderDailyList();
    document.getElementById('noteInput').value = localStorage.getItem('travelNote') || "";
};

// --- 天數與行程管理 ---

function addNewDay() {
    let nextDate;
    if (activeDates.length === 0) {
        nextDate = new Date().toISOString().split('T')[0];
    } else {
        let lastDate = new Date(activeDates[activeDates.length - 1]);
        lastDate.setDate(lastDate.getDate() + 1);
        nextDate = lastDate.toISOString().split('T')[0];
    }
    activeDates.push(nextDate);
    currentSelectedDate = nextDate;
    saveAndRefresh();
}

function deleteCurrentDay() {
    if (!confirm("確定要移除這天的所有規劃嗎？此動作不可復原。")) return;
    itineraryData = itineraryData.filter(item => item.date !== currentSelectedDate);
    activeDates = activeDates.filter(d => d !== currentSelectedDate);
    currentSelectedDate = activeDates.length > 0 ? activeDates[0] : "";
    saveAndRefresh();
}

function saveAndRefresh() {
    localStorage.setItem('activeDates', JSON.stringify(activeDates));
    localStorage.setItem('itineraryData', JSON.stringify(itineraryData));
    localStorage.setItem('lastSelectedDate', currentSelectedDate);
    renderDateTabs();
    renderDailyList();
}

// --- 介面渲染 ---

function renderDateTabs() {
    const nav = document.getElementById('date-navigator');
    nav.innerHTML = '';
    activeDates.forEach(dateStr => {
        let dateObj = new Date(dateStr);
        const div = document.createElement('div');
        div.className = `date-item ${dateStr === currentSelectedDate ? 'active' : ''}`;
        div.onclick = () => {
            currentSelectedDate = dateStr;
            saveAndRefresh();
        };
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
        dateTitle.innerText = "尚未開啟旅程天數";
        deleteBtn.style.display = "none";
        return;
    }

    dateTitle.innerText = `${currentSelectedDate}`;
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
                <div class="card-action" style="margin-top:12px; display:flex; gap:10px;">
                    ${item.link ? `<a href="${item.link}" target="_blank" class="btn-small-ui">地點</a>` : ''}
                    <span class="btn-small-ui delete" onclick="deleteItem(${item.id})">移除</span>
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

// --- 表單與切換 ---

function toggleAddForm() {
    if (!currentSelectedDate) return alert("請先新增旅遊天數");
    const modal = document.getElementById('add-form');
    modal.style.display = modal.style.display === 'none' ? 'flex' : 'none';
    document.getElementById('itemDate').value = currentSelectedDate;
}

function saveItinerary() {
    const title = document.getElementById('itemTitle').value;
    if (!title) return alert("請填寫行程名稱");
    
    itineraryData.push({
        id: Date.now(),
        date: document.getElementById('itemDate').value,
        time: document.getElementById('itemTime').value,
        title: title,
        note: document.getElementById('itemNote').value,
        link: document.getElementById('itemLink').value
    });
    toggleAddForm();
    saveAndRefresh();
}

function deleteItem(id) {
    itineraryData = itineraryData.filter(item => item.id !== id);
    saveAndRefresh();
}

function showTab(tabId, el) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if(el) el.classList.add('active');
}

function calculateBill() {
    const amount = document.getElementById('billAmount').value;
    const people = document.getElementById('billPeople').value;
    if (amount > 0 && people > 0) {
        document.getElementById('billResultText').innerText = `平均每人：$ ${Math.ceil(amount / people)}`;
    }
}

function saveNote() {
    localStorage.setItem('travelNote', document.getElementById('noteInput').value);
    alert("內容已存入手機");
}
