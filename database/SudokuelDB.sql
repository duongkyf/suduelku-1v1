-- =========================================================================
-- HỆ THỐNG CƠ SỞ DỮ LIỆU MICROSOFT SQL SERVER: SUDOKUEL 1v1 ARENA
-- Giao thức kết hợp: RESTful API (HTTP) + WebSocket (Socket.IO trên TCP)
-- =========================================================================

IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'SudokuelDB')
BEGIN
    CREATE DATABASE SudokuelDB;
END
GO

USE SudokuelDB;
GO

-- 1. BẢNG USERS: Quản lý tài khoản, phân quyền USER/ADMIN, ELO & Tổng trận thắng
IF OBJECT_ID('dbo.Matches', 'U') IS NOT NULL DROP TABLE dbo.Matches;
IF OBJECT_ID('dbo.Puzzles', 'U') IS NOT NULL DROP TABLE dbo.Puzzles;
IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL DROP TABLE dbo.Users;
GO

CREATE TABLE dbo.Users (
    UserId INT IDENTITY(1,1) PRIMARY KEY,
    Username VARCHAR(50) NOT NULL UNIQUE,
    PasswordHash VARCHAR(255) NOT NULL,
    Role VARCHAR(10) NOT NULL DEFAULT 'USER' CHECK (Role IN ('USER', 'ADMIN')),
    EloRating INT NOT NULL DEFAULT 1200,
    TotalWins INT NOT NULL DEFAULT 0,
    TotalMatches INT NOT NULL DEFAULT 0,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

-- 2. BẢNG PUZZLES: Kho đề bài Sudoku 9x9 có lời giải độc nhất (Unique Solution)
-- Easy: Ẩn 30 ô (51 số cho sẵn) | Medium: Ẩn 40 ô (41 số) | Hard: Ẩn 50 ô (31 số)
CREATE TABLE dbo.Puzzles (
    PuzzleId INT IDENTITY(1,1) PRIMARY KEY,
    Difficulty VARCHAR(10) NOT NULL CHECK (Difficulty IN ('EASY', 'MEDIUM', 'HARD')),
    InitialGrid CHAR(81) NOT NULL,
    SolutionGrid CHAR(81) NOT NULL,
    BlanksCount INT NOT NULL,
    CreatedBy INT NULL FOREIGN KEY REFERENCES dbo.Users(UserId),
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT CK_Puzzles_GridLength CHECK (LEN(InitialGrid) = 81 AND LEN(SolutionGrid) = 81)
);
GO

-- 3. BẢNG MATCHES: Lưu lịch sử đấu phòng 1v1, điểm số, số ô đúng, lỗi & thời gian giải
CREATE TABLE dbo.Matches (
    MatchId INT IDENTITY(1,1) PRIMARY KEY,
    RoomCode CHAR(4) NOT NULL,
    PuzzleId INT NOT NULL FOREIGN KEY REFERENCES dbo.Puzzles(PuzzleId),
    Difficulty VARCHAR(10) NOT NULL,
    Mode VARCHAR(15) NOT NULL DEFAULT 'ONLINE_1V1', -- 'ONLINE_1V1' hoặc 'BOT_AI'
    
    Player1Id INT NOT NULL FOREIGN KEY REFERENCES dbo.Users(UserId),
    Player1Score INT NOT NULL DEFAULT 0,
    Player1CorrectCells INT NOT NULL DEFAULT 0,
    Player1Mistakes INT NOT NULL DEFAULT 0,
    Player1Solved BIT NOT NULL DEFAULT 0,
    Player1SolvedTimeMs INT NULL, -- Tính chính xác tới mili-giây (hiển thị 0.1s)

    Player2Id INT NULL FOREIGN KEY REFERENCES dbo.Users(UserId),
    Player2Name VARCHAR(50) NOT NULL DEFAULT 'Bot AI',
    Player2Score INT NOT NULL DEFAULT 0,
    Player2CorrectCells INT NOT NULL DEFAULT 0,
    Player2Mistakes INT NOT NULL DEFAULT 0,
    Player2Solved BIT NOT NULL DEFAULT 0,
    Player2SolvedTimeMs INT NULL,

    WinnerId INT NULL FOREIGN KEY REFERENCES dbo.Users(UserId),
    WinReason NVARCHAR(255) NOT NULL,
    StartedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    EndedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

-- DỮ LIỆU MẪU KHỞI TẠO (SEED DATA)
INSERT INTO dbo.Users (Username, PasswordHash, Role, EloRating, TotalWins, TotalMatches)
VALUES 
('admin_arena', '$2b$10$SudokuAdminHash999', 'ADMIN', 1650, 42, 50),
('minh_sudoku', '$2b$10$SudokuUserHash111', 'USER', 1420, 28, 35),
('lan_logic',   '$2b$10$SudokuUserHash222', 'USER', 1380, 21, 30),
('hoang_pro',   '$2b$10$SudokuUserHash333', 'USER', 1290, 15, 25);
GO

INSERT INTO dbo.Puzzles (Difficulty, InitialGrid, SolutionGrid, BlanksCount, CreatedBy)
VALUES
-- DỄ / EASY (Hiển thị 40 số cho sẵn, ẩn 41 ô trống)
('EASY',
 '070200001080073409002145078009000050530760084020409000406510000008930740703824006',
 '374298561185673429962145378649381257531762984827459613496517832218936745753824196',
 41, 1),
-- KHÓ / MEDIUM (Hiển thị 30 số cho sẵn, ẩn 51 ô trống)
('MEDIUM',
 '920810000001000000000265000508402000040000680090038204034000002080023079000000508',
 '926817345851394726473265891568472913342951687197638254734589162685123479219746538',
 51, 1),
-- BẬC THẦY / HARD (Hiển thị 25 số cho sẵn, ẩn 56 ô trống)
('HARD',
 '000530080000009050040807010057000000090018700200050100000062300760000009000004000',
 '672531984831649257549827613157496832396218745284753196415962378763185429928374561',
 56, 1);
GO
