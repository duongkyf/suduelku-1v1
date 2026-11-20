// game.js — LOGIC TRẬN ĐẤU, PHÒNG CHỜ, ĐIỀN SỐ, XÓA, HOÀN TÁC

//TIỆN ÍCH CHUNG

//Hệ số điểm
function getSpeedMultiplier(ms) {
  const sec = Math.floor(ms / 1000);
  return sec <= 60 ? 6 : sec <= 120 ? 5 : sec <= 180 ? 4 : sec <= 240 ? 3 : sec <= 300 ? 2 : 1;
}

const isRowSolved = (cs, r) => Array.from({ length: 9 }, (_, c) => cs[r * 9 + c]).every(s => s === 1);
const isColSolved = (cs, c) => Array.from({ length: 9 }, (_, r) => cs[r * 9 + c]).every(s => s === 1);
const isBoxSolved = (cs, b) => {
  const sr = Math.floor(b / 3) * 3, sc = (b % 3) * 3;
  for (let r = sr; r < sr + 3; r++) for (let c = sc; c < sc + 3; c++) if (cs[r * 9 + c] !== 1) return false;
  return true;
};

//Đồng bộ trạng thái hoàn thành của cột/bảng/ ô 3x3
function syncInitialCompletedRegions(p) {
  for (let i = 0; i < 9; i++) {
    p.completedRows[i] = isRowSolved(p.cellState, i);
    p.completedCols[i] = isColSolved(p.cellState, i);
    p.completedBoxes[i] = isBoxSolved(p.cellState, i);
  }
}

//Sinh mã phòng
function genRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const setExplain = (text) => { document.getElementById('lastMoveExplain').textContent = text; };
const emit = (event, data) => { if (socket) socket.emit(event, data); };

function stopMatchTimers() {
  clearInterval(matchState.timerInterval);
  clearTimeout(matchState.botInterval);
  clearTimeout(matchState.botClearWrongTimer);
}

// Lấy đề từ SQL Server, lỗi thì sinh đề cục bộ
async function fetchPuzzle(difficulty) {
  try {
    const res = await fetch(`${API_BASE_URL}/puzzles/random/${difficulty}`);
    if (res.ok) {
      const row = await res.json();
      return generateSudokuByDifficulty(difficulty, row.InitialGrid || row.initialGrid, row.SolutionGrid || row.solutionGrid);
    }
  } catch (e) {
    console.warn('Không lấy được đề từ API, sinh đề cục bộ:', e.message);
  }
  return generateSudokuByDifficulty(difficulty);
}

// CHUYỂN MÀN HÌNH 
function switchScreen(screenName) {
  const vLobby = document.getElementById('viewRoomLobby');
  document.getElementById('viewHome').classList.add('hidden');
  document.getElementById('viewArena').classList.add('hidden');
  if (vLobby) vLobby.classList.add('hidden');

  if (screenName === 'ARENA') {
    document.getElementById('viewArena').classList.remove('hidden');
    return;
  }

  stopMatchTimers();
  if (screenName === 'LOBBY' && vLobby) {
    matchState.status = 'LOBBY';
    vLobby.classList.remove('hidden');
  } else {
    matchState.status = 'IDLE';
    document.getElementById('viewHome').classList.remove('hidden');
  }
}

// PHÒNG CHỜ 
const READY_BADGE = {
  ready: ['ĐÃ SẴN SÀNG', 'bg-[#16a34a]'],
  preparing: ['ĐANG CHUẨN BỊ...', 'bg-[#b45309]'],
  waiting: ['ĐANG CHỜ...', 'bg-[#78716c]']
};

function setLobbyBadge(id, kind) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = READY_BADGE[kind][0];
  el.className = `px-2 py-0.5 ${READY_BADGE[kind][1]} text-white text-[10px] font-bold`;
}

// Chỉ Chủ phòng mới bấm được 3 nút Độ khó
function lockLobbyDiffButtons() {
  document.querySelectorAll('[data-lobby-diff]').forEach(b => {
    b.disabled = !matchState.isRoomHost;
    b.classList.toggle('opacity-60', !matchState.isRoomHost);
    b.classList.toggle('cursor-not-allowed', !matchState.isRoomHost);
  });
}

// Đồng bộ giao diện Phòng chờ (huy hiệu Sẵn sàng + nút Bắt đầu)
function syncLobbyWaitingState(hasOpponent) {
  const hostReady = matchState.hostReady !== false;
  const guestReady = Boolean(hasOpponent && matchState.guestReady);

  setLobbyBadge('lobbyHostReadyBadge', hostReady ? 'ready' : 'preparing');
  setLobbyBadge('lobbyGuestReadyBadge', !hasOpponent ? 'waiting' : guestReady ? 'ready' : 'preparing');

  if (!hasOpponent) {
    document.getElementById('lobbyGuestName').textContent = 'Đang chờ người chơi...';
    document.getElementById('lobbyGuestElo').textContent = 'Đang chờ người chơi vào phòng...';
  }

  const btnStart = document.getElementById('btnStartMatchFromLobby');
  if (btnStart) {
    const canStart = Boolean(hasOpponent && matchState.isRoomHost && hostReady && guestReady);
    btnStart.disabled = !canStart;
    btnStart.classList.toggle('opacity-50', !canStart);
    btnStart.classList.toggle('cursor-not-allowed', !canStart);
  }
  lockLobbyDiffButtons();
}

//Nút chỉnh độ khó trong phòng chờ
function updateLobbyDifficultyButtonsUI(diff) {
  matchState.difficulty = diff;
  const givens = SUDOKU_GIVENS_BY_DIFFICULTY[diff] || 40;
  const lbl = document.getElementById('lobbySelectedDiffText');
  if (lbl) lbl.textContent = `Đang chọn: ${getDifficultyDisplayName(diff)} (${givens} số sẵn)`;

  document.querySelectorAll('.lobby-diff-btn').forEach(btn => {
    const active = btn.getAttribute('data-lobby-diff') === diff;
    btn.className = 'lobby-diff-btn py-2 px-3 border-2 border-[#292524] text-center transition '
      + (active ? 'bg-[#292524] text-[#fffdf9]' : 'bg-[#fffdf9] text-[#1c1917] hover:bg-[#f3efe6]');
  });
  lockLobbyDiffButtons();
}

// Khởi tạo trạng thái phòng chờ 1v1
function openRoomLobby({ roomCode = null, difficulty = 'EASY', opponentName = 'Đang chờ người chơi...', isHost = true } = {}) {
  const code = roomCode || genRoomCode();
  const hasOpponent = Boolean(opponentName && opponentName !== 'Đang chờ người chơi...');

  Object.assign(matchState, {
    status: 'LOBBY',
    roomCode: code,
    mode: 'ROOM_1V1',
    difficulty,
    isRoomHost: isHost,
    hasLobbyOpponent: hasOpponent,
    lobbyOpponentName: opponentName,
    lobbyReady: isHost,
    hostReady: true,
    guestReady: false
  });

  const me = dbState.currentUser;
  document.getElementById('lobbyRoomCodeDisplay').textContent = code;
  document.getElementById('lobbyHostName').textContent = isHost ? me.username : opponentName;
  document.getElementById('lobbyHostElo').textContent = isHost
    ? `${me.elo} ELO • Chủ phòng điều chỉnh độ khó` : 'Chủ phòng điều chỉnh độ khó';
  document.getElementById('lobbyGuestName').textContent = isHost ? opponentName : me.username;
  document.getElementById('lobbyGuestElo').textContent = isHost
    ? (hasOpponent ? 'Đã kết nối ổn định' : 'Đang chờ người chơi vào phòng...')
    : `${me.elo} ELO • Khách tham gia`;

  const chatBox = document.getElementById('lobbyChatHistoryBox');
  if (chatBox) {
    chatBox.innerHTML = `<div class="text-[#57534e] italic text-[11px]">Hệ thống: Đã vào phòng chờ [${escapeHtml(code)}]. Hãy chọn độ khó và trò chuyện trước khi bắt đầu!</div>`;
  }

  updateLobbyDifficultyButtonsUI(difficulty);
  syncLobbyWaitingState(hasOpponent);
  switchScreen('LOBBY');
}

// KHỞI TẠO TRẬN ĐẤU 
function makePlayer(username, digits, extra = {}) {
  const p = {
    ...newPlayer(username),
    currentGrid: [...digits],
    cellState: digits.map(d => (d !== 0 ? 1 : 0)),
    ...extra
  };
  syncInitialCompletedRegions(p);
  return p;
}

async function startNewMatch({ difficulty = matchState.difficulty, mode = 'BOT_AI', roomCode = null, opponentName = null, opponentElo = null, customPuzzle = null } = {}) {
  stopMatchTimers();

  const puzzle = customPuzzle || await fetchPuzzle(difficulty);
  const code = roomCode || genRoomCode();
  const diffLabel = getDifficultyDisplayName(difficulty);
  const digits = puzzle.initialGrid.split('').map(c => parseInt(c, 10));
  const firstBlank = puzzle.initialGrid.indexOf('0');

  Object.assign(matchState, {
    roomCode: code, mode, difficulty,
    totalBlanks: puzzle.blanksCount,
    initialGrid: puzzle.initialGrid,
    solutionGrid: puzzle.solutionGrid,
    startedAtMs: performance.now(),
    elapsedMs: 0,
    status: 'PLAYING',
    postMatchLoser: null,
    selectedCell: Math.max(0, firstBlank),
    spectatingOpponent: false,
    p1LockHandled: false,
    moveHistory: []
  });

  matchState.p1 = makePlayer(dbState.isLoggedIn ? dbState.currentUser.username : 'Bạn (Khách)', digits, {
    givenMask: digits.map(d => d !== 0),
    wrongMask: Array(81).fill(false),
    notes: Array.from({ length: 81 }, () => new Set())
  });
  matchState.p2 = makePlayer(opponentName || (mode === 'BOT_AI' ? `Bot AI (${diffLabel})` : 'Đối thủ Online'), digits, {
    elo: opponentElo,
    wrongMask: Array(81).fill(false),
    lastTechnique: 'NAKED_SINGLE',
    lastWrongCell: -1, lastCorrectCell: -1, lastPopupPoints: 0
  });

  document.getElementById('activeRoomCodeBadge').textContent = code;
  document.getElementById('activeDifficultyBadge').textContent = diffLabel;
  document.getElementById('waitingStatusBanner')?.classList.add('hidden');
  document.getElementById('matchResultModal')?.classList.add('hidden');
  document.getElementById('surrenderConfirmModal')?.classList.add('hidden');

  const revealEl = document.getElementById('p2RevealNotice');
  if (revealEl) {
    revealEl.textContent = 'Ẩn số';
    revealEl.className = 'text-[10px] italic font-normal text-[#57534e]';
  }

  // Đặt lại các nút và dòng note trên Dòng 2 về trạng thái ban đầu
  document.getElementById('btnSurrender')?.classList.remove('hidden');
  document.getElementById('btnLeaveSpectate')?.classList.add('hidden');
  document.getElementById('btnForceOpponentFinish')?.classList.add('hidden');
  const btnToggleSpec = document.getElementById('btnToggleSpectateBoard');
  if (btnToggleSpec) {
    btnToggleSpec.classList.add('hidden');
    btnToggleSpec.textContent = 'Xem lại bảng của bạn';
  }
  const inlineNote = document.getElementById('inlineLockNote');
  if (inlineNote) {
    inlineNote.classList.add('hidden');
    inlineNote.textContent = '';
  }

  setExplain(`Độ khó: ${diffLabel}. Nhấn vào 1 ô để highlight hàng, cột và khối 3×3 của ô đó.`);

  switchScreen('ARENA');
  renderAllArena();

  matchState.timerInterval = setInterval(() => {
    if (matchState.status !== 'PLAYING') return;
    matchState.elapsedMs = performance.now() - matchState.startedAtMs;
    updateTimerAndMultiplierUI();
    if (matchState.elapsedMs >= matchState.maxDurationMs) {
      [matchState.p1, matchState.p2].forEach(p => { p.locked = true; p.finished = true; });
      checkAndTriggerMatchFinish();
    }
  }, 200);

  if (mode === 'BOT_AI') setupOpponentBotLoop();
}

// VÒNG LẶP BOT AI: NHỊP ĐỘ SUY NGHĨ ĐỘNG CHO NGƯỜI CHƠI CASUAL

function setupOpponentBotLoop() {
  clearTimeout(matchState.botInterval);
  clearTimeout(matchState.botClearWrongTimer);

  const BOT_CFG = {
    EASY:   { minMs: 7500, maxMs: 12000, mistakeRate: 0.20, maxBotMistakes: 4 },
    MEDIUM: { minMs: 7000, maxMs: 11000, mistakeRate: 0.14, maxBotMistakes: 4 },
    HARD:   { minMs: 6000, maxMs: 9500,  mistakeRate: 0.08, maxBotMistakes: 3 }
  };
  const cfg = BOT_CFG[matchState.difficulty] || BOT_CFG.EASY;
  const active = () => matchState.status === 'PLAYING' && !matchState.p2.locked && !matchState.p2.finished;

  function computeHumanLikeDelay() {
    const p2 = matchState.p2;
    let base = cfg.minMs + Math.floor(Math.random() * (cfg.maxMs - cfg.minMs + 1));

    if (typeof findAlgorithmicBotMove === 'function') {
      const nextMove = findAlgorithmicBotMove(p2);
      if (nextMove) {
        if (nextMove.minRegionBlanks === 1) {
          base *= 0.65;
        } else if (nextMove.technique === 'NAKED_SINGLE') {
          base *= 0.85;
        } else if (nextMove.technique === 'HIDDEN_SINGLE') {
          base *= 1.05;
        } else {
          base *= 1.25;
        }
      }
    }

    if (matchState.elapsedMs < 10000) base *= 1.15;
    return Math.round(base);
  }

  function scheduleNext() {
    if (!active()) return;
    const delay = computeHumanLikeDelay();
    matchState.botInterval = setTimeout(() => {
      if (!active()) return;
      const p2 = matchState.p2;
      const shouldMistake = Math.random() < cfg.mistakeRate && p2.mistakes < cfg.maxBotMistakes;
      simulateOpponentMove(!shouldMistake);
      scheduleNext();
    }, delay);
  }
  scheduleNext();
}

function updateTimerAndMultiplierUI() {
  document.getElementById('matchTimerDisplay').textContent = formatTimeHHMMSS(matchState.elapsedMs);
  document.getElementById('speedMultiplierBadge').textContent = `Hệ số x${getSpeedMultiplier(matchState.elapsedMs)}`;
}

// ĐIỀN SỐ, XÓA, HOÀN TÁC 
function emitMove(idx, digit, isCorrect) {
  if (matchState.mode === 'BOT_AI') return;
  const { p1 } = matchState;
  emit('player_move', {
    roomCode: matchState.roomCode, cellIndex: idx, value: digit, isCorrect,
    score: p1.score, correctCells: p1.correctCells, mistakes: p1.mistakes
  });
}

function handlePlayerSubmitDigit(digit) {
  const p1 = matchState.p1;
  if (matchState.status !== 'PLAYING') { renderAllArena(); return; }
  if (p1.locked || p1.finished) { renderAllArena(); return; }

  const idx = matchState.selectedCell;
  if (idx < 0 || idx >= 81) { showToast('Hãy nhấn chọn 1 ô trống trên bảng trước!', 'info'); return; }
  if (p1.givenMask[idx] || p1.cellState[idx] === 1) { showToast('Ô này đã có số đúng, hãy chọn một ô trống khác!', 'info'); return; }

  const snapshot = {
    cellIndex: idx,
    prevDigit: p1.currentGrid[idx],
    prevWrong: p1.wrongMask[idx],
    prevCellState: p1.cellState[idx],
    prevNotes: new Set(p1.notes[idx]),
    wasCorrectMove: false
  };

  // Chế độ ghi chú
  if (matchState.notesMode) {
    if (p1.wrongMask[idx]) { p1.wrongMask[idx] = false; p1.currentGrid[idx] = 0; }
    if (!p1.notes[idx].delete(digit)) p1.notes[idx].add(digit);
    matchState.moveHistory.push(snapshot);
    playTone(440, 0.04, 'triangle');
    renderAllArena();
    return;
  }

  const r = Math.floor(idx / 9), c = idx % 9;
  const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
  const mult = getSpeedMultiplier(matchState.elapsedMs);

  // Điền SAI
  if (digit !== parseInt(matchState.solutionGrid[idx], 10)) {
    matchState.moveHistory.push(snapshot);
    p1.mistakes += 1;
    p1.wrongMask[idx] = true;
    p1.currentGrid[idx] = digit;
    playTone(210, 0.18, 'sawtooth', 165);
    setExplain(`Ô (${r + 1},${c + 1}) = ${digit} SAI (0đ, Lỗi: ${p1.mistakes}/5). Nhấn "xóa" hoặc "hoàn tác".`);

    if (p1.mistakes >= p1.maxMistakes) {
      p1.locked = true;
      p1.finished = true;
    }
    emitMove(idx, digit, false);
    renderAllArena();
    if (!matchState.spectatingOpponent) {
      spawnFloatingScoreOnBoard('playerBoard', idx, 'SAI (0đ)', 'bg-[#b91c1c] text-white');
    }
    checkMatchEndConditions();
    return;
  }

  // Điền ĐÚNG 
  snapshot.wasCorrectMove = true;
  matchState.moveHistory.push(snapshot);
  p1.cellState[idx] = 1;
  p1.currentGrid[idx] = digit;
  p1.wrongMask[idx] = false;
  p1.notes[idx].clear();
  p1.correctCells += 1;
  clearPeerNotes(p1, idx, digit);

  const doneRows = [], doneCols = [], doneBoxes = [];
  if (!p1.completedRows[r] && isRowSolved(p1.cellState, r)) { p1.completedRows[r] = true; doneRows.push(r); }
  if (!p1.completedCols[c] && isColSolved(p1.cellState, c)) { p1.completedCols[c] = true; doneCols.push(c); }
  if (!p1.completedBoxes[b] && isBoxSolved(p1.cellState, b)) { p1.completedBoxes[b] = true; doneBoxes.push(b); }

  const baseGain = 10;
  const comboCount = doneRows.length + doneCols.length + doneBoxes.length;
  const comboBonus = comboCount * 30;
  let fullClearBonus = 0;
  if (p1.cellState.every(s => s === 1)) {
    fullClearBonus = 100 * mult;
    Object.assign(p1, { solved: true, locked: true, finished: true, solvedTimeMs: matchState.elapsedMs });
  }

  const totalDelta = baseGain + comboBonus + fullClearBonus;
  p1.score += totalDelta;

  if (fullClearBonus > 0) playChordSfx([523.25, 659.25, 783.99, 1046.5], 0.07);
  else if (comboCount > 0) playChordSfx([523.25, 659.25, 783.99], 0.06);
  else playTone(540, 0.08, 'sine');

  let explain = `Ô (${r + 1},${c + 1}) = ${digit} ĐÚNG: +${baseGain}đ`;
  if (comboCount > 0) explain += ` + Combo: +${comboBonus}đ`;
  if (fullClearBonus > 0) explain += ` + Full Clear: +${fullClearBonus}đ!`;
  setExplain(explain);

  emitMove(idx, digit, true);
  renderAllArena();
  const cellEl = document.getElementById('playerBoard').children[idx];
  if (cellEl) cellEl.classList.add('cell-pop-correct');
  if (comboCount > 0) triggerRegionComboVfx(doneRows, doneCols, doneBoxes);
  spawnFloatingScoreOnBoard('playerBoard', idx, `+${totalDelta}`, 'bg-[#2d6a4f] text-white');
  checkMatchEndConditions();
}

//Xóa số điền sai hoặc ghi chú tại ô đang chọn
function handleDeleteWrongOrNotesCell() {
  const p1 = matchState.p1;
  if (matchState.status !== 'PLAYING' || p1.locked || p1.finished) return;

  const idx = matchState.selectedCell;
  if (idx < 0 || idx >= 81) { showToast('Hãy chọn ô màu đỏ điền sai cần xóa!', 'info'); return; }
  if (p1.givenMask[idx] || p1.cellState[idx] === 1) { showToast('Ô cho sẵn hoặc đã giải đúng (Anti-Farming) không thể xóa!', 'warn'); return; }
  if (!p1.wrongMask[idx] && p1.notes[idx].size === 0 && p1.currentGrid[idx] === 0) { showToast('Ô đang chọn đã trống sẵn!', 'info'); return; }

  matchState.moveHistory.push({
    cellIndex: idx,
    prevDigit: p1.currentGrid[idx],
    prevWrong: p1.wrongMask[idx],
    prevCellState: p1.cellState[idx],
    prevNotes: new Set(p1.notes[idx]),
    wasCorrectMove: false
  });

  p1.wrongMask[idx] = false;
  p1.currentGrid[idx] = 0;
  p1.notes[idx].clear();
  playTone(360, 0.06, 'sine');
  setExplain(`Đã xóa số điền sai / ghi chú tại ô (${Math.floor(idx / 9) + 1},${(idx % 9) + 1}).`);
  emitMove(idx, 0, false);
  renderAllArena();
}

//Hoàn tác nước đi gần nhất
function handleUndoLastMove() {
  const p1 = matchState.p1;
  if (matchState.status !== 'PLAYING' || p1.locked || p1.finished) return;

  const hist = matchState.moveHistory;
  while (hist.length && hist[hist.length - 1].wasCorrectMove) hist.pop();
  if (!hist.length) { showToast('Chưa có nước đi nào để hoàn tác!', 'info'); return; }

  const last = hist.pop();
  const idx = last.cellIndex;
  p1.currentGrid[idx] = last.prevDigit;
  p1.wrongMask[idx] = last.prevWrong;
  p1.notes[idx] = new Set(last.prevNotes);
  matchState.selectedCell = idx;

  playTone(400, 0.07, 'triangle');
  setExplain(`Đã hoàn tác 1 nước tại ô (${Math.floor(idx / 9) + 1},${(idx % 9) + 1}).`);
  emitMove(idx, p1.currentGrid[idx], false);
  renderAllArena();
}

//Bật chế độ ghi chú
function toggleNotesMode() {
  matchState.notesMode = !matchState.notesMode;
  const on = matchState.notesMode;
  const lbl = document.getElementById('notesStatusLabel');
  lbl.textContent = on ? 'Bật' : 'Tắt';
  lbl.className = on ? 'text-[#16a34a] font-bold not-italic' : 'font-normal italic';
  document.getElementById('btnToggleNotes').className =
    'w-full py-2.5 px-3 rounded-xl border-2 text-xs sm:text-sm font-bold text-[#1c1917] transition flex flex-col items-center gap-0.5 shadow-sm '
    + (on ? 'border-[#16a34a] bg-[#f0fdf4]' : 'border-[#292524] bg-[#fffdf9] hover:bg-[#f3efe6]');
  playTone(480, 0.05, 'sine');
}

//Xóa ghi chú của số vừa điền khỏi tất cả các ô cùng hàng, cùng cột và cùng khối 3x3
function clearPeerNotes(p, cellIndex, digit) {
  const r = Math.floor(cellIndex / 9), c = cellIndex % 9;
  const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
  for (let i = 0; i < 9; i++) {
    p.notes[r * 9 + i].delete(digit);
    p.notes[i * 9 + c].delete(digit);
  }
  for (let rr = br; rr < br + 3; rr++) for (let cc = bc; cc < bc + 3; cc++) p.notes[rr * 9 + cc].delete(digit);
}