const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json());

let currentUser = null;

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'newnameA1$',
  database: 'smart_parking_db'
});

async function addLog(action, userId = null) {
  await pool.query(
    'INSERT INTO audit_logs (user_id, action) VALUES (?, ?)',
    [userId, action]
  );
}

app.get('/', (req, res) => {
  res.send('Smart Campus Parking System API is running');
});

app.get('/api/lots', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM parking_lots');
  res.json(rows.map(lot => ({
    id: lot.lot_id,
    name: lot.lot_name,
    location: lot.location,
    total_capacity: lot.total_capacity,
    available_spaces: lot.available_spaces,
    is_active: !!lot.is_active
  })));
});

app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const [existing] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const [roleRows] = await pool.query('SELECT role_id FROM roles WHERE role_name = ?', [role || 'student']);
    const roleId = roleRows[0].role_id;

    const [result] = await pool.query(
      'INSERT INTO users (full_name, email, password, role_id) VALUES (?, ?, ?, ?)',
      [name, email, password, roleId]
    );

    await addLog(`User registered: ${email}`, result.insertId);

    res.json({ message: 'User created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await pool.query(`
      SELECT u.user_id, u.full_name, u.email, r.role_name
      FROM users u
      JOIN roles r ON u.role_id = r.role_id
      WHERE u.email = ? AND u.password = ?
    `, [email, password]);

    if (rows.length === 0) {
      await addLog(`Failed login attempt for ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    currentUser = {
      id: rows[0].user_id,
      name: rows[0].full_name,
      email: rows[0].email,
      role: rows[0].role_name
    };

    await addLog(`User logged in: ${email}`, currentUser.id);

    res.json({ message: 'Login successful', user: currentUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/logout', async (req, res) => {
  if (currentUser) {
    await addLog(`User logged out: ${currentUser.email}`, currentUser.id);
  }
  currentUser = null;
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/current-user', (req, res) => {
  res.json(currentUser);
});

app.post('/api/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    const [result] = await pool.query(
      'UPDATE users SET password = ? WHERE email = ?',
      [newPassword, email]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await addLog(`Password reset for ${email}`);
    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reservations', async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const { user_id, lot_id, duration } = req.body;

    await conn.beginTransaction();

    const [lotRows] = await conn.query(
      'SELECT * FROM parking_lots WHERE lot_id = ? AND available_spaces > 0 AND is_active = TRUE FOR UPDATE',
      [lot_id]
    );

    if (lotRows.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'No available space in selected lot' });
    }

    await conn.query(
      'UPDATE parking_lots SET available_spaces = available_spaces - 1 WHERE lot_id = ?',
      [lot_id]
    );

    await conn.query(
      'INSERT INTO reservations (user_id, lot_id, duration, status) VALUES (?, ?, ?, "ACTIVE")',
      [user_id, lot_id, duration]
    );

    await conn.commit();

    await addLog(`Reservation created for user ${user_id}`, user_id);

    res.json({ message: 'Reservation confirmed' });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

app.get('/api/reservations', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.reservation_id, u.full_name, p.lot_name, r.duration, r.status
      FROM reservations r
      JOIN users u ON r.user_id = u.user_id
      JOIN parking_lots p ON r.lot_id = p.lot_id
      ORDER BY r.reservation_id
    `);

    res.json(rows.map(r => ({
      id: r.reservation_id,
      user_name: r.full_name,
      lot_name: r.lot_name,
      duration: r.duration,
      status: r.status
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/reservations/:id', async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT * FROM reservations WHERE reservation_id = ? AND status = "ACTIVE" FOR UPDATE',
      [req.params.id]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Reservation not found or already cancelled' });
    }

    const reservation = rows[0];

    await conn.query(
      'UPDATE reservations SET status = "CANCELLED" WHERE reservation_id = ?',
      [req.params.id]
    );

    await conn.query(
      'UPDATE parking_lots SET available_spaces = available_spaces + 1 WHERE lot_id = ?',
      [reservation.lot_id]
    );

    await conn.commit();

    await addLog(`Reservation cancelled: ${req.params.id}`, reservation.user_id);

    res.json({ message: 'Reservation cancelled' });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

app.post('/api/admin/lots', async (req, res) => {
  try {
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { name, location, total_capacity } = req.body;

    await pool.query(
      'INSERT INTO parking_lots (lot_name, location, total_capacity, available_spaces, is_active) VALUES (?, ?, ?, ?, TRUE)',
      [name, location, total_capacity, total_capacity]
    );

    await addLog(`Admin added lot: ${name}`, currentUser.id);

    res.json({ message: 'Parking lot added successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/lots/:id/capacity', async (req, res) => {
  try {
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const lotId = req.params.id;
    const newCapacity = parseInt(req.body.total_capacity);

    const [rows] = await pool.query('SELECT * FROM parking_lots WHERE lot_id = ?', [lotId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Lot not found' });
    }

    const lot = rows[0];
    const usedSpaces = lot.total_capacity - lot.available_spaces;

    if (newCapacity < usedSpaces) {
      return res.status(400).json({ error: 'New capacity cannot be less than reserved spaces' });
    }

    const newAvailable = newCapacity - usedSpaces;

    await pool.query(
      'UPDATE parking_lots SET total_capacity = ?, available_spaces = ? WHERE lot_id = ?',
      [newCapacity, newAvailable, lotId]
    );

    await addLog(`Admin updated capacity for lot ${lotId}`, currentUser.id);

    res.json({ message: 'Capacity updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/lots/:id/disable', async (req, res) => {
  try {
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await pool.query(
      'UPDATE parking_lots SET is_active = FALSE WHERE lot_id = ?',
      [req.params.id]
    );

    await addLog(`Admin disabled lot ${req.params.id}`, currentUser.id);

    res.json({ message: 'Lot disabled successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reports/summary', async (req, res) => {
  try {
    const [[lotsCount]] = await pool.query('SELECT COUNT(*) AS count FROM parking_lots');
    const [[activeLots]] = await pool.query('SELECT COUNT(*) AS count FROM parking_lots WHERE is_active = TRUE');
    const [[usersCount]] = await pool.query('SELECT COUNT(*) AS count FROM users');
    const [[reservationsCount]] = await pool.query('SELECT COUNT(*) AS count FROM reservations');
    const [[activeReservations]] = await pool.query('SELECT COUNT(*) AS count FROM reservations WHERE status = "ACTIVE"');
    const [[cancelledReservations]] = await pool.query('SELECT COUNT(*) AS count FROM reservations WHERE status = "CANCELLED"');

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
    const [rows] = await pool.query('SELECT * FROM audit_logs ORDER BY log_id DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
