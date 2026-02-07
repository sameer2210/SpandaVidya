import http from 'http';
import { Server as SocketServer } from 'socket.io';
import app from './src/app.js';
import config from './src/config/config.js';
import connectToDb from './src/db/db.js';
import aiService from './src/services/ai.service.js';

connectToDb();

const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: config.FRONTEND_URLS,
    credentials: true,
    methods: ['GET', 'POST'],
  },
  pingInterval: 25000,
  pingTimeout: 60000,
});

const conversationRoom = conversationId => `conversation:${conversationId}`;

io.on('connection', socket => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('join-conversation', payload => {
    const conversationId = payload?.conversationId;
    if (!conversationId) return;
    socket.join(conversationRoom(conversationId));
  });

  socket.on('leave-conversation', payload => {
    const conversationId = payload?.conversationId;
    if (!conversationId) return;
    socket.leave(conversationRoom(conversationId));
  });

  socket.on('chat:prompt', async payload => {
    const {
      requestId,
      conversationId,
      userId,
      userName,
      message,
      history = [],
    } = payload || {};

    const effectiveRequestId = requestId || `${socket.id}-${Date.now()}`;

    if (!conversationId || !userId || !message) {
      socket.emit('chat:error', {
        requestId: effectiveRequestId,
        conversationId,
        message: 'conversationId, userId, and message are required',
      });
      return;
    }

    const room = conversationRoom(conversationId);
    socket.join(room);

    try {
      let fullText = '';
      for await (const chunk of aiService.streamChat({ history, message, userName })) {
        if (!chunk) continue;
        fullText += chunk;
        io.to(room).emit('chat:chunk', {
          requestId: effectiveRequestId,
          conversationId,
          chunk,
        });
      }

      io.to(room).emit('chat:done', {
        requestId: effectiveRequestId,
        conversationId,
        fullText,
      });
    } catch (error) {
      console.error('AI chat error:', error);
      socket.emit('chat:error', {
        requestId: effectiveRequestId,
        conversationId,
        message: error?.message || 'Failed to generate response',
      });
    }
  });

  socket.on('disconnect', reason => {
    console.log(`Socket disconnected: ${socket.id} (${reason})`);
  });
});

server.listen(config.PORT, () => {
  console.log(`Server running on port => ${config.PORT}`);
});

export { io };
