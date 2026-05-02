const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let lots = [
  { id: 1, name: 'Lot A', location: 'North Campus', total_capacity: 120, available_spaces: 32, is_active: true },
  { id: 2, name: 'Lot B', location: 'Library', total_capacity: 80, available_spaces: 10, is_active: true },
  { id: 3, name: 'Faculty Lot', location: 'Admin Building', total_capacity: 45, available_spaces: 0, is_active: true }
];

let reservations = [];

app.get('/', (req, res) => {
  res.send('Smart Campus Parking System API is running');
});

app.get('/api/lots', (req, res) => {
  res.json(lots);
});

app.post('/api/register', (req, res) => {
  res.json({ message: 'Register endpoint ready' });
});

app.post('/api/login', (req, res) => {
  res.json({ message: 'Login endpoint ready' });
});

app.post('/api/reservations', (req, res) => {
  const { user_id, lot_id, duration } = req.body;

  const lot = lots.find(l => l.id === parseInt(lot_id) && l.available_spaces > 0);

  if (!lot) {
    return res.status(400).json({ error: 'No available space in selected lot' });
  }

  lot.available_spaces -= 1;

  const reservation = {
    id: reservations.length + 1,
    user_id,
    lot_id: parseInt(lot_id),
    duration,
    status: 'ACTIVE'
  };

  reservations.push(reservation);

  res.json({
    message: 'Reservation confirmed',
    reservation
  });
});

app.delete('/api/reservations/:id', (req, res) => {
  const reservation = reservations.find(r => r.id === parseInt(req.params.id));

  if (!reservation) {
    return res.status(404).json({ error: 'Reservation not found' });
  }

  reservation.status = 'CANCELLED';

  const lot = lots.find(l => l.id === reservation.lot_id);
  if (lot) {
    lot.available_spaces += 1;
  }

  res.json({
    message: 'Reservation cancelled',
    reservation
  });
});

app.post('/api/admin/lots', (req, res) => {
  const lot = {
    id: lots.length + 1,
    name: req.body.name,
    location: req.body.location,
    total_capacity: req.body.total_capacity,
    available_spaces: req.body.available_spaces,
    is_active: true
  };

  lots.push(lot);
  res.json({ message: 'Parking lot added', lot });
});

app.put('/api/admin/lots/:id/capacity', (req, res) => {
  const lot = lots.find(l => l.id === parseInt(req.params.id));

  if (!lot) {
    return res.status(404).json({ error: 'Lot not found' });
  }

  lot.total_capacity = req.body.total_capacity;

  res.json({
    message: 'Capacity updated',
    lot
  });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
