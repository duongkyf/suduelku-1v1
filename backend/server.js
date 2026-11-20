const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const sql = require('mssql');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 5000,
  pingTimeout: 5000
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// 1. KẾT NỐI MICROSOFT SQL SERVER (đọc từ backend/.env)
const dbConfig = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASS || '123456',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'SudokuelDB',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  options: { encrypt: false, trustServerCertificate: true }
};

// Khởi tạo Connection Pool kết nối bất đồng bộ tới SQL Server (trả về pool nếu thành công, null nếu lỗi)
const poolPromise = new sql.ConnectionPool(dbConfig)
  .connect()
  .then(pool => {
    console.log('Đã kết nối thành công tới Microsoft SQL Server:', dbConfig.database);
    return pool;
  })
  .catch(err => {
    console.error('Lỗi kết nối SQL Server:', err.message);
    return null;
  }); 

// Middleware gắn Connection Pool vào req.pool cho mọi route /api và trả về lỗi 500 nếu chưa kết nối được SQL Server
app.use('/api', async (req, res, next) => {
  req.pool = await poolPromise;
  if (!req.pool) return res.status(500).json({ error: 'Chưa kết nối được SQL Server!' });
  next();
});

// 2. REST API

// 2.1. Đăng nhập
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await req.pool.request()
      .input('u', sql.VarChar, username)
      .query(`
        SELECT UserID, Username, PasswordHash, Role, EloRating,
               ISNULL(Wins, ISNULL(TotalWins, 0)) AS Wins,
               ISNULL(TotalMatches, 0) AS TotalMatches
        FROM Users WHERE Username = @u
      `);
    const user = result.recordset[0];
    const dbPass = (user && user.PasswordHash) || '';
    const ok = user && (dbPass.startsWith('$2') ? await bcrypt.compare(password, dbPass) : password === dbPass);
    if (!ok) return res.status(401).json({ error: 'Sai tên tài khoản hoặc mật khẩu!' });
    delete user.PasswordHash;
    res.json(user);
  } catch (err) {
    console.error('Lỗi Login:', err.message);
    res.status(500).json({ error: 'Lỗi truy vấn cơ sở dữ liệu!' });
  }
});

// 2.2. Đăng ký
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const check = await req.pool.request()
      .input('u', sql.VarChar, username)
      .query('SELECT UserID FROM Users WHERE Username = @u');
    if (check.recordset.length) return res.status(400).json({ error: 'Tên tài khoản này đã tồn tại!' });
    const insert = await req.pool.request()
      .input('u', sql.VarChar, username)
      .input('p', sql.VarChar, await bcrypt.hash(password, 10))
      .input('r', sql.VarChar, 'USER')
      .query(`
        INSERT INTO Users (Username, PasswordHash, Role, EloRating, Wins, TotalWins, TotalMatches)
        OUTPUT INSERTED.UserID, INSERTED.Username, INSERTED.Role, INSERTED.EloRating, INSERTED.Wins, INSERTED.TotalMatches
        VALUES (@u, @p, @r, 1200, 0, 0, 0)
      `);
    res.status(201).json(insert.recordset[0]);
  } catch (err) {
    console.error('Lỗi Register:', err.message);
    res.status(500).json({ error: 'Không thể tạo tài khoản trong CSDL!' });
  }
});

// 2.3. Bảng xếp hạng ELO (Top 10)
app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await req.pool.request().query(`
      SELECT TOP 10 UserID, Username, EloRating,
             ISNULL(Wins, ISNULL(TotalWins, 0)) AS Wins,
             ISNULL(TotalMatches, 0) AS TotalMatches
      FROM Users ORDER BY EloRating DESC, Wins DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Lỗi Leaderboard:', err.message);
    res.json([]);
  }
});

// 2.4. Lịch sử đấu: Chỉ lưu 1 dòng nhưng tự đảo P1 <-> P2 theo tài khoản đang xem (@u)
app.get('/api/matches', async (req, res) => {
  const username = String(req.query.username ?? '').trim();
  try {
    const request = req.pool.request();
    if (username) {
      request.input('u', sql.NVarChar, username);
      const result = await request.query(`
        SELECT TOP 30
          MatchID, RoomCode, Difficulty,
          CASE WHEN P2Name = @u THEN P2Name ELSE P1Name END AS P1Name,
          CASE WHEN P2Name = @u THEN P2Score ELSE P1Score END AS P1Score,
          CASE WHEN P2Name = @u THEN P2Cells ELSE P1Cells END AS P1Cells,
          CASE WHEN P2Name = @u THEN P2Mistakes ELSE P1Mistakes END AS P1Mistakes,
          CASE WHEN P2Name = @u THEN P1Name ELSE P2Name END AS P2Name,
          CASE WHEN P2Name = @u THEN P1Score ELSE P2Score END AS P2Score,
          CASE WHEN P2Name = @u THEN P1Cells ELSE P2Cells END AS P2Cells,
          CASE WHEN P2Name = @u THEN P1Mistakes ELSE P2Mistakes END AS P2Mistakes,
          WinnerName, WinReason
        FROM Matches
        WHERE P1Name = @u OR P2Name = @u
        ORDER BY MatchID DESC
      `);
      return res.json(result.recordset);
    }
    const result = await request.query(`
      SELECT TOP 30 MatchID, RoomCode, Difficulty, P1Name, P1Score, P1Cells, P1Mistakes,
                    P2Name, P2Score, P2Cells, P2Mistakes, WinnerName, WinReason
      FROM Matches ORDER BY MatchID DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Lỗi lấy Lịch sử đấu:', err.message);
    res.json([]);
  }
});

// 2.6. Lấy 1 đề ngẫu nhiên theo độ khó
app.get('/api/puzzles/random/:difficulty', async (req, res) => {
  try {
    const r = await req.pool.request()
      .input('d', sql.VarChar, String(req.params.difficulty).toUpperCase())
      .query('SELECT TOP 1 InitialGrid, SolutionGrid FROM Puzzles WHERE Difficulty = @d ORDER BY NEWID()');
    if (!r.recordset.length) return res.status(404).json({ error: 'Chưa có đề cho độ khó này' });
    res.json(r.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. SOCKET.IO: GHÉP CẶP ELO (±500), PHÒNG CHỜ & ĐỒNG BỘ 1V1
// Bọc handler: payload rỗng/null hoặc lỗi bất ngờ không làm sập cả server
const onSafe = (socket, event, fn) =>
  socket.on(event, (data, ...rest) => {
    try { fn(data ?? {}, ...rest); } catch (e) { console.error(`[socket:${event}]`, e.message); }
  });

const activeRooms = new Map();
let quickMatchQueue = [];

// 3a. KẾT QUẢ TRẬN: SERVER TỰ TÍNH ELO & LƯU LỊCH SỬ (không tin số ELO từ client)
//   - Client chỉ BÁO "ai thắng" qua socket; ELO do server đọc từ DB và tính.
//   - Hai bên báo khớp nhau -> chốt. Báo khác nhau -> không tính ELO.
//   - Thoát / rớt mạng giữa ván khi cả hai còn đang chơi -> bên thoát bị xử thua.
const DIFFS = ['EASY', 'MEDIUM', 'HARD'];
const END_TYPES = ['SOLVED', 'SURRENDER', 'TIMEOUT', 'POINTS'];
const K_FACTOR = 24;
const FULL_CLEAR_BONUS_RATIO = 0.5; // +50% ELO cơ bản khi giải hết 81 ô
const MIN_ELO = 800;
const MATCH_MAX_AGE_MS = 20 * 60 * 1000; // 15 phút thi đấu + dư; quá hạn mà chưa chốt -> bỏ
const FORFEIT_GRACE_MS = 3000; // chờ 3s trước khi xử thua người rớt mạng (nếu người kia cũng rớt -> hủy trận)

const clampInt = (v, max) => Math.min(max, Math.max(0, Number(v) | 0));
const otherOf = (m, p) => m.players.find(x => x !== p);
const isLocked = (m, p) => (m.stats[p.socketId]?.mistakes ?? 0) >= 5; // đã khóa bảng 5/5 lỗi
const forfeitResult = (loser, winner) =>
  ({ winner: winner.name, endType: 'SURRENDER', endActor: loser.name, solved: false });
const notify = (m, payload) => m.players.forEach(p => io.to(p.socketId).emit('match_result', payload));

// Tạo hồ sơ trận khi Chủ phòng bấm bắt đầu 
function startMatchRecord(room) {
  if (room.match) clearTimeout(room.match.timer);
  const m = {
    roomCode: room.roomCode,
    ranked: Boolean(room.isQuickMatch), // do SERVER quyết định (phòng ghép cặp), không tin client
    difficulty: DIFFS.includes(room.difficulty) ? room.difficulty : 'EASY',
    players: [
      { name: room.host, socketId: room.hostSocketId },
      { name: room.guest, socketId: room.guestSocketId }
    ],
    stats: {},    // socketId -> { score, correctCells, mistakes } (lấy từ player_move gần nhất)
    reports: {},  // socketId -> báo cáo kết quả
    left: {},     // socketId -> true nếu đã rời phòng
    finished: false
  };
  m.timer = setTimeout(() => {
    if (m.finished) return;
    m.finished = true;
    notify(m, { saved: false, reason: 'EXPIRED' });
  }, MATCH_MAX_AGE_MS);
  m.timer.unref?.();
  room.match = m;
}

// Kết thúc trận đấu, hủy các bộ đếm thời gian, lưu kết quả vào DB và thông báo cho người chơi
function finishMatch(m, result) {
  if (m.finished) return;
  m.finished = true;
  clearTimeout(m.timer);
  clearTimeout(m.forfeitTimer);
  saveMatchResult(m, result)
    .then(payload => notify(m, payload))
    .catch(err => {
      console.error('Lỗi lưu kết quả trận đấu:', err.message);
      notify(m, { saved: false, reason: 'DB_ERROR' });
    });
}

// Một người rời phòng / rớt mạng khi trận chưa chốt kết quả
function onPlayerLeftMatch(m, socketId) {
  const me = m.players.find(p => p.socketId === socketId);
  if (!me) return;
  m.left[socketId] = true;
  if (m.reports[socketId]) return; // đã báo cáo trước khi rời -> chờ đối phương báo cáo

  const other = otherOf(m, me);
  const theirs = m.reports[other.socketId];
  // Đối phương đã báo cáo rồi -> chốt theo báo cáo đó (bonus chỉ khi người rời đã bị khóa 5/5)
  if (theirs) return finishMatch(m, { ...theirs, solved: theirs.solved && isLocked(m, me) });
  // Cả hai đều đã rời mà không ai báo cáo -> hủy trận
  if (m.left[other.socketId]) { m.finished = true; clearTimeout(m.timer); clearTimeout(m.forfeitTimer); return; }
  // Có người đã khóa 5/5: không phải bỏ cuộc -> chờ người còn lại chơi xong và báo cáo
  if (isLocked(m, me) || isLocked(m, other)) return;
  // Cả hai đang chơi bình thường mà một bên thoát / rớt mạng -> xử thua sau một khoảng chờ ngắn
  // (nếu người kia cũng rớt trong lúc chờ thì nhánh "cả hai đã rời" ở trên sẽ hủy trận)
  m.forfeitTimer = setTimeout(() => finishMatch(m, forfeitResult(me, other)), FORFEIT_GRACE_MS);
  m.forfeitTimer.unref?.();
}

// Tính ELO bằng dữ liệu trong DB, cập nhật Users + ghi Matches trong CÙNG 1 transaction
async function saveMatchResult(m, r) {
  const pool = await poolPromise;
  if (!pool) throw new Error('Chưa kết nối được SQL Server');

  const [a, b] = m.players; // a = Chủ phòng (P1), b = Khách (P2)
  const winner = r.winner === 'DRAW' ? null : m.players.find(p => p.name === r.winner);
  const sa = m.stats[a.socketId] || {};
  const sb = m.stats[b.socketId] || {};
  const fmt = (n) => (n > 0 ? `+${n} ELO` : `${n} ELO`);

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    let deltas = null, elo = null, bonus = 0;
    let eloTag = 'CUSTOM | 0 ELO';

    if (m.ranked) {
      const rs = await new sql.Request(tx)
        .input('a', sql.VarChar, a.name)
        .input('b', sql.VarChar, b.name)
        .query('SELECT Username, ISNULL(EloRating, 1200) AS Elo FROM Users WHERE Username IN (@a, @b)');
      const cur = Object.fromEntries(rs.recordset.map(u => [String(u.Username).toLowerCase(), u.Elo]));
      const eA = cur[a.name.toLowerCase()], eB = cur[b.name.toLowerCase()];

      if (eA != null && eB != null) {
        let dA = 0, dB = 0;
        if (winner) {
          const wElo = winner === a ? eA : eB;
          const lElo = winner === a ? eB : eA;
          const expected = 1 / (1 + Math.pow(10, (lElo - wElo) / 400));
          const base = Math.max(8, Math.round(K_FACTOR * (1 - expected)));
          bonus = r.solved ? Math.round(base * FULL_CLEAR_BONUS_RATIO) : 0;
          dA = winner === a ? base + bonus : -base;
          dB = winner === b ? base + bonus : -base;
        }

        const apply = async (p, delta, won) => {
          const res = await new sql.Request(tx)
            .input('u', sql.VarChar, p.name)
            .input('d', sql.Int, delta)
            .input('w', sql.Int, won ? 1 : 0)
            .query(`
              UPDATE Users
              SET EloRating = CASE WHEN ISNULL(EloRating, 1200) + @d < ${MIN_ELO} THEN ${MIN_ELO} ELSE ISNULL(EloRating, 1200) + @d END,
                  Wins = ISNULL(Wins, ISNULL(TotalWins, 0)) + @w,
                  TotalWins = ISNULL(TotalWins, ISNULL(Wins, 0)) + @w,
                  TotalMatches = ISNULL(TotalMatches, 0) + 1
              OUTPUT INSERTED.EloRating AS Elo
              WHERE Username = @u
            `);
          return res.recordset[0].Elo;
        };
        const nA = await apply(a, dA, winner === a);
        const nB = await apply(b, dB, winner === b);

        deltas = { [a.name]: nA - eA, [b.name]: nB - eB };
        elo = { [a.name]: nA, [b.name]: nB };
        eloTag = `${a.name}:${fmt(deltas[a.name])} | ${b.name}:${fmt(deltas[b.name])}`;
      }
    }

    let statusTag = 'TÍNH ĐIỂM';
    const actorOk = r.endActor && m.players.some(p => p.name === r.endActor);
    if (r.endType === 'SOLVED' && actorOk) statusTag = `HOÀN THÀNH:${r.endActor}`;
    else if (r.endType === 'SURRENDER' && actorOk) statusTag = `BỎ CUỘC:${r.endActor}`;
    else if (r.endType === 'TIMEOUT') statusTag = 'HẾT GIỜ';

    await new sql.Request(tx)
      .input('roomCode', sql.VarChar, String(m.roomCode).toUpperCase())
      .input('difficulty', sql.VarChar, m.difficulty)
      .input('p1Name', sql.NVarChar, a.name)
      .input('p1Score', sql.Int, sa.score || 0)
      .input('p1Cells', sql.Int, sa.correctCells || 0)
      .input('p1Mistakes', sql.Int, sa.mistakes || 0)
      .input('p2Name', sql.NVarChar, b.name)
      .input('p2Score', sql.Int, sb.score || 0)
      .input('p2Cells', sql.Int, sb.correctCells || 0)
      .input('p2Mistakes', sql.Int, sb.mistakes || 0)
      .input('winnerName', sql.NVarChar, winner ? winner.name : 'HÒA (DRAW)')
      .input('winReason', sql.NVarChar, `${statusTag} | ${eloTag}`)
      .query(`
        INSERT INTO Matches (RoomCode, Difficulty, P1Name, P1Score, P1Cells, P1Mistakes, P2Name, P2Score, P2Cells, P2Mistakes, WinnerName, WinReason)
        VALUES (@roomCode, @difficulty, @p1Name, @p1Score, @p1Cells, @p1Mistakes, @p2Name, @p2Score, @p2Cells, @p2Mistakes, @winnerName, @winReason)
      `);

    await tx.commit();
    return { saved: true, ranked: Boolean(deltas), winnerName: winner ? winner.name : 'DRAW', deltas, elo, bonus };
  } catch (err) {
    await tx.rollback().catch(() => {});
    throw err;
  }
}

// Tính độ lệch ELO cho phép khi ghép trận: bắt đầu từ 150, tăng thêm 50/s, max 500
const MAX_ELO_DIFF = 500;
const queueTolerance = (joinedAt) => Math.min(
  MAX_ELO_DIFF,
  150 + Math.floor((Date.now() - joinedAt) / 1000) * 50
);

//Mỗi giây quét hàng đợi ghép cặp người chơi hợp lệ theo ELO, tạo phòng với độ khó ngẫu nhiên, thông báo vào sảnh chờ
function tryMatchmakeQueue() {
  for (let i = 0; i < quickMatchQueue.length; i++) {
    for (let j = i + 1; j < quickMatchQueue.length; j++) {
      const p1 = quickMatchQueue[i];
      const p2 = quickMatchQueue[j];
      if (p1.username === p2.username) continue;
      if (Math.abs(p1.elo - p2.elo) > Math.max(queueTolerance(p1.joinedAt), queueTolerance(p2.joinedAt))) continue;

      quickMatchQueue.splice(j, 1);
      quickMatchQueue.splice(i, 1);

      const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
      const difficulty = ['EASY', 'MEDIUM', 'HARD'][Math.floor(Math.random() * 3)];
      [p1, p2].forEach(p => {
        const s = io.sockets.sockets.get(p.socketId);
        if (s) s.join(roomCode);
      });

      activeRooms.set(roomCode, {
        roomCode, difficulty, isQuickMatch: true,
        host: p1.username, hostElo: p1.elo, hostSocketId: p1.socketId,
        guest: p2.username, guestElo: p2.elo, guestSocketId: p2.socketId
      });

      io.to(roomCode).emit('player_joined_lobby', {
        roomCode, difficulty,
        hostName: p1.username, hostElo: p1.elo,
        guestName: p2.username, guestElo: p2.elo,
        isQuickMatch: true
      });
      return;
    }
  }
}
setInterval(tryMatchmakeQueue, 1000);

// Xử lý khi người chơi rời phòng
function handlePlayerLeaveRoom(socket, roomCode) {
  const room = activeRooms.get(roomCode);
  if (!room) return;
  // Chỉ người thật sự thuộc phòng mới được rời / đóng phòng
  if (room.hostSocketId !== socket.id && room.guestSocketId !== socket.id) return;
  if (room.match && !room.match.finished) onPlayerLeftMatch(room.match, socket.id); // rời giữa ván
  socket.leave(roomCode);

  if (room.guest && room.hostSocketId === socket.id) {
    Object.assign(room, {
      host: room.guest, hostElo: room.guestElo, hostSocketId: room.guestSocketId,
      guest: null, guestElo: null, guestSocketId: null
    });
    io.to(roomCode).emit('promoted_to_host', {
      roomCode, newHostName: room.host, newHostElo: room.hostElo, difficulty: room.difficulty
    });
    return;
  }

  if (room.guest && room.guestSocketId === socket.id) {
    const leftGuestName = room.guest;
    Object.assign(room, { guest: null, guestElo: null, guestSocketId: null });
    io.to(roomCode).emit('guest_left_lobby', {
      roomCode, leftGuestName, hostName: room.host, hostElo: room.hostElo, difficulty: room.difficulty
    });
    return;
  }

  if (room.match) clearTimeout(room.match.timer);
  activeRooms.delete(roomCode);
  io.to(roomCode).emit('room_closed_by_peer');
}

// Xử lý toàn bộ sự kiện Socket.IO thời gian thực
io.on('connection', (socket) => {
  onSafe(socket, 'quick_match_find', ({ username, elo }) => {
    quickMatchQueue = quickMatchQueue.filter(q => q.socketId !== socket.id && q.username !== username);
    quickMatchQueue.push({ socketId: socket.id, username, elo: Number(elo) || 1200, joinedAt: Date.now() });
    tryMatchmakeQueue();
  });

  onSafe(socket, 'quick_match_cancel', () => {
    quickMatchQueue = quickMatchQueue.filter(q => q.socketId !== socket.id);
  });

  onSafe(socket, 'create_room', ({ roomCode, username, elo, difficulty }) => {
    socket.join(roomCode);
    activeRooms.set(roomCode, {
      roomCode, difficulty: difficulty || 'EASY',
      host: username, hostElo: elo || 1200, hostSocketId: socket.id,
      guest: null, guestElo: null, guestSocketId: null
    });
  });

  onSafe(socket, 'join_room', ({ roomCode, username, elo, isQuickMatch }) => {
    const room = activeRooms.get(roomCode);
    if (!room) return socket.emit('room_error', { message: `Không tìm thấy phòng ${roomCode} hoặc phòng đã đóng!` });
    if (room.guest && room.guest !== username) return socket.emit('room_error', { message: `Phòng ${roomCode} đã đủ 2 người chơi!` });
    if (room.host === username) return socket.emit('room_error', { message: 'Bạn không thể tự vào phòng của chính mình!' });

    socket.join(roomCode);
    Object.assign(room, { guest: username, guestElo: elo || 1200, guestSocketId: socket.id });

    io.to(roomCode).emit('player_joined_lobby', {
      roomCode, difficulty: room.difficulty,
      hostName: room.host, hostElo: room.hostElo,
      guestName: room.guest, guestElo: room.guestElo,
      isQuickMatch: Boolean(isQuickMatch)
    });
  });

  onSafe(socket, 'change_room_difficulty', ({ roomCode, difficulty }) => {
    const room = activeRooms.get(roomCode);
    if (!room) return socket.emit('room_error', { message: `Server không tìm thấy phòng ${roomCode}!` });
    if (room.hostSocketId !== socket.id) return socket.emit('room_error', { message: 'Bạn không phải Chủ phòng (socket đã đổi, hãy tạo lại phòng)!' });

    room.difficulty = difficulty;
    socket.to(roomCode).emit('room_diff_updated', { roomCode, difficulty });
  });

  onSafe(socket, 'lobby_toggle_ready', ({ roomCode, isHost, ready, username }) => {
    socket.to(roomCode).emit('lobby_ready_updated', { isHost, ready, username });
  });

  onSafe(socket, 'lobby_chat', ({ roomCode, username, message }) => {
    socket.to(roomCode).emit('lobby_chat', { username, message });
  });

  onSafe(socket, 'lobby_start_match', ({ roomCode, difficulty, puzzleData, mode }) => {
    const room = activeRooms.get(roomCode);
    if (!room || room.hostSocketId !== socket.id) return; // chỉ Chủ phòng được bắt đầu trận
    if (!room.guest || !room.guestSocketId) return;        // cần đủ 2 người
    startMatchRecord(room);
    const players = [
      { username: room.host, elo: room.hostElo },
      { username: room.guest || 'Đối thủ', elo: room.guestElo || 1200 }
    ];
    io.to(roomCode).emit('match_started_from_lobby', { roomCode, difficulty, puzzleData, mode, players });
  });

  onSafe(socket, 'player_move', (payload) => {
    const { roomCode } = payload;
    if (!roomCode || !socket.rooms.has(roomCode)) return;
    // Ghi lại thống kê mới nhất của người chơi (dùng khi lưu lịch sử / xác định đã khóa 5/5 lỗi)
    const m = activeRooms.get(roomCode)?.match;
    if (m && !m.finished && m.players.some(p => p.socketId === socket.id)) {
      m.stats[socket.id] = {
        score: clampInt(payload.score, 100000),
        correctCells: clampInt(payload.correctCells, 81),
        mistakes: clampInt(payload.mistakes, 5)
      };
    }
    socket.to(roomCode).emit('opponent_update', payload);
  });

  onSafe(socket, 'player_surrender', ({ roomCode, username }) => {
    if (roomCode && socket.rooms.has(roomCode)) socket.to(roomCode).emit('opponent_surrendered', { username });
  });

  // Client BÁO kết quả cuối trận (chỉ báo "ai thắng", không gửi ELO)
  onSafe(socket, 'report_result', ({ roomCode, winnerName, endType, endActor, winnerSolved }) => {
    const m = activeRooms.get(roomCode)?.match;
    if (!m || m.finished) return;
    const me = m.players.find(p => p.socketId === socket.id);
    if (!me || m.reports[me.socketId]) return; // người lạ hoặc báo lần 2 -> bỏ qua

    const names = m.players.map(p => p.name);
    const winner = (winnerName === 'DRAW' || winnerName === 'HÒA (DRAW)') ? 'DRAW' : winnerName;
    if (winner !== 'DRAW' && !names.includes(winner)) return;

    const mine = m.reports[me.socketId] = {
      winner,
      endType: END_TYPES.includes(endType) ? endType : 'POINTS',
      endActor: names.includes(endActor) ? endActor : '',
      solved: Boolean(winnerSolved) && winner !== 'DRAW'
    };
    const other = otherOf(m, me);
    const theirs = m.reports[other.socketId];

    if (theirs) {
      if (mine.winner !== theirs.winner) { // hai bên báo khác nhau -> không tin ai
        m.finished = true;
        clearTimeout(m.timer);
        return notify(m, { saved: false, reason: 'MISMATCH' });
      }
      const host = m.reports[m.players[0].socketId];
      return finishMatch(m, { ...host, solved: mine.solved && theirs.solved }); // bonus chỉ khi CẢ HAI xác nhận
    }
    // Đối phương đã rời: có người bị khóa 5/5 -> chốt theo báo cáo; còn không -> xử thua người rời ngay
    if (m.left[other.socketId]) finishMatch(m, isLocked(m, other) || isLocked(m, me) ? mine : forfeitResult(other, me));
  });

  onSafe(socket, 'leave_room', ({ roomCode }) => handlePlayerLeaveRoom(socket, roomCode));

  socket.on('disconnect', () => {
    quickMatchQueue = quickMatchQueue.filter(q => q.socketId !== socket.id);
    for (const [roomCode, room] of [...activeRooms]) {
      if (room.hostSocketId === socket.id || room.guestSocketId === socket.id) {
        handlePlayerLeaveRoom(socket, roomCode);
      }
    }
  });
});

// 4. KHỞI CHẠY SERVER
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sudokuel Server đang chạy tại: http://localhost:${PORT}`));