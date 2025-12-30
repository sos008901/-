// 分頁切換功能
function showTab(tabId) {
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    // 每次切換回到最上方
    document.querySelector('main').scrollTop = 0;
}

// 新增行程或購物項目
function addItem(type) {
    const inputId = type === 'itinerary' ? 'itineraryInput' : 'shoppingInput';
    const listId = type === 'itinerary' ? 'itineraryList' : 'shoppingList';
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);

    if (input.value.trim() === '') return;

    const li = document.createElement('li');
    li.innerHTML = `
        <span>${input.value}</span>
        <button style="background:#8b0000; padding:5px 12px; font-size:12px;" onclick="this.parentElement.remove()">移除</button>
    `;
    list.appendChild(li);
    input.value = '';
}

// 分帳計算 (無條件進位到整數)
function calculateBill() {
    const amount = document.getElementById('billAmount').value;
    const people = document.getElementById('billPeople').value;
    const resultText = document.getElementById('billResultText');

    if (amount > 0 && people > 0) {
        const perPerson = Math.ceil(amount / people);
        resultText.innerText = `平均每人約：$ ${perPerson}`;
    } else {
        resultText.innerText = "請輸入正確的金額與人數";
    }
}

// 隨筆儲存
function saveNote() {
    const note = document.getElementById('noteInput').value;
    const status = document.getElementById('noteStatus');
    
    localStorage.setItem('travelNote', note);
    status.innerText = "已妥善保存隨筆內容";
    status.style.cssText = "font-size: 12px; color: #A68B5B; margin-top: 15px;";
    
    setTimeout(() => { status.innerText = ""; }, 2500);
}

// 載入時讀取
window.onload = function() {
    const savedNote = localStorage.getItem('travelNote');
    if (savedNote) {
        document.getElementById('noteInput').value = savedNote;
    }
}
