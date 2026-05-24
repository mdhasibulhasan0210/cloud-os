const http = require('http');
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const app = require('./app');
const { jwtSecret } = require('./config/auth');
const initializeAdmin = require('./utils/initAdmin');
const logger = require('./utils/logger');
const db = require('./config/db');

const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIO(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.FRONTEND_URL 
      : 'http://localhost:3000',
    credentials: true
  }
});

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    // Get token from auth header or handshake
    const token = socket.handshake.auth.token || socket.handshake.headers.cookie?.split('token=')[1]?.split(';')[0];
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    // Verify JWT token
    const decoded = jwt.verify(token, jwtSecret);
    
    // Find user in database
    const user = await db.users.findOne({ _id: decoded.id });

    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    // Check if user is approved (except for admin/owner/moderator)
    if (user.status !== 'approved' && !['admin', 'owner', 'moderator'].includes(user.role)) {
      return next(new Error('Authentication error: Account not approved'));
    }

    // Attach user info to socket
    socket.userId = user._id.toString();
    socket.userRole = user.role;
    socket.username = user.username;
    
    next();
  } catch (error) {
    logger.error('Socket authentication error:', error.message);
    next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  logger.info(`User connected: ${socket.userId}`);

  // Join user's personal room
  socket.join(socket.userId);

  // Handle disconnect
  socket.on('disconnect', () => {
    logger.info(`User disconnected: ${socket.userId}`);
  });

  // Handle typing indicator
  socket.on('typing', (data) => {
    socket.to(data.to).emit('user_typing', {
      from: socket.userId,
      isTyping: data.isTyping
    });
  });

  // Handle message read receipt
  socket.on('message_read', (data) => {
    socket.to(data.from).emit('message_read_receipt', {
      messageId: data.messageId
    });
  });
});

// Make io accessible to routes
app.set('io', io);

// Export io for use in controllers
global.io = io;

// Initialize admin and start server
(async () => {
  try {
    // Connect to MongoDB first
    await db.connect();

    await initializeAdmin();
    
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Visit: http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
})();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

module.exports = { server, io };
