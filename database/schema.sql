CREATE DATABASE IF NOT EXISTS smart_parking_db;
USE smart_parking_db;

CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'student',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parking_lots (
    lot_id INT AUTO_INCREMENT PRIMARY KEY,
    lot_name VARCHAR(100) NOT NULL,
    location VARCHAR(255) NOT NULL,
    total_spaces INT NOT NULL,
    available_spaces INT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN'
);

CREATE TABLE IF NOT EXISTS reservations (
    reservation_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    lot_id INT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reservation_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_reservation_lot
        FOREIGN KEY (lot_id) REFERENCES parking_lots(lot_id)
        ON DELETE CASCADE
);
