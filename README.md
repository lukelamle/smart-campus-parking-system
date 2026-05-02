# smart-campus-parking-system

## Course Information
- Course: CMPE 131 - Software Engineering
- Instructor: Professor Ishie Eswar
- Team Name: Team 12
- Project Title: Smart Campus Parking System

## Team Members
- Thuan Nguyen
- Luke Le
- Hrant Minasyan
- Omeid Sahibzada

## Project Overview
The Smart Campus Parking System is designed to help students and faculty locate available parking spaces on campus, reserve parking spaces, and support administrative parking management.

## Problem Statement
Students and faculty experience difficulty locating available parking spaces on campus. This causes delays, congestion, and inefficiencies. A centralized parking system with real-time availability, reservation functionality, and administrative oversight can improve campus parking operations.

## Product Vision
The Smart Campus Parking System provides real-time parking availability, reservation functionality, and administrative oversight. The system improves campus mobility by reducing search time and improving space utilization.

## System Architecture
The project uses a layered service-oriented architecture:
- Presentation Layer: Web/mobile-friendly user interface
- Application Layer: API for validation, routing, and error handling
- Business Layer: Parking and reservation services
- Security Layer: Authentication, authorization, and audit logging
- Data Layer: Relational database

## Main Features
- User registration
- Secure login
- Password reset
- View parking lots
- Real-time space availability
- Filter parking lots by distance
- Reserve parking spaces
- Cancel reservations
- Reservation confirmations
- Admin dashboard
- Add parking lots
- Update lot capacity
- Disable parking lot
- Reports and usage trends
- Role-based access control
- Activity logs
- Mobile-friendly interface
- Map-based parking visualization

## Technology Stack
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js + Express
- Database: MySQL

## Folder Structure
```text
smart-campus-parking-system/
├── frontend/
├── backend/
├── database/
├── docs/
└── README.md
```

## How to Download
```bash
git clone https://github.com/YOUR-USERNAME/smart-campus-parking-system.git
cd smart-campus-parking-system
```

## How to Install
### Backend
```bash
cd backend
npm init -y
npm install express mysql2 cors bcrypt jsonwebtoken dotenv
```

## How to Set Up the Database
Open MySQL and run:
```sql
CREATE DATABASE smart_parking;
USE smart_parking;
```

Then import:
```bash
mysql -u root -p smart_parking < ../database/schema.sql
```

## How to Run the Backend
```bash
cd backend
node server.js
```

## How to Run the Frontend
Open:
```text
frontend/index.html
```
in a web browser, or run it using VS Code Live Server.

## Notes
This repository is the implementation codebase for the Smart Campus Parking System project submission.
