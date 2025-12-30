// 資料儲存
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

// --- 天數管理功能 ---

// 1. 新增一天
function addNewDay() {
    let nextDate;
    if (activeDates.length === 0) {
        // 如果還沒有任何日期，就從今天開始
        nextDate = new Date().toISOString().split('T')[0];
    } else {
        // 從最後一天往後加一天
        let lastDate = new Date(activeDates[activeDates.length - 1]);
        lastDate.setDate(lastDate.getDate() + 1);
        nextDate = lastDate.toISOString().split('T')[0];
    }
    
    activeDates.push(nextDate);
    currentSelectedDate = nextDate;
    saveAndRefresh();
}

// 2. 刪除當前選中的整天行程
function deleteCurrentDay() {
    if (!currentSelectedDate) return;
    if (!confirm(`確定要刪除 ${currentSelectedDate} 的所有行程與天數嗎？`)) return;

    // 刪除該天的所有行程項目
    itineraryData = itineraryData.filter(item => item.date !== currentSelectedDate);
    // 從日期清單中移除
    activeDates = activeDates.filter(d => d !== currentSelectedDate);
    
    // 選中剩下的第一天，或清空
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

// --- 介面渲染功能 ---

function renderDateTabs() {
    const nav = document.getElementById('date-navigator');
    nav.innerHTML = '';
    
    activeDates.forEach(dateStr => {
        let dateObj = new Date(dateStr);
        let displayDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
        let dayName = weekdays[dateObj.getDay()];
        
        const div = document.createElement('div');
        div.className = `date-item ${dateStr === currentSelectedDate ? 'active' : ''}`;
        div.onclick = () => {
            currentSelectedDate = dateStr;
            localStorage.setItem('lastSelectedDate', dateStr);
            renderDateTabs();
            renderDailyList();
        };
        div.innerHTML = `<strong>${displayDate}</strong><span>${dayName}</span>`;
        nav.appendChild(div);
    });
}

function renderDailyList() {
    const list = document.getElementById('daily-list');
    const dateTitle = document.getElementById('current-view-date');
    const deleteLink = document.getElementById('delete-day-link');
    list.innerHTML = '';

    if (!currentSelectedDate) {
        dateTitle.innerText = "尚未加入天數";
        deleteLink.style.display = "none";
        list.innerHTML = '<p style="text-align:center; color:#AAA; margin-top:40px;">請點擊上方「+ 新增天數」開始規劃</p>';
        return;
    }

    dateTitle.innerText = `${currentSelectedDate} 行程`;
    deleteLink.style.display = "block";

    const items = itineraryData
        .filter(item => item.date === currentSelectedDate)
        .sort((a, b) => (a.time > b.time ? 1 : -1));

    if (items.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#AAA; margin-top:30px;">今日尚無行程，點擊「+」新增行程</p>';
    } else {
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'itinerary-card';
            card.innerHTML = `
                <div class="card-time">${item.time || '--:--'}</div>
                <div class="card-content">
                    <h3>${item.title}</h3>
                    ${item.note ? `<p>${item.note}</p>` : ''}
                    <div class="card-action">
                        ${item.link ? `<a href="${item.link}" target="_blank" class="btn-small">地點/連結</a>` : ''}
                        <span class="btn-small" style="color:#C66" onclick="deleteItem(${item.id})">移除行程</span>
                    </div>
                </div>
            `;
            list.appendChild(card);
        });
    }
}

// --- 其他功能 ---

function toggleAddForm() {
    if (!currentSelectedDate) return alert("請先新增天數後再加入行程");
    const form = document.getElementById('add-form');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    document.getElementById('itemDate').value = currentSelectedDate;
}

function saveItinerary() {
    const title = document.getElementById('itemTitle').value;
    if (!title) return alert("請輸入行程名稱");
    
    const newItem = {
        id: Date.now(),
        date: document.getElementById('itemDate').value,
        time: document.getElementById('itemTime').value,
        title: title,
        note: document.getElementById('itemNote').value,
        link: document.getElementById('itemLink').value
    };

    itineraryData.push(newItem);
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
    document.getElementById('noteStatus').innerText = "✅ 已儲存";
    setTimeout(() => document.getElementById('noteStatus').innerText = "", 2000);
}
