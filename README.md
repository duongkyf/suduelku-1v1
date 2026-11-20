# SUDUELKU 1v1 ARENA

Ứng dụng web thi đấu Sudoku 1v1 thời gian thực với Node.js, Express, Socket.IO và Microsoft SQL Server (hỗ trợ ghép trận nhanh theo ELO, tạo phòng chờ, đấu với Bot AI và lưu lịch sử trận đấu).

## 1. Cấu trúc thư mục
```text
suduelku-1v1-arena/
├── backend/                        # Server Node.js (mặc định cổng 3000)
│   ├── config/
│   │   └── db.js                   # Kết nối Microsoft SQL Server
│   ├── services/
│   │   └── scoringService.js       # Thuật toán tính điểm & ELO
│   ├── .env                        # [Tự tạo] Cấu hình kết nối SQL Server (không đẩy lên Git)
│   ├── package.json
│   └── server.js                   # Khởi chạy Express REST API + Socket.IO
│
├── database/                       # Cơ sở dữ liệu SQL Server
│   └── SudokuelDB.sql              # Script tạo DB & bảng trong SSMS
│
├── frontend/                       # Giao diện Client (HTML, CSS, JS thuần)
│   ├── css/
│   │   └── style.css               # Giao diện Minimalist Classic / Vintage
│   ├── js/
│   │   ├── auth.js                 # Đăng nhập, đăng ký & trạng thái tài khoản
│   │   ├── config.js               # [Tùy chọn] Cấu hình BACKEND_URL khi đấu LAN
│   │   ├── data.js                 # Sinh đề & dữ liệu Sudoku
│   │   ├── events.js               # Xử lý sự kiện UI & Socket.IO
│   │   ├── game.js                 # Logic ván đấu & Bot AI
│   │   ├── render.js               # Cập nhật giao diện bàn đấu & phòng chờ
│   │   ├── utils.js                # Hàm tiện ích & âm thanh
│   │   └── verdict.js              # Xử lý kết quả cuối trận
│   └── index.html                  # Trang chủ, phòng chờ & bàn đấu 9x9
│
├── .gitignore
└── README.md