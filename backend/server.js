const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 3001;

// adjust host/user/password to whatever works in Workbench on port 3308
const pool = mysql.createPool({
  host: 'localhost',
  port: 3308,
  user: 'parking_user',      // or 'root'
  password: 'sqlgroup12',    // or your root password
  database: 'smart_parking_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Smart Campus Parking API running' });
});

app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ success: true, db: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* USERS */
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT user_id, full_name, email, role, created_at
      FROM users
      ORDER BY user_id ASC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users/register', async (req, res) => {
  try {
    const { full_name, email, password, role } = req.body;

    const [result] = await pool.execute(
      `
      INSERT INTO users (full_name, email, password, role)
      VALUES (?, ?, ?, ?)
      `,
      [full_name, email, password, role || 'student']
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user_id: result.insertId
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await pool.execute(
      `
      SELECT user_id, full_name, email, role
      FROM users
      WHERE email = ? AND password = ?
      `,
      [email, password]
    );

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    res.json({
      success: true,
      message: 'Login successful',
      user: rows[0]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* PARKING LOTS */
app.get('/api/lots', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT lot_id, lot_name, location, total_spaces, available_spaces, status
      FROM parking_lots
      ORDER BY lot_name ASC
    `);

    // shape matches your frontend table: Lot, Location, Total Capacity, Available, Status
    const mapped = rows.map(lot => ({
      id: lot.lot_id,
      lot_name: lot.lot_name,
      location: lot.location,
      total_capacity: lot.total_spaces,
      available_spaces: lot.available_spaces,
      status: lot.status
    }));

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* RESERVATIONS LIST */
app.get('/api/reservations', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        r.reservation_id,
        u.full_name AS user_name,
        p.lot_name,
        r.start_time,
        r.end_time,
        r.status
      FROM reservations r
      JOIN users u ON r.user_id = u.user_id
      JOIN parking_lots p ON r.lot_id = p.lot_id
      ORDER BY r.reservation_id DESC
    `);

    const mapped = rows.map(r => ({
      id: r.reservation_id,
      user_name: r.user_name,
      lot_name: r.lot_name,
      start_time: r.start_time,
      end_time: r.end_time,
      status: r.status
    }));

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* CREATE RESERVATION */
app.post('/api/reservations', async (req, res) => {
  let conn;
  try {
    const { user_id, lot_id, duration_minutes } = req.body;

    const start = new Date();
    const end = new Date(start.getTime() + duration_minutes * 60 * 1000);

    const start_time = start.toISOString().slice(0, 19).replace('T', ' ');
    const end_time = end.toISOString().slice(0, 19).replace('T', ' ');

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [lotRows] = await conn.execute(
      'SELECT available_spaces FROM parking_lots WHERE lot_id = ? AND status = "OPEN" FOR UPDATE',
      [lot_id]
    );

    if (!lotRows.length) {
      await conn.rollback();
      return res.status(400).json({ message: 'Lot not found or not open' });
    }

    if (lotRows[0].available_spaces <= 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'No available spaces' });
    }

    const [reservationResult] = await conn.execute(
      `
      INSERT INTO reservations (user_id, lot_id, start_time, end_time, status)
      VALUES (?, ?, ?, ?, 'ACTIVE')
      `,
      [user_id, lot_id, start_time, end_time]
    );

    await conn.execute(
      `
      UPDATE parking_lots
      SET available_spaces = available_spaces - 1
      WHERE lot_id = ?
      `,
      [lot_id]
    );

    await conn.commit();

    res.status(201).json({
      success: true,
      message: 'Reservation created successfully',
      reservation_id: reservationResult.insertId
    });
  } catch (error) {
    if (conn) await conn.rollback();
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

/* CANCEL RESERVATION */
app.put('/api/reservations/:id/cancel', async (req, res) => {
  let conn;
  try {
    const { id } = req.params;

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [reservationRows] = await conn.execute(
      `
      SELECT lot_id, status
      FROM reservations
      WHERE reservation_id = ?
      FOR UPDATE
      `,
      [id]
    );

    if (!reservationRows.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Reservation not found' });
    }

    if (reservationRows[0].status === 'CANCELLED') {
      await conn.rollback();
      return res.status(400).json({ message: 'Reservation already cancelled' });
    }

    await conn.execute(
      `
      UPDATE reservations
      SET status = 'CANCELLED'
      WHERE reservation_id = ?
      `,
      [id]
    );

    await conn.execute(
      `
      UPDATE parking_lots
      SET available_spaces = available_spaces + 1
      WHERE lot_id = ?
      `,
      [reservationRows[0].lot_id]
    );

    await conn.commit();

    res.json({
      success: true,
      message: 'Reservation cancelled successfully'
    });
  } catch (error) {
    if (conn) await conn.rollback();
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

/* SIMPLE REPORT SUMMARY */
app.get('/api/reports/summary', async (req, res) => {
  try {
    const [[lotsCount]] = await pool.query('SELECT COUNT(*) AS count FROM parking_lots');
    const [[usersCount]] = await pool.query('SELECT COUNT(*) AS count FROM users');
    const [[reservationsCount]] = await pool.query('SELECT COUNT(*) AS count FROM reservations');
    const [[activeReservations]] = await pool.query('SELECT COUNT(*) AS count FROM reservations WHERE status = "ACTIVE"');
    const [[cancelledReservations]] = await pool.query('SELECT COUNT(*) AS count FROM reservations WHERE status = "CANCELLED"');

    res.json({
      total_lots: lotsCount.count,
      total_users: usersCount.count,
      total_reservations: reservationsCount.count,
      active_reservations: activeReservations.count,
      cancelled_reservations: cancelledReservations.count
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, async () => {
  try {
    await pool.query('SELECT 1');
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('MySQL connected successfully');
  } catch (error) {
    console.error('MySQL connection failed:', error.message);
  }
});
