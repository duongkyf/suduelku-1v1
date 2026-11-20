const sql = require('mssql');
require('dotenv').config();

// CẤU HÌNH KẾT NỐI SQL SERVER (Đọc từ tệp backend/.env)
const dbConfig = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASS || '123456',
    server: process.env.DB_SERVER || 'localhost',
    port: parseInt(process.env.DB_PORT || '1433', 10),
    database: process.env.DB_NAME || 'SudokuelDB',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

const poolPromise = new sql.ConnectionPool(dbConfig)
    .connect()
    .then(pool => {
        console.log('Đã kết nối Microsoft SQL Server (SudokuelDB) thành công!');
        return pool;
    })
    .catch(err => {
        console.warn('Chưa kết nối được SQL Server (Đang chạy chế độ In-Memory dự phòng):', err.message);
        return null;
    });

module.exports = { sql, poolPromise };
