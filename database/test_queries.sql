USE smart_parking_db;

SELECT DATABASE();

SHOW TABLES;

SELECT COUNT(*) AS users_count FROM users;
SELECT COUNT(*) AS lots_count FROM parking_lots;
SELECT COUNT(*) AS reservations_count FROM reservations;

SELECT * FROM users;
SELECT * FROM parking_lots;
SELECT * FROM reservations;

SELECT 
    r.reservation_id,
    u.full_name,
    p.lot_name,
    r.start_time,
    r.end_time,
    r.status
FROM reservations r
JOIN users u ON r.user_id = u.user_id
JOIN parking_lots p ON r.lot_id = p.lot_id
ORDER BY r.reservation_id;
