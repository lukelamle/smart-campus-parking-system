CREATE DATABASE IF NOT EXISTS smart_parking_db;
USE smart_parking_db;

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS reservations;
DROP TABLE IF EXISTS parking_lots;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;

CREATE TABLE roles (
  role_id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(100) NOT NULL,
  role_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(role_id)
);

CREATE TABLE parking_lots (
  lot_id INT AUTO_INCREMENT PRIMARY KEY,
  lot_name VARCHAR(100) NOT NULL,
  location VARCHAR(100) NOT NULL,
  total_capacity INT NOT NULL,
  available_spaces INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE reservations (
  reservation_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  lot_id INT NOT NULL,
  duration VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (lot_id) REFERENCES parking_lots(lot_id)
);

CREATE TABLE audit_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(255) NOT NULL,
  log_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

INSERT INTO roles (role_name) VALUES
('admin'),
('student');

INSERT INTO users (full_name, email, password, role_id) VALUES
('Admin User', 'admin@campus.edu', 'admin123', 1),
('Student User', 'student@campus.edu', 'student123', 2);

INSERT INTO parking_lots (lot_name, location, total_capacity, available_spaces, is_active) VALUES
('Lot A', 'North Campus', 120, 32, TRUE),
('Lot B', 'Library', 80, 10, TRUE),
('Faculty Lot', 'Admin Building', 45, 0, TRUE);
