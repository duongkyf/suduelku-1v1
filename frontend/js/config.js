// config.js — CẤU HÌNH KẾT NỐI & TRẠNG THÁI TOÀN CỤC (nạp đầu tiên)

// 1. KẾT NỐI BACKEND
const BACKEND_ORIGIN = location.protocol.startsWith('http') ? location.origin : 'http://localhost:3000';
const API_BASE_URL = `${BACKEND_ORIGIN}/api`;

// 2. SOCKET.IO (thư viện đã được nạp trong index.html trước file này)
let socket = null;
try {
  socket = io(BACKEND_ORIGIN, { transports: ['websocket', 'polling'] });
} catch (e) {
  console.warn('Không kết nối được Socket.IO:', e);
}

// 3. TRẠNG THÁI TÀI KHOẢN & DỮ LIỆU TỪ SQL SERVER
const dbState = {
  isLoggedIn: false,
  currentUser: { userId: 0, username: 'Khách (Guest)', role: 'GUEST', elo: 1200 },
  authMode: 'LOGIN',        // 'LOGIN' | 'REGISTER' (dùng trong auth.js)
  pendingHomeMode: null,    // 'BOT_AI' (dùng trong events.js)
  users: [],                // bảng xếp hạng (fetchSyncDatabaseLists ghi vào)
  matches: []               // lịch sử đấu
};

// 4. NGƯỜI CHƠI: khuôn mặc định, dùng cho trạng thái ban đầu và cho makePlayer() trong game.js
const newPlayer = (username) => ({
  username,
  givenMask: [], currentGrid: [], cellState: [], wrongMask: [], notes: [],
  score: 0, correctCells: 0, mistakes: 0, maxMistakes: 5,
  surrendered: false, locked: false, finished: false, solved: false, solvedTimeMs: null,
  completedRows: Array(9).fill(false),
  completedCols: Array(9).fill(false),
  completedBoxes: Array(9).fill(false)
});

// 5. TRẠNG THÁI TRẬN ĐẤU 1v1 THỜI GIAN THỰC & PHÒNG CHỜ (MATCH ENGINE)
let matchState = {
  roomCode: '',
  mode: 'BOT_AI', // 'BOT_AI' | 'ROOM_1V1' | 'QUICK_1V1'
  difficulty: 'EASY',
  isRoomHost: true,
  lobbyOpponentName: 'Đang chờ người chơi...',
  lobbyReady: true,
  totalBlanks: 41,
  initialGrid: '',
  solutionGrid: '',
  startedAtMs: 0,
  elapsedMs: 0,
  maxDurationMs: 15 * 60 * 1000, // Giới hạn 15 phút / trận
  postMatchLoser: null,
  status: 'PLAYING',
  notesMode: false,
  selectedCell: 0,
  moveHistory: [],
  timerInterval: null,
  botInterval: null,

  p1: newPlayer('Khách (Guest)'),
  p2: { ...newPlayer('Bot AI (Dễ)'), lastWrongCell: -1, lastCorrectCell: -1, lastPopupPoints: 0 }
};