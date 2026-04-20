-- ============================================================
-- LibraryOS - PostgreSQL Schema (Converted)
-- ============================================================

-- -----------------------------------------------
-- Admins
-- -----------------------------------------------
CREATE TABLE admins (
    admin_id    SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(100) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    role        VARCHAR(20) DEFAULT 'admin',
    last_login  TIMESTAMP,
    createdAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------
-- Members
-- -----------------------------------------------
CREATE TABLE members (
    member_id   SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(100) UNIQUE NOT NULL,
    phone       VARCHAR(20),
    address     TEXT,
    member_type VARCHAR(20) DEFAULT 'general',
    join_date   DATE DEFAULT CURRENT_DATE,
    is_active   BOOLEAN DEFAULT TRUE,
    createdAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------
-- Books
-- -----------------------------------------------
CREATE TABLE books (
    book_id         SERIAL PRIMARY KEY,
    title           VARCHAR(200) NOT NULL,
    author          VARCHAR(100) NOT NULL,
    isbn            VARCHAR(20) UNIQUE,
    category        VARCHAR(100),
    publisher       VARCHAR(150),
    publish_year    INT,
    total_copies    INT DEFAULT 1,
    available_copies INT DEFAULT 1,
    shelf_location  VARCHAR(50),
    description     TEXT,
    createdAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------
-- Issue Log
-- -----------------------------------------------
CREATE TABLE issue_log (
    issue_id    SERIAL PRIMARY KEY,
    member_id   INT NOT NULL,
    book_id     INT NOT NULL,
    issued_by   INT,
    issue_date  DATE DEFAULT CURRENT_DATE,
    due_date    DATE NOT NULL,
    return_date DATE,
    fine_amount DECIMAL(10,2) DEFAULT 0.00,
    fine_paid   BOOLEAN DEFAULT FALSE,
    status      VARCHAR(20) DEFAULT 'issued',
    notes       TEXT,
    createdAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (member_id) REFERENCES members(member_id),
    FOREIGN KEY (book_id)   REFERENCES books(book_id),
    FOREIGN KEY (issued_by) REFERENCES admins(admin_id)
);

-- -----------------------------------------------
-- Trigger Function (PostgreSQL version)
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION update_stock_after_return()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.return_date IS NOT NULL AND OLD.return_date IS NULL THEN
        UPDATE books
        SET available_copies = available_copies + 1
        WHERE book_id = NEW.book_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stock_after_return
AFTER UPDATE ON issue_log
FOR EACH ROW
EXECUTE FUNCTION update_stock_after_return();

-- -----------------------------------------------
-- View
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
    (CURRENT_DATE - il.due_date) AS days_overdue,
    CASE 
        WHEN (CURRENT_DATE - il.due_date) > 0
        THEN (CURRENT_DATE - il.due_date) * 5
        ELSE 0
    END AS fine_accrued
FROM issue_log il
JOIN members m ON il.member_id = m.member_id
JOIN books   b ON il.book_id   = b.book_id
WHERE il.return_date IS NULL;