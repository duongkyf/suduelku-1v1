// render.js — VẼ BẢNG, BÀN PHÍM SỐ, THỐNG KÊ & ĐỒNG BỘ DANH SÁCH TỪ SQL SERVER

function getBoxBorderClasses(idx) {
  const r = Math.floor(idx / 9), c = idx % 9;
  const cls = [];
  if (c === 2 || c === 5) cls.push('box-right');
  if (c === 8) cls.push('no-right');
  if (r === 2 || r === 5) cls.push('box-bottom');
  if (r === 8) cls.push('no-bottom');
  return cls.join(' ');
}

function renderPlayerBoard() {
  const boardEl = document.getElementById('playerBoard');
  if (!boardEl) return;
  boardEl.innerHTML = '';

  const isSpectating = Boolean(matchState.spectatingOpponent && matchState.p1.locked);
  const activePlayer = isSpectating ? matchState.p2 : matchState.p1;

  boardEl.onclick = (e) => {
    if (isSpectating) return;
    const cell = e.target.closest('[data-idx]');
    if (!cell) return;
    matchState.selectedCell = Number(cell.dataset.idx);
    renderPlayerBoard();
  };

  const p1 = activePlayer;
  const givenMask = matchState.p1.givenMask;
  const sel = isSpectating ? -1 : matchState.selectedCell;
  const selRow = sel >= 0 ? Math.floor(sel / 9) : -1;
  const selCol = sel >= 0 ? sel % 9 : -1;
  const selBox = sel >= 0 ? Math.floor(selRow / 3) * 3 + Math.floor(selCol / 3) : -1;
  const selVal = (sel >= 0 && !(p1.wrongMask && p1.wrongMask[sel])) ? p1.currentGrid[sel] : 0;

  for (let idx = 0; idx < 81; idx++) {
    const r = Math.floor(idx / 9), c = idx % 9;
    const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    const val = p1.currentGrid[idx];
    const isWrong = p1.wrongMask && p1.wrongMask[idx];

    let stateClass = 'bg-white text-[#1c1917]';
    if (givenMask[idx]) stateClass = 'cell-given';
    else if (p1.cellState[idx] === 1) stateClass = 'cell-correct';
    else if (isWrong) stateClass = 'cell-wrong-persisted';

    if (sel >= 0 && !isWrong) {
      if (idx === sel) stateClass += ' cell-selected';
      else if (selVal !== 0 && val === selVal) stateClass += ' cell-same-digit-highlight';
      else if (r === selRow || c === selCol || b === selBox) stateClass += ' cell-peer-highlight';
    } else if (idx === sel) {
      stateClass += ' cell-selected';
    }

    const cell = document.createElement('div');
    cell.className = `sudoku-cell mono-num ${getBoxBorderClasses(idx)} ${stateClass}`;
    cell.dataset.idx = idx;

    if (val !== 0) {
      cell.textContent = val;
    } else if (!isSpectating && p1.notes && p1.notes[idx] && p1.notes[idx].size > 0) {
      const wrap = document.createElement('div');
      wrap.className = 'notes-grid';
      for (let n = 1; n <= 9; n++) {
        const sp = document.createElement('span');
        sp.className = 'note-digit mono-num';
        sp.textContent = p1.notes[idx].has(n) ? n : '';
        wrap.appendChild(sp);
      }
      cell.appendChild(wrap);
    }
    boardEl.appendChild(cell);
  }
}

function renderOpponentBoard(animatedCellIdx = -1, animType = null, popupText = null) {
  const boardEl = document.getElementById('opponentBoard');
  if (!boardEl) return;
  boardEl.innerHTML = '';

  const { p1, p2 } = matchState;
  const canRevealOpponent = Boolean(p1.locked || matchState.status === 'FINISHED');
  const noticeEl = document.getElementById('p2RevealNotice');
  if (noticeEl && matchState.status === 'PLAYING') {
    if (p1.locked) {
      noticeEl.textContent = 'Đang xem trực tiếp';
      noticeEl.className = 'text-[10px] font-bold text-[#16a34a]';
    } else {
      noticeEl.textContent = 'Ẩn số';
      noticeEl.className = 'text-[10px] italic font-normal text-[#57534e]';
    }
  }

  for (let idx = 0; idx < 81; idx++) {
    const cell = document.createElement('div');
    let cls = 'opp-empty';
    const isWrong = p2.wrongMask && p2.wrongMask[idx];

    if (p1.givenMask[idx]) {
      cls = 'opp-given';
      if (canRevealOpponent) cell.textContent = p2.currentGrid[idx] || '';
    } else if (p2.cellState[idx] === 1) {
      cls = 'opp-correct-hidden';
      cell.textContent = canRevealOpponent ? (p2.currentGrid[idx] || '✓') : '✓';
    } else if (canRevealOpponent && isWrong && p2.currentGrid[idx]) {
      cls = 'cell-wrong-persisted font-bold text-[#b91c1c] bg-[#fee2e2]';
      cell.textContent = p2.currentGrid[idx];
    }

    if (idx === animatedCellIdx && animType === 'CORRECT') cls += ' opp-flip-anim';
    else if (idx === animatedCellIdx && animType === 'WRONG') cls += ' opp-wrong-flash';

    cell.className = `sudoku-cell-mini mono-num ${getBoxBorderClasses(idx)} ${cls}`;
    boardEl.appendChild(cell);
  }

  if (animatedCellIdx >= 0 && popupText) {
    const color = animType === 'CORRECT' ? 'bg-[#2d6a4f] text-white' : 'bg-[#b91c1c] text-white';
    spawnFloatingScoreOnBoard('opponentBoard', animatedCellIdx, popupText, color);
  }
}

function spawnFloatingScoreOnBoard(boardId, cellIdx, text, colorClasses) {
  const boardEl = document.getElementById(boardId);
  const target = boardEl && boardEl.children[cellIdx];
  if (!target) return;
  const tag = document.createElement('div');
  tag.className = `floating-score-tag mono-num ${colorClasses}`;
  tag.textContent = text;
  target.appendChild(tag);
  setTimeout(() => tag.remove(), 1100);
}

function renderNumpad() {
  const container = document.getElementById('numpadContainer');
  if (!container) return;
  container.innerHTML = '';

  const { p1 } = matchState;
  const counts = Array(10).fill(0);
  for (let i = 0; i < 81; i++) {
    const d = p1.currentGrid[i];
    if (p1.cellState[i] === 1 && d >= 1 && d <= 9) counts[d]++;
  }

  for (let num = 1; num <= 9; num++) {
    const done = counts[num] >= 9;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'py-1.5 sm:py-2 rounded-lg border-2 border-[#292524] font-bold mono-num text-sm sm:text-base flex flex-col items-center justify-center transition leading-tight '
      + (done ? 'bg-[#475569] text-[#faf7f0] opacity-75' : 'bg-[#fffdf9] hover:bg-[#e2edf8] active:scale-95 text-[#1c1917]');
    btn.innerHTML = `<span>${num}</span><span class="text-[9px] font-normal ${done ? 'text-[#e7e2d8]' : 'text-[#57534e]'}">${counts[num]}/9</span>`;
    btn.addEventListener('click', () => handlePlayerSubmitDigit(num));
    container.appendChild(btn);
  }
}

function playerStateText(p) {
  if (p.solved) return `Hoàn tất (${formatTimeHHMMSS(p.solvedTimeMs)})`;
  if (p.surrendered) return 'Đã bỏ cuộc';
  if (p.locked) return 'Đã khóa (5/5 lỗi)';
  return 'Đang giải';
}

function updateHeaderStats() {
  const setText = (id, t) => { document.getElementById(id).textContent = t; };
  [['p1', matchState.p1], ['p2', matchState.p2]].forEach(([k, p]) => {
    const pct = Math.min(100, Math.max(0, Math.round((p.correctCells / matchState.totalBlanks) * 100)));
    setText(`${k}NameHeader`, p.username);
    setText(`${k}ScoreDisplay`, `${p.score} đ`);
    setText(`${k}ProgressDisplay`, `${pct}% (${p.correctCells}/${matchState.totalBlanks} ô)`);
    setText(`${k}MistakesDisplay`, `${p.mistakes}/${p.maxMistakes}`);
    setText(`${k}StateBadge`, playerStateText(p));
    document.getElementById(`${k}ScoreBar`).style.width = `${pct}%`;
  });
}

function renderAllArena() {
  renderPlayerBoard();
  renderOpponentBoard();
  renderNumpad();
  updateHeaderStats();
  updateTimerAndMultiplierUI();
}

// ĐỒNG BỘ DỮ LIỆU TỪ SQL SERVER: BẢNG XẾP HẠNG & LỊCH SỬ ĐẤU
async function fetchSyncDatabaseLists() {
  try {
    const uname = dbState.isLoggedIn ? encodeURIComponent(dbState.currentUser.username) : '';
    const [resLb, resMatches] = await Promise.all([
      fetch(`${API_BASE_URL}/leaderboard`),
      fetch(`${API_BASE_URL}/matches?username=${uname}`)
    ]);

    if (resLb.ok) {
      const lb = await resLb.json();
      dbState.users = lb.map(u => ({
        userId: u.UserID,
        username: u.Username,
        elo: u.EloRating ?? 1200,
        wins: Number(u.Wins ?? 0),
        matches: Number(u.TotalMatches ?? 0)
      }));

      const me = dbState.isLoggedIn && dbState.users.find(u => u.username === dbState.currentUser.username);
      if (me) {
        dbState.currentUser.elo = me.elo;
        const label = document.getElementById('currentEloLabel');
        if (label) label.textContent = `${me.elo} ELO`;
      }
    }

    if (resMatches.ok) {
      const rows = await resMatches.json();
      dbState.matches = rows.map(m => ({
        matchId: m.MatchID,
        roomCode: m.RoomCode ?? 'BOT',
        difficulty: m.Difficulty ?? 'EASY',
        p1Name: m.P1Name, p1Score: m.P1Score ?? 0, p1Cells: m.P1Cells ?? 0, p1Mistakes: m.P1Mistakes ?? 0,
        p2Name: m.P2Name, p2Score: m.P2Score ?? 0, p2Cells: m.P2Cells ?? 0, p2Mistakes: m.P2Mistakes ?? 0,
        winnerName: m.WinnerName,
        winReason: m.WinReason ?? ''
      }));
    }
  } catch (err) {
    console.warn('Không tải được danh sách từ SQL Server:', err.message);
  }
  renderDatabaseModals();
}

// Phân tích chuỗi WinReason (tương thích cả định dạng ngắn gọn mới lẫn dữ liệu cũ)
function parseHistoryMeta(m) {
  const raw = String(m.winReason || '');
  const parts = raw.split('|').map(s => s.trim());

  let actionType = null; // 'SOLVED' | 'SURRENDER' | 'TIMEOUT' | null
  let actionActor = null;
  let myEloText = '0 ELO';

  // Nhận diện Phòng tùy chọn cho cả bản ghi mới ('CUSTOM') và bản ghi cũ ('0 ELO' / 'Phòng tùy chọn')
  const isCustomRoom = parts.includes('CUSTOM')
    || raw.includes('Phòng tùy chọn')
    || parts.some(p => p === '0 ELO');

  // 1. Trích xuất trạng thái HOÀN THÀNH / BỎ CUỘC / HẾT GIỜ
  const first = parts[0] || '';
  if (first.startsWith('HOÀN THÀNH:')) {
    actionType = 'SOLVED';
    actionActor = first.slice('HOÀN THÀNH:'.length).trim();
  } else if (first.startsWith('BỎ CUỘC:')) {
    actionType = 'SURRENDER';
    actionActor = first.slice('BỎ CUỘC:'.length).trim();
  } else if (first === 'HẾT GIỜ' || raw.includes('Hết giờ')) {
    actionType = 'TIMEOUT';
  } else if (raw.includes('giải xong 81 ô')) {
    actionType = 'SOLVED';
    actionActor = m.winnerName;
  } else if (raw.toLowerCase().includes('bỏ cuộc')) {
    actionType = 'SURRENDER';
    actionActor = m.winnerName === m.p1Name ? m.p2Name : m.p1Name;
  }

  // 2. Trích xuất số ELO thay đổi của tài khoản đang xem (m.p1Name)
  const myToken = parts.find(p => p.startsWith(`${m.p1Name}:`));
  if (myToken) {
    myEloText = myToken.slice(m.p1Name.length + 1).trim();
  } else if (!isCustomRoom) {
    const matchNum = raw.match(/([+-]?\d+)\s*ELO/i);
    if (matchNum) {
      const absVal = Math.abs(parseInt(matchNum[1], 10));
      const isDraw = m.winnerName === 'DRAW' || m.winnerName === 'HÒA (DRAW)';
      if (isDraw || absVal === 0) myEloText = '0 ELO';
      else if (m.winnerName === m.p1Name) myEloText = `+${absVal} ELO`;
      else myEloText = `-${absVal} ELO`;
    }
  }

  return { actionType, actionActor, myEloText, isCustomRoom };
}

function renderDatabaseModals() {
  // 1. Bảng xếp hạng Top 10 ELO (căn đều 4 cột)
  const lbBody = document.getElementById('leaderboardTableBody');
  if (lbBody) {
    if (!dbState.users.length) {
      lbBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center italic text-[#57534e]">Chưa có dữ liệu kỳ thủ trong SQL Server.</td></tr>';
    } else {
      lbBody.innerHTML = dbState.users.slice(0, 10).map((u, i) => {
        const rate = u.matches > 0 ? Math.round((u.wins / u.matches) * 100) : 0;
        return `<tr>
          <td class="py-2 px-2 text-center font-bold mono-num">#${i + 1}</td>
          <td class="py-2 px-2 text-left font-bold truncate">${escapeHtml(u.username)}</td>
          <td class="py-2 px-2 text-center font-bold mono-num text-[#2d6a4f]">${u.elo}</td>
          <td class="py-2 px-2 text-right mono-num text-[#57534e]">${rate}% (${u.wins}/${u.matches})</td>
        </tr>`;
      }).join('');
    }
  }

  // 2. Lịch sử đấu đối xứng hoàn toàn qua trục giữa + Chú thích (Phòng tùy chọn)
  const histBox = document.getElementById('matchHistoryContainer');
  if (!histBox) return;
  const mine = dbState.matches.filter(m => !dbState.isLoggedIn || m.p1Name === dbState.currentUser.username);
  if (!mine.length) {
    histBox.innerHTML = '<div class="py-4 text-center italic text-[#57534e]">Tài khoản của bạn chưa có lịch sử trận đấu nào.</div>';
    return;
  }

  histBox.innerHTML = mine.map(m => {
    const isDraw = m.winnerName === 'DRAW' || m.winnerName === 'HÒA (DRAW)';
    const isWin = m.winnerName === m.p1Name;
    const [text, badge, border] = isDraw
      ? ['HÒA', 'bg-[#78716c]', 'border-l-[#78716c]']
      : isWin ? ['THẮNG', 'bg-[#2d6a4f]', 'border-l-[#2d6a4f]'] : ['THUA', 'bg-[#b91c1c]', 'border-l-[#b91c1c]'];

    const { actionType, actionActor, myEloText, isCustomRoom } = parseHistoryMeta(m);

    const eloTextColor = myEloText.startsWith('+')
      ? 'text-[#16a34a]'
      : myEloText.startsWith('-')
      ? 'text-[#b91c1c]'
      : 'text-[#78716c]';

    const customRoomNote = isCustomRoom
      ? '<span class="ml-1.5 text-[11px] italic font-normal text-[#57534e]">(Phòng tùy chọn)</span>'
      : '';

    const makePlayerSubtext = (playerName, alignRight = false) => {
      if (actionActor !== playerName) return '';
      const alignCls = alignRight ? 'text-right' : 'text-left';
      if (actionType === 'SOLVED') {
        return `<div class="${alignCls} text-[10px] font-bold uppercase tracking-wider text-[#16a34a] mt-0.5">HOÀN THÀNH</div>`;
      }
      if (actionType === 'SURRENDER') {
        return `<div class="${alignCls} text-[10px] font-bold uppercase tracking-wider text-[#b91c1c] mt-0.5">BỎ CUỘC</div>`;
      }
      return '';
    };

    const timeoutSubtext = actionType === 'TIMEOUT'
      ? '<div class="text-[10px] font-bold uppercase tracking-wider text-[#b45309] mt-0.5">HẾT GIỜ</div>'
      : '';

    return `
      <div class="p-3 border border-[#d6d0c4] border-l-4 ${border} bg-[#f5f2eb] space-y-1.5">
        <div class="grid grid-cols-[1fr_auto] items-center border-b border-[#e7e2d8] pb-1 gap-2">
          <div class="truncate">
            <span class="font-bold mono-num text-xs">[Phòng ${escapeHtml(m.roomCode)}] Độ khó: ${getDifficultyDisplayName(m.difficulty)}</span>
            ${customRoomNote}
          </div>
          <div class="flex items-center justify-end gap-2">
            <span class="w-16 text-right mono-num text-[11px] font-bold ${eloTextColor}">${escapeHtml(myEloText)}</span>
            <span class="w-16 py-0.5 text-center ${badge} text-white text-[10px] font-bold tracking-wider">${text}</span>
          </div>
        </div>
        <div class="grid grid-cols-[1fr_auto_1fr] items-start text-xs pt-0.5 gap-2">
          <div class="text-left min-w-0">
            <div class="truncate">
              <span class="text-sm font-bold text-[#1c1917]">${escapeHtml(m.p1Name)}:</span>
              <b class="mono-num text-[#2d6a4f]">${m.p1Score}đ</b>
              <span class="text-[11px] text-[#57534e]">(${m.p1Cells} ô, ${m.p1Mistakes} lỗi)</span>
            </div>
            ${makePlayerSubtext(m.p1Name, false)}
          </div>
          <div class="shrink-0 text-center px-2">
            <div class="italic font-bold text-[#78716c]">vs</div>
            ${timeoutSubtext}
          </div>
          <div class="text-right min-w-0">
            <div class="truncate">
              <span class="text-sm font-bold text-[#2b4c7e]">${escapeHtml(m.p2Name)}:</span>
              <b class="mono-num text-[#b91c1c]">${m.p2Score}đ</b>
              <span class="text-[11px] text-[#57534e]">(${m.p2Cells} ô, ${m.p2Mistakes} lỗi)</span>
            </div>
            ${makePlayerSubtext(m.p2Name, true)}
          </div>
        </div>
      </div>`;
  }).join('');
}