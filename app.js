// RO Origin Classic - Auction Helper Application Logic

const QUOTAS = {
  album: 1,
  shard: 1,
  whiteFeather: 3,
  blackFeather: 5
};

const ITEM_TYPES = [
  { key: 'album', name: 'สมุดการ์ดบอส', icon: '<img src="images/card-album.svg" class="feather-svg-icon-tbl" alt="📘">', textIcon: '📘', color: '#fbbf24' },
  { key: 'shard', name: 'เศษการ์ดบอส', icon: '<img src="images/card-shard.svg" class="feather-svg-icon-tbl" alt="🧩">', textIcon: '🧩', color: '#3b82f6' },
  { key: 'whiteFeather', name: 'ขนนกขาว', icon: '<img src="images/white-feather.svg" class="feather-svg-icon-tbl" alt="🪶">', textIcon: '🪶(ขาว)', color: '#10b981' },
  { key: 'blackFeather', name: 'ขนนกดำแดง', icon: '<img src="images/red-feather.svg" class="feather-svg-icon-tbl" alt="🪶">', textIcon: '🪶(แดง)', color: '#a855f7' }
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
  buyoutDeductions: {
    album: {},
    shard: {},
    whiteFeather: {},
    blackFeather: {}
  },
  buyoutHistory: [],
  searchTerm: ''
};

// DOM Elements
const quotaInputs = {
  album: document.getElementById('quotaAlbum'),
  shard: document.getElementById('quotaShard'),
  whiteFeather: document.getElementById('quotaWhiteFeather'),
  blackFeather: document.getElementById('quotaBlackFeather')
};

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
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initEventListeners();
  loadStateFromUI();
  calculateAndRender();
  await checkUrlShareMode();
});

window.addEventListener('hashchange', async () => {
  await checkUrlShareMode();
});

function loadQuotasFromUI() {
  Object.keys(quotaInputs).forEach(key => {
    const val = parseInt(quotaInputs[key].value);
    QUOTAS[key] = (val && val > 0) ? val : 1;
  });
}

function initEventListeners() {
  // Quota Inputs Listener
  Object.keys(quotaInputs).forEach(key => {
    if (quotaInputs[key]) {
      quotaInputs[key].addEventListener('input', () => {
        loadQuotasFromUI();
        updateListCounts();
        calculateAndRender();
      });
    }
  });

  // Stock Inputs Listener
  Object.keys(stockInputs).forEach(key => {
    if (stockInputs[key]) {
      stockInputs[key].addEventListener('input', () => {
        appData.stocks[key] = parseInt(stockInputs[key].value) || 0;
        updateListCounts();
        calculateAndRender();
      });
    }
  });

  // Name Lists Listener
  Object.keys(listInputs).forEach(key => {
    if (listInputs[key]) {
      listInputs[key].addEventListener('input', () => {
        updateListCounts();
        calculateAndRender();
      });
    }
  });

  // Search Listener
  const searchInput = document.getElementById('searchMember');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      appData.searchTerm = e.target.value.trim().toLowerCase();
      calculateAndRender();
    });
  }

  // Action Buttons
  const btnDemo = document.getElementById('btnDemo');
  if (btnDemo) btnDemo.addEventListener('click', loadDemoData);

  const btnReset = document.getElementById('btnReset');
  if (btnReset) btnReset.addEventListener('click', resetAll);

  const btnCopyGuild = document.getElementById('btnCopyGuild');
  if (btnCopyGuild) btnCopyGuild.addEventListener('click', copyGuildText);

  const btnCapWheel = document.getElementById('btnCapWheel');
  if (btnCapWheel) btnCapWheel.addEventListener('click', captureWheelTable);

  // Share & View-Only Mode Buttons
  const btnShare = document.getElementById('btnShareLink');
  if (btnShare) {
    btnShare.addEventListener('click', generateAndCopyShareLink);
  }

  const btnSwitchToEdit = document.getElementById('btnSwitchToEdit');
  if (btnSwitchToEdit) {
    btnSwitchToEdit.addEventListener('click', () => {
      setViewOnlyMode(false);
      showToast('✏️ สลับเป็นโหมดแก้ไขเรียบร้อยแล้ว');
    });
  }
}

// Helpers for Ultra-Short Base64URL Encoding/Decoding
function base64urlEncode(uint8Array) {
  let binary = '';
  const len = uint8Array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(base64urlStr) {
  let base64 = base64urlStr.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Share Link & View-Only Logic (Ultra-Compressed Custom Format + Deflate + Base64URL)
async function encodeShareData() {
  try {
    const q = [
      parseInt(quotaInputs.album ? quotaInputs.album.value : 1) || 1,
      parseInt(quotaInputs.shard ? quotaInputs.shard.value : 1) || 1,
      parseInt(quotaInputs.whiteFeather ? quotaInputs.whiteFeather.value : 3) || 3,
      parseInt(quotaInputs.blackFeather ? quotaInputs.blackFeather.value : 5) || 5
    ];
    const s = [
      parseInt(stockInputs.album ? stockInputs.album.value : 0) || 0,
      parseInt(stockInputs.shard ? stockInputs.shard.value : 0) || 0,
      parseInt(stockInputs.whiteFeather ? stockInputs.whiteFeather.value : 0) || 0,
      parseInt(stockInputs.blackFeather ? stockInputs.blackFeather.value : 0) || 0
    ];
    const l = [
      parseNames(listInputs.album ? listInputs.album.value : '').join('\x1f'),
      parseNames(listInputs.shard ? listInputs.shard.value : '').join('\x1f'),
      parseNames(listInputs.whiteFeather ? listInputs.whiteFeather.value : '').join('\x1f'),
      parseNames(listInputs.blackFeather ? listInputs.blackFeather.value : '').join('\x1f')
    ];

    // Ultra-compact binary string structure: "qStr;sStr;lStr;bStr"
    const qStr = (q.join(',') === '1,1,3,5') ? '' : q.join(',');
    const sStr = s.join(',');
    const lStr = l.join('\x1e');

    // Build buyout deductions compact string
    const bArr = [];
    ITEM_TYPES.forEach(t => {
      const k = t.key;
      const deds = appData.buyoutDeductions[k] || {};
      Object.keys(deds).forEach(pName => {
        const cnt = deds[pName];
        if (cnt > 0) {
          bArr.push(`${k}\x1f${pName}\x1f${cnt}`);
        }
      });
    });
    const bStr = bArr.join('\x1e');

    const compactText = `${qStr};${sStr};${lStr};${bStr}`;

    // Try Native Deflate Compression (Ultra-compact for Thai UTF-8 text)
    if (typeof CompressionStream !== 'undefined') {
      try {
        const stream = new Blob([compactText]).stream().pipeThrough(new CompressionStream('deflate-raw'));
        const response = new Response(stream);
        const buffer = await response.arrayBuffer();
        return 'c' + base64urlEncode(new Uint8Array(buffer));
      } catch (e) {
        console.warn('CompressionStream error, fallback to LZString:', e);
      }
    }

    const legacyJson = JSON.stringify([q, s, [
      listInputs.album ? listInputs.album.value : '',
      listInputs.shard ? listInputs.shard.value : '',
      listInputs.whiteFeather ? listInputs.whiteFeather.value : '',
      listInputs.blackFeather ? listInputs.blackFeather.value : ''
    ]]);

    if (typeof LZString !== 'undefined' && LZString.compressToEncodedURIComponent) {
      return LZString.compressToEncodedURIComponent(legacyJson);
    }
    return btoa(encodeURIComponent(legacyJson));
  } catch (err) {
    console.error('encodeShareData error:', err);
    return '';
  }
}

async function decodeShareData(encodedStr) {
  if (!encodedStr) return null;
  let jsonStr = '';

  // New Custom Compact Deflate format (starts with 'c')
  if (encodedStr.startsWith('c') && typeof DecompressionStream !== 'undefined') {
    try {
      const rawBase64 = encodedStr.slice(1);
      const buffer = base64urlDecode(rawBase64);
      const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      const response = new Response(stream);
      const text = await response.text();
      
      const parts = text.split(';');
      if (parts.length >= 3) {
        const [qStr, sStr, lStr, bStr] = parts;
        const qArr = qStr ? qStr.split(',').map(Number) : [1, 1, 3, 5];
        const sArr = sStr ? sStr.split(',').map(Number) : [0, 0, 0, 0];
        const lCats = lStr ? lStr.split('\x1e') : ['', '', '', ''];
        
        const buyoutDeductions = { album: {}, shard: {}, whiteFeather: {}, blackFeather: {} };
        if (bStr) {
          const bEntries = bStr.split('\x1e');
          bEntries.forEach(entry => {
            if (!entry) return;
            const [k, pName, cntStr] = entry.split('\x1f');
            if (k && pName && cntStr) {
              if (!buyoutDeductions[k]) buyoutDeductions[k] = {};
              buyoutDeductions[k][pName] = parseInt(cntStr) || 0;
            }
          });
        }

        return {
          quotas: { album: qArr[0] || 1, shard: qArr[1] || 1, whiteFeather: qArr[2] || 3, blackFeather: qArr[3] || 5 },
          stocks: { album: sArr[0] || 0, shard: sArr[1] || 0, whiteFeather: sArr[2] || 0, blackFeather: sArr[3] || 0 },
          lists: {
            album: lCats[0] ? lCats[0].split('\x1f').join('\n') : '',
            shard: lCats[1] ? lCats[1].split('\x1f').join('\n') : '',
            whiteFeather: lCats[2] ? lCats[2].split('\x1f').join('\n') : '',
            blackFeather: lCats[3] ? lCats[3].split('\x1f').join('\n') : ''
          },
          buyoutDeductions
        };
      }
    } catch (e) {
      console.warn('DecompressionStream failed for custom format:', e);
    }
  }

  // Deflate-raw JSON format (starts with 'z')
  if (encodedStr.startsWith('z') && typeof DecompressionStream !== 'undefined') {
    try {
      const rawBase64 = encodedStr.slice(1);
      const buffer = base64urlDecode(rawBase64);
      const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      const response = new Response(stream);
      jsonStr = await response.text();
    } catch (e) {
      console.warn('DecompressionStream failed:', e);
      jsonStr = '';
    }
  }

  // Try LZString decompression fallback
  if (!jsonStr && typeof LZString !== 'undefined' && LZString.decompressFromEncodedURIComponent) {
    try {
      jsonStr = LZString.decompressFromEncodedURIComponent(encodedStr);
    } catch (e) {}
  }

  // Fallback to legacy base64 if LZString failed or uncompressed
  if (!jsonStr) {
    try {
      jsonStr = decodeURIComponent(atob(encodedStr));
    } catch (e) {
      jsonStr = '';
    }
  }

  if (!jsonStr) return null;

  try {
    const parsed = JSON.parse(jsonStr);
    // New Compact Array Format: [q, s, l]
    if (Array.isArray(parsed) && parsed.length === 3) {
      const [q, s, l] = parsed;
      return {
        quotas: { album: q[0], shard: q[1], whiteFeather: q[2], blackFeather: q[3] },
        stocks: { album: s[0], shard: s[1], whiteFeather: s[2], blackFeather: s[3] },
        lists: { album: l[0], shard: l[1], whiteFeather: l[2], blackFeather: l[3] }
      };
    }
    // Legacy Object Format Fallback
    if (parsed.quotas || parsed.stocks || parsed.lists) {
      return parsed;
    }
  } catch (err) {
    console.error('Failed to parse decoded share data:', err);
  }
  return null;
}

async function generateAndCopyShareLink() {
  const encoded = await encodeShareData();
  if (!encoded) {
    showToast('⚠️ ไม่สามารถสร้างลิงก์แชร์ได้');
    return;
  }
  const cleanUrl = window.location.href.split('#')[0];
  const shareUrl = `${cleanUrl}#s=${encoded}`;

  const toastMsg = '🔗 คัดลอกลิงก์สำหรับแชร์ (View-Only) เรียบร้อยแล้ว!';

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast(toastMsg);
    }).catch(() => {
      fallbackCopyText(shareUrl, toastMsg);
    });
  } else {
    fallbackCopyText(shareUrl, toastMsg);
  }
}

function fallbackCopyText(text, successMsg) {
  const input = document.createElement('textarea');
  input.value = text;
  input.style.position = 'fixed';
  input.style.top = '0';
  input.style.left = '0';
  input.style.opacity = '0';
  input.style.pointerEvents = 'none';
  document.body.appendChild(input);
  input.focus();
  input.select();
  
  let success = false;
  try {
    success = document.execCommand('copy');
  } catch (err) {
    success = false;
  }
  document.body.removeChild(input);

  if (success) {
    showToast(successMsg || '🔗 คัดลอกลิงก์สำหรับแชร์ (View-Only) เรียบร้อยแล้ว!');
  } else {
    window.prompt('คัดลอกลิงก์แชร์คิวข้างล่างนี้ได้เลยครับ:', text);
  }
}

function setViewOnlyMode(isViewOnly) {
  const banner = document.getElementById('viewOnlyBanner');
  if (isViewOnly) {
    document.body.classList.add('view-only-mode');
    if (banner) banner.classList.remove('hidden');
  } else {
    document.body.classList.remove('view-only-mode');
    if (banner) banner.classList.add('hidden');
  }
}

async function checkUrlShareMode() {
  const hash = window.location.hash;
  if (hash && (hash.startsWith('#share=') || hash.startsWith('#s='))) {
    const encodedStr = hash.replace('#share=', '').replace('#s=', '');
    const shareData = await decodeShareData(encodedStr);
    if (shareData) {
      if (shareData.quotas) {
        Object.keys(shareData.quotas).forEach(k => {
          if (quotaInputs[k]) quotaInputs[k].value = shareData.quotas[k];
        });
      }
      if (shareData.stocks) {
        Object.keys(shareData.stocks).forEach(k => {
          if (stockInputs[k]) stockInputs[k].value = shareData.stocks[k];
        });
      }
      if (shareData.lists) {
        Object.keys(shareData.lists).forEach(k => {
          if (listInputs[k]) listInputs[k].value = shareData.lists[k];
        });
      }
      if (shareData.buyoutDeductions) {
        appData.buyoutDeductions = shareData.buyoutDeductions;
      }
      loadStateFromUI();
      calculateAndRender();
      setViewOnlyMode(true);
      showToast('👀 เปิดในโหมด View-Only สำหรับสมาชิก (รวมรายการที่โดน Buyout แล้ว)');
    }
  }
}

function parseNames(text) {
  if (!text) return [];
  return text
    .split('\n')
    .map(name => name.trim())
    .filter(name => name.length > 0);
}

function getTotalCategoryStock(key) {
  const stock = appData.stocks[key] || 0;
  const deds = appData.buyoutDeductions[key] || {};
  let totalDeductions = 0;
  Object.keys(deds).forEach(p => {
    totalDeductions += (deds[p] || 0);
  });
  return stock + totalDeductions;
}

function updateListCounts() {
  loadQuotasFromUI();
  Object.keys(listInputs).forEach(key => {
    const totalStock = getTotalCategoryStock(key);
    const quota = QUOTAS[key];
    const maxPlayers = Math.floor(totalStock / quota);

    let names = parseNames(listInputs[key].value);

    // Dynamic input footer text
    const footerEl = listInputs[key].parentElement.querySelector('.input-footer');
    const unitStr = (key === 'album') ? 'เล่ม' : 'ชิ้น';
    if (footerEl) {
      footerEl.textContent = `คนละ ${quota} ${unitStr} (จำกัดสูงสุดตามสต็อก)`;
    }

    // Strictly limit allowed player names to maxPlayers based on total stock (including buyouts) and quota
    if (totalStock > 0 && names.length > maxPlayers) {
      names = names.slice(0, maxPlayers);
      listInputs[key].value = names.join('\n');
      const catObj = ITEM_TYPES.find(t => t.key === key);
      showToast(`⚠️ ${catObj.name}: ปรับโควต้าเป็น ${quota} ${unitStr}/คน ล็อคได้สูงสุด ${maxPlayers} คน`);
    } else if (totalStock === 0 && names.length > 0) {
      names = [];
      listInputs[key].value = '';
      const catObj = ITEM_TYPES.find(t => t.key === key);
      showToast(`⚠️ กรุณากำหนดจำนวนสต็อก ${catObj.name} ก่อนใส่รายชื่อครับ`);
    }

    if (maxPlayers > 0) {
      countBadges[key].textContent = `${names.length}/${maxPlayers} คน`;
    } else {
      countBadges[key].textContent = `0 คน`;
    }

    appData.lists[key] = names;
  });
}

function loadStateFromUI() {
  loadQuotasFromUI();
  Object.keys(stockInputs).forEach(key => {
    appData.stocks[key] = parseInt(stockInputs[key].value) || 0;
  });
  updateListCounts();
}

function loadDemoData() {
  quotaInputs.album.value = 1;
  quotaInputs.shard.value = 1;
  quotaInputs.whiteFeather.value = 3;
  quotaInputs.blackFeather.value = 5;

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

  quotaInputs.album.value = 1;
  quotaInputs.shard.value = 1;
  quotaInputs.whiteFeather.value = 3;
  quotaInputs.blackFeather.value = 5;

  Object.keys(stockInputs).forEach(key => stockInputs[key].value = 0);
  Object.keys(listInputs).forEach(key => listInputs[key].value = '');

  appData.buyoutDeductions = { album: {}, shard: {}, whiteFeather: {}, blackFeather: {} };
  appData.buyoutHistory = [];

  loadStateFromUI();
  calculateAndRender();
  updateBuyoutHistoryUI();
  showToast('🗑️ ล้างข้อมูลเรียบร้อยแล้ว');
}

// Buyout Cut Engine Handlers
function handleBuyoutCut(key, catName, playerName, page, slot) {
  // 1. Deduct 1 stock
  if (appData.stocks[key] > 0) {
    appData.stocks[key] -= 1;
    if (stockInputs[key]) stockInputs[key].value = appData.stocks[key];
  }

  // 2. Track buyout deduction for player
  if (!appData.buyoutDeductions[key]) appData.buyoutDeductions[key] = {};
  appData.buyoutDeductions[key][playerName] = (appData.buyoutDeductions[key][playerName] || 0) + 1;

  // 3. Add to history stack for undo
  appData.buyoutHistory.push({
    key,
    catName,
    playerName,
    page,
    slot,
    timestamp: new Date()
  });

  // 4. Recalculate & update UI
  updateListCounts();
  calculateAndRender();
  updateBuyoutHistoryUI();

  showToast(`🚫 ตัดคิว Buyout: ${playerName} (${catName} หน้า ${page} แถว ${slot}) เรียบร้อย! คิวถัดไปขยับขึ้น 1 แถวอัตโนมัติ`);
}

function undoLastBuyout() {
  if (appData.buyoutHistory.length === 0) return;

  const lastCut = appData.buyoutHistory.pop();
  const { key, catName, playerName, page, slot } = lastCut;

  // 1. Restore stock
  appData.stocks[key] = (appData.stocks[key] || 0) + 1;
  if (stockInputs[key]) stockInputs[key].value = appData.stocks[key];

  // 2. Reduce deduction
  if (appData.buyoutDeductions[key] && appData.buyoutDeductions[key][playerName] > 0) {
    appData.buyoutDeductions[key][playerName] -= 1;
  }

  // 3. Recalculate & update UI
  updateListCounts();
  calculateAndRender();
  updateBuyoutHistoryUI();

  showToast(`↩️ เรียกคืนคิวที่โดน Buyout: ${playerName} (${catName} หน้า ${page} แถว ${slot}) คืนสู่ระบบเรียบร้อย`);
}

function updateBuyoutHistoryUI() {
  const bar = document.getElementById('buyoutHistoryBar');
  const tagsContainer = document.getElementById('buyoutHistoryList');
  const btnUndo = document.getElementById('btnUndoBuyout');

  if (!bar || !tagsContainer) return;

  if (appData.buyoutHistory.length === 0) {
    bar.classList.add('hidden');
    tagsContainer.innerHTML = '';
  } else {
    bar.classList.remove('hidden');
    tagsContainer.innerHTML = appData.buyoutHistory.map(h => `
      <span class="buyout-tag">👤 ${escapeHtml(h.playerName)} (${escapeHtml(h.catName)}: หน้า ${h.page} แถว ${h.slot})</span>
    `).join('');
  }

  if (btnUndo) {
    btnUndo.onclick = undoLastBuyout;
  }
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
    const baseQuota = QUOTAS[key];
    const playerList = appData.lists[key] || [];

    // Find available item slots of this type
    const availableItemsOfCategory = allItems.filter(item => item.itemType === key && item.assignedTo === null);
    let itemPointer = 0;

    playerList.forEach(playerName => {
      if (!playerAssignmentsMap[playerName]) {
        playerAssignmentsMap[playerName] = [];
      }

      // Check if player has any Buyout deductions
      const deduction = (appData.buyoutDeductions[key] && appData.buyoutDeductions[key][playerName]) || 0;
      const effectiveQuota = Math.max(0, baseQuota - deduction);

      if (effectiveQuota > 0) {
        const remainingInStock = availableItemsOfCategory.length - itemPointer;
        const giveCount = Math.min(effectiveQuota, remainingInStock);
        for (let q = 0; q < giveCount; q++) {
          const itemToGive = availableItemsOfCategory[itemPointer];
          itemToGive.assignedTo = playerName;
          playerAssignmentsMap[playerName].push(itemToGive);
          itemPointer++;
        }
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
          const iconPrefix = `<span class="player-icon-prefix">${typeObj.icon}</span>`;

          rowsHtml += `
            <tr class="${rowBgClass} ${isGroupStart}">
              <td>
                <div class="cat-player-name" title="${escapeHtml(pName)}">
                  ${iconPrefix}<span>${escapeHtml(pName)}</span>
                </div>
              </td>
              <td><span class="page-num-badge">หน้า ${itemUnit.page}</span></td>
              <td><span class="slot-num-badge">แถว ${itemUnit.slot}</span></td>
              <td>
                <button class="btn-buyout-cut" data-key="${key}" data-name="${typeObj.name}" data-player="${escapeHtml(pName)}" data-page="${itemUnit.page}" data-slot="${itemUnit.slot}" title="ตัดคิว Buyout 1 ชิ้น (หน้า ${itemUnit.page} แถว ${itemUnit.slot})"><img src="images/icon-buyout.svg" class="btn-buyout-icon" alt="🚫"></button>
              </td>
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
          <button class="btn-cap btn-cap-single" data-key="${key}" data-name="${typeObj.name}" title="แคปรูปตาราง"><img src="images/icon-camera.svg" class="btn-svg-icon" alt=""></button>
        </div>
      </div>
      <table class="cat-table">
        <thead>
          <tr>
            <th style="padding-left: 8px;">ชื่อผู้เล่น</th>
            <th style="width: 58px; text-align: center; white-space: nowrap;">หน้าที่</th>
            <th style="width: 58px; text-align: center; white-space: nowrap;">แถวที่</th>
            <th style="width: 36px; text-align: center; white-space: nowrap;"></th>
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
      const btnEl = e.target.closest('button') || e.currentTarget;
      const key = btnEl.getAttribute('data-key');
      const name = btnEl.getAttribute('data-name');
      captureCategoryTable(key, name);
    });
  });

  // Attach event listeners for buyout cut buttons
  document.querySelectorAll('.btn-buyout-cut').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const btnEl = e.target.closest('button') || e.currentTarget;
      const key = btnEl.getAttribute('data-key');
      const name = btnEl.getAttribute('data-name');
      const player = btnEl.getAttribute('data-player');
      const page = btnEl.getAttribute('data-page');
      const slot = btnEl.getAttribute('data-slot');

      handleBuyoutCut(key, name, player, page, slot);
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
      <div style="text-align: center; color: var(--text-muted); padding: 16px 0;">
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
        <td><span class="slot-num-badge">แถว ${itemUnit.slot}</span></td>
      </tr>
    `;
  });

  container.innerHTML = `
    <div class="category-table-box wheel-table-box">
      <div class="category-table-header wheel">
        <div class="cat-header-title">
          <span><img src="images/icon-table.svg" class="btn-svg-icon" alt="" style="width: 18px; height: 18px; vertical-align: sub;"> ไอเทมสำหรับกิจกรรมวงล้อ</span>
          <span class="badge badge-warning">${wheelItems.length} ชิ้น</span>
        </div>
        <div class="cat-header-actions">
          <button class="btn-cap btn-cap-wheel-inner" title="แคปรูปตาราง"><img src="images/icon-camera.svg" class="btn-svg-icon" alt=""></button>
        </div>
      </div>
      <table class="cat-table">
        <thead>
          <tr>
            <th style="padding-left: 8px;">รายการไอเทม</th>
            <th style="width: 58px; text-align: center; white-space: nowrap;">หน้าที่</th>
            <th style="width: 58px; text-align: center; white-space: nowrap;">แถวที่</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;

  const innerCapBtn = container.querySelector('.btn-cap-wheel-inner');
  if (innerCapBtn) {
    innerCapBtn.addEventListener('click', captureWheelTable);
  }
}

function getFormattedTimestamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
}

// Screenshot / Capture Functions
async function captureTableElement(tableBox, baseFileName) {
  if (!tableBox) return;

  if (typeof html2canvas === 'undefined') {
    alert('ระบบสร้างภาพยังไม่พร้อมใช้งาน กรุณารอเบราว์เซอร์โหลดสักครู่ครับ');
    return;
  }

  const tbody = tableBox.querySelector('tbody');
  if (!tbody) {
    showToast('✨ ไม่มีรายการไอเทมให้แคปรูปครับ');
    return;
  }
  const rows = Array.from(tbody.querySelectorAll('tr'));
  if (rows.length === 0) {
    showToast('✨ ไม่มีรายการไอเทมให้แคปรูปครับ');
    return;
  }

  const MAX_ROWS_PER_IMAGE = 30;
  const totalParts = Math.ceil(rows.length / MAX_ROWS_PER_IMAGE);
  const targetWidth = tableBox.offsetWidth || 480;

  if (totalParts === 1) {
    showToast(`📸 กำลังแคปรูปตาราง...`);
  } else {
    showToast(`📸 กำลังแบ่งแคปรูปเป็น ${totalParts} ไฟล์ (ไม่เกิน 30 แถว/รูป)...`);
  }

  const timestamp = getFormattedTimestamp();

  for (let part = totalParts - 1; part >= 0; part--) {
    const startIdx = part * MAX_ROWS_PER_IMAGE;
    const endIdx = Math.min((part + 1) * MAX_ROWS_PER_IMAGE, rows.length);
    const chunkRows = rows.slice(startIdx, endIdx);

    // Create standalone wrapper outside CSS Grid to prevent height stretching
    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.top = '-9999px';
    wrapper.style.left = '-9999px';
    wrapper.style.width = targetWidth + 'px';
    wrapper.style.zIndex = '-9999';

    const cloneBox = tableBox.cloneNode(true);
    const actions = cloneBox.querySelector('.cat-header-actions');
    if (actions) actions.remove();

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
      chunkRows.forEach(r => {
        const rowClone = r.cloneNode(true);
        if (rowClone.children.length >= 4) {
          rowClone.children[3].remove();
        }
        cloneTbody.appendChild(rowClone);
      });
    }

    // Remove buyout cut buttons and 4th column from header in cloneBox
    cloneBox.querySelectorAll('.btn-buyout-cut').forEach(btn => btn.remove());
    cloneBox.querySelectorAll('thead tr').forEach(tr => {
      if (tr.children.length >= 4) {
        tr.children[3].remove();
      }
    });

    // Ensure 3-column screenshot clone has ample column width & right padding so badges never clip
    cloneBox.querySelectorAll('th:nth-child(2), td:nth-child(2)').forEach(cell => {
      cell.style.width = '76px';
    });
    cloneBox.querySelectorAll('th:nth-child(3), td:nth-child(3)').forEach(cell => {
      cell.style.width = '84px';
      cell.style.paddingRight = '16px';
    });

    // Reset height constraints on cloneBox so canvas fits exact content size
    cloneBox.style.width = '100%';
    cloneBox.style.height = 'auto';
    cloneBox.style.minHeight = '0';
    cloneBox.style.maxHeight = 'none';
    cloneBox.style.margin = '0';
    cloneBox.style.boxShadow = 'none';

    wrapper.appendChild(cloneBox);
    document.body.appendChild(wrapper);

    try {
      const canvas = await html2canvas(cloneBox, {
        backgroundColor: '#1e1f22',
        scale: 2,
        useCORS: true,
        logging: false
      });

      const dataUrl = canvas.toDataURL('image/png');
      const suffix = totalParts > 1 ? `_Part${part + 1}` : '';
      const fileName = `${baseFileName}_${timestamp}${suffix}.png`;

      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (totalParts === 1 && navigator.clipboard && window.ClipboardItem && canvas.toBlob) {
        canvas.toBlob(blob => {
          if (blob) {
            navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]).catch(() => {});
          }
        });
      }

      if (totalParts > 1) {
        await new Promise(r => setTimeout(r, 400));
      }
    } catch (err) {
      console.error('Capture error:', err);
    } finally {
      wrapper.remove();
    }
  }

  showToast(totalParts > 1 ? `📸 แคปรูปตารางเรียบร้อยแล้ว! (${totalParts} ไฟล์)` : `📸 แคปรูปตารางเรียบร้อยแล้ว!`);
}

function captureCategoryTable(key, categoryName) {
  const tableBox = document.querySelector(`.category-table-box[data-key="${key}"]`);
  if (!tableBox) return;
  const fileName = `ตารางประมูล_${categoryName.replace(/\s+/g, '_')}`;
  captureTableElement(tableBox, fileName);
}

function captureWheelTable() {
  const container = document.getElementById('wheelSummaryContainer');
  if (!container) return;
  const tableBox = container.querySelector('.category-table-box');
  if (!tableBox) {
    showToast('✨ ไม่มีไอเทมกิจกรรมวงล้อให้แคปรูปครับ');
    return;
  }
  captureTableElement(tableBox, 'ตารางประมูล_กิจกรรมวงล้อ');
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
      const iconStr = itemUnit.textIcon || itemUnit.itemIcon;
      text += `  • ${iconStr} ${itemUnit.itemName}: หน้า ${itemUnit.page} (แถว ${itemUnit.slot})\n`;
    });

    text += `\n`;
  });

  text += `==============================\n`;
  text += `⚠️ หมายเหตุ: กรุณากดประมูลให้ตรงตามเลขอินเด็กซ์หน้าและแถวที่ระบุไว้ครับ!`;

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

// Theme Toggle Implementation
function initTheme() {
  const savedTheme = localStorage.getItem('ro_auction_theme') || 'dark';
  applyTheme(savedTheme);

  const checkbox = document.getElementById('themeToggleCheckbox');
  if (checkbox) {
    checkbox.addEventListener('change', (e) => {
      const newTheme = e.target.checked ? 'light' : 'dark';
      applyTheme(newTheme);
      localStorage.setItem('ro_auction_theme', newTheme);
      showToast(newTheme === 'light' ? '☀️ สลับเป็นโหมดสว่างเรียบร้อย' : '🌙 สลับเป็นโหมดมืดเรียบร้อย');
    });
  }
}

function applyTheme(theme) {
  const checkbox = document.getElementById('themeToggleCheckbox');
  if (theme === 'light') {
    document.body.classList.add('light-theme');
    if (checkbox) checkbox.checked = true;
  } else {
    document.body.classList.remove('light-theme');
    if (checkbox) checkbox.checked = false;
  }
}

