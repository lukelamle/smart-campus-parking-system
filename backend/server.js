const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let users = [
  { id: 1, name: 'Admin User', email: 'admin@campus.edu', password: 'admin123', role: 'admin' },
  { id: 2, name: 'Student User', email: 'student@campus.edu', password: 'student123', role: 'student' }
];

let currentUser = null;

let lots = [
  { id: 1, name: 'Lot A', location: 'North Campus', total_capacity: 120, available_spaces: 32, is_active: true },
  { id: 2, name: 'Lot B', location: 'Library', total_capacity: 80, available_spaces: 10, is_active: true },
  { id: 3, name: 'Faculty Lot', location: 'Admin Building', total_capacity: 45, available_spaces: 0, is_active: true }
];

let reservations = [];
let auditLogs = [];

function addLog(action, user = null) {
  auditLogs.push({
    id: auditLogs.length + 1,
    user_id: user ? user.id : null,
    action,
    time: new Date().toISOString()
  });
}

app.get('/', (req, res) => {
  res.send('Smart Campus Parking System API is running');
});

app.get('/api/lots', (req, res) => {
  res.json(lots);
});

app.post('/api/register', (req, res) => {
  const { name, email, password, role } = req.body;

  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    return res.status(400).json({ error: 'Email already exists' });
  }

  const newUser = {
    id: users.length + 1,
    name,
    email,
    password,
    role: role || 'student'
  };

  users.push(newUser);
  addLog(`User registered: ${email}`, newUser);

  res.json({ message: 'User created successfully', user: newUser });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  const user = users.find(u => u.email === email && u.password === password);

  if (!user) {
    addLog(`Failed login attempt for ${email}`);
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  currentUser = user;
  addLog(`User logged in: ${email}`, user);

  res.json({ message: 'Login successful', user });
});

app.post('/api/logout', (req, res) => {
  if (currentUser) {
    addLog(`User logged out: ${currentUser.email}`, currentUser);
  }
  currentUser = null;
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/current-user', (req, res) => {
  res.json(currentUser);
});

app.post('/api/reset-password', (req, res) => {
  const { email, newPassword } = req.body;
  const user = users.find(u => u.email === email);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  user.password = newPassword;
  addLog(`Password reset for ${email}`, user);

  res.json({ message: 'Password reset successful' });
});

app.post('/api/reservations', (req, res) => {
  const { user_id, lot_id, duration } = req.body;

  const user = users.find(u => u.id === parseInt(user_id));
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const lot = lots.find(l => l.id === parseInt(lot_id) && l.available_spaces > 0 && l.is_active);
  if (!lot) {
    return res.status(400).json({ error: 'No available space in selected lot' });
  }

  lot.available_spaces -= 1;

  const reservation = {
    id: reservations.length + 1,
    user_id: user.id,
    user_name: user.name,
    lot_id: lot.id,
    lot_name: lot.name,
    duration,
    status: 'ACTIVE',
    created_at: new Date().toISOString()
  };

  reservations.push(reservation);
  addLog(`Reservation created for ${user.email} in ${lot.name}`, user);

  res.json({
    message: 'Reservation confirmed',
    reservation
  });
});

app.get('/api/reservations', (req, res) => {
  res.json(reservations);
});

app.delete('/api/reservations/:id', (req, res) => {
  const reservation = reservations.find(r => r.id === parseInt(req.params.id));

  if (!reservation || reservation.status === 'CANCELLED') {
    return res.status(404).json({ error: 'Reservation not found or already cancelled' });
  }

  reservation.status = 'CANCELLED';

  const lot = lots.find(l => l.id === reservation.lot_id);
  if (lot) {
    lot.available_spaces += 1;
  }

  addLog(`Reservation cancelled: ${reservation.id}`);

  res.json({
    message: 'Reservation cancelled',
    reservation
  });
});

app.post('/api/admin/lots', (req, res) => {
  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { name, location, total_capacity 
