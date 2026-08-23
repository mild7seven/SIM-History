const STORAGE_KEY = 'SIM_TRACKER_DATA_V3';

// Helper Function: Masking 4 Digit Terakhir Nomor HP
function maskPhoneNumber(phoneStr) {
  if (!phoneStr) return '';
  const cleanStr = phoneStr.trim();
  if (cleanStr.length <= 7) return '*******';
  return cleanStr.slice(0, -7) + '*******';
}

function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(amount || 0);
}

function formatDateIndo(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function getCards() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

function saveCards(cards) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  renderCards();
  updateDashboardStats();
}

function toggleForm() {
  const form = document.getElementById('cardForm');
  form.classList.toggle('hidden');
}

function saveCard(event) {
  event.preventDefault();
  const provider = document.getElementById('provider').value.trim();
  const phoneNumber = document.getElementById('phoneNumber').value.trim();
  const activeExpiry = document.getElementById('activeExpiry').value;
  const graceExpiry = document.getElementById('graceExpiry').value;

  const newCard = {
    id: Date.now().toString(),
    provider,
    phoneNumber, // Tersimpan penuh untuk kebutuhan pencarian, disembunyikan saat render
    activeExpiry,
    graceExpiry,
    createdAt: new Date().toISOString(),
    history: []
  };

  const cards = getCards();
  cards.push(newCard);
  saveCards(cards);

  event.target.reset();
  toggleForm();
}

function deleteCard(id) {
  const cards = getCards();
  const card = cards.find(c => c.id === id);
  if (!card) return;

  const maskedPhone = maskPhoneNumber(card.phoneNumber);
  if (confirm(`Hapus kartu ${card.provider} (${maskedPhone}) beserta seluruh riwayatnya?`)) {
    const updated = cards.filter(c => c.id !== id);
    saveCards(updated);
  }
}

function calculateNewDates(card, daysToAdd) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentActive = new Date(card.activeExpiry);
  const currentGrace = new Date(card.graceExpiry);

  const graceDurationMs = currentGrace.getTime() - currentActive.getTime();
  const defaultGraceMs = graceDurationMs > 0 ? graceDurationMs : 30 * 24 * 60 * 60 * 1000;

  let baseActiveDate = currentActive > today ? new Date(currentActive) : new Date(today);
  baseActiveDate.setDate(baseActiveDate.getDate() + parseInt(daysToAdd || 0, 10));

  const newActiveStr = baseActiveDate.toISOString().split('T')[0];
  const newGraceDate = new Date(baseActiveDate.getTime() + defaultGraceMs);
  const newGraceStr = newGraceDate.toISOString().split('T')[0];

  return { newActiveStr, newGraceStr };
}

function openTopupModal(id) {
  const card = getCards().find(c => c.id === id);
  if (!card) return;

  document.getElementById('topupCardId').value = id;
  document.getElementById('topupTitle').innerText = `Beli Paket / Masa Aktif`;
  document.getElementById('topupSubtitle').innerText = `${card.provider} • ${maskPhoneNumber(card.phoneNumber)}`;
  document.getElementById('topupPrice').value = '';
  document.getElementById('topupPackageName').value = '';
  document.getElementById('daysToAdd').value = '';
  document.getElementById('previewNewActive').innerText = '-';
  document.getElementById('previewNewGrace').innerText = '-';

  document.getElementById('topupModal').classList.remove('hidden');
}

function closeTopupModal() {
  document.getElementById('topupModal').classList.add('hidden');
}

function setDays(days) {
  document.getElementById('daysToAdd').value = days;
  updatePreviewDates();
}

function updatePreviewDates() {
  const cardId = document.getElementById('topupCardId').value;
  const daysToAdd = parseInt(document.getElementById('daysToAdd').value, 10);
  const card = getCards().find(c => c.id === cardId);

  if (!card || isNaN(daysToAdd) || daysToAdd <= 0) {
    document.getElementById('previewNewActive').innerText = '-';
    document.getElementById('previewNewGrace').innerText = '-';
    return;
  }

  const { newActiveStr, newGraceStr } = calculateNewDates(card, daysToAdd);
  document.getElementById('previewNewActive').innerText = formatDateIndo(newActiveStr);
  document.getElementById('previewNewGrace').innerText = formatDateIndo(newGraceStr);
}

function processTopup(event) {
  event.preventDefault();
  const cardId = document.getElementById('topupCardId').value;
  const topupType = document.getElementById('topupType').value;
  const packageName = document.getElementById('topupPackageName').value.trim();
  const price = parseFloat(document.getElementById('topupPrice').value) || 0;
  const daysToAdd = parseInt(document.getElementById('daysToAdd').value, 10);

  if (isNaN(daysToAdd) || daysToAdd <= 0) {
    alert('Masukkan tambahan hari yang valid!');
    return;
  }

  const cards = getCards();
  const cardIndex = cards.findIndex(c => c.id === cardId);
  if (cardIndex === -1) return;

  const card = cards[cardIndex];
  const { newActiveStr, newGraceStr } = calculateNewDates(card, daysToAdd);

  const historyItem = {
    id: Date.now().toString(),
    date: new Date().toISOString(),
    type: topupType,
    packageName: packageName,
    price: price,
    daysAdded: daysToAdd,
    prevActive: card.activeExpiry,
    newActive: newActiveStr,
    prevGrace: card.graceExpiry,
    newGrace: newGraceStr
  };

  if (!card.history) card.history = [];
  card.history.unshift(historyItem);

  card.activeExpiry = newActiveStr;
  card.graceExpiry = newGraceStr;

  saveCards(cards);
  closeTopupModal();
}

let activeHistoryCardId = null;

function openHistoryModal(id) {
  activeHistoryCardId = id;
  const card = getCards().find(c => c.id === id);
  if (!card) return;

  document.getElementById('historySubtitle').innerText = `${card.provider} • ${maskPhoneNumber(card.phoneNumber)}`;
  renderHistoryList(card);
  document.getElementById('historyModal').classList.remove('hidden');
}

function closeHistoryModal() {
  document.getElementById('historyModal').classList.add('hidden');
  activeHistoryCardId = null;
}

function renderHistoryList(card) {
  const container = document.getElementById('historyListContainer');
  const history = card.history || [];

  const totalSpent = history.reduce((sum, h) => sum + (h.price || 0), 0);
  document.getElementById('historyTotalAmount').innerText = formatRupiah(totalSpent);

  if (history.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-slate-500 border border-dashed border-slate-700/60 rounded-xl">
        <i class="fa-solid fa-receipt text-2xl mb-2 opacity-50"></i>
        <p class="text-xs">Belum ada riwayat transaksi untuk kartu ini.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = history.map(item => {
    let typeBadge = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    let typeLabel = 'Paket Data';
    if (item.type === 'masa_aktif') {
      typeBadge = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      typeLabel = 'Masa Aktif';
    } else if (item.type === 'pulsa') {
      typeBadge = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      typeLabel = 'Pulsa';
    }

    const txDate = new Date(item.date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
        <div class="flex justify-between items-start">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs px-2 py-0.5 rounded-full border ${typeBadge} font-medium">${typeLabel}</span>
              <h4 class="text-xs font-bold text-slate-200">${item.packageName}</h4>
            </div>
            <p class="text-[10px] text-slate-500 mt-1"><i class="fa-regular fa-clock"></i> ${txDate}</p>
          </div>
          <div class="text-right">
            <span class="text-xs font-bold text-emerald-400">${formatRupiah(item.price)}</span>
            <p class="text-[10px] text-blue-400 font-medium">+${item.daysAdded} Hari Masa Aktif</p>
          </div>
        </div>
        <div class="bg-slate-950/60 p-2 rounded-lg text-[11px] text-slate-400 flex justify-between items-center">
          <span>Perpanjangan:</span>
          <span class="font-mono text-slate-300">${formatDateIndo(item.prevActive)} <i class="fa-solid fa-arrow-right text-[9px] text-blue-500 mx-1"></i> ${formatDateIndo(item.newActive)}</span>
        </div>
      </div>
    `;
  }).join('');
}

function clearCardHistory() {
  if (!activeHistoryCardId) return;
  const cards = getCards();
  const card = cards.find(c => c.id === activeHistoryCardId);
  if (!card) return;

  if (confirm(`Hapus semua riwayat transaksi untuk ${card.provider}?`)) {
    card.history = [];
    saveCards(cards);
    renderHistoryList(card);
  }
}

function calculateStatus(activeExpiryStr, graceExpiryStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeDate = new Date(activeExpiryStr);
  const graceDate = new Date(graceExpiryStr);

  const diffActiveDays = Math.ceil((activeDate - today) / (1000 * 60 * 60 * 24));
  const diffGraceDays = Math.ceil((graceDate - today) / (1000 * 60 * 60 * 24));

  if (diffActiveDays >= 0) {
    return {
      statusKey: 'AKTIF',
      label: 'AKTIF',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      info: `Sisa masa aktif: ${diffActiveDays} hari`,
      daysLeft: diffActiveDays
    };
  } else if (diffGraceDays >= 0) {
    return {
      statusKey: 'MASA TENGGANG',
      label: 'MASA TENGGANG',
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      info: `Sisa masa tenggang: ${diffGraceDays} hari`,
      daysLeft: diffGraceDays
    };
  } else {
    return {
      statusKey: 'HANGUS',
      label: 'HANGUS',
      badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      info: 'Kartu telah melebihi masa tenggang',
      daysLeft: 0
    };
  }
}

function updateDashboardStats() {
  const cards = getCards();
  let totalActive = 0;
  let totalGrace = 0;
  let totalExpense = 0;

  cards.forEach(c => {
    const status = calculateStatus(c.activeExpiry, c.graceExpiry);
    if (status.statusKey === 'AKTIF') totalActive++;
    if (status.statusKey === 'MASA TENGGANG') totalGrace++;

    if (c.history && Array.isArray(c.history)) {
      c.history.forEach(h => {
        totalExpense += (h.price || 0);
      });
    }
  });

  document.getElementById('statTotalCards').innerText = cards.length;
  document.getElementById('statActiveCards').innerText = totalActive;
  document.getElementById('statGraceCards').innerText = totalGrace;
  document.getElementById('statTotalExpense').innerText = formatRupiah(totalExpense);
}

function renderCards() {
  const container = document.getElementById('simContainer');
  const cards = getCards();
  const searchInput = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('statusFilter')?.value || 'ALL';

  const filteredCards = cards.filter(card => {
    const maskedPhone = maskPhoneNumber(card.phoneNumber);
    const matchesSearch = card.provider.toLowerCase().includes(searchInput) || 
                          card.phoneNumber.includes(searchInput) || 
                          maskedPhone.includes(searchInput);
    const status = calculateStatus(card.activeExpiry, card.graceExpiry);
    const matchesStatus = statusFilter === 'ALL' || status.statusKey === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (filteredCards.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-2xl">
        <i class="fa-solid fa-sim-card text-3xl mb-2 opacity-40"></i>
        <p class="text-sm">Tidak ada data kartu SIM yang sesuai.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filteredCards.map(card => {
    const status = calculateStatus(card.activeExpiry, card.graceExpiry);
    const historyCount = (card.history || []).length;
    const maskedPhone = maskPhoneNumber(card.phoneNumber);

    return `
      <div class="bg-slate-800 border border-slate-700/70 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-slate-600 transition shadow-lg">
        <div>
          <div class="flex justify-between items-start mb-2">
            <div>
              <h3 class="font-bold text-slate-100 text-base flex items-center gap-2">
                ${card.provider}
              </h3>
              <p class="text-xs font-mono text-slate-400 mt-0.5 tracking-wider">${maskedPhone}</p>
            </div>
            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${status.badgeClass}">
              ${status.label}
            </span>
          </div>

          <div class="space-y-1.5 text-xs text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-800 mt-3">
            <div class="flex justify-between">
              <span class="text-slate-500">Masa Aktif:</span>
              <span class="font-medium">${formatDateIndo(card.activeExpiry)}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Masa Tenggang:</span>
              <span class="font-medium">${formatDateIndo(card.graceExpiry)}</span>
            </div>
            <div class="pt-2 border-t border-slate-800 font-semibold text-blue-400 flex justify-between items-center">
              <span>${status.info}</span>
            </div>
          </div>
        </div>

        <div class="space-y-2 pt-2 border-t border-slate-700/50">
          <div class="grid grid-cols-2 gap-2">
            <button onclick="openTopupModal('${card.id}')" class="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 py-2 px-2 rounded-xl text-xs font-semibold transition border border-blue-500/30 flex items-center justify-center gap-1.5">
              <i class="fa-solid fa-cart-plus text-[11px]"></i> Beli Paket
            </button>
            <button onclick="openHistoryModal('${card.id}')" class="bg-slate-700/60 hover:bg-slate-700 text-slate-200 py-2 px-2 rounded-xl text-xs font-semibold transition border border-slate-600/50 flex items-center justify-center gap-1.5">
              <i class="fa-solid fa-history text-[11px]"></i> Riwayat (${historyCount})
            </button>
          </div>
          <div class="flex justify-end pt-1">
            <button onclick="deleteCard('${card.id}')" class="text-[11px] text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1">
              <i class="fa-solid fa-trash text-[10px]"></i> Hapus Kartu
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  renderCards();
  updateDashboardStats();
});
