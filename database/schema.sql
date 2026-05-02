CREATE DATABASE smart_parking;
USE smart_parking;

CREATE TABLE roles (
  role_id INT PRIMARY KEY AUTO_INCREMENT,
  role_name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE users (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(role_id)
);

CREATE TABLE parking_lots (
  lot_id INT PRIMARY KEY AUTO_INCREMENT,
  lot_name VARCHAR(100) NOT NULL,
  location VARCHAR(150) NOT NULL,
  total_capacity INT NOT NULL,
  available_spaces INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE reservations (
  reservation_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  lot_id INT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (lot_id) REFERENCES parking_lots(lot_id)
);

CREATE TABLE audit_logs (
  log_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  action VARCHAR(255) NOT NULL,
  log_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

INSERT INTO roles (role_name)
VALUES
('Student Driver'),
('Campus Staff'),
('Parking Administrator'),
('System Administrator');

INSERT INTO parking_lots (lot_name, location, total_capacity, available_spaces, is_active)
VALUES
('Lot A', 'North Campus', 120, 32, TRUE),
('Lot B', 'Library', 80, 10, TRUE),
('Faculty Lot', 'Admin Building', 45, 0, TRUE);
