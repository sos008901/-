// 全域狀態：儲存所有行程與當前選擇日期
let itineraryData = JSON.parse(localStorage.getItem('itineraryData')) || [];
let currentSelectedDate = new Date().toISOString().split('T')[0];

// 初始化
window.onload = () => {
    generateDateTabs();
    renderDailyList();
    document.getElementById('noteInput').value = localStorage.getItem('travelNote') || "";
};

// 1. 生成頂部日期切換標籤 (顯示今天前後 7 天作為範例)
function generateDateTabs() {
    const nav = document.getElementById('date-navigator');
    nav.innerHTML = '';
    const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    
    for (let i = -2; i < 7; i++) {
        let date = new Date();
        date.setDate(date.getDate() + i);
        let dateStr = date.toISOString().split('T')[0];
        let dayName = weekdays[date.getDay()];
        let displayDate = `${date.getMonth() + 1}/${date.getDate()}`;
        
        const div = document.createElement('div');
        div.className = `date-item ${dateStr === currentSelectedDate ? 'active' : ''}`;
        div.onclick = () => {
            currentSelectedDate = dateStr;
            generateDateTabs();
            renderDailyList();
        };
        div.innerHTML = `<strong>${displayDate}</strong><span>${dayName}</span>`;
        nav.appendChild(div);
    }
}

// 2. 切換新增表單顯示
function toggleAddForm() {
    const form = document.getElementById('add-form');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    document.getElementById('itemDate').value = currentSelectedDate;
}

// 3. 儲存行程
function saveItinerary() {
    const date = document.getElementById('itemDate').value;
    const time = document.getElementById('itemTime').value;
    const title = document.getElementById('itemTitle').value;
    const note = document.getElementById('itemNote').value;
    const link = document.getElementById('itemLink').value;

    if (!date || !title) return alert("請至少輸入日期與行程名稱");

    const newItem = { id: Date.now(), date, time, title, note, link };
    itineraryData.push(newItem);
    localStorage.setItem('itineraryData', JSON.stringify(itineraryData));
    
    toggleAddForm();
    renderDailyList();
}

// 4. 渲染當日清單
function renderDailyList() {
    const list = document.getElementById('daily-list');
    const title = document.getElementById('current-view-date');
    list.innerHTML = '';
    
    // 過濾出當天的行程並按時間排序
    const todayItems = itineraryData
        .filter(item => item.date === currentSelectedDate)
        .sort((a, b) => (a.time > b.time ? 1 : -1));

    title.innerText = `${currentSelectedDate} 行程`;

    if (todayItems.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#AAA; margin-top:30px;">今日尚無行程</p>';
        return;
    }

    todayItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'itinerary-card';
        card.innerHTML = `
            <div class="card-time">${item.time || '--:--'}</div>
            <div class="card-content">
                <h3>${item.title}</h3>
                ${item.note ? `<p>${item.note}</p>` : ''}
                <div class="card-action">
                    ${item.link ? `<a href="${item.link}" target="_blank" class="btn-small">查看地點/連結</a>` : ''}
                    <button class="btn-small" onclick="deleteItem(${item.id})">移除</button>
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

function deleteItem(id) {
    itineraryData = itineraryData.filter(item => item.id !== id);
    localStorage.setItem('itineraryData', JSON.stringify(itineraryData));
    renderDailyList();
}

// --- 以下為分頁與其他功能維持 ---
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
    document.getElementById('noteStatus').innerText = "✅ 已存檔";
    setTimeout(() => document.getElementById('noteStatus').innerText = "", 2000);
}
