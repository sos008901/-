// 1. 分頁切換功能
function showTab(tabId) {
  // 隱藏所有內容
  const contents = document.querySelectorAll(".tab-content");
  contents.forEach((content) => content.classList.remove("active"));

  // 顯示指定的內容
  document.getElementById(tabId).classList.add("active");
}

// 2. 通用的新增清單功能 (用於行程與購物)
function addItem(type) {
  const inputId = type === "itinerary" ? "itineraryInput" : "shoppingInput";
  const listId = type === "itinerary" ? "itineraryList" : "shoppingList";
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);

  if (input.value.trim() === "") return;

  const li = document.createElement("li");
  li.innerHTML = `
        <span>${input.value}</span>
        <button style="background:red; padding:5px 10px;" onclick="this.parentElement.remove()">刪除</button>
    `;
  list.appendChild(li);
  input.value = ""; // 清空輸入框
}

// 3. 分帳計算功能
function calculateBill() {
  const amount = document.getElementById("billAmount").value;
  const people = document.getElementById("billPeople").value;
  const resultText = document.getElementById("billResultText");

  if (amount > 0 && people > 0) {
    const perPerson = (amount / people).toFixed(2);
    resultText.innerText = `平均每人：$${perPerson}`;
  } else {
    resultText.innerText = "請輸入正確的金額與人數";
  }
}

// 4. 記事本儲存功能 (簡單演示)
function saveNote() {
  const note = document.getElementById("noteInput").value;
  const status = document.getElementById("noteStatus");

  if (note.trim() !== "") {
    // 這裡可以延伸使用 localStorage 儲存
    localStorage.setItem("travelNote", note);
    status.innerText = "✅ 已儲存至本地瀏覽器";
    status.style.color = "green";
  }
}

// 初始化讀取記事本
window.onload = function () {
  const savedNote = localStorage.getItem("travelNote");
  if (savedNote) {
    document.getElementById("noteInput").value = savedNote;
  }
};

