function showTab(tabId, element) {
    // 切換內容
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    // 切換按鈕狀態
    if(element) {
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        element.classList.add('active');
    }
    
    document.querySelector('main').scrollTop = 0;
}

function addItem(type) {
    const input = document.getElementById(type === 'itinerary' ? 'itineraryInput' : 'shoppingInput');
    const list = document.getElementById(type === 'itinerary' ? 'itineraryList' : 'shoppingList');
    if (!input.value.trim()) return;

    const li = document.createElement('li');
    li.innerHTML = `<span>${input.value}</span><button style="background:#A68B5B; padding:4px 10px; font-size:11px;" onclick="this.parentElement.remove()">移除</button>`;
    list.appendChild(li);
    input.value = '';
}

function calculateBill() {
    const amount = document.getElementById('billAmount').value;
    const people = document.getElementById('billPeople').value;
    if (amount > 0 && people > 0) {
        document.getElementById('billResultText').innerText = `每人約：$ ${Math.ceil(amount / people)}`;
    }
}

function saveNote() {
    localStorage.setItem('travelNote', document.getElementById('noteInput').value);
    const status = document.getElementById('noteStatus');
    status.innerText = "隨筆已存入本地記憶體";
    setTimeout(() => status.innerText = "", 2000);
}

window.onload = () => {
    document.getElementById('noteInput').value = localStorage.getItem('travelNote') || "";
};
