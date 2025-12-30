// 分頁切換與高亮效果
function showTab(tabId, el) {
    // 1. 隱藏所有頁面
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    // 2. 顯示點選的頁面
    document.getElementById(tabId).classList.add('active');
    
    // 3. 移除所有導覽按鈕的高亮
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    // 4. 為當前按鈕加上高亮
    if (el) {
        el.classList.add('active');
    }
    
    // 5. 切換時自動回到頂部
    document.getElementById('scroll-area').scrollTop = 0;
}

// 新增項目功能
function addItem(type) {
    const inputId = type === 'itinerary' ? 'itineraryInput' : 'shoppingInput';
    const listId = type === 'itinerary' ? 'itineraryList' : 'shoppingList';
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);

    if (input.value.trim() === '') return;

    const li = document.createElement('li');
    li.innerHTML = `
        <span>${input.value}</span>
        <button style="background:none; color:#C66; border:1px solid #C66; padding:4px 10px; font-size:11px; border-radius:4px;" 
                onclick="this.parentElement.remove()">移除</button>
    `;
    list.appendChild(li);
    input.value = '';
}

// 分帳計算
function calculateBill() {
    const amount = document.getElementById('billAmount').value;
    const people = document.getElementById('billPeople').value;
    const resultText = document.getElementById('billResultText');

    if (amount > 0 && people > 0) {
        const perPerson = Math.ceil(amount / people);
        resultText.innerText = `平均每人：$ ${perPerson}`;
        resultText.style.color = "#4A4E5A";
    } else {
        resultText.innerText = "請輸入正確金額與人數";
        resultText.style.color = "red";
    }
}

// 隨筆儲存
function saveNote() {
    const note = document.getElementById('noteInput').value;
    const status = document.getElementById('noteStatus');
    localStorage.setItem('travelNote', note);
    status.innerText = "✅ 隨筆內容已妥善存於手機中";
    setTimeout(() => { status.innerText = ""; }, 2500);
}

// 載入時自動讀取隨筆
window.onload = () => {
    const savedNote = localStorage.getItem('travelNote');
    if (savedNote) {
        document.getElementById('noteInput').value = savedNote;
    }
};
