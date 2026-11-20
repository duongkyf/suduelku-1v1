// verdict.js — BOT AI THUẬT TOÁN 3 TẦNG, THƯỞNG ELO TỈ LỆ +50% & KẾT QUẢ

function getBotCleanGrid(p2) {
  return Array.from({ length: 81 }, (_, i) => (p2.cellState[i] === 1 ? p2.currentGrid[i] : 0));
}

function getValidCandidatesOnGrid(grid, idx) {
  if (grid[idx] !== 0) return [];
  const r = Math.floor(idx / 9), c = idx % 9;
  const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
  const used = new Set();

  for (let i = 0; i < 9; i++) {
    if (grid[r * 9 + i] > 0) used.add(grid[r * 9 + i]);
    if (grid[i * 9 + c] > 0) used.add(grid[i * 9 + c]);
  }
  for (let rr = br; rr < br + 3; rr++) {
    for (let cc = bc; cc < bc + 3; cc++) {
      if (grid[rr * 9 + cc] > 0) used.add(grid[rr * 9 + cc]);
    }
  }
  const cands = [];
  for (let d = 1; d <= 9; d++) if (!used.has(d)) cands.push(d);
  return cands;
}

function getMinBlanksInPeers(grid, idx) {
  const r = Math.floor(idx / 9), c = idx % 9;
  const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
  let rBlanks = 0, cBlanks = 0, bBlanks = 0;

  for (let i = 0; i < 9; i++) {
    if (grid[r * 9 + i] === 0) rBlanks++;
    if (grid[i * 9 + c] === 0) cBlanks++;
  }
  for (let rr = br; rr < br + 3; rr++) {
    for (let cc = bc; cc < bc + 3; cc++) {
      if (grid[rr * 9 + cc] === 0) bBlanks++;
    }
  }
  return Math.min(rBlanks, cBlanks, bBlanks);
}

function botSolveFromCurrentGrid(cleanGrid) {
  const g = cleanGrid.slice();

  function backtrack() {
    let bestIdx = -1, bestCands = null;
    for (let i = 0; i < 81; i++) {
      if (g[i] === 0) {
        const cands = getValidCandidatesOnGrid(g, i);
        if (cands.length === 0) return false;
        if (bestCands === null || cands.length < bestCands.length) {
          bestIdx = i;
          bestCands = cands;
          if (cands.length === 1) break;
        }
      }
    }
    if (bestIdx === -1) return true;

    for (const d of bestCands) {
      g[bestIdx] = d;
      if (backtrack()) return true;
      g[bestIdx] = 0;
    }
    return false;
  }
  return backtrack() ? g : null;
}

function findAlgorithmicBotMove(p2) {
  const grid = getBotCleanGrid(p2);
  const candMap = Array.from({ length: 81 }, (_, i) => (grid[i] === 0 ? getValidCandidatesOnGrid(grid, i) : []));
  const unsolved = [];

  for (let i = 0; i < 81; i++) {
    if (grid[i] === 0) {
      unsolved.push({
        idx: i,
        cands: candMap[i],
        minRegionBlanks: getMinBlanksInPeers(grid, i)
      });
    }
  }
  if (unsolved.length === 0) return null;

  // TẦNG 1: NAKED SINGLE
  const nakedSingles = unsolved.filter(item => item.cands.length === 1);
  if (nakedSingles.length > 0) {
    nakedSingles.sort((a, b) => a.minRegionBlanks - b.minRegionBlanks);
    const topPool = nakedSingles.slice(0, Math.min(3, nakedSingles.length));
    const chosen = topPool[Math.floor(Math.random() * topPool.length)];
    return {
      idx: chosen.idx,
      digit: chosen.cands[0],
      cands: chosen.cands,
      minRegionBlanks: chosen.minRegionBlanks,
      technique: 'NAKED_SINGLE',
      allUnsolved: unsolved
    };
  }

  // TẦNG 2: HIDDEN SINGLE 
  const regions = [];
  for (let r = 0; r < 9; r++) regions.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) regions.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  for (let b = 0; b < 9; b++) {
    const sr = Math.floor(b / 3) * 3, sc = (b % 3) * 3;
    const boxCells = [];
    for (let rr = sr; rr < sr + 3; rr++) for (let cc = sc; cc < sc + 3; cc++) boxCells.push(rr * 9 + cc);
    regions.push(boxCells);
  }

  const hiddenMoves = [];
  for (const reg of regions) {
    for (let d = 1; d <= 9; d++) {
      const possibleCells = reg.filter(idx => grid[idx] === 0 && candMap[idx].includes(d));
      if (possibleCells.length === 1) {
        const targetIdx = possibleCells[0];
        hiddenMoves.push({
          idx: targetIdx,
          digit: d,
          cands: candMap[targetIdx],
          minRegionBlanks: getMinBlanksInPeers(grid, targetIdx),
          technique: 'HIDDEN_SINGLE',
          allUnsolved: unsolved
        });
      }
    }
  }
  if (hiddenMoves.length > 0) {
    hiddenMoves.sort((a, b) => a.minRegionBlanks - b.minRegionBlanks);
    const topHidden = hiddenMoves.slice(0, Math.min(3, hiddenMoves.length));
    return topHidden[Math.floor(Math.random() * topHidden.length)];
  }

  // TẦNG 3: MRV + BACKTRACKING 
  unsolved.sort((a, b) => a.cands.length - b.cands.length || a.minRegionBlanks - b.minRegionBlanks);
  const minCandLen = unsolved[0].cands.length;
  const mrvPool = unsolved.filter(item => item.cands.length === minCandLen);
  const chosenMrv = mrvPool[Math.floor(Math.random() * mrvPool.length)];

  const solvedBoard = botSolveFromCurrentGrid(grid);
  const deducedDigit = solvedBoard ? solvedBoard[chosenMrv.idx] : (chosenMrv.cands[0] || 1);

  return {
    idx: chosenMrv.idx,
    digit: deducedDigit,
    cands: chosenMrv.cands,
    minRegionBlanks: chosenMrv.minRegionBlanks,
    technique: 'MRV_BACKTRACK',
    allUnsolved: unsolved
  };
}

// 5. THỰC THI NƯỚC ĐI CỦA BOT AI
function simulateOpponentMove(isCorrect = true) {
  if (matchState.status !== 'PLAYING') return;
  const p2 = matchState.p2;
  if (p2.locked || p2.finished) return;
  if (!p2.wrongMask) p2.wrongMask = Array(81).fill(false);

  clearTimeout(matchState.botClearWrongTimer);
  for (let i = 0; i < 81; i++) {
    if (p2.wrongMask[i]) {
      p2.wrongMask[i] = false;
      p2.currentGrid[i] = 0;
    }
  }

  const move = findAlgorithmicBotMove(p2);
  if (!move) return;

  p2.lastTechnique = move.technique;
  const mult = getSpeedMultiplier(matchState.elapsedMs);

  let targetIdx = move.idx;
  let correctDigit = move.digit;
  let targetCands = move.cands;

  if (!isCorrect && move.minRegionBlanks <= 1 && move.allUnsolved) {
    const ambiguousCells = move.allUnsolved.filter(u => u.cands.length >= 2);
    if (ambiguousCells.length > 0) {
      const alt = ambiguousCells[Math.floor(Math.random() * ambiguousCells.length)];
      targetIdx = alt.idx;
      targetCands = alt.cands;
      correctDigit = parseInt(matchState.solutionGrid[targetIdx], 10);
    } else {
      isCorrect = true;
    }
  }

  if (isCorrect) {
    p2.wrongMask[targetIdx] = false;
    p2.cellState[targetIdx] = 1;
    p2.currentGrid[targetIdx] = correctDigit;
    p2.correctCells += 1;

    const baseGain = 10;
    let comboCount = 0;
    const r = Math.floor(targetIdx / 9), c = targetIdx % 9;
    const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);

    if (!p2.completedRows[r] && isRowSolved(p2.cellState, r)) { p2.completedRows[r] = true; comboCount++; }
    if (!p2.completedCols[c] && isColSolved(p2.cellState, c)) { p2.completedCols[c] = true; comboCount++; }
    if (!p2.completedBoxes[b] && isBoxSolved(p2.cellState, b)) { p2.completedBoxes[b] = true; comboCount++; }

    const comboBonus = comboCount * 30;
    let fullClearBonus = 0;
    if (p2.cellState.every(s => s === 1)) {
      fullClearBonus = 100 * mult;
      p2.solved = true;
      p2.locked = true;
      p2.finished = true;
      p2.solvedTimeMs = matchState.elapsedMs;
    }

    const totalDelta = baseGain + comboBonus + fullClearBonus;
    p2.score += totalDelta;
    p2.lastCorrectCell = targetIdx;
    p2.lastWrongCell = -1;
    p2.lastPopupPoints = totalDelta;

    renderOpponentBoard(targetIdx, 'CORRECT', `+${totalDelta}`);
    if (matchState.spectatingOpponent && matchState.p1.locked) {
      renderPlayerBoard();
      spawnFloatingScoreOnBoard('playerBoard', targetIdx, `+${totalDelta}`, 'bg-[#2d6a4f] text-white');
    }
    updateHeaderStats();
    checkMatchEndConditions();
  } else {
    const plausibleWrong = (targetCands || []).filter(d => d !== correctDigit);
    const wrongDigit = plausibleWrong.length > 0
      ? plausibleWrong[Math.floor(Math.random() * plausibleWrong.length)]
      : ((correctDigit % 9) + 1);

    p2.mistakes += 1;
    p2.wrongMask[targetIdx] = true;
    p2.currentGrid[targetIdx] = wrongDigit;
    p2.lastWrongCell = targetIdx;
    p2.lastCorrectCell = -1;

    if (p2.mistakes >= p2.maxMistakes) {
      p2.locked = true;
      p2.finished = true;
    }

    renderOpponentBoard(targetIdx, 'WRONG', 'SAI');
    if (matchState.spectatingOpponent && matchState.p1.locked) {
      renderPlayerBoard();
      spawnFloatingScoreOnBoard('playerBoard', targetIdx, 'SAI (0đ)', 'bg-[#b91c1c] text-white');
    }
    updateHeaderStats();
    checkMatchEndConditions();

    if (!p2.locked && matchState.status === 'PLAYING') {
      matchState.botClearWrongTimer = setTimeout(() => {
        if (matchState.status !== 'PLAYING' || !p2.wrongMask[targetIdx]) return;
        p2.wrongMask[targetIdx] = false;
        p2.currentGrid[targetIdx] = 0;
        renderOpponentBoard();
        if (matchState.spectatingOpponent && matchState.p1.locked) renderPlayerBoard();
      }, 1800);
    }
  }
}

// 6. KIỂM TRA ĐIỀU KIỆN KẾT THÚC (GIỮ NGUYÊN MÀN HÌNH, CHỈ HIỆN NÚT & DÒNG NOTE TRÊN DÒNG 2)
function checkMatchEndConditions() {
  const p1 = matchState.p1;
  const p2 = matchState.p2;
  const btnSurrender = document.getElementById('btnSurrender');
  const btnLeaveSpectate = document.getElementById('btnLeaveSpectate');
  const btnToggleSpec = document.getElementById('btnToggleSpectateBoard');
  const btnForceFinish = document.getElementById('btnForceOpponentFinish');
  const inlineNote = document.getElementById('inlineLockNote');

  if (p1.solved || p2.solved || p1.surrendered || p2.surrendered) {
    checkAndTriggerMatchFinish();
    return;
  }

  if (p1.finished && p2.finished) {
    checkAndTriggerMatchFinish();
    return;
  }

  if (p1.finished && !p2.finished) {
    if (btnSurrender) btnSurrender.classList.add('hidden');
    if (btnLeaveSpectate) btnLeaveSpectate.classList.remove('hidden');
    if (btnToggleSpec) btnToggleSpec.classList.remove('hidden');
    if (btnForceFinish) {
      btnForceFinish.textContent = 'Kết thúc ngay';
      btnForceFinish.classList.toggle('hidden', matchState.mode !== 'BOT_AI');
    }
    if (inlineNote) {
      inlineNote.textContent = 'Đã khóa 5/5 lỗi - Đang xem trực tiếp bảng của đối thủ';
      inlineNote.classList.remove('hidden');
    }

    if (!matchState.p1LockHandled) {
      matchState.p1LockHandled = true;
      matchState.spectatingOpponent = true;
      if (btnToggleSpec) btnToggleSpec.textContent = 'Xem lại bảng của bạn';
      setExplain(`Đang xem trực tiếp bảng của ${p2.username} (hiện đầy đủ số đã mở và nước đi sai).`);
      renderAllArena();
    }
  } else if (!p1.finished && p2.finished) {
    if (btnToggleSpec) btnToggleSpec.classList.add('hidden');
    if (btnForceFinish) {
      btnForceFinish.textContent = 'Kết thúc ngay';
      btnForceFinish.classList.remove('hidden');
    }
    if (inlineNote) {
      inlineNote.textContent = 'Đối thủ đã khóa 5/5 lỗi - Hoàn thành toàn bộ bảng để nhận +50% ELO thưởng!';
      inlineNote.classList.remove('hidden');
    }
  }
}

function evaluateWinnerPriority(p1, p2) {
  const isTimeout = matchState.elapsedMs >= matchState.maxDurationMs;

  if (p1.surrendered) {
    return {
      winner: 'P2',
      winnerName: p2.username,
      endType: 'SURRENDER',
      endActor: p1.username,
      badge: 'KẾT THÚC DO BỎ CUỘC',
      reason: `${p1.username} đã chọn bỏ cuộc. Chiến thắng thuộc về ${p2.username}!`
    };
  }
  if (p2.surrendered) {
    return {
      winner: 'P1',
      winnerName: p1.username,
      endType: 'SURRENDER',
      endActor: p2.username,
      badge: 'ĐỐI THỦ BỎ CUỘC',
      reason: `${p2.username} đã chọn bỏ cuộc. Chiến thắng thuộc về ${p1.username}!`
    };
  }

  if (p1.solved && !p2.solved) {
    return {
      winner: 'P1',
      winnerName: p1.username,
      endType: 'SOLVED',
      endActor: p1.username,
      badge: 'GIẢI HOÀN TẤT BẢNG 9x9 TRƯỚC',
      reason: `${p1.username} đã giải xong 81 ô trước trong ${formatTimeHHMMSS(p1.solvedTimeMs)} (${p1.score}đ so với ${p2.score}đ) và giành chiến thắng!`
    };
  }
  if (!p1.solved && p2.solved) {
    return {
      winner: 'P2',
      winnerName: p2.username,
      endType: 'SOLVED',
      endActor: p2.username,
      badge: 'ĐỐI THỦ GIẢI HOÀN TẤT BẢNG 9x9 TRƯỚC',
      reason: `${p2.username} đã giải xong 81 ô trước trong ${formatTimeHHMMSS(p2.solvedTimeMs)} (${p2.score}đ so với ${p1.score}đ)!`
    };
  }

  const fallbackType = isTimeout ? 'TIMEOUT' : 'POINTS';

  if (p1.score !== p2.score) {
    const isP1 = p1.score > p2.score;
    return {
      winner: isP1 ? 'P1' : 'P2',
      winnerName: isP1 ? p1.username : p2.username,
      endType: fallbackType,
      endActor: '',
      badge: isTimeout ? 'HẾT GIỜ — XÉT TỔNG ĐIỂM' : 'PHÂN ĐỊNH BẰNG TỔNG ĐIỂM TÍCH LŨY',
      reason: `Phân định thắng thua bằng Tổng điểm tích lũy (${p1.score}đ vs ${p2.score}đ).`
    };
  }
  if (p1.correctCells !== p2.correctCells) {
    const isP1 = p1.correctCells > p2.correctCells;
    return {
      winner: isP1 ? 'P1' : 'P2',
      winnerName: isP1 ? p1.username : p2.username,
      endType: fallbackType,
      endActor: '',
      badge: 'BẰNG ĐIỂM — PHÂN ĐỊNH BẰNG SỐ Ô ĐÚNG',
      reason: `Hai người chơi bằng điểm (${p1.score}đ). Phân định bằng Số ô điền đúng (${p1.correctCells} ô vs ${p2.correctCells} ô).`
    };
  }
  if (p1.mistakes !== p2.mistakes) {
    const isP1 = p1.mistakes < p2.mistakes;
    return {
      winner: isP1 ? 'P1' : 'P2',
      winnerName: isP1 ? p1.username : p2.username,
      endType: fallbackType,
      endActor: '',
      badge: 'BẰNG ĐIỂM — PHÂN ĐỊNH BẰNG ĐỘ CHÍNH XÁC',
      reason: `Phân định bằng Số lỗi ít hơn (${p1.mistakes} lỗi vs ${p2.mistakes} lỗi).`
    };
  }
  return {
    winner: 'DRAW',
    winnerName: 'HÒA (DRAW)',
    endType: fallbackType,
    endActor: '',
    badge: 'KẾT QUẢ HÒA TUYỆT ĐỐI',
    reason: 'Cả 2 người chơi có cùng điểm số, cùng số ô điền đúng và cùng số lỗi!'
  };
}

function formatPlayerEndStatus(player, opponent) {
  if (player.solvedTimeMs) {
    return `${formatTimeHHMMSS(player.solvedTimeMs)} (Hoàn thành)`;
  }
  if (player.surrendered) {
    return 'Đã bỏ cuộc';
  }
  const currentClock = formatTimeHHMMSS(matchState.elapsedMs);
  if (player.mistakes >= 5) {
    return `${currentClock} (Khóa 5/5 lỗi)`;
  }
  if (opponent.surrendered) {
    return `${currentClock} (Đối thủ bỏ cuộc)`;
  }
  if (opponent.solved) {
    return `${currentClock} (Đối thủ xong trước)`;
  }
  if (matchState.elapsedMs >= 15 * 60 * 1000) {
    return `${currentClock} (Hết giờ 15p)`;
  }
  return currentClock;
}

function checkAndTriggerMatchFinish() {
  if (matchState.status === 'FINISHED') return;
  matchState.status = 'FINISHED';
  stopMatchTimers();

  const p1 = matchState.p1;
  const p2 = matchState.p2;
  const mult = getSpeedMultiplier(matchState.elapsedMs);
  p1.finishBonus = p1.solved ? (100 * mult) : 0;
  p2.finishBonus = p2.solved ? (100 * mult) : 0;

  const verdict = evaluateWinnerPriority(p1, p2);

  // Client không tự tính ELO nữa: chỉ BÁO kết quả cho server, server tính và gửi lại (match_result)
  const isRankedMatch = matchState.mode === 'QUICK_1V1';
  matchState.verdictReason = verdict.reason;
  if (dbState.isLoggedIn && matchState.mode !== 'BOT_AI') {
    emit('report_result', {
      roomCode: matchState.roomCode,
      winnerName: verdict.winnerName,
      endType: verdict.endType,
      endActor: verdict.endActor,
      winnerSolved: Boolean((verdict.winner === 'P1' && p1.solved) || (verdict.winner === 'P2' && p2.solved))
    });
  }

  const revealEl = document.getElementById('p2RevealNotice');
  if (revealEl) revealEl.textContent = 'Đã kết thúc';
  renderAllArena();
  updateAuthUI();

  const eloSuffix = !dbState.isLoggedIn || matchState.mode === 'BOT_AI'
    ? ' (Luyện tập với máy • Không tính ELO)'
    : isRankedMatch
    ? ' (Đang chờ máy chủ tính ELO...)'
    : ' (Giao hữu Phòng tùy chọn • Không tính ELO)';

  document.getElementById('modalPriorityBadge').textContent = verdict.badge;
  document.getElementById('modalWinnerHeadline').textContent =
    verdict.winner === 'P1'
      ? `BẠN CHIẾN THẮNG (${p1.username})!`
      : verdict.winner === 'P2'
      ? `ĐỐI THỦ CHIẾN THẮNG (${p2.username})`
      : 'TRẬN ĐẤU HÒA TUYỆT ĐỐI!';
  document.getElementById('modalWinnerSubtext').textContent = `${verdict.reason}${eloSuffix}`;

  const p1Pct = Math.round((p1.correctCells / matchState.totalBlanks) * 100);
  const p2Pct = Math.round((p2.correctCells / matchState.totalBlanks) * 100);

  document.getElementById('modalP1Name').textContent = p1.username;
  document.getElementById('modalP1Score').textContent = `${p1.score} đ`;
  document.getElementById('modalP1BonusNote').textContent = p1.finishBonus > 0 ? `(Đã gồm +${p1.finishBonus}đ thưởng tốc độ về đích)` : '';
  document.getElementById('modalP1Time').textContent = formatPlayerEndStatus(p1, p2);
  document.getElementById('modalP1Cells').textContent = `${p1Pct}% (${p1.correctCells}/${matchState.totalBlanks} ô)`;
  document.getElementById('modalP1Mistakes').textContent = `${p1.mistakes} / 5`;

  document.getElementById('modalP2Name').textContent = p2.username;
  document.getElementById('modalP2Score').textContent = `${p2.score} đ`;
  document.getElementById('modalP2BonusNote').textContent = p2.finishBonus > 0 ? `(Đã gồm +${p2.finishBonus}đ thưởng tốc độ về đích)` : '';
  document.getElementById('modalP2Time').textContent = formatPlayerEndStatus(p2, p1);
  document.getElementById('modalP2Cells').textContent = `${p2Pct}% (${p2.correctCells}/${matchState.totalBlanks} ô)`;
  document.getElementById('modalP2Mistakes').textContent = `${p2.mistakes} / 5`;

  const p1Tag = document.getElementById('modalP1StatusTag');
  const p2Tag = document.getElementById('modalP2StatusTag');
  if (verdict.winner === 'P1') {
    p1Tag.textContent = 'THẮNG';
    p1Tag.className = 'px-2 py-0.5 text-xs font-bold bg-[#2d6a4f] text-white';
    p2Tag.textContent = 'THUA';
    p2Tag.className = 'px-2 py-0.5 text-xs font-bold bg-[#d6d0c4] text-[#1c1917]';
  } else if (verdict.winner === 'P2') {
    p2Tag.textContent = 'THẮNG';
    p2Tag.className = 'px-2 py-0.5 text-xs font-bold bg-[#2b4c7e] text-white';
    p1Tag.textContent = 'THUA';
    p1Tag.className = 'px-2 py-0.5 text-xs font-bold bg-[#d6d0c4] text-[#1c1917]';
  } else {
    p1Tag.textContent = 'HÒA';
    p2Tag.textContent = 'HÒA';
  }

  const btnHome = document.getElementById('btnBackHomeFromModal');
  const btnRoomLobby = document.getElementById('btnBackToRoomLobbyModal');
  const btnPlayAgain = document.getElementById('btnPlayAgainModal');

  btnHome.classList.remove('hidden');
  btnRoomLobby.classList.add('hidden');
  btnPlayAgain.classList.add('hidden');

  if (matchState.mode === 'ROOM_1V1') {
    btnRoomLobby.classList.remove('hidden');
  } else if (matchState.mode === 'BOT_AI') {
    btnPlayAgain.classList.remove('hidden');
  }

  document.getElementById('matchResultModal').classList.remove('hidden');
}

// Lắng nghe sự kiện WebSocket từ đối thủ khi thi đấu Online 1v1
if (typeof socket !== 'undefined' && socket) {
  socket.on('opponent_update', (payload) => {
    if (matchState.status !== 'PLAYING' || matchState.mode === 'BOT_AI') return;
    const p2 = matchState.p2;
    if (!p2.wrongMask) p2.wrongMask = Array(81).fill(false);
    const idx = payload.cellIndex;

    if (payload.value === 0) {
      p2.wrongMask[idx] = false;
      p2.currentGrid[idx] = 0;
      renderOpponentBoard();
      if (matchState.spectatingOpponent && matchState.p1.locked) renderPlayerBoard();
      return;
    }

    if (payload.isCorrect) {
      p2.wrongMask[idx] = false;
      p2.cellState[idx] = 1;
      p2.currentGrid[idx] = payload.value || parseInt(matchState.solutionGrid[idx], 10);
      p2.correctCells = payload.correctCells ?? (p2.correctCells + 1);
      const delta = (payload.score ?? p2.score) - p2.score;
      p2.score = payload.score ?? p2.score;
      if (p2.cellState.every(s => s === 1)) {
        p2.solved = true;
        p2.locked = true;
        p2.finished = true;
        p2.solvedTimeMs = matchState.elapsedMs;
      }
      const popTxt = delta > 0 ? `+${delta}` : '+10';
      renderOpponentBoard(idx, 'CORRECT', popTxt);
      if (matchState.spectatingOpponent && matchState.p1.locked) {
        renderPlayerBoard();
        spawnFloatingScoreOnBoard('playerBoard', idx, popTxt, 'bg-[#2d6a4f] text-white');
      }
    } else {
      p2.mistakes = payload.mistakes ?? (p2.mistakes + 1);
      p2.wrongMask[idx] = true;
      p2.currentGrid[idx] = payload.value || 0;
      if (p2.mistakes >= p2.maxMistakes) {
        p2.locked = true;
        p2.finished = true;
      }
      renderOpponentBoard(idx, 'WRONG', 'SAI');
      if (matchState.spectatingOpponent && matchState.p1.locked) {
        renderPlayerBoard();
        spawnFloatingScoreOnBoard('playerBoard', idx, 'SAI (0đ)', 'bg-[#b91c1c] text-white');
      }
    }

    updateHeaderStats();
    checkMatchEndConditions();
  });

  socket.on('opponent_surrendered', () => {
    if (matchState.status !== 'PLAYING' || matchState.mode === 'BOT_AI') return;
    if (!matchState.p1.finished) {
      matchState.p2.surrendered = true;
    }
    matchState.p2.locked = true;
    matchState.p2.finished = true;
    checkMatchEndConditions();
  });

  // Kết quả ELO do SERVER tính rồi gửi về cho cả 2 người chơi
  socket.on('match_result', ({ saved, ranked, deltas, elo, bonus, reason }) => {
    if (matchState.mode === 'BOT_AI') return;
    const me = dbState.currentUser.username;
    let suffix;
    if (!saved) {
      suffix = reason === 'MISMATCH'
        ? ' (Hai máy báo kết quả khác nhau • Ván này không tính ELO)'
        : ' (Máy chủ chưa lưu được kết quả • Không tính ELO)';
    } else if (!ranked) {
      suffix = matchState.mode === 'ROOM_1V1' ? ' (Giao hữu Phòng tùy chọn • Không tính ELO)' : ' (Không tính ELO)';
    } else {
      const d = deltas?.[me] ?? 0;
      suffix = ` (${d >= 0 ? '+' : ''}${d} ELO${d > 0 && bonus > 0 ? ` • Gồm +${bonus} ELO thưởng giải hết bảng` : ''})`;
      if (elo?.[me] != null) {
        dbState.currentUser.elo = elo[me];
        sessionStorage.setItem('suduelku_user', JSON.stringify(dbState.currentUser));
        updateAuthUI();
      }
    }
    const el = document.getElementById('modalWinnerSubtext');
    if (el) el.textContent = `${matchState.verdictReason || ''}${suffix}`;
    fetchSyncDatabaseLists();
  });
}