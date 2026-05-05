const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;

const pool = mysql.createPool({
  host: 'localhost',
  port: 3308,
  user: 'root',
  password: 'newnameA1$',
  database: 'smart_parking_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

let currentUser = null;

async function addLog(action, user = null) {
  try {
    await pool.execute(
      'INSERT INTO audit_logs (user_id, action) VALUES (?, ?)',
      [user ? user.user_id : null, action]
    );
  } catch (error) {
    console.error('Audit log error:', error.message);
  }
}

app.get('/', (req, res) => {
  res.send('Smart Campus Parking System API is running');
});

app.get('/api/lots', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        lot_id AS id,
        lot_name AS name,
        location,
        total_spaces AS total_capacity,
        available_spaces,
        CASE WHEN status = 'OPEN' THEN TRUE ELSE FALSE END AS is_active
      FROM parking_lots
      ORDER BY lot_id ASC
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const [existingUser] = await pool.execute(
      'SELECT user_id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const [result] = await pool.execute(
      'INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, password, role || 'student']
    );

    const [rows] = await pool.execute(
      'SELECT user_id, full_name, email, role FROM users WHERE user_id = ?',
      [result.insertId]
    );

    const newUser = {
      id: rows[0].user_id,
      name: rows[0].full_name,
      email: rows[0].email,
      role: rows[0].role
    };

    await addLog(`User registered: ${email}`, { user_id: rows[0].user_id });

    res.json({ message: 'User created successfully', user: newUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await pool.execute(
      'SELECT user_id, full_name, email, role FROM users WHERE email = ? AND password = ?',
      [email, password]
    );

    if (rows.length === 0) {
      await addLog(`Failed login attempt for ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    currentUser = {
      id: rows[0].user_id,
      user_id: rows[0].user_id,
      name: rows[0].full_name,
      full_name: rows[0].full_name,
      email: rows[0].email,
      role: rows[0].role
    };

    await addLog(`User logged in: ${email}`, currentUser);

    res.json({
      message: 'Login successful',
      user: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/logout', async (req, res) => {
  try {
    if (currentUser) {
      await addLog(`User logged out: ${currentUser.email}`, currentUser);
    }
    currentUser = null;
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/current-user', (req, res) => {
  if (!currentUser) return res.json(null);

  res.json({
    id: currentUser.id,
    name: currentUser.name,
    email: currentUser.email,
    role: currentUser.role
  });
});

app.post('/api/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    const [result] = await pool.execute(
      'UPDATE users SET password = ? WHERE email = ?',
      [newPassword, email]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [rows] = await pool.execute(
      'SELECT user_id FROM users WHERE email = ?',
      [email]
    );

    await addLog(`Password reset for ${email}`, { user_id: rows[0].user_id });

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reservations', async (req, res) => {
  let conn;
  try {
    const { user_id, lot_id, duration } = req.body;

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [userRows] = await conn.execute(
      'SELECT user_id, full_name, email FROM users WHERE user_id = ?',
      [parseInt(user_id)]
    );

    if (userRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'User not found' });
    }

    const [lotRows] = await conn.execute(
      `SELECT lot_id, lot_name, available_spaces, status
       FROM parking_lots
       WHERE lot_id = ? FOR UPDATE`,
      [parseInt(lot_id)]
    );

    if (lotRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Lot not found' });
    }

    const lot = lotRows[0];

    if (lot.available_spaces <= 0 || lot.status !== 'OPEN') {
      await conn.rollback();
      return res.status(400).json({ error: 'No available space in selected lot' });
    }

    const now = new Date();
    const end = new Date(now.getTime() + parseInt(duration) * 60000);

    const formatDate = (d) => d.toISOString().slice(0, 19).replace('T', ' ');

    const [reservationResult] = await conn.execute(
      `INSERT INTO reservations (user_id, lot_id, start_time, end_time, status)
       VALUES (?, ?, ?, ?, 'ACTIVE')`,
      [parseInt(user_id), parseInt(lot_id), formatDate(now), formatDate(end)]
    );

    await conn.execute(
      `UPDATE parking_lots
       SET available_spaces = available_spaces - 1
       WHERE lot_id = ?`,
      [parseInt(lot_id)]
    );

    await conn.commit();

    const reservation = {
      id: reservationResult.insertId,
      user_id: userRows[0].user_id,
      user_name: userRows[0].full_name,
      lot_id: lot.lot_id,
      lot_name: lot.lot_name,
      duration: parseInt(duration),
      status: 'ACTIVE',
      created_at: now.toISOString()
    };

    await addLog(`Reservation created for ${userRows[0].email} in ${lot.lot_name}`, {
      user_id: userRows[0].user_id
    });

    res.json({
      message: 'Reservation confirmed',
      reservation
    });
  } catch (error) {
    if (conn) await conn.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

app.get('/api/reservations', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        r.reservation_id AS id,
        r.user_id,
        u.full_name AS user_name,
        r.lot_id,
        p.lot_name,
        TIMESTAMPDIFF(MINUTE, r.start_time, r.end_time) AS duration,
        r.status,
        r.created_at
      FROM reservations r
      JOIN users u ON r.user_id = u.user_id
      JOIN parking_lots p ON r.lot_id = p.lot_id
      ORDER BY r.reservation_id ASC
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/reservations/:id', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [reservationRows] = await conn.execute(
      `SELECT reservation_id, lot_id, status
       FROM reservations
       WHERE reservation_id = ? FOR UPDATE`,
      [parseInt(req.params.id)]
    );

    if (reservationRows.length === 0 || reservationRows[0].status === 'CANCELLED') {
      await conn.rollback();
      return res.status(404).json({ error: 'Reservation not found or already cancelled' });
    }

    const reservation = reservationRows[0];

    await conn.execute(
      `UPDATE reservations
       SET status = 'CANCELLED'
       WHERE reservation_id = ?`,
      [reservation.reservation_id]
    );

    await conn.execute(
      `UPDATE parking_lots
       SET available_spaces = available_spaces + 1
       WHERE lot_id = ?`,
      [reservation.lot_id]
    );

    await conn.commit();

    await addLog(`Reservation cancelled: ${reservation.reservation_id}`);

    res.json({
      message: 'Reservation cancelled',
      reservation: {
        id: reservation.reservation_id,
        lot_id: reservation.lot_id,
        status: 'CANCELLED'
      }
    });
  } catch (error) {
    if (conn) await conn.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

app.post('/api/admin/lots', async (req, res) => {
  try {
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { name, location, total_capacity } = req.body;

    const [result] = await pool.execute(
      `INSERT INTO parking_lots (lot_name, location, total_spaces, available_spaces, status)
       VALUES (?, ?, ?, ?, 'OPEN')`,
      [name, location, parseInt(total_capacity), parseInt(total_capacity)]
    );

    const [rows] = await pool.execute(
      `SELECT
         lot_id AS id,
         lot_name AS name,
         location,
         total_spaces AS total_capacity,
         available_spaces,
         CASE WHEN status = 'OPEN' THEN TRUE ELSE FALSE END AS is_active
       FROM parking_lots
       WHERE lot_id = ?`,
      [result.insertId]
    );

    await addLog(`Admin added lot: ${name}`, currentUser);

    res.json({ message: 'Parking lot added successfully', lot: rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/lots/:id/capacity', async (req, res) => {
  try {
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const [rows] = await pool.execute(
      `SELECT lot_id, lot_name, total_spaces, available_spaces
       FROM parking_lots
       WHERE lot_id = ?`,
      [parseInt(req.params.id)]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Lot not found' });
    }

    const lot = rows[0];
    const oldCapacity = lot.total_spaces;
    const newCapacity = parseInt(req.body.total_capacity);
    const usedSpaces = oldCapacity - lot.available_spaces;

    if (newCapacity < usedSpaces) {
      return res.status(400).json({ error: 'New capacity cannot be less than current reserved spaces' });
    }

    const newAvailable = newCapacity - usedSpaces;

    await pool.execute(
      `UPDATE parking_lots
       SET total_spaces = ?, available_spaces = ?
       WHERE lot_id = ?`,
      [newCapacity, newAvailable, lot.lot_id]
    );

    const updatedLot = {
      id: lot.lot_id,
      name: lot.lot_name,
      location: lot.location,
      total_capacity: newCapacity,
      available_spaces: newAvailable,
      is_active: true
    };

    await addLog(`Admin updated capacity for ${lot.lot_name}`, currentUser);

    res.json({
      message: 'Capacity updated successfully',
      lot: updatedLot
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/lots/:id/disable', async (req, res) => {
  try {
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const [rows] = await pool.execute(
      'SELECT lot_id, lot_name FROM parking_lots WHERE lot_id = ?',
      [parseInt(req.params.id)]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Lot not found' });
    }

    await pool.execute(
      `UPDATE parking_lots
       SET status = 'CLOSED'
       WHERE lot_id = ?`,
      [parseInt(req.params.id)]
    );

    await addLog(`Admin disabled lot: ${rows[0].lot_name}`, currentUser);

    res.json({
      message: 'Lot disabled successfully',
      lot: {
        id: rows[0].lot_id,
        name: rows[0].lot_name,
        is_active: false
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reports/summary', async (req, res) => {
  try {
    const [[lotsCount]] = await pool.query('SELECT COUNT(*) AS count FROM parking_lots');
    const [[activeLots]] = await pool.query(`SELECT COUNT(*) AS count FROM parking_lots WHERE status = 'OPEN'`);
    const [[usersCount]] = await pool.query('SELECT COUNT(*) AS count FROM users');
    const [[reservationsCount]] = await pool.query('SELECT COUNT(*) AS count FROM reservations');
    const [[activeReservations]] = await pool.query(`SELECT COUNT(*) AS count FROM reservations WHERE status = 'ACTIVE'`);
    const [[cancelledReservations]] = await pool.query(`SELECT COUNT(*) AS count FROM reservations WHERE status = 'CANCELLED'`);

    res.json({
      total_lots: lotsCount.count,
      active_lots: activeLots.count,
      total_users: usersCount.count,
      total_reservations: reservationsCount.count,
      active_reservations: activeReservations.count,
      cancelled_reservations: cancelledReservations.count
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/audit-logs', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        a.log_id AS id,
        a.user_id,
        a.action,
        a.created_at AS time
      FROM audit_logs a
      ORDER BY a.log_id DESC
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
