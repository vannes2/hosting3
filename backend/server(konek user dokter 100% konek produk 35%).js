const express = require('express');
const cors = require('cors'); 
const mysql = require('mysql'); 
const jwt = require('jsonwebtoken'); 
const http = require('http'); 
const { Server } = require('socket.io'); 
const bodyParser = require('body-parser');

const app = express(); 
const PORT = 5000; 

// Middleware untuk meningkatkan batas ukuran body request 
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'pass',
  database: 'ayune_database'
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    return;
  }
  console.log('Connected to database');
});


// Endpoint Signup
app.post('/api/signup', (req, res) => {
  const { name, email, phone, password, confirmPassword, gender, birthdate } = req.body;

  // Validasi input
  if (!name || !email || !phone || !password || !confirmPassword || !gender || !birthdate) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }

  // Simpan data ke tabel users
  const userQuery = 'INSERT INTO users (nama_user, email_user, no_hp_user, jk_user, tgl_user) VALUES (?, ?, ?, ?, ?)';
  const userValues = [name, email, phone, gender === 'L' ? 'L' : 'P', birthdate];

  db.query(userQuery, userValues, (err, result) => {
    if (err) {
      console.error('Error inserting user data:', err);
      return res.status(500).json({ message: 'Database error', error: err });
    }

    const userId = result.insertId;
    const signupQuery = 'INSERT INTO sign_up (id_user, pw_user, konfir_pw_user) VALUES (?, ?, ?)';
    const signupValues = [userId, password, confirmPassword];

    db.query(signupQuery, signupValues, (err, result) => {
      if (err) {
        console.error('Error inserting signup data:', err);
        return res.status(500).json({ message: 'Database error', error: err });
      }

      res.status(201).json({ message: 'User registered successfully' });
    });
  });
});

// Endpoint Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  // Validasi input
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  // Cari pengguna berdasarkan email dan password di tabel sign_up
  const loginQuery = `
    SELECT users.*, sign_up.pw_user
    FROM users
    INNER JOIN sign_up ON users.id = sign_up.id_user
    WHERE users.email_user = ? AND sign_up.pw_user = ?
  `;

  db.query(loginQuery, [email, password], (err, results) => {
    if (err) {
      console.error('Error querying database:', err);
      return res.status(500).json({ message: 'Database error', error: err });
    }

    if (results.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = results[0];

    // Buat token JWT
    const token = jwt.sign({ email: user.email_user, id: user.id }, 'secret_key', { expiresIn: '1h' });

    res.status(200).json({ token, user });
  });
});

// Konfigurasi socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Ganti dengan asal klien Anda
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('User connected');

  socket.on('message', (message) => {
    io.emit('message', message); // Kirim pesan ke semua klien
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Endpoint CRUD untuk tabel users

// Menampilkan semua data user
app.get('/api/users', (req, res) => {
  const query = `
    SELECT u.*, t.nama_tipe AS nama_tipe_kulit, m.nama_masalah AS nama_masalah_kulit 
    FROM users u
    LEFT JOIN tipe_kulit t ON u.id_tipe_kulit = t.id
    LEFT JOIN masalah_kulit m ON u.id_masalah_kulit = m.id
  `;
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching users:', err);
      return res.status(500).json({ message: 'Database error', error: err });
    }
    console.log('Data pengguna yang diambil:', results);
    res.status(200).json(results);
  });
});

// Endpoint Menambah data user baru
app.post('/api/users', (req, res) => {
  const { nama_user, email_user, no_hp_user, jk_user, tgl_user, koin, id_tipe_kulit, id_masalah_kulit } = req.body;
  console.log('POST /api/users', req.body); // Logging input data
  console.log('Values:', [nama_user, email_user, no_hp_user, jk_user, tgl_user, koin, id_tipe_kulit, id_masalah_kulit]);
  const query = 'INSERT INTO users (nama_user, email_user, no_hp_user, jk_user, tgl_user, koin, id_tipe_kulit, id_masalah_kulit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
  db.query(query, [nama_user, email_user, no_hp_user, jk_user, tgl_user, koin, id_tipe_kulit, id_masalah_kulit], (err, result) => {
    if (err) {
      console.error('Error inserting user:', err);
      return res.status(500).json({ message: 'Database error', error: err });
    }
    res.status(201).json({ message: 'User added successfully' });
  });
});


// Endpoint Mengedit data user
app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const { nama_user, email_user, no_hp_user, jk_user, tgl_user, koin, id_tipe_kulit, id_masalah_kulit } = req.body;
  console.log('PUT /api/users/:id', req.body);
  const query = 'UPDATE users SET nama_user = ?, email_user = ?, no_hp_user = ?, jk_user = ?, tgl_user = ?, koin = ?, id_tipe_kulit = ?, id_masalah_kulit = ? WHERE id = ?';
  db.query(query, [nama_user, email_user, no_hp_user, jk_user, tgl_user, koin, id_tipe_kulit, id_masalah_kulit, id], (err, result) => {
    if (err) {
      console.error('Error updating user:', err);
      return res.status(500).json({ message: 'Database error', error: err });
    }
    res.status(200).json({ message: 'User updated successfully' });
  });
});

// Endpoint Menghapus data user
app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  console.log('DELETE /api/users/:id', id); // Logging ID
  const query = 'DELETE FROM users WHERE id = ?';
  db.query(query, [id], (err, result) => {
    if (err) {
      console.error('Error deleting user:', err);
      return res.status(500).json({ message: 'Database error', error: err });
    }
    res.status(200).json({ message: 'User deleted successfully' });
  });
});


// Endpoint CRUD untuk tabel dokters

// Menampilkan semua data dokter
app.get('/api/dokters', (req, res) => {
  const query = 'SELECT * FROM dokters';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching dokters:', err);
      return res.status(500).json({ message: 'Database error', error: err });
    }
    res.status(200).json(results);
  });
});


// Menambah data dokter baru
app.post('/api/dokters', (req, res) => {
  const { nama_dokter, gambar, bidang_dokter, riwayat_dokter, jadwal, harga_dokter, is_available, rating } = req.body;
  const query = 'INSERT INTO dokters (nama_dokter, gambar, bidang_dokter, riwayat_dokter, jadwal, harga_dokter, is_available, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
  db.query(query, [nama_dokter, gambar, bidang_dokter, riwayat_dokter, jadwal, harga_dokter, is_available, rating], (err, result) => {
    if (err) {
      console.error('Error inserting dokter:', err);
      return res.status(500).json({ message: 'Database error', error: err });
    }
    res.status(201).json({ message: 'Dokter added successfully' });
  });
});


// Mengedit data dokter
app.put('/api/dokters/:id', (req, res) => {
  const { id } = req.params;
  const { nama_dokter, gambar, bidang_dokter, riwayat_dokter, jadwal, harga_dokter, is_available, rating } = req.body;
  const query = 'UPDATE dokters SET nama_dokter = ?, gambar = ?, bidang_dokter = ?, riwayat_dokter = ?, jadwal = ?, harga_dokter = ?, is_available = ?, rating = ? WHERE id = ?';
  db.query(query, [nama_dokter, gambar, bidang_dokter, riwayat_dokter, jadwal, harga_dokter, is_available, rating, id], (err, result) => {
    if (err) {
      console.error('Error updating dokter:', err);
      return res.status(500).json({ message: 'Database error', error: err });
    }
    res.status(200).json({ message: 'Dokter updated successfully' });
  });
});


// Menghapus data dokter
app.delete('/api/dokters/:id', (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM dokters WHERE id = ?';
  db.query(query, [id], (err, result) => {
    if (err) {
      console.error('Error deleting dokter:', err);
      return res.status(500).json({ message: 'Database error', error: err });
    }
    res.status(200).json({ message: 'Dokter deleted successfully' });
  });
});

// Endpoint CRUD untuk tabel produk

// Menampilkan semua data produk
app.get('/api/produk', (req, res) => {
  const query = 'SELECT p.*, b.nama_brand, k.nama_kategori, t.nama_tipe AS tipe_kulit, m.nama_masalah AS masalah_kulit FROM produk p LEFT JOIN brand b ON p.id_brand = b.id LEFT JOIN kategori k ON p.id_kategori = k.id LEFT JOIN tipe_kulit t ON p.id_tipe_kulit = t.id LEFT JOIN masalah_kulit m ON p.id_masalah = m.id';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching produk:', err);
      return res.status(500).json({ message: 'Database error', error: err });
    }
    res.status(200).json(results);
  });
});


// Mengedit data produk
app.put('/api/produk/:id', (req, res) => {
  const { id } = req.params;
  const { id_brand, nama_produk, id_kategori, harga, id_tipe_kulit, id_masalah_kulit, deskripsi, komposisi, cara_pemakaian, rating_produk, link_shopee, link_tokopedia } = req.body;
  const query = 'UPDATE produk SET id_brand = ?, nama_produk = ?, id_kategori = ?, harga = ?, id_tipe_kulit = ?, id_masalah_kulit = ?, deskripsi = ?, komposisi = ?, cara_pemakaian = ?, rating_produk = ?, link_shopee = ?, link_tokopedia = ? WHERE id = ?';
  db.query(query, [id_brand, nama_produk, id_kategori, harga, id_tipe_kulit, id_masalah_kulit, deskripsi, komposisi, cara_pemakaian, rating_produk, link_shopee, link_tokopedia, id], (err, result) => {
    if (err) {
      console.error('Error updating produk:', err);
      return res.status(500).json({ message: 'Database error', error: err });
    }
    res.status(200).json({ message: 'Produk updated successfully' });
  });
});

// Menghapus data produk
app.delete('/api/produk/:id', (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM produk WHERE id = ?';
  db.query(query, [id], (err, result) => {
    if (err) {
      console.error('Error deleting produk:', err);
      return res.status(500).json({ message: 'Database error', error: err });
    }
    res.status(200).json({ message: 'Produk deleted successfully' });
  });
});


// Jalankan server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
