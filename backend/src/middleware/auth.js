const jwt = require('jsonwebtoken');

/**
 * Middleware to authenticate requests using JSON Web Tokens (JWT).
 * Expects the token in the 'Authorization' header in the format 'Bearer <token>'.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Invalid token format. Expected Bearer <token>' });
  }

  const token = parts[1];
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error('FATAL: JWT_SECRET environment variable is not defined.');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token has expired' });
      }
      return res.status(403).json({ error: 'Invalid or forbidden token' });
    }

    req.user = {
      id: decoded.id,
      username: decoded.username,
    };
    next();
  });
}

module.exports = authenticateToken;
