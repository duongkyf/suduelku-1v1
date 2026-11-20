# HƯỚNG DẪN CHẠY DỰ ÁN SUDUELKU 1v1 ARENA & CÁC CHỖ CẦN SỬA

## 1. Cấu trúc thư mục chuẩn trong gói ZIP này
```text
suduelku-1v1-arena/
├── backend/                        <-- SERVER NODE.JS (Chạy cổng 3000)
│   ├── config/
│   │   └── db.js                   <-- Kết nối Microsoft SQL Server
│   ├── services/
│   │   └── scoringService.js       <-- Thuật toán tính điểm & ELO
│   ├── .env                        <-- [CHỖ CẦN SỬA 1] Cấu hình mật khẩu SQL Server
│   ├── package.json
│   └── server.js                   <-- Khởi chạy Express REST API + Socket.IO
│
├── database/                       <-- CƠ SỞ DỮ LIỆU SQL SERVER
│   └── SudokuelDB.sql              <-- Chạy file này trong SSMS để tạo bảng
│
└── frontend/                       <-- GIAO DIỆN CLIENT (Đã tách HTML, CSS, JS)
    ├── css/
    │   └── style.css               <-- Giao diện Minimalist Classic / Vintage
    ├── js/
    │   └── main.js                 <-- [CHỖ CẦN SỬA 2 - TÙY CHỌN] Đổi IP nếu đấu LAN 2 máy
    └── index.html                  <-- Trang chủ & Bàn đấu 9x9
```

## 2. Danh sách những chỗ bạn cần kiểm tra & sửa trên máy của bạn
1. **Tệp `backend/.env`** (Quan trọng nhất):
   - Sửa `DB_PASS=123456` thành mật khẩu tài khoản `sa` trong SQL Server của bạn.
   - Sửa `DB_SERVER=localhost` (nếu máy bạn dùng SQL Server Express thì đổi thành `DB_SERVER=localhost\SQLEXPRESS`).
2. **Tệp `frontend/js/main.js` (Dòng 6 - Chỉ sửa nếu chơi LAN giữa 2 laptop khác nhau)**:
   - Mặc định đang để `const BACKEND_URL = 'http://localhost:3000';`.
   - Nếu bạn chạy và test 2 tab trình duyệt trên cùng 1 máy thì **giữ nguyên không cần sửa**.

## 3. Các lệnh chạy dự án
Mở Terminal tại thư mục `suduelku-1v1-arena`:
```powershell
cd backend
npm install
node server.js
```
Sau đó mở trình duyệt tại `http://localhost:3000` (hoặc chuột phải vào `frontend/index.html` chọn **Open with Live Server**).
