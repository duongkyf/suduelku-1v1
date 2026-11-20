// utils.js — ÂM THANH, ĐỊNH DẠNG, TOAST, ESCAPE HTML & CLIPBOARD

let soundEnabled = true;
let audioCtx = null;

const DIFF_NAMES = { EASY: 'Dễ', MEDIUM: 'Trung bình', HARD: 'Khó' };
// Chỉ trả về tên trong whitelist -> không bao giờ chèn chuỗi lạ từ DB vào innerHTML
const getDifficultyDisplayName = (code) => DIFF_NAMES[code] || 'Không rõ';

// Chống XSS khi chèn tên / tin nhắn của người khác vào innerHTML
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Mili-giây -> "MM:SS"
function formatTimeHHMMSS(ms) {
  const total = Math.max(0, Math.floor((ms || 0) / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function playTone(freq = 520, duration = 0.09, type = 'sine', secondFreq = null) {
  if (!soundEnabled) return;
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (secondFreq) osc.frequency.setValueAtTime(secondFreq, t + duration * 0.5);
    gain.gain.setValueAtTime(0.07, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(t + duration);
  } catch (e) {}
}

// Hợp âm khi hoàn thành Hàng / Cột / Khối hoặc kết thúc ván
function playChordSfx(notes = [523.25, 659.25, 783.99], stepSec = 0.07) {
  if (!soundEnabled) return;
  notes.forEach((f, i) => setTimeout(() => playTone(f, 0.14, 'triangle'), i * stepSec * 1000));
}

// Hiệu ứng gợn sóng khi hoàn thành Hàng / Cột / Khối 3x3
function triggerRegionComboVfx(rows = [], cols = [], boxes = []) {
  const boardEl = document.getElementById('playerBoard');
  if (!boardEl || boardEl.children.length < 81) return;
  const cells = new Set();
  rows.forEach(r => { for (let c = 0; c < 9; c++) cells.add(r * 9 + c); });
  cols.forEach(c => { for (let r = 0; r < 9; r++) cells.add(r * 9 + c); });
  boxes.forEach(b => {
    const sr = Math.floor(b / 3) * 3, sc = (b % 3) * 3;
    for (let r = sr; r < sr + 3; r++) for (let c = sc; c < sc + 3; c++) cells.add(r * 9 + c);
  });
  cells.forEach(i => {
    const el = boardEl.children[i];
    if (!el) return;
    el.classList.add('cell-combo-wave');
    setTimeout(() => el.classList.remove('cell-combo-wave'), 750);
  });
}

function showToast(message, variant = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const colors = {
    success: 'bg-[#2d6a4f] text-white',
    error: 'bg-[#b91c1c] text-white',
    warn: 'bg-[#b45309] text-white',
    info: 'bg-[#292524] text-[#fffdf9]'
  };
  const el = document.createElement('div');
  el.className = `px-4 py-2 border-2 border-[#1c1917] shadow-md text-xs font-bold transition-all ${colors[variant] || colors.info}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 250);
  }, 2800);
}

function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  // Dự phòng cho HTTP qua IP LAN / Radmin VPN / ZeroTier 
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.readOnly = true; // tránh bật bàn phím ảo trên điện thoại
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length); 
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    ok ? resolve() : reject(new Error('Trình duyệt không cho phép sao chép'));
  });
}