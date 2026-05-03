const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: 'localhost',
  port: 3306,
  user: 'parking_user',
  password: 'sqlgroup12',
  database: 'smart_parking_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

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

    if (rows.length === 0) {
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
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/lots/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.execute(
      `SELECT * FROM parking_lots WHERE lot_id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Lot not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/lots', async (req, res) => {
  try {
    const { lot_name, location, total_spaces, available_spaces, status } = req.body;

    const [result] = await pool.execute(
      `
      INSERT INTO parking_lots (lot_name, location, total_spaces, available_spaces, status)
      VALUES (?, ?, ?, ?, ?)
      `,
      [lot_name, location, total_spaces, available_spaces, status || 'OPEN']
    );

    res.status(201).json({
      success: true,
      message: 'Lot created',
      lot_id: result.insertId
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/lots/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { lot_name, location, total_spaces, available_spaces, status } = req.body;

    const [result] = await pool.execute(
      `
      UPDATE parking_lots
      SET lot_name = ?, location = ?, total_spaces = ?, available_spaces = ?, status = ?
      WHERE lot_id = ?
      `,
      [lot_name, location, total_spaces, available_spaces, status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Lot not found' });
    }

    res.json({ success: true, message: 'Lot updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/lots/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.execute(
      `DELETE FROM parking_lots WHERE lot_id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Lot not found' });
    }

    res.json({ success: true, message: 'Lot deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* RESERVATIONS */
app.get('/api/reservations', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT reservation_id, user_id, lot_id, start_time, end_time, status
      FROM reservations
      ORDER BY reservation_id DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reservations', async (req, res) => {
  let connection;
  try {
    const { user_id, lot_id, start_time, end_time } = req.body;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [lotRows] = await connection.execute(
      `SELECT available_spaces FROM parking_lots WHERE lot_id = ? FOR UPDATE`,
      [lot_id]
    );

    if (lotRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Lot not found' });
    }

    if (lotRows[0].available_spaces <= 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'No available spaces' });
    }

    const [reservationResult] = await connection.execute(
      `
      INSERT INTO reservations (user_id, lot_id, start_time, end_time, status)
      VALUES (?, ?, ?, ?, 'ACTIVE')
      `,
      [user_id, lot_id, start_time, end_time]
    );

    await connection.execute(
      `
      UPDATE parking_lots
      SET available_spaces = available_spaces - 1
      WHERE lot_id = ?
      `,
      [lot_id]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Reservation created successfully',
      reservation_id: reservationResult.insertId
    });
  } catch (error) {
    if (connection) await connection.rollback();
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

app.put('/api/reservations/:id/cancel', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [reservationRows] = await connection.execute(
      `
      SELECT lot_id, status
      FROM reservations
      WHERE reservation_id = ?
      FOR UPDATE
      `,
      [id]
    );

    if (reservationRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Reservation not found' });
    }

    if (reservationRows[0].status === 'CANCELLED') {
      await connection.rollback();
      return res.status(400).json({ message: 'Reservation already cancelled' });
    }

    await connection.execute(
      `
      UPDATE reservations
      SET status = 'CANCELLED'
      WHERE reservation_id = ?
      `,
      [id]
    );

    await connection.execute(
      `
      UPDATE parking_lots
      SET available_spaces = available_spaces + 1
      WHERE lot_id = ?
      `,
      [reservationRows[0].lot_id]
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'Reservation cancelled successfully'
    });
  } catch (error) {
    if (connection) await connection.rollback();
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

/* ADMIN REPORTS */
app.get('/api/admin/report/lots', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT lot_id, lot_name, total_spaces, available_spaces, status
      FROM parking_lots
      ORDER BY lot_name
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/report/reservations', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT reservation_id, user_id, lot_id, start_time, end_time, status
      FROM reservations
      ORDER BY start_time DESC
    `);
    res.json(rows);
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
