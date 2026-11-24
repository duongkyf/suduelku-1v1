// events.js — GẮN SỰ KIỆN GIAO DIỆN & SOCKET.IO (PHÒNG CHỜ, GHÉP CẶP, TRẬN ĐẤU)

window.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const show = (id) => $(id).classList.remove('hidden');
  const hide = (id) => $(id).classList.add('hidden');
  const on = (id, fn, evt = 'click') => $(id).addEventListener(evt, fn);
  const myName = () => dbState.currentUser.username;

  const SURRENDER_TEXT = {
    BOT_AI: 'Đấu với máy chỉ để luyện tập: bỏ cuộc sẽ không bị trừ ELO và ván này không được lưu vào lịch sử.',
    ROOM_1V1: 'Nếu bỏ cuộc ngay bây giờ, bạn sẽ bị xử thua ván này. Phòng tùy chọn không tính ELO.',
    QUICK_1V1: 'Nếu bỏ cuộc ngay bây giờ, bạn sẽ bị xử thua ván đấu này và bị trừ điểm ELO.'
  };

  function appendLobbyChatMessage(sender, text, isSelf = true) {
    const box = $('lobbyChatHistoryBox');
    if (!box) return;
    const d = new Date();
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const line = document.createElement('div');
    line.className = 'leading-snug break-words';
    line.innerHTML = `
      <span class="mono-num text-[10px] text-[#78716c]">[${time}]</span>
      <b class="${isSelf ? 'text-[#2d6a4f]' : 'text-[#2b4c7e]'}">${escapeHtml(sender)}:</b>
      <span class="text-[#1c1917]">${escapeHtml(text)}</span>`;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
  }

  function resetToHostWaiting() {
    Object.assign(matchState, {
      status: 'LOBBY', isRoomHost: true, lobbyReady: true, hostReady: true, guestReady: false,
      hasLobbyOpponent: false, lobbyOpponentName: 'Đang chờ người chơi...'
    });
  }

  function handleOpponentLeftInArena(becameHost = false) {
    if ($('viewArena').classList.contains('hidden') || matchState.status !== 'PLAYING' || matchState.mode === 'BOT_AI') return false;
    matchState.hasLobbyOpponent = false;
    matchState.lobbyOpponentName = 'Đang chờ người chơi...';
    if (becameHost) matchState.isRoomHost = true;

    // Nếu đối thủ đã khóa bảng (5/5 lỗi) rồi mới bấm "Thoát ra" -> mình vẫn tiếp tục giải bình thường
    if (matchState.p2.finished) {
      return true;
    }

    // Nếu mình đã khóa bảng (5/5 lỗi) và đang xem, mà đối thủ thoát trận -> chốt điểm cả 2 để phân định thắng thua
    if (matchState.p1.finished) {
      Object.assign(matchState.p2, { locked: true, finished: true });
      checkMatchEndConditions();
      return true;
    }

    // Cả 2 đang giải bình thường mà đối thủ thoát -> đối thủ bỏ cuộc
    Object.assign(matchState.p2, { surrendered: true, locked: true, finished: true });
    showToast('Đối thủ đã thoát trận! Bạn giành chiến thắng.', 'success');
    checkMatchEndConditions();
    return true;
  }

  //ĐĂNG NHẬP / ĐĂNG KÝ 
  on('btnHomeOpenLogin', () => openAuthModalWithMode('LOGIN'));
  on('btnHomeOpenRegister', () => openAuthModalWithMode('REGISTER'));
  on('tabSelectLogin', () => openAuthModalWithMode('LOGIN'));
  on('tabSelectRegister', () => openAuthModalWithMode('REGISTER'));
  on('btnCloseAuthModal', () => hide('authModal'));

  on('btnHomeLogout', () => {
    sessionStorage.removeItem('suduelku_user');
    dbState.isLoggedIn = false;
    dbState.currentUser = { userId: 0, username: 'Khách (Guest)', role: 'USER', elo: 1200 };
    hide('homeDifficultyPicker');
    hide('roomInputCollapse');
    updateAuthUI();
    showToast('Đã đăng xuất! Các tính năng Online đã được khóa lại.', 'info');
  });

  on('authSwitchForm', async (e) => {
    e.preventDefault();
    const username = $('authUsernameInput').value.trim();
    const password = $('authPasswordInput').value;
    const endpoint = dbState.authMode === 'REGISTER' ? '/auth/register' : '/auth/login';
    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Thao tác thất bại!', 'error'); return; }

      dbState.isLoggedIn = true;
      dbState.currentUser = {
        userId: data.UserID || data.userId,
        username: data.Username || data.username,
        role: 'USER',
        elo: data.EloRating ?? data.elo ?? 1200
      };
      matchState.p1.username = myName();
      sessionStorage.setItem('suduelku_user', JSON.stringify(dbState.currentUser));

      hide('authModal');
      updateAuthUI();
      await fetchSyncDatabaseLists();
      showToast(`Đã đăng nhập: ${myName()} (${dbState.currentUser.elo} ELO)!`, 'success');
    } catch (err) {
      showToast('Không kết nối được Backend Server (Hãy bật node server.js ở cổng 3000)!', 'error');
    }
  }, 'submit');

  // CÁC MODAL TIỆN ÍCH 
  [['TechInfo', false], ['Rules', false], ['Leaderboard', true], ['History', true]].forEach(([name, needSync]) => {
    const modal = `${name[0].toLowerCase()}${name.slice(1)}Modal`;
    on(`btnOpen${name}Modal`, async () => {
      if (name === 'History' && !dbState.isLoggedIn) return;
      if (needSync) await fetchSyncDatabaseLists();
      show(modal);
    });
    on(`btnClose${name}Modal`, () => hide(modal));
  });

  // GHÉP CẶP NHANH 
  let queueTimer = null;

  on('btnQuickMatchCenter', () => {
    if (!dbState.isLoggedIn) return;
    const myElo = dbState.currentUser.elo || 1200;
    const timerEl = $('quickMatchTimerText');
    const rangeEl = $('quickMatchRangeText');
    let seconds = 0;

    const renderRange = () => {
      const tol = Math.min(500, 150 + seconds * 50);
      const minElo = Math.max(800, myElo - tol);
      const maxElo = myElo + tol;
      if (rangeEl) rangeEl.textContent = `ELO của bạn: ${myElo} • Biên độ tìm: ${minElo} – ${maxElo} (Giới hạn ±500)`;
    };
    if (timerEl) timerEl.textContent = '00:00';
    renderRange();

    clearInterval(queueTimer);
    queueTimer = setInterval(() => {
      seconds++;
      if (timerEl) timerEl.textContent = formatTimeHHMMSS(seconds * 1000);
      renderRange();
    }, 1000);

    show('lobbyModal');
    emit('quick_match_find', { username: myName(), elo: myElo });
  });

  on('btnCloseLobbyModal', () => {
    clearInterval(queueTimer);
    hide('lobbyModal');
    emit('quick_match_cancel');
    showToast('Đã hủy tìm trận.', 'info');
  });

  // TẠO PHÒNG / VÀO PHÒNG 
  on('btnHomeCreateRoom', () => {
    if (!dbState.isLoggedIn) return;
    hide('homeDifficultyPicker');
    openRoomLobby({ difficulty: 'EASY', opponentName: 'Đang chờ người chơi...', isHost: true });
    resetToHostWaiting();
    syncLobbyWaitingState(false);
    emit('create_room', { roomCode: matchState.roomCode, username: myName(), elo: dbState.currentUser.elo, difficulty: 'EASY' });
    showToast(`Đã tạo phòng ${matchState.roomCode}! Hãy mở tab thứ 2 và nhập mã này để đấu.`, 'success');
  });

  on('btnToggleRoomInput', () => {
    if (!dbState.isLoggedIn) return;
    $('roomInputCollapse').classList.toggle('hidden');
    if (!$('roomInputCollapse').classList.contains('hidden')) $('inputRoomCode').focus();
  });

  on('btnJoinRoom', () => {
    if (!dbState.isLoggedIn) return;
    const input = $('inputRoomCode');
    const code = (input.value || '').trim().toUpperCase();
    if (code.length !== 4) { showToast('Vui lòng nhập đúng Mã phòng 4 ký tự!', 'warn'); return; }
    input.value = '';
    hide('roomInputCollapse');

    if (socket) {
      emit('join_room', { roomCode: code, username: myName(), elo: dbState.currentUser.elo, isQuickMatch: false });
    } else {
      openRoomLobby({ roomCode: code, difficulty: 'EASY', opponentName: `Chủ phòng ${code}`, isHost: false });
    }
  });

  // ĐẤU VỚI MÁY
  on('btnHomeVsBot', () => {
    dbState.pendingHomeMode = 'BOT_AI';
    $('pickerModeBadge').textContent = 'Chế độ: Đấu với máy (Bot AI)';
    show('homeDifficultyPicker');
  });
  on('btnCancelDifficultyPicker', () => hide('homeDifficultyPicker'));

  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const diff = btn.dataset.diff;
      hide('homeDifficultyPicker');
      startNewMatch({ difficulty: diff, mode: 'BOT_AI' });
      showToast(`Bắt đầu Đấu với máy — Độ khó ${getDifficultyDisplayName(diff)}!`, 'success');
    });
  });

  // PHÒNG CHỜ (#viewRoomLobby)
  document.querySelectorAll('[data-lobby-diff]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!matchState.isRoomHost) { showToast('Chỉ Chủ phòng mới được điều chỉnh độ khó đề bài!', 'warn'); return; }
      const diff = btn.getAttribute('data-lobby-diff');
      if (diff === matchState.difficulty) return;

      updateLobbyDifficultyButtonsUI(diff);
      appendLobbyChatMessage('Hệ thống', `Chủ phòng đã đổi độ khó sang mức ${getDifficultyDisplayName(diff)}.`, true);
      if (matchState.roomCode) emit('change_room_difficulty', { roomCode: matchState.roomCode, difficulty: diff });
    });
  });

  on('inputRoomCode', (e) => {
    const pasted = (e.clipboardData || window.clipboardData)?.getData('text') || '';
    if (pasted) {
      e.preventDefault();
      $('inputRoomCode').value = pasted.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4);
    }
  }, 'paste');

  on('btnCopyRoomCode', async () => {
    try {
      await copyTextToClipboard(matchState.roomCode);
      showToast(`Đã sao chép mã phòng: ${matchState.roomCode}`, 'success');
    } catch (err) {
      showToast(`Mã phòng của bạn là: ${matchState.roomCode}`, 'info');
    }
  });

  on('btnLeaveRoomLobby', () => {
    matchState.status = 'IDLE';
    emit('leave_room', { roomCode: matchState.roomCode });
    switchScreen('HOME');
    showToast('Đã rời phòng chờ về Trang chủ.', 'info');
  });

  on('btnToggleLobbyReady', () => {
    matchState.lobbyReady = !matchState.lobbyReady;
    if (matchState.isRoomHost) matchState.hostReady = matchState.lobbyReady;
    else matchState.guestReady = matchState.lobbyReady;

    syncLobbyWaitingState(matchState.hasLobbyOpponent);
    appendLobbyChatMessage(myName(), matchState.lobbyReady ? 'Đã sẵn sàng thi đấu!' : 'Đang tạm dừng chuẩn bị...', true);
    emit('lobby_toggle_ready', {
      roomCode: matchState.roomCode, isHost: matchState.isRoomHost, ready: matchState.lobbyReady, username: myName()
    });
  });

  function sendLobbyChat(msg) {
    appendLobbyChatMessage(myName(), msg, true);
    playTone(580, 0.06, 'sine');
    emit('lobby_chat', { roomCode: matchState.roomCode, username: myName(), message: msg });
  }
  document.querySelectorAll('.lobby-quick-chat').forEach(btn => {
    btn.addEventListener('click', () => sendLobbyChat(btn.getAttribute('data-quick-msg')));
  });
  on('lobbyCustomChatForm', (e) => {
    e.preventDefault();
    const input = $('lobbyCustomChatInput');
    const msg = (input.value || '').trim();
    if (!msg) return;
    input.value = '';
    sendLobbyChat(msg);
  }, 'submit');

  on('btnStartMatchFromLobby', async () => {
    const s = matchState;
    if (!s.isRoomHost) return showToast('Chỉ Chủ phòng mới có quyền bắt đầu trận đấu!', 'warn');
    if (!s.hasLobbyOpponent) return showToast('Đang chờ người chơi thứ 2 vào phòng!', 'warn');
    if (!s.hostReady) return showToast('Bạn cần chuyển về trạng thái Sẵn sàng trước khi bắt đầu!', 'warn');
    if (!s.guestReady) return showToast('Đối thủ đang chuẩn bị, hãy chờ đối thủ nhấn Sẵn sàng!', 'warn');

    const puzzleData = await fetchPuzzle(s.difficulty);
    if (socket && socket.connected) {
      emit('lobby_start_match', { roomCode: s.roomCode, difficulty: s.difficulty, puzzleData, mode: 'ROOM_1V1' });
    } else {
      startNewMatch({ difficulty: s.difficulty, mode: 'ROOM_1V1', roomCode: s.roomCode, opponentName: s.lobbyOpponentName, customPuzzle: puzzleData });
    }
  });

  // SOCKET.IO 
  if (socket) {
    socket.on('room_error', ({ message }) => showToast(message, 'error'));

    socket.on('player_joined_lobby', async ({ roomCode, difficulty, hostName, hostElo, guestName, guestElo, isQuickMatch }) => {
      const amIHost = myName() === hostName;
      const oppName = amIHost ? guestName : hostName;
      matchState.lobbyOpponentName = oppName;

      if (isQuickMatch) {
        if (amIHost) {
          const puzzleData = await fetchPuzzle(difficulty);
          emit('lobby_start_match', { roomCode, difficulty, puzzleData, mode: 'QUICK_1V1' });
        }
        return;
      }

      openRoomLobby({ roomCode, difficulty, opponentName: oppName, isHost: amIHost });
      $('lobbyHostName').textContent = hostName;
      $('lobbyHostElo').textContent = `${hostElo} ELO • Chủ phòng`;
      $('lobbyGuestName').textContent = guestName;
      $('lobbyGuestElo').textContent = `${guestElo} ELO • Đã kết nối`;

      appendLobbyChatMessage('Hệ thống', `${guestName} đã vào phòng (Đang chuẩn bị — hãy nhấn Sẵn sàng để bắt đầu)!`, false);
      showToast(`${guestName} đã vào phòng ${roomCode}!`, 'success');
    });

    socket.on('promoted_to_host', ({ newHostName, newHostElo, difficulty }) => {
      if (handleOpponentLeftInArena(true)) return;
      resetToHostWaiting();
      matchState.difficulty = difficulty || matchState.difficulty || 'EASY';
      $('lobbyHostName').textContent = newHostName;
      $('lobbyHostElo').textContent = `${newHostElo} ELO • Chủ phòng mới`;
      updateLobbyDifficultyButtonsUI(matchState.difficulty);
      syncLobbyWaitingState(false);
      appendLobbyChatMessage('Hệ thống', `Chủ phòng cũ đã rời phòng. Bạn (${newHostName}) đã trở thành Chủ phòng mới!`, true);
      showToast('Chủ phòng đã rời đi. Bạn đã trở thành Chủ phòng mới!', 'info');
    });

    socket.on('guest_left_lobby', ({ leftGuestName }) => {
      if (handleOpponentLeftInArena(false)) return;
      Object.assign(matchState, { status: 'LOBBY', hasLobbyOpponent: false, guestReady: false, lobbyOpponentName: 'Đang chờ người chơi...' });
      syncLobbyWaitingState(false);
      appendLobbyChatMessage('Hệ thống', `${leftGuestName || 'Khách'} đã rời phòng chờ. Đang chờ người chơi mới...`, false);
      showToast('Đối thủ đã rời phòng chờ.', 'warn');
    });

    socket.on('room_diff_updated', ({ difficulty }) => {
      const diff = difficulty || 'EASY';
      updateLobbyDifficultyButtonsUI(diff);
      appendLobbyChatMessage('Hệ thống', `Chủ phòng đã đổi độ khó sang mức ${getDifficultyDisplayName(diff)}.`, false);
    });

    socket.on('lobby_ready_updated', ({ isHost, ready, username }) => {
      if (isHost) matchState.hostReady = ready;
      else matchState.guestReady = ready;
      syncLobbyWaitingState(matchState.hasLobbyOpponent);
      appendLobbyChatMessage(username, ready ? 'Đã sẵn sàng!' : 'Đang chuẩn bị...', false);
    });

    socket.on('lobby_chat', ({ username, message }) => {
      if (username === myName()) return;
      appendLobbyChatMessage(username, message, false);
      playTone(480, 0.06, 'triangle');
    });

    socket.on('match_started_from_lobby', ({ roomCode, difficulty, puzzleData, mode, players }) => {
      clearInterval(queueTimer);
      hide('lobbyModal');
      const opp = (players || []).find(p => p.username !== myName());
      startNewMatch({
        difficulty, mode: mode || 'ROOM_1V1', roomCode,
        opponentName: opp ? opp.username : matchState.lobbyOpponentName,
        opponentElo: opp ? opp.elo : null,
        customPuzzle: puzzleData
      });
      showToast(`Trận đấu 1v1 phòng ${roomCode} bắt đầu!`, 'success');
    });

    socket.on('room_closed_by_peer', () => {
      if (!$('viewRoomLobby').classList.contains('hidden')) {
        resetToHostWaiting();
        $('lobbyHostName').textContent = myName();
        $('lobbyHostElo').textContent = `${dbState.currentUser.elo} ELO • Chủ phòng mới`;
        syncLobbyWaitingState(false);
        emit('create_room', { roomCode: matchState.roomCode, username: myName(), elo: dbState.currentUser.elo, difficulty: matchState.difficulty || 'EASY' });
        appendLobbyChatMessage('Hệ thống', 'Chủ phòng cũ đã rời đi. Bạn đã trở thành Chủ phòng mới!', true);
        showToast('Chủ phòng đã rời đi. Bạn đã trở thành Chủ phòng mới!', 'info');
        return;
      }
      handleOpponentLeftInArena(true);
    });
  }

  // BÀN ĐẤU (#viewArena)
  on('btnToggleSpectateBoard', () => {
    if (!matchState.p1.locked) return;
    matchState.spectatingOpponent = !matchState.spectatingOpponent;
    const btn = $('btnToggleSpectateBoard');
    if (btn) {
      btn.textContent = matchState.spectatingOpponent ? 'Xem lại bảng của bạn' : 'Xem bảng đối thủ';
    }
    setExplain(
      matchState.spectatingOpponent
        ? `Đang xem trực tiếp bảng của ${matchState.p2.username} (hiện đầy đủ số đã mở và nước đi sai).`
        : 'Đang xem lại bảng của bạn (Đã khóa do chạm 5/5 lỗi).'
    );
    renderPlayerBoard();
  });

  // Xử lý rời trận sau khi bị khóa bàn
  function handleLeaveAfterLocked() {
    stopMatchTimers();
    if (matchState.mode !== 'BOT_AI' && matchState.roomCode) {
      emit('leave_room', { roomCode: matchState.roomCode });
    }
    matchState.status = 'IDLE';
    switchScreen('HOME');
  }

  on('btnLeaveSpectate', handleLeaveAfterLocked);
  on('btnLeaveFromBanner', handleLeaveAfterLocked);
  on('btnUndoMove', handleUndoLastMove);
  on('btnDeleteWrongCell', handleDeleteWrongOrNotesCell);
  on('btnToggleNotes', toggleNotesMode);
  on('btnClearFocusDigit', () => { matchState.selectedCell = -1; renderPlayerBoard(); });

  on('btnSurrender', () => {
    if (matchState.status !== 'PLAYING') { switchScreen('HOME'); return; }
    $('surrenderConfirmText').textContent = SURRENDER_TEXT[matchState.mode] || SURRENDER_TEXT.QUICK_1V1;
    show('surrenderConfirmModal');
  });
  on('btnCancelSurrenderModal', () => hide('surrenderConfirmModal'));

  // Xác nhận đầu hàng
  on('btnConfirmSurrenderNow', () => {
    hide('surrenderConfirmModal');
    // Nếu đối thủ đã khóa bảng 5/5 lỗi từ trước, việc dừng lại sẽ tính là chốt điểm để so điểm
    Object.assign(matchState.p1, { surrendered: true, locked: true, finished: true });
    if (matchState.mode !== 'BOT_AI') emit('player_surrender', { roomCode: matchState.roomCode, username: myName() });
    checkMatchEndConditions();
  });

  // Nút "Kết thúc ngay" trên Dòng 2:
  // - Khi đối thủ đã khóa 5/5 lỗi: chốt điểm hiện tại của mình và mở bảng tổng kết ngay
  // - Khi bị khóa 5/5 lỗi trong chế độ Đấu với máy: cho Bot giải nốt và mở bảng tổng kết
  on('btnForceOpponentFinish', () => {
    const p1 = matchState.p1;
    const p2 = matchState.p2;

    if (!p1.finished && p2.finished) {
      p1.locked = true;
      p1.finished = true;
      if (matchState.mode !== 'BOT_AI') {
        emit('player_finish_early', { roomCode: matchState.roomCode, username: myName() });
      }
      checkMatchEndConditions();
      return;
    }

    if (matchState.mode === 'BOT_AI' && !p2.finished) {
      while (!p2.finished && p2.cellState.includes(0)) simulateOpponentMove(true);
      p2.finished = true;
      checkMatchEndConditions();
    }
  });

  // Phím tắt trong trận
  window.addEventListener('keydown', (e) => {
    if ($('viewArena').classList.contains('hidden')) return;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

    const key = e.key;
    const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

    if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === 'z') {
      e.preventDefault();
      handleUndoLastMove();
    } else if (key >= '1' && key <= '9') {
      e.preventDefault();
      handlePlayerSubmitDigit(parseInt(key, 10));
    } else if (e.code && /^Numpad[1-9]$/.test(e.code)) {
      e.preventDefault();
      handlePlayerSubmitDigit(parseInt(e.code.slice(6), 10));
    } else if (key.toLowerCase() === 'n' || e.code === 'Space') {
      e.preventDefault();
      toggleNotesMode();
      showToast(matchState.notesMode ? 'Đã BẬT chế độ Ghi chú (Phím N)' : 'Đã TẮT chế độ Ghi chú', 'info');
    } else if (key === 'Backspace' || key === 'Delete') {
      e.preventDefault();
      handleDeleteWrongOrNotesCell();
    } else if (key === 'Escape') {
      e.preventDefault();
      matchState.selectedCell = -1;
      renderPlayerBoard();
    } else if (arrows[key]) {
      e.preventDefault();
      const cur = matchState.selectedCell >= 0 ? matchState.selectedCell : 0;
      const r = (Math.floor(cur / 9) + arrows[key][0] + 9) % 9;
      const c = ((cur % 9) + arrows[key][1] + 9) % 9;
      matchState.selectedCell = r * 9 + c;
      renderPlayerBoard();
    }
  });

  // MÀN HÌNH KẾT QUẢ 
  on('btnBackHomeFromModal', () => {
    if (matchState.mode !== 'BOT_AI' && matchState.roomCode) emit('leave_room', { roomCode: matchState.roomCode });
    matchState.status = 'IDLE';
    hide('matchResultModal');
    switchScreen('HOME');
  });

  // Xử lý quay lại phòng chờ
  on('btnBackToRoomLobbyModal', () => {
    const stillHasOpp = Boolean(matchState.hasLobbyOpponent);
    Object.assign(matchState, { status: 'LOBBY', hostReady: true, guestReady: false, lobbyReady: matchState.isRoomHost });
    hide('matchResultModal');
    switchScreen('LOBBY');
    syncLobbyWaitingState(stillHasOpp);
    appendLobbyChatMessage('Hệ thống', 'Ván đấu đã kết thúc. Đã quay lại phòng chờ!', true);
    showToast(`Đã trở về phòng chờ ${matchState.roomCode}.`, 'info');
  });

  // Nhấn nút chơi lại: tạo ván đấu mới với Bot cùng độ khó
  on('btnPlayAgainModal', () => {
    hide('matchResultModal');
    startNewMatch({ difficulty: matchState.difficulty, mode: 'BOT_AI' });
    showToast(`Bắt đầu ván mới (Độ khó: ${getDifficultyDisplayName(matchState.difficulty)})!`, 'success');
  });

  //KHÔI PHỤC TÀI KHOẢN KHI F5 
  const savedUser = sessionStorage.getItem('suduelku_user');
  if (savedUser) {
    try {
      dbState.currentUser = JSON.parse(savedUser);
      dbState.isLoggedIn = true;
      matchState.p1.username = myName();
    } catch (e) {
      sessionStorage.removeItem('suduelku_user'); // dữ liệu phiên hỏng -> coi như chưa đăng nhập
    }
  }

  updateAuthUI();
  fetchSyncDatabaseLists();
  switchScreen('HOME');
});