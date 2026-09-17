// RO Origin Classic - Auction Helper Application Logic

const QUOTAS = {
  album: 1,
  shard: 1,
  whiteFeather: 3,
  blackFeather: 5
};

const ITEM_TYPES = [
  { key: 'album', name: 'สมุดการ์ดบอส', icon: '📘', color: '#fbbf24' },
  { key: 'shard', name: 'เศษการ์ดบอส', icon: '🧩', color: '#3b82f6' },
  { key: 'whiteFeather', name: 'ขนนกขาว', icon: '🪶', color: '#10b981' },
  { key: 'blackFeather', name: 'ขนนกดำแดง', icon: '🪶', color: '#a855f7' }
];

// State
let appData = {
  stocks: { album: 0, shard: 0, whiteFeather: 0, blackFeather: 0 },
  lists: {
    album: [],
    shard: [],
    whiteFeather: [],
    blackFeather: []
  },
  searchTerm: ''
};

// DOM Elements
const stockInputs = {
  album: document.getElementById('stockAlbum'),
  shard: document.getElementById('stockShard'),
  whiteFeather: document.getElementById('stockWhiteFeather'),
  blackFeather: document.getElementById('stockBlackFeather')
};

const listInputs = {
  album: document.getElementById('listAlbum'),
  shard: document.getElementById('listShard'),
  whiteFeather: document.getElementById('listWhiteFeather'),
  blackFeather: document.getElementById('listBlackFeather')
};

const countBadges = {
  album: document.getElementById('countAlbum'),
  shard: document.getElementById('countShard'),
  whiteFeather: document.getElementById('countWhiteFeather'),
  blackFeather: document.getElementById('countBlackFeather')
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadStateFromUI();
  calculateAndRender();
});

function initEventListeners() {
  // Stock Inputs Listener
  Object.keys(stockInputs).forEach(key => {
    stockInputs[key].addEventListener('input', () => {
      appData.stocks[key] = parseInt(stockInputs[key].value) || 0;
      calculateAndRender();
    });
  });

  // Name Lists Listener
  Object.keys(listInputs).forEach(key => {
    listInputs[key].addEventListener('input', () => {
      updateListCounts();
      calculateAndRender();
    });
  });

  // Search Listener
  document.getElementById('searchMember').addEventListener('input', (e) => {
    appData.searchTerm = e.target.value.trim().toLowerCase();
    calculateAndRender();
  });

  // Action Buttons
  document.getElementById('btnDemo').addEventListener('click', loadDemoData);
  document.getElementById('btnReset').addEventListener('click', resetAll);
  document.getElementById('btnCopyGuild').addEventListener('click', copyGuildText);
  document.getElementById('btnCapWheel').addEventListener('click', captureWheelTable);
}

function parseNames(text) {
  if (!text) return [];
  return text
    .split('\n')
    .map(name => name.trim())
    .filter(name => name.length > 0);
}

function updateListCounts() {
  Object.keys(listInputs).forEach(key => {
    const names = parseNames(listInputs[key].value);
    countBadges[key].textContent = `${names.length} คน`;
    appData.lists[key] = names;
  });
}

function loadStateFromUI() {
  Object.keys(stockInputs).forEach(key => {
    appData.stocks[key] = parseInt(stockInputs[key].value) || 0;
  });
  updateListCounts();
}

function loadDemoData() {
  stockInputs.album.value = 2;
  stockInputs.shard.value = 3;
  stockInputs.whiteFeather.value = 70;
  stockInputs.blackFeather.value = 16;

  listInputs.album.value = 'กิลด์มาสเตอร์\nรองหัวหน้ากิลด์';
  listInputs.shard.value = 'สายแทงค์1\nสายดาเมจ1\nสายฮีล1';
  
  // Demo 23 players for 70 white feathers (23 x 3 = 69, 1 remainder -> กิจกรรมวงล้อ)
  const demoWhitePlayers = [];
  for (let i = 1; i <= 23; i++) {
    demoWhitePlayers.push(`สมาชิกที่ ${i}`);
  }
  listInputs.whiteFeather.value = demoWhitePlayers.join('\n');
  listInputs.blackFeather.value = 'กิลด์มาสเตอร์\nสายซัพพอร์ต1\nสายดาเมจ3';

  loadStateFromUI();
  calculateAndRender();
  showToast('⚡ โหลดข้อมูลตัวอย่าง 70 ขนนกขาว (เหลือ 1 เศษ -> กิจกรรมวงล้อ)');
}

function resetAll() {
  if (!confirm('คุณต้องการล้างข้อมูลทั้งหมดใช่หรือไม่?')) return;

  Object.keys(stockInputs).forEach(key => stockInputs[key].value = 0);
  Object.keys(listInputs).forEach(key => listInputs[key].value = '');

  loadStateFromUI();
  calculateAndRender();
  showToast('🗑️ ล้างข้อมูลเรียบร้อยแล้ว');
}

// Core Engine Calculation
function calculateEngine() {
  const allItems = [];
  let globalIndex = 0;

  // 1. Build consecutive items array
  ITEM_TYPES.forEach(typeObj => {
    const count = appData.stocks[typeObj.key] || 0;
    for (let i = 0; i < count; i++) {
      const page = Math.floor(globalIndex / 4) + 1;
      const slot = (globalIndex % 4) + 1;
      allItems.push({
        globalIndex,
        itemType: typeObj.key,
        itemName: typeObj.name,
        itemIcon: typeObj.icon,
        color: typeObj.color,
        page,
        slot,
        assignedTo: null
      });
      globalIndex++;
    }
  });

  const totalPages = Math.ceil(allItems.length / 4) || 0;

  // 2. Allocate to players per category with AUTO MAX quota
  const warnings = [];
  const playerAssignmentsMap = {}; // { playerName: [ { item, page, slot } ] }

  ITEM_TYPES.forEach(typeObj => {
    const key = typeObj.key;
    const maxQuota = QUOTAS[key];
    const playerList = appData.lists[key] || [];

    // Find available item slots of this type
    const availableItemsOfCategory = allItems.filter(item => item.itemType === key && item.assignedTo === null);
    let itemPointer = 0;

    playerList.forEach(playerName => {
      if (!playerAssignmentsMap[playerName]) {
        playerAssignmentsMap[playerName] = [];
      }

      // Check if there are enough items left to fulfill a FULL max quota for this player
      const remainingInStock = availableItemsOfCategory.length - itemPointer;
      if (remainingInStock >= maxQuota) {
        for (let q = 0; q < maxQuota; q++) {
          const itemToGive = availableItemsOfCategory[itemPointer];
          itemToGive.assignedTo = playerName;
          playerAssignmentsMap[playerName].push(itemToGive);
          itemPointer++;
        }
      } else {
        // Stock depleted or incomplete quota for this category
        warnings.push({
          type: 'shortage',
          playerName,
          categoryName: typeObj.name,
          needed: maxQuota,
          given: 0
        });
      }
    });

    // Check if there's remaining unassigned stock (remainder / leftovers not forming full quota)
    const remainingInCat = availableItemsOfCategory.length - itemPointer;
    if (remainingInCat > 0) {
      const wheelName = 'กิจกรรมวงล้อ';
      if (!playerAssignmentsMap[wheelName]) {
        playerAssignmentsMap[wheelName] = [];
      }
      for (let r = itemPointer; r < availableItemsOfCategory.length; r++) {
        const itemToGive = availableItemsOfCategory[r];
        itemToGive.assignedTo = wheelName;
        playerAssignmentsMap[wheelName].push(itemToGive);
      }
      itemPointer = availableItemsOfCategory.length;

      warnings.push({
        type: 'leftover',
        categoryName: typeObj.name,
        count: remainingInCat
      });
    }
  });

  return {
    allItems,
    totalPages,
    playerAssignmentsMap,
    warnings
  };
}

// Render Functions
function calculateAndRender() {
  const result = calculateEngine();
  renderSideBySideCategoryTables(result);
  renderWheelTable(result);
}

// CATEGORY TABLES RENDERER (ROW COLORING GROUPED BY PLAYER)
function renderSideBySideCategoryTables(result) {
  const container = document.getElementById('personalSummaryList');
  container.innerHTML = '';

  const searchTerm = appData.searchTerm;
  let hasAnyContent = false;

  ITEM_TYPES.forEach(typeObj => {
    const key = typeObj.key;
    const categoryItems = result.allItems.filter(i => i.itemType === key);
    const assignedItems = categoryItems.filter(i => i.assignedTo !== null);

    // Group assigned items by player
    const playerMap = {};
    assignedItems.forEach(item => {
      const pName = item.assignedTo;
      if (!playerMap[pName]) playerMap[pName] = [];
      playerMap[pName].push(item);
    });

    // Exclude Wheel Activity from standard category tables
    let playerNames = Object.keys(playerMap).filter(n => n !== 'กิจกรรมวงล้อ');
    if (searchTerm) {
      playerNames = playerNames.filter(n => n.toLowerCase().includes(searchTerm));
    }

    if (playerNames.length > 0 || categoryItems.length > 0) {
      hasAnyContent = true;
    }

    let rowsHtml = '';
    let rowCounter = 1;

    if (playerNames.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="3" style="text-align: center; color: var(--text-dim); padding: 20px;">
            ${categoryItems.length === 0 ? 'ไม่มีไอเทมในสต็อก' : 'ไม่มีผู้ลงชื่อคิวในหมวดนี้'}
          </td>
        </tr>
      `;
    } else {
      playerNames.forEach((pName, pIdx) => {
        const itemsList = playerMap[pName];
        const rowBgClass = (pIdx % 2 === 0) ? 'row-player-even' : 'row-player-odd';

        itemsList.forEach((itemUnit, unitIdx) => {
          const isGroupStart = (unitIdx === 0) ? 'player-group-start' : '';

          rowsHtml += `
            <tr class="${rowBgClass} ${isGroupStart}">
              <td>
                <div class="cat-player-name">
                  <span>${escapeHtml(pName)}</span>
                </div>
              </td>
              <td><span class="page-num-badge">หน้า ${itemUnit.page}</span></td>
              <td><span class="slot-num-badge">ช่อง ${itemUnit.slot}</span></td>
            </tr>
          `;
          rowCounter++;
        });
      });
    }

    const tableBox = document.createElement('div');
    tableBox.className = 'category-table-box';
    tableBox.setAttribute('data-key', key);

    tableBox.innerHTML = `
      <div class="category-table-header ${key}">
        <div class="cat-header-title">
          <span>${typeObj.icon} ${typeObj.name}</span>
          <span class="badge badge-info">${categoryItems.length} ชิ้น (${playerNames.length} คน)</span>
        </div>
        <div class="cat-header-actions">
          <button class="btn-cap btn-cap-single" data-key="${key}" data-name="${typeObj.name}">📸 แคปรูปตาราง</button>
        </div>
      </div>
      <table class="cat-table">
        <thead>
          <tr>
            <th>ชื่อผู้เล่น</th>
            <th style="width: 95px;">หน้าที่</th>
            <th style="width: 95px;">ช่องที่</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

    container.appendChild(tableBox);
  });

  // Attach event listeners for per-category capture buttons
  document.querySelectorAll('.btn-cap-single').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const key = e.target.getAttribute('data-key');
      const name = e.target.getAttribute('data-name');
      captureCategoryTable(key, name);
    });
  });

  if (!hasAnyContent) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">
        📋 กรุณาระบุจำนวนไอเทมและวางรายชื่อผู้ประมูลเพื่อเริ่มคำนวณคิว
      </div>
    `;
  }
}

// STANDALONE WHEEL ACTIVITY TABLE RENDERER
function renderWheelTable(result) {
  const container = document.getElementById('wheelSummaryContainer');
  if (!container) return;

  const wheelItems = result.playerAssignmentsMap['กิจกรรมวงล้อ'] || [];

  if (wheelItems.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 30px; background: #0d1424; border-radius: var(--radius-md); border: 1px dashed rgba(255,255,255,0.1);">
        ✨ ไม่มีไอเทมเศษเหลือสำหรับกิจกรรมวงล้อในวันนี้
      </div>
    `;
    return;
  }

  let rowsHtml = '';
  wheelItems.forEach((itemUnit, idx) => {
    const rowBgClass = (idx % 2 === 0) ? 'row-player-even' : 'row-player-odd';
    rowsHtml += `
      <tr class="${rowBgClass}">
        <td>
          <div class="cat-player-name">
            <span>${itemUnit.itemIcon} ${escapeHtml(itemUnit.itemName)}</span>
          </div>
        </td>
        <td><span class="page-num-badge">หน้า ${itemUnit.page}</span></td>
        <td><span class="slot-num-badge">ช่อง ${itemUnit.slot}</span></td>
      </tr>
    `;
  });

  container.innerHTML = `
    <div class="category-table-box wheel-table-box">
      <div class="category-table-header wheel">
        <div class="cat-header-title">
          <span>🎯 ไอเทมสำหรับกิจกรรมวงล้อ</span>
          <span class="badge badge-warning">${wheelItems.length} ชิ้น</span>
        </div>
      </div>
      <table class="cat-table">
        <thead>
          <tr>
            <th>รายการไอเทม</th>
            <th style="width: 95px;">หน้าที่</th>
            <th style="width: 95px;">ช่องที่</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

// Screenshot / Capture Functions
async function captureCategoryTable(key, categoryName) {
  const tableBox = document.querySelector(`.category-table-box[data-key="${key}"]`);
  if (!tableBox) return;

  if (typeof html2canvas === 'undefined') {
    alert('ระบบสร้างภาพยังไม่พร้อมใช้งาน กรุณารอเบราว์เซอร์โหลดสักครู่ครับ');
    return;
  }

  const tbody = tableBox.querySelector('tbody');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  
  if (rows.length === 0) return;

  const MAX_ROWS_PER_IMAGE = 30;
  const totalParts = Math.ceil(rows.length / MAX_ROWS_PER_IMAGE);

  if (totalParts > 1) {
    showToast(`📸 แบ่งแคปรูปตาราง ${categoryName} เป็น ${totalParts} ไฟล์ (ไม่เกิน 30 แถว/รูป)...`);
  } else {
    showToast(`📸 กำลังแคปรูปตาราง ${categoryName}...`);
  }

  for (let part = 0; part < totalParts; part++) {
    const startIdx = part * MAX_ROWS_PER_IMAGE;
    const endIdx = Math.min((part + 1) * MAX_ROWS_PER_IMAGE, rows.length);
    const chunkRows = rows.slice(startIdx, endIdx);

    // Clone container element for capturing
    const cloneBox = tableBox.cloneNode(true);

    // Remove action buttons in header clone
    const actions = cloneBox.querySelector('.cat-header-actions');
    if (actions) actions.remove();

    // Add part indicator if split into multiple files
    if (totalParts > 1) {
      const titleDiv = cloneBox.querySelector('.cat-header-title');
      if (titleDiv) {
        const partTag = document.createElement('span');
        partTag.className = 'badge badge-warning';
        partTag.style.marginLeft = '8px';
        partTag.textContent = `(ส่วนที่ ${part + 1}/${totalParts}: แถว ${startIdx + 1}-${endIdx})`;
        titleDiv.appendChild(partTag);
      }
    }

    // Replace tbody with slice of rows
    const cloneTbody = cloneBox.querySelector('tbody');
    cloneTbody.innerHTML = '';
    chunkRows.forEach(r => cloneTbody.appendChild(r.cloneNode(true)));

    // Position off-screen for clean rendering
    cloneBox.style.position = 'fixed';
    cloneBox.style.left = '-9999px';
    cloneBox.style.top = '0';
    cloneBox.style.width = tableBox.offsetWidth + 'px';
    document.body.appendChild(cloneBox);

    try {
      const canvas = await html2canvas(cloneBox, {
        backgroundColor: '#0f1626',
        scale: 2,
        useCORS: true
      });

      await new Promise((resolve) => {
        canvas.toBlob(blob => {
          const suffix = totalParts > 1 ? `_Part${part + 1}` : '';
          const fileName = `ตารางประมูล_${categoryName.replace(/\s+/g, '_')}${suffix}.png`;
          
          const link = document.createElement('a');
          link.download = fileName;
          link.href = URL.createObjectURL(blob);
          link.click();

          if (part === 0 && navigator.clipboard && window.ClipboardItem) {
            navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]).catch(() => {});
          }

          setTimeout(resolve, 400);
        });
      });
    } catch (err) {
      console.error('Capture error:', err);
    } finally {
      document.body.removeChild(cloneBox);
    }
  }

  showToast(`📸 แคปรูปตาราง ${categoryName} เรียบร้อย! (${totalParts} ไฟล์)`);
}

async function captureWheelTable() {
  const container = document.getElementById('wheelSummaryContainer');
  if (!container) return;

  const tableBox = container.querySelector('.category-table-box');
  if (!tableBox) {
    showToast('✨ ไม่มีไอเทมกิจกรรมวงล้อให้แคปรูปครับ');
    return;
  }

  if (typeof html2canvas === 'undefined') {
    alert('ระบบสร้างภาพยังไม่พร้อมใช้งาน กรุณารอเบราว์เซอร์โหลดสักครู่ครับ');
    return;
  }

  const tbody = tableBox.querySelector('tbody');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  if (rows.length === 0) return;

  const MAX_ROWS_PER_IMAGE = 30;
  const totalParts = Math.ceil(rows.length / MAX_ROWS_PER_IMAGE);

  if (totalParts > 1) {
    showToast(`📸 แบ่งแคปรูปตารางกิจกรรมวงล้อเป็น ${totalParts} ไฟล์...`);
  } else {
    showToast(`📸 กำลังแคปรูปตารางกิจกรรมวงล้อ...`);
  }

  for (let part = 0; part < totalParts; part++) {
    const startIdx = part * MAX_ROWS_PER_IMAGE;
    const endIdx = Math.min((part + 1) * MAX_ROWS_PER_IMAGE, rows.length);
    const chunkRows = rows.slice(startIdx, endIdx);

    const cloneBox = tableBox.cloneNode(true);

    if (totalParts > 1) {
      const titleDiv = cloneBox.querySelector('.cat-header-title');
      if (titleDiv) {
        const partTag = document.createElement('span');
        partTag.className = 'badge badge-warning';
        partTag.style.marginLeft = '8px';
        partTag.textContent = `(ส่วนที่ ${part + 1}/${totalParts})`;
        titleDiv.appendChild(partTag);
      }
    }

    const cloneTbody = cloneBox.querySelector('tbody');
    if (cloneTbody) {
      cloneTbody.innerHTML = '';
      chunkRows.forEach(r => cloneTbody.appendChild(r.cloneNode(true)));
    }

    cloneBox.style.position = 'fixed';
    cloneBox.style.left = '-9999px';
    cloneBox.style.top = '0';
    cloneBox.style.width = tableBox.offsetWidth + 'px';
    document.body.appendChild(cloneBox);

    try {
      const canvas = await html2canvas(cloneBox, {
        backgroundColor: '#0f1626',
        scale: 2,
        useCORS: true
      });

      await new Promise((resolve) => {
        canvas.toBlob(blob => {
          const suffix = totalParts > 1 ? `_Part${part + 1}` : '';
          const fileName = `ตารางประมูล_กิจกรรมวงล้อ${suffix}.png`;
          
          const link = document.createElement('a');
          link.download = fileName;
          link.href = URL.createObjectURL(blob);
          link.click();

          if (part === 0 && navigator.clipboard && window.ClipboardItem) {
            navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]).catch(() => {});
          }

          setTimeout(resolve, 400);
        });
      });
    } catch (err) {
      console.error('Capture wheel error:', err);
    } finally {
      document.body.removeChild(cloneBox);
    }
  }

  showToast(`📸 แคปรูปตารางกิจกรรมวงล้อเรียบร้อยแล้ว!`);
}

// Export formatted text to Discord/Line
function copyGuildText() {
  const result = calculateEngine();
  const playerNames = Object.keys(result.playerAssignmentsMap);

  if (playerNames.length === 0 || result.allItems.length === 0) {
    alert('กรุณากรอกข้อมูลจำนวนไอเทมและรายชื่อผู้ประมูลก่อนคัดลอกครับ!');
    return;
  }

  let text = `==============================\n`;
  text += `⚔️ สรุปคิวประมูล RO Origin Classic ⚔️\n`;
  text += `📦 รวมไอเทมทั้งหมด: ${result.allItems.length} ชิ้น (${result.totalPages} หน้า)\n`;
  text += `==============================\n\n`;

  playerNames.forEach(playerName => {
    const assignedItems = result.playerAssignmentsMap[playerName];
    if (assignedItems.length === 0) return;

    text += `👤 [ ${playerName} ]\n`;

    assignedItems.forEach((itemUnit) => {
      text += `  • ${itemUnit.itemIcon} ${itemUnit.itemName}: หน้า ${itemUnit.page} (ช่อง ${itemUnit.slot})\n`;
    });

    text += `\n`;
  });

  text += `==============================\n`;
  text += `⚠️ หมายเหตุ: กรุณากดประมูลให้ตรงตามเลขอินเด็กซ์หน้าและช่องที่ระบุไว้ครับ!`;

  navigator.clipboard.writeText(text).then(() => {
    showToast('📋 คัดลอกสรุปคิวส่ง Discord/Line เรียบร้อยแล้ว!');
  }).catch(err => {
    console.error('Copy failed', err);
    alert('ไม่สามารถคัดลอกอัตโนมัติได้ กรุณาคัดลอกด้วยตนเอง');
  });
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
