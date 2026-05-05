USE smart_parking_db;

-- =====================================================
-- 0. CHECK DATABASE AND TABLES
-- =====================================================

SELECT DATABASE() AS current_database;

SHOW TABLES;

DESCRIBE users;
DESCRIBE parking_lots;
DESCRIBE reservations;
DESCRIBE audit_logs;

-- =====================================================
-- 1. CLEAR OLD TEST DATA (OPTIONAL)
-- Run this only if you want a clean reset without dropping tables.
-- =====================================================

DELETE FROM audit_logs;
DELETE FROM reservations;
DELETE FROM parking_lots;
DELETE FROM users;

ALTER TABLE users AUTO_INCREMENT = 1;
ALTER TABLE parking_lots AUTO_INCREMENT = 1;
ALTER TABLE reservations AUTO_INCREMENT = 1;
ALTER TABLE audit_logs AUTO_INCREMENT = 1;

-- =====================================================
-- 2. INSERT SAMPLE USERS
-- =====================================================

INSERT INTO users (full_name, email, password, role) VALUES
('Admin User', 'admin@campus.edu', 'admin123', 'admin'),
('Student User', 'student@campus.edu', 'student123', 'student'),
('Lam Le', 'lam@example.com', 'pass123', 'student');

SELECT * FROM users;

-- =====================================================
-- 3. INSERT SAMPLE PARKING LOTS
-- =====================================================

INSERT INTO parking_lots (lot_name, location, total_spaces, available_spaces, status) VALUES
('Lot A', 'North Campus', 120, 32, 'OPEN'),
('Lot B', 'Library', 80, 10, 'OPEN'),
('Faculty Lot', 'Admin Building', 45, 0, 'OPEN');

SELECT * FROM parking_lots;

-- =====================================================
-- 4. INSERT SAMPLE AUDIT LOGS
-- =====================================================

INSERT INTO audit_logs (user_id, action) VALUES
(1, 'Initial admin seeded'),
(2, 'Initial student seeded'),
(3, 'Initial student seeded');

SELECT * FROM audit_logs;

-- =====================================================
-- 5. TEST LOGIN-LIKE LOOKUP
-- Simulates backend login query
-- =====================================================

SELECT user_id, full_name, email, role
FROM users
WHERE email = 'admin@campus.edu' AND password = 'admin123';

SELECT user_id, full_name, email, role
FROM users
WHERE email = 'student@campus.edu' AND password = 'wrongpass';

-- =====================================================
-- 6. CREATE TEST RESERVATION #1
-- Student User reserves Lot A for 30 minutes
-- =====================================================

INSERT INTO reservations (user_id, lot_id, start_time, end_time, status)
VALUES (
    2,
    1,
    NOW(),
    DATE_ADD(NOW(), INTERVAL 30 MINUTE),
    'ACTIVE'
);

UPDATE parking_lots
SET available_spaces = available_spaces - 1
WHERE lot_id = 1 AND available_spaces > 0 AND status = 'OPEN';

INSERT INTO audit_logs (user_id, action)
VALUES (2, 'Reservation created for student@campus.edu in Lot A');

SELECT * FROM reservations;
SELECT * FROM parking_lots WHERE lot_id = 1;
SELECT * FROM audit_logs ORDER BY log_id DESC;

-- =====================================================
-- 7. CREATE TEST RESERVATION #2
-- Lam Le reserves Lot B for 60 minutes
-- =====================================================

INSERT INTO reservations (user_id, lot_id, start_time, end_time, status)
VALUES (
    3,
    2,
    NOW(),
    DATE_ADD(NOW(), INTERVAL 60 MINUTE),
    'ACTIVE'
);

UPDATE parking_lots
SET available_spaces = available_spaces - 1
WHERE lot_id = 2 AND available_spaces > 0 AND status = 'OPEN';

INSERT INTO audit_logs (user_id, action)
VALUES (3, 'Reservation created for lam@example.com in Lot B');

SELECT * FROM reservations;
SELECT * FROM parking_lots WHERE lot_id IN (1, 2);

-- =====================================================
-- 8. VIEW FULL RESERVATION REPORT WITH JOINS
-- =====================================================

SELECT
    r.reservation_id,
    r.user_id,
    u.full_name AS user_name,
    u.email,
    r.lot_id,
    p.lot_name,
    p.location,
    r.start_time,
    r.end_time,
    TIMESTAMPDIFF(MINUTE, r.start_time, r.end_time) AS duration_minutes,
    r.status,
    r.created_at
FROM reservations r
JOIN users u ON r.user_id = u.user_id
JOIN parking_lots p ON r.lot_id = p.lot_id
ORDER BY r.reservation_id ASC;

-- =====================================================
-- 9. REPORT SUMMARY QUERIES
-- Matches backend /api/reports/summary logic
-- =====================================================

SELECT COUNT(*) AS total_lots
FROM parking_lots;

SELECT COUNT(*) AS active_lots
FROM parking_lots
WHERE status = 'OPEN';

SELECT COUNT(*) AS total_users
FROM users;

SELECT COUNT(*) AS total_reservations
FROM reservations;

SELECT COUNT(*) AS active_reservations
FROM reservations
WHERE status = 'ACTIVE';

SELECT COUNT(*) AS cancelled_reservations
FROM reservations
WHERE status = 'CANCELLED';

-- One-query version
SELECT
    (SELECT COUNT(*) FROM parking_lots) AS total_lots,
    (SELECT COUNT(*) FROM parking_lots WHERE status = 'OPEN') AS active_lots,
    (SELECT COUNT(*) FROM users) AS total_users,
    (SELECT COUNT(*) FROM reservations) AS total_reservations,
    (SELECT COUNT(*) FROM reservations WHERE status = 'ACTIVE') AS active_reservations,
    (SELECT COUNT(*) FROM reservations WHERE status = 'CANCELLED') AS cancelled_reservations;

-- =====================================================
-- 10. CANCEL RESERVATION #1
-- Simulates backend cancel endpoint
-- =====================================================

UPDATE reservations
SET status = 'CANCELLED'
WHERE reservation_id = 1 AND status = 'ACTIVE';

UPDATE parking_lots
SET available_spaces = available_spaces + 1
WHERE lot_id = 1;

INSERT INTO audit_logs (user_id, action)
VALUES (2, 'Reservation cancelled: 1');

SELECT * FROM reservations WHERE reservation_id = 1;
SELECT * FROM parking_lots WHERE lot_id = 1;
SELECT * FROM audit_logs ORDER BY log_id DESC;

-- =====================================================
-- 11. CHECK ACTIVE VS CANCELLED RESERVATIONS
-- =====================================================

SELECT reservation_id, status
FROM reservations
ORDER BY reservation_id;

SELECT *
FROM reservations
WHERE status = 'ACTIVE';

SELECT *
FROM reservations
WHERE status = 'CANCELLED';

-- =====================================================
-- 12. TEST ADMIN ADDING A NEW LOT
-- =====================================================

INSERT INTO parking_lots (lot_name, location, total_spaces, available_spaces, status)
VALUES ('Science Lot', 'Science Building', 90, 90, 'OPEN');

INSERT INTO audit_logs (user_id, action)
VALUES (1, 'Admin added lot: Science Lot');

SELECT * FROM parking_lots ORDER BY lot_id;
SELECT * FROM audit_logs ORDER BY log_id DESC;

-- =====================================================
-- 13. TEST ADMIN UPDATING LOT CAPACITY
-- Example: update Lot B from 80 to 100
-- =====================================================

UPDATE parking_lots
SET total_spaces = 100,
    available_spaces = available_spaces + (100 - total_spaces)
WHERE lot_id = 2;

INSERT INTO audit_logs (user_id, action)
VALUES (1, 'Admin updated capacity for Lot B');

SELECT * FROM parking_lots WHERE lot_id = 2;

-- =====================================================
-- 14. TEST ADMIN DISABLING A LOT
-- =====================================================

UPDATE parking_lots
SET status = 'CLOSED'
WHERE lot_id = 3;

INSERT INTO audit_logs (user_id, action)
VALUES (1, 'Admin disabled lot: Faculty Lot');

SELECT * FROM parking_lots WHERE lot_id = 3;

-- =====================================================
-- 15. SHOW ONLY OPEN LOTS WITH AVAILABLE SPACES
-- Useful frontend test
-- =====================================================

SELECT
    lot_id,
    lot_name,
    location,
    total_spaces,
    available_spaces,
    status
FROM parking_lots
WHERE status = 'OPEN' AND available_spaces > 0
ORDER BY lot_id;

-- =====================================================
-- 16. SHOW AUDIT LOGS WITH USER NAMES
-- =====================================================

SELECT
    a.log_id,
    a.user_id,
    u.full_name,
    a.action,
    a.created_at
FROM audit_logs a
LEFT JOIN users u ON a.user_id = u.user_id
ORDER BY a.log_id DESC;

-- =====================================================
-- 17. DELETE A TEST RESERVATION (OPTIONAL)
-- =====================================================

DELETE FROM reservations
WHERE reservation_id = 2;

INSERT INTO audit_logs (user_id, action)
VALUES (3, 'Deleted reservation 2 for cleanup');

SELECT * FROM reservations;
SELECT * FROM audit_logs ORDER BY log_id DESC;

-- =====================================================
-- 18. FINAL STATE CHECK
-- =====================================================

SELECT * FROM users ORDER BY user_id;
SELECT * FROM parking_lots ORDER BY lot_id;
SELECT * FROM reservations ORDER BY reservation_id;
SELECT * FROM audit_logs ORDER BY log_id DESC;
