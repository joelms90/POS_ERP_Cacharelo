import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve public directory for static admin dashboard
app.use(express.static(path.join(__dirname, 'public')));

// Path to JSON user database (fallback)
const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface User {
  id: string;
  name: string;
  pin: string;
  role: 'waiter' | 'cashier' | 'kitchen';
}

const defaultUsers: User[] = [
  { id: uuidv4(), name: 'Juan (Mesero)', pin: '1111', role: 'waiter' },
  { id: uuidv4(), name: 'Sofia (Cajero)', pin: '2222', role: 'cashier' },
  { id: uuidv4(), name: 'Chef Carlos', pin: '3333', role: 'kitchen' }
];

// Initialize PostgreSQL Pool if DATABASE_URL is provided
const DATABASE_URL = process.env.DATABASE_URL;
let pgPool: Pool | null = null;

if (DATABASE_URL) {
  console.log('PostgreSQL configuration detected, connecting...');
  pgPool = new Pool({
    connectionString: DATABASE_URL,
    // Turn off SSL verification for local dev docker, enable for secure Cloud SQL
    ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1') || DATABASE_URL.includes('db') ? false : { rejectUnauthorized: false }
  });

  // Verify database connection and schema availability
  pgPool.query('SELECT 1 FROM users LIMIT 1')
    .then(() => {
      console.log('Successfully connected to PostgreSQL database and verified "users" table.');
    })
    .catch((err) => {
      console.error('PostgreSQL database check failed. Ensure migrations have been run:', err.message);
    });
} else {
  console.log('No DATABASE_URL configured. Falling back to local data/users.json database.');
}

// Fallback JSON File database Helpers
function readUsersFromFile(): User[] {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
      return defaultUsers;
    }
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading users from file:', error);
    return defaultUsers;
  }
}

function writeUsersToFile(users: User[]): void {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Error writing users to file:', error);
  }
}

// Asynchronous Data Access Layer (handles PostgreSQL vs JSON File transparently)
async function getUsers(): Promise<User[]> {
  if (pgPool) {
    const res = await pgPool.query('SELECT * FROM users');
    return res.rows;
  }
  return readUsersFromFile();
}

async function addUser(user: User): Promise<void> {
  if (pgPool) {
    await pgPool.query(
      'INSERT INTO users (id, name, pin, role) VALUES ($1, $2, $3, $4)',
      [user.id, user.name, user.pin, user.role]
    );
  } else {
    const users = readUsersFromFile();
    users.push(user);
    writeUsersToFile(users);
  }
}

async function deleteUser(id: string): Promise<boolean> {
  if (pgPool) {
    const res = await pgPool.query('DELETE FROM users WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  } else {
    const users = readUsersFromFile();
    const filteredUsers = users.filter(u => u.id !== id);
    if (users.length === filteredUsers.length) return false;
    writeUsersToFile(filteredUsers);
    return true;
  }
}

async function findUserByPin(pin: string): Promise<User | undefined> {
  if (pgPool) {
    const res = await pgPool.query('SELECT * FROM users WHERE pin = $1', [pin]);
    return res.rows[0];
  }
  const users = readUsersFromFile();
  return users.find(u => u.pin === pin);
}

// Admin Password for dashboard authorization
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Middleware to verify admin requests
const verifyAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers['x-admin-token'];
  if (token === ADMIN_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: 'No autorizado. Se requiere contraseña de administrador.' });
  }
};

// API: Verify login via PIN (Public endpoint for Flutter)
app.post('/api/auth/login', async (req, res) => {
  const { pin } = req.body;
  
  if (!pin) {
    res.status(400).json({ error: 'PIN es requerido' });
    return;
  }

  try {
    const user = await findUserByPin(pin);
    if (user) {
      res.json({
        success: true,
        user: {
          name: user.name,
          role: user.role,
          pin: user.pin
        }
      });
    } else {
      res.status(401).json({ success: false, error: 'PIN de acceso inválido' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error interno de autenticación' });
  }
});

// API: Admin password verification endpoint
app.post('/api/auth/admin', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: ADMIN_PASSWORD });
  } else {
    res.status(401).json({ success: false, error: 'Contraseña de administrador incorrecta' });
  }
});

// API: Get all users (Protected)
app.get('/api/users', verifyAdmin, async (req, res) => {
  try {
    const users = await getUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// API: Add new user (Protected)
app.post('/api/users', verifyAdmin, async (req, res) => {
  const { name, pin, role } = req.body;

  if (!name || !pin || !role) {
    res.status(400).json({ error: 'Nombre, PIN y rol son requeridos' });
    return;
  }

  if (pin.length !== 4 || isNaN(Number(pin))) {
    res.status(400).json({ error: 'El PIN debe ser un número de exactamente 4 dígitos' });
    return;
  }

  try {
    const pinExists = await findUserByPin(pin);
    if (pinExists) {
      res.status(400).json({ error: 'Este PIN ya está asignado a otro usuario' });
      return;
    }

    const newUser: User = {
      id: uuidv4(),
      name,
      pin,
      role: role as 'waiter' | 'cashier' | 'kitchen'
    };

    await addUser(newUser);
    res.status(201).json({ success: true, user: newUser });
  } catch (error) {
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// API: Delete user (Protected)
app.delete('/api/users/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await deleteUser(id);
    if (deleted) {
      res.json({ success: true, message: 'Usuario eliminado correctamente' });
    } else {
      res.status(404).json({ error: 'Usuario no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// Fallback to serve index.html for dashboard
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`  EMPIRE POS BACKEND ONLINE ON PORT ${PORT}      `);
  console.log(`  Admin Dashboard: http://localhost:${PORT}      `);
  console.log(`===============================================`);
});
