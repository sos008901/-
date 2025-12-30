function showTab(tabId) {
    // 1. 切換內容區塊
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    // 2. 切換下方按鈕的高亮狀態
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
        // 如果按鈕的文字包含對應的關鍵字，就設為 active
        if (item.innerText.includes(getTabText(tabId))) {
            item.classList.add('active');
        }
    });

    // 3. 回到頂部
    document.querySelector('main').scrollTop = 0;
}

// 輔助函式：將 ID 對應到按鈕文字
function getTabText(id) {
    const mapping = {
        'itinerary': '行程',
        'splitBill': '分帳',
        'notes': '隨筆',
        'shopping': '清單'
    };
    return mapping[id];
}

// 其他功能保持不變...
function addItem(type) {
    const inputId = type === 'itinerary' ? 'itineraryInput' : 'shoppingInput';
    const listId = type === 'itinerary' ? 'itineraryList' : 'shoppingList';
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    if (input.value.trim() === '') return;
    const li = document.createElement('li');
    li.innerHTML = `<span>${input.value}</span><button style="background:#8b0000; padding:5px 12px; font-size:12px; border-radius:4px;" onclick="this.parentElement.remove()">移除</button>`;
    list.appendChild(li);
    input.value = '';
}

function calculateBill() {
    const amount = document.getElementById('billAmount').value;
    const people = document.getElementById('billPeople').value;
    const resultText = document.getElementById('billResultText');
    if (amount > 0 && people > 0) {
        resultText.innerText = `平均每人約：$ ${Math.ceil(amount / people)}`;
    }
}

function saveNote() {
    const note = document.getElementById('noteInput').value;
    localStorage.setItem('travelNote', note);
    alert("隨筆已儲存");
}

window.onload = function() {
    const savedNote = localStorage.getItem('travelNote');
    if (savedNote) document.getElementById('noteInput').value = savedNote;
    // 初始化第一個標籤為 active
    document.querySelector('.nav-item').classList.add('active');
}
