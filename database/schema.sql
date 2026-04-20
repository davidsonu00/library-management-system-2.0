-- ============================================================
-- LibraryOS - Enhanced MySQL Schema
-- Based on original Library-Management-System-MySQL project
-- Enhanced with: auth, fine tracking, status, extra fields
-- ============================================================

CREATE DATABASE IF NOT EXISTS library_db;
USE library_db;

-- -----------------------------------------------
-- Admins / Librarians (NEW - missing in original)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
    admin_id    INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(100) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    role        ENUM('admin','librarian') DEFAULT 'admin',
    last_login  DATETIME,
    createdAt   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- -----------------------------------------------
-- Members (enhanced from original)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS members (
    member_id   INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(100) UNIQUE NOT NULL,
    phone       VARCHAR(20),
    address     TEXT,
    member_type ENUM('student','faculty','general') DEFAULT 'general',
    join_date   DATE DEFAULT (CURDATE()),
    is_active   BOOLEAN DEFAULT TRUE,
    createdAt   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- -----------------------------------------------
-- Books (enhanced from original)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS books (
    book_id         INT AUTO_INCREMENT PRIMARY KEY,
    title           VARCHAR(200) NOT NULL,
    author          VARCHAR(100) NOT NULL,
    isbn            VARCHAR(20) UNIQUE,
    category        VARCHAR(100),
    publisher       VARCHAR(150),
    publish_year    INT,
    total_copies    INT NOT NULL DEFAULT 1,
    available_copies INT NOT NULL DEFAULT 1,
    shelf_location  VARCHAR(50),
    description     TEXT,
    createdAt       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- -----------------------------------------------
-- Issue Log (enhanced from original)
-- Original had: issue_id, member_id, book_id, issue_date, return_date
-- Added: issued_by, due_date, fine_amount, fine_paid, status, notes
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS issue_log (
    issue_id    INT AUTO_INCREMENT PRIMARY KEY,
    member_id   INT NOT NULL,
    book_id     INT NOT NULL,
    issued_by   INT,
    issue_date  DATE DEFAULT (CURDATE()),
    due_date    DATE NOT NULL,
    return_date DATE,
    fine_amount DECIMAL(10,2) DEFAULT 0.00,
    fine_paid   BOOLEAN DEFAULT FALSE,
    status      ENUM('issued','returned','overdue') DEFAULT 'issued',
    notes       TEXT,
    createdAt   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(member_id),
    FOREIGN KEY (book_id)   REFERENCES books(book_id),
    FOREIGN KEY (issued_by) REFERENCES admins(admin_id)
);

-- -----------------------------------------------
-- Trigger: update available_copies on return
-- (preserved from original, enhanced)
-- -----------------------------------------------
DROP TRIGGER IF EXISTS update_stock_after_return;
DELIMITER //
CREATE TRIGGER update_stock_after_return
AFTER UPDATE ON issue_log
FOR EACH ROW
BEGIN
    IF NEW.return_date IS NOT NULL AND OLD.return_date IS NULL THEN
        UPDATE books
        SET available_copies = available_copies + 1
        WHERE book_id = NEW.book_id;
    END IF;
END //
DELIMITER ;

-- -----------------------------------------------
-- View: currently issued books (from original)
-- -----------------------------------------------
CREATE OR REPLACE VIEW issued_books AS
SELECT
    il.issue_id,
    m.name   AS member_name,
    m.email  AS member_email,
    b.title  AS book_title,
    b.author,
    il.issue_date,
    il.due_date,
    DATEDIFF(CURDATE(), il.due_date) AS days_overdue,
    IF(DATEDIFF(CURDATE(), il.due_date) > 0,
       DATEDIFF(CURDATE(), il.due_date) * 5, 0) AS fine_accrued
FROM issue_log il
JOIN members m ON il.member_id = m.member_id
JOIN books   b ON il.book_id   = b.book_id
WHERE il.return_date IS NULL;

-- -----------------------------------------------
-- Sample data
-- -----------------------------------------------
INSERT IGNORE INTO members (name, email, phone, member_type) VALUES
('Amit Verma',   'amit@gmail.com',  '9876543210', 'student'),
('Priya Sharma', 'priya@gmail.com', '9123456789', 'faculty'),
('Rahul Singh',  'rahul@gmail.com', '9012345678', 'general');

INSERT IGNORE INTO books (title, author, isbn, category, total_copies, available_copies, publisher, publish_year) VALUES
('Let Us C',          'Yashwant Kanetkar', '978-8183331630', 'Programming', 5, 5, 'BPB Publications', 2016),
('Wings of Fire',     'A.P.J Abdul Kalam', '978-8173711466', 'Biography',   3, 3, 'Universities Press', 1999),
('The Alchemist',     'Paulo Coelho',      '978-0062315007', 'Fiction',     4, 4, 'HarperOne',         1988),
('Data Structures',   'Seymour Lipschutz', '978-0070701588', 'Programming', 2, 2, 'McGraw-Hill',       2011),
('Mein Kampf (Study)','Various Editors',   '978-1788288408', 'History',     1, 1, 'Academic',          2020);
