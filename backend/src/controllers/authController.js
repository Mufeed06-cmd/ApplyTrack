const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const BCRYPT_SALT_ROUNDS = 10;
const JWT_EXPIRES_IN = '24h';

/**
 * Register a new user
 * POST /api/auth/register
 */
async function register(req, res) {
  try {
    const { username, password } = req.body;

    // Validate inputs
    if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const trimmedUsername = username.trim();

    if (trimmedUsername.length < 3 || trimmedUsername.length > 50) {
      return res.status(400).json({ error: 'Username must be between 3 and 50 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if username already exists
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE username = ? LIMIT 1',
      [trimmedUsername]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ error: 'Username is already taken' });
    }

    // Hash password securely with bcrypt
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Insert user into database
    const [result] = await pool.execute(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [trimmedUsername, hashedPassword]
    );

    const userId = result.insertId;

    // Generate JWT token
    const token = jwt.sign(
      { id: userId, username: trimmedUsername },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: userId,
        username: trimmedUsername,
      },
    });
  } catch (error) {
    console.error('Error during user registration:', error);
    return res.status(500).json({ error: 'Internal server error during registration' });
  }
}

/**
 * Authenticate existing user
 * POST /api/auth/login
 */
async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const trimmedUsername = username.trim();

    // Fetch user by username
    const [users] = await pool.execute(
      'SELECT id, username, password FROM users WHERE username = ? LIMIT 1',
      [trimmedUsername]
    );

    if (users.length === 0) {
      // Use uniform message to avoid account enumeration
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = users[0];

    // Verify password hash
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (error) {
    console.error('Error during user login:', error);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
}

/**
 * Get current authenticated user profile
 * GET /api/auth/me
 */
async function getMe(req, res) {
  try {
    const [users] = await pool.execute(
      'SELECT id, username, created_at FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ user: users[0] });
  } catch (error) {
    console.error('Error fetching current user:', error);
    return res.status(500).json({ error: 'Internal server error fetching user profile' });
  }
}

module.exports = {
  register,
  login,
  getMe,
};
