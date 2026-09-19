// --- KONFIGURASI AWAL ---
'use strict';

// Nama penyimpanan lokal
const STORAGE_KEY = 'budgetku_preview_v1';

// Data awal (jika tidak ada di localStorage)
let data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {
  transactions: [
    { id: 'demo1', name: 'Cilok', price: 10000, qty: 1, amount: 10000, category: 'Makanan', budgetId: 'demo-budget', timestamp: Date.now() - 86400000 },
    { id: 'demo2', name: 'Nasi Goreng', price: 25000, qty: 1, amount: 25000, category: 'Makanan', budgetId: 'demo-budget', timestamp: Date.now() - 43200000 },
    { id: 'demo3', name: 'Bensin', price: 20000, qty: 1, amount: 20000, category: 'Transportasi', budgetId: null, timestamp: Date.now() - 21600000 }
  ],
  budgets: [
    { id: 'demo-budget', name: 'Jajan Mingguan', category: 'Makanan', limit: 100000 }
  ]
};

// Ekstrak array untuk kemudahan akses
let transactions = data.transactions;
let budgets = data.budgets;

// Pengaturan aplikasi
let currentSort = 'date';     // Urutan transaksi: date, amount, category
let selectedPresetId = 'none'; // ID anggaran yang dipilih untuk transaksi baru
let editingBudgetId = null;    // ID anggaran yang sedang diedit

// --- FUNGSI BANTUAN ---
// Format angka ke Rupiah
const rupiah = (number) => {
  return 'Rp ' + Math.round(number).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// Escape karakter HTML
const esc = (str) => {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return String(str).replace(/[&<>"']/g, (m) => map[m]);
};

// Simpan data ke localStorage
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ transactions, budgets }));
}

// Hitung total pengeluaran untuk suatu anggaran
function calculateSpent(budgetId) {
  return transactions
    .filter(transaction => transaction.budgetId === budgetId)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

// --- FUNGSI RENDER (TAMPILAN) ---

// Render saldo utama
function renderBalance() {
  // Hitung total semua transaksi
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  document.getElementById('balance-display').textContent = rupiah(total);
  document.getElementById('balance-count').textContent = transactions.length + ' transaksi';

  // Hitung dan tampilkan info anggaran
  const totalBudget = budgets.reduce((sum, b) => sum + b.limit, 0);
  const infoElement = document.getElementById('balance-budget-info');
  
  if (totalBudget > 0) {
    const diff = totalBudget - total;
    if (diff >= 0) {
      infoElement.textContent = 'Sisa anggaran ' + rupiah(diff);
    } else {
      infoElement.textContent = '⚠ Lewat ' + rupiah(-diff);
    }
  } else {
    infoElement.textContent = '';
  }
}

// Render daftar anggaran
function renderBudgets() {
  const budgetListElement = document.getElementById('budget-list');

  if (budgets.length === 0) {
    budgetListElement.innerHTML = '<p class="empty-hint">Belum ada anggaran.</p>';
    renderPreset(); // Tetap render preset meski kosong
    return;
  }

  // Bangun HTML untuk setiap anggaran
  let html = '';
  budgets.forEach(budget => {
    const spentAmount = calculateSpent(budget.id);
    const percent = budget.limit > 0 ? (spentAmount / budget.limit) * 100 : 0;
    const fillWidth = Math.min(percent, 100);

    // Tentukan warna progress bar
    let fillClass = 'fill-ok'; // Hijau default
    if (percent >= 100) {
      fillClass = 'fill-over'; // Merah
    } else if (percent >= 75) {
      fillClass = 'fill-warn'; // Kuning
    }

    // Hitung sisa anggaran
    const remaining = budget.limit - spentAmount;
    let remainingText = '';
    if (remaining >= 0) {
      remainingText = 'Sisa <strong>' + rupiah(remaining) + '</strong>';
    } else {
      remainingText = '⚠ Melebihi limit sebesar <strong>' + rupiah(Math.abs(remaining)) + '</strong>';
    }

    html += `
      <div class="budget-item">
        <div class="budget-item-info">
          <div class="budget-item-name">🎯 ${esc(budget.name)}</div>
          <div class="budget-item-detail">
            Terpakai <strong>${rupiah(spentAmount)}</strong> dari ${rupiah(budget.limit)}
            · <strong>${percent.toFixed(0)}%</strong>
          </div>
          <div class="budget-progress-track">
            <div class="budget-progress-fill ${fillClass}" style="width:${fillWidth}%"></div>
          </div>
          <div class="budget-item-detail" style="margin-top:7px">
            ${remainingText}
          </div>
        </div>
        <span class="budget-item-total">Limit ${rupiah(budget.limit)}</span>
        <div class="budget-item-actions">
          <button class="btn-icon" onclick="editBudget('${budget.id}')">✏️</button>
          <button class="btn-icon" onclick="deleteBudget('${budget.id}')">🗑</button>
        </div>
      </div>`;
  });

  budgetListElement.innerHTML = html;
  renderPreset(); // Render preset setelah anggaran diperbarui
}

// Render tombol preset anggaran di formulir
function renderPreset() {
  const presetSelectorElement = document.getElementById('preset-selector');
  
  // Tombol "Tanpa Limit"
  let html = `<button class="preset-chip ${(selectedPresetId === 'none' ? 'active' : '')}" data-preset="none">Tanpa Limit</button>`;
  
  // Tambahkan tombol untuk setiap anggaran
  budgets.forEach(budget => {
    const spentAmount = calculateSpent(budget.id);
    const remaining = Math.max(budget.limit - spentAmount, 0);
    const isActive = selectedPresetId === budget.id ? 'active' : '';
    
    html += `<button class="preset-chip ${isActive}" data-preset="${budget.id}">${esc(budget.name)} <small>(${rupiah(remaining)})</small></button>`;
  });

  presetSelectorElement.innerHTML = html;
}

// Update teks hint preset
function updatePresetHint() {
  const hintElement = document.getElementById('preset-hint');
  
  if (selectedPresetId === 'none') {
    hintElement.textContent = '';
    return;
  }

  const budget = budgets.find(b => b.id === selectedPresetId);
  if (!budget) {
    hintElement.textContent = '';
    return;
  }

  const spentAmount = calculateSpent(budget.id);
  hintElement.textContent = `Limit: ${rupiah(budget.limit)} · Terpakai: ${rupiah(spentAmount)} · Sisa: ${rupiah(Math.max(budget.limit - spentAmount, 0))}`;
}

// Render daftar transaksi
function renderTransactions() {
  const txListElement = document.getElementById('tx-list');

  // Salin dan urutkan transaksi
  let sortedTransactions = [...transactions];
  if (currentSort === 'amount') {
    sortedTransactions.sort((a, b) => b.amount - a.amount);
  } else if (currentSort === 'category') {
    sortedTransactions.sort((a, b) => a.category.localeCompare(b.category));
  } else {
    sortedTransactions.sort((a, b) => b.timestamp - a.timestamp); // Default: tanggal terbaru
  }

  if (sortedTransactions.length === 0) {
    txListElement.innerHTML = '<p class="empty-hint">Belum ada transaksi.</p>';
    return;
  }

  // Bangun HTML untuk setiap transaksi
  let html = '';
  sortedTransactions.forEach(tx => {
    html += `
      <div class="tx-item">
        <div>
          <div class="tx-name">${esc(tx.name)}</div>
          <div class="tx-meta">${esc(tx.category)} · ${tx.qty} × ${rupiah(tx.price)}</div>
        </div>
        <div>
          <b>${rupiah(tx.amount)}</b><br>
          <button onclick="deleteTransaction('${tx.id}')">Hapus</button>
        </div>
      </div>`;
  });

  txListElement.innerHTML = html;
}

// Render ringkasan anggaran untuk layar grafik
function renderSummary() {
  const summaryElement = document.getElementById('budget-summary');

  if (budgets.length === 0) {
    summaryElement.innerHTML = '<p class="empty-hint">Belum ada data anggaran.</p>';
    return;
  }

  let html = '';
  budgets.forEach(budget => {
    const spentAmount = calculateSpent(budget.id);
    const percent = (spentAmount / budget.limit) * 100;
    const fillWidth = Math.min(percent, 100);
    
    // Tentukan warna progress bar
    let fillClass = 'fill-ok';
    if (percent >= 100) {
      fillClass = 'fill-over';
    } else if (percent >= 75) {
      fillClass = 'fill-warn';
    }

    html += `
      <div class="budget-item">
        <b>${esc(budget.name)}</b>
        <div class="budget-item-detail">${rupiah(spentAmount)} / ${rupiah(budget.limit)} · ${percent.toFixed(0)}%</div>
        <div class="budget-progress-track">
          <div class="budget-progress-fill ${fillClass}" style="width:${fillWidth}%"></div>
        </div>
      </div>`;
  });

  summaryElement.innerHTML = html;
}

// Render semua elemen
function renderAll() {
  renderBalance();
  renderBudgets();
  renderTransactions();
  renderSummary();
  
  // Perbarui pratinjau harga total
  const priceElement = document.getElementById('price-preview-val');
  const amount = parseFloat(document.getElementById('amount').value) || 0;
  const qty = parseFloat(document.getElementById('qty').value) || 1;
  priceElement.textContent = rupiah(amount * qty);
}

// --- FUNGSI INTERAKSI PENGGUNA ---

// Tambah transaksi baru
function addTransaction() {
  const nameInput = document.getElementById('item-name');
  const amountInput = document.getElementById('amount');
  const qtyInput = document.getElementById('qty');
  const categorySelect = document.getElementById('category');

  const name = nameInput.value.trim();
  const price = parseFloat(amountInput.value);
  const qty = parseFloat(qtyInput.value) || 1;

  // Validasi input
  if (!name || isNaN(price) || price < 1) {
    alert('Masukkan nama dan harga yang valid.');
    return;
  }

  const total = price * qty;
  let budgetId = null;

  // Jika ada preset anggaran yang dipilih, gunakan
  if (selectedPresetId !== 'none') {
    const budget = budgets.find(b => b.id === selectedPresetId);
    if (budget) {
      budgetId = budget.id;
    }
  }

  // Buat objek transaksi baru
  const newTransaction = {
    id: String(Date.now()),
    name: name,
    price: price,
    qty: qty,
    amount: total,
    category: categorySelect.value,
    budgetId: budgetId,
    timestamp: Date.now()
  };

  // Tambahkan ke array dan simpan
  transactions.push(newTransaction);
  saveData();

  // Perbarui tampilan
  renderAll();

  // Reset form
  nameInput.value = '';
  amountInput.value = '';
  qtyInput.value = '1';
  document.getElementById('price-preview-val').textContent = 'Rp 0';
}

// Hapus transaksi
function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveData();
  renderAll();
}

// --- FUNGSI MANAJEMEN ANGGARAN ---

// Buka modal anggaran (buat/edit)
function openBudgetModal(id = null) {
  editingBudgetId = id;
  const budget = budgets.find(b => b.id === id);

  document.getElementById('budget-name').value = budget?.name || '';
  document.getElementById('budget-category').value = budget?.category || 'Makanan';
  document.getElementById('budget-limit-input').value = budget?.limit || '';

  document.getElementById('modal-backdrop').classList.remove('hidden');
}

// Tutup modal anggaran
function closeBudgetModal() {
  document.getElementById('modal-backdrop').classList.add('hidden');
  editingBudgetId = null;
}

// Simpan anggaran (baru atau edit)
function saveBudget() {
  const nameInput = document.getElementById('budget-name');
  const categorySelect = document.getElementById('budget-category');
  const limitInput = document.getElementById('budget-limit-input');

  const name = nameInput.value.trim();
  const category = categorySelect.value;
  const limit = parseFloat(limitInput.value);

  // Validasi input
  if (!name || isNaN(limit) || limit < 1) {
    alert('Masukkan nama dan limit yang valid.');
    return;
  }

  if (editingBudgetId) {
    // Edit anggaran yang ada
    const budget = budgets.find(b => b.id === editingBudgetId);
    if (budget) {
      budget.name = name;
      budget.category = category;
      budget.limit = limit;
      
      // Perbarui limit di transaksi terkait
      transactions.forEach(t => {
        if (t.budgetId === editingBudgetId) {
          t.limitAmt = limit;
        }
      });
    }
  } else {
    // Buat anggaran baru
    const newId = String(Date.now());
    const newBudget = {
      id: newId,
      name: name,
      category: category,
      limit: limit
    };
    budgets.push(newBudget);

    // Tambahkan transaksi lama dengan kategori yang sama ke anggaran ini
    transactions.forEach(t => {
      if (t.category === category && !t.budgetId) {
        t.budgetId = newId;
        t.limitAmt = limit;
      }
    });
  }

  // Simpan dan perbarui tampilan
  saveData();
  closeBudgetModal();
  renderAll();
}

// Hapus anggaran
function deleteBudget(id) {
  // Konfirmasi opsional bisa ditambahkan di sini
  budgets = budgets.filter(b => b.id !== id);
  
  // Cabut referensi dari transaksi terkait
  transactions.forEach(t => {
    if (t.budgetId === id) {
      t.budgetId = null;
      t.limitAmt = null;
    }
  });

  saveData();
  renderAll();
}

// Edit anggaran (pembungkus openBudgetModal)
function editBudget(id) {
  openBudgetModal(id);
}

// --- INISIALISASI DAN EVENT LISTENER ---

// Panggil sekali saat halaman dimuat
renderAll();

// Event listener untuk form tambah transaksi
document.getElementById('add-btn').onclick = addTransaction;
document.getElementById('amount').oninput = renderAll;
document.getElementById('qty').oninput = renderAll;

// Event listener untuk manajemen anggaran
document.getElementById('add-budget-btn').onclick = () => openBudgetModal();
document.getElementById('modal-close').onclick = closeBudgetModal;
document.getElementById('modal-cancel').onclick = closeBudgetModal;
document.getElementById('modal-save').onclick = saveBudget;

// Event listener untuk urutan transaksi
document.querySelectorAll('.sort-btn').forEach(button => {
  button.onclick = () => {
    currentSort = button.dataset.sort;
    
    // Ubah tombol aktif
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    button.classList.add('active');
    
    renderTransactions(); // Render ulang hanya daftar transaksi
  };
});

// Event listener untuk navigasi bawah
document.querySelectorAll('.nav-btn').forEach(button => {
  button.onclick = () => {
    // Ubah tombol aktif
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    button.classList.add('active');
    
    // Tampilkan layar yang sesuai
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + button.dataset.screen).classList.add('active');
  };
});

// Event listener untuk toggle tema
document.getElementById('theme-toggle').onclick = () => {
  const isDarkMode = document.documentElement.dataset.theme === 'dark';
  document.documentElement.dataset.theme = isDarkMode ? 'light' : 'dark';
  document.getElementById('theme-toggle').textContent = isDarkMode ? '🌙 Mode Gelap' : '☀️ Mode Terang';
};

// Event listener untuk preset selector (delegasi event)
document.getElementById('preset-selector').onclick = (event) => {
  const chip = event.target.closest('.preset-chip');
  if (chip) {
    selectedPresetId = chip.dataset.preset;
    renderPreset(); // Perbarui tampilan preset
    updatePresetHint(); // Perbarui hint
  }
};

// Update hint saat halaman dimuat
updatePresetHint();