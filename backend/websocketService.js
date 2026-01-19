const WebSocket = require('ws');
const db = require('./db');

class WebSocketService {
    constructor() {
        this.wss = null;
        this.users = new Map(); // userId -> { id, username, ... }
        this.activeConnections = new Map(); // ws -> userId
    }

    /**
     * Initialize the WebSocket server
     * @param {Object} server - The HTTP/HTTPS server instance
     */
    initialize(server) {
        this.wss = new WebSocket.Server({ 
            server,
            maxPayload: 10 * 1024 * 1024 * 1024 // 10GB max payload
        });
        
        this.wss.on('connection', (ws, req) => {
            const ip = req.socket.remoteAddress;
            console.log(`[WebSocket] New connection from ${ip}`);
            
            // Send a welcome message
            this.sendToClient(ws, { 
                type: 'system', 
                content: 'Connected to WebSocket server',
                timestamp: new Date().toISOString()
            });

            // Send chat history
            this.sendHistory(ws);

            ws.on('message', (message) => {
                try {
                    // Try to parse as JSON, otherwise treat as string
                    let parsedMessage;
                    try {
                        parsedMessage = JSON.parse(message);
                    } catch (e) {
                        parsedMessage = { 
                            type: 'text', 
                            content: message.toString(),
                            id: Date.now().toString(),
                            created_at: new Date().toISOString()
                        };
                    }

                    console.log(`[WebSocket] Received:`, parsedMessage);
                    
                    if (parsedMessage.type === 'join') {
                        this.handleJoin(parsedMessage, ws);
                    } else if (parsedMessage.type === 'edit') {
                        // Handle message edit
                        this.handleEditMessage(parsedMessage, ws);
                    } else if (parsedMessage.type === 'delete') {
                        // Handle message deletion
                        this.handleDeleteMessage(parsedMessage, ws);
                    } else if (parsedMessage.type === 'reaction') {
                        // Handle reaction
                        this.handleReaction(parsedMessage, ws);
                    } else if (parsedMessage.type === 'load_more') {
                        // Handle loading more history
                        this.handleLoadMore(parsedMessage, ws);
                    } else if (parsedMessage.type === 'typing_start' || parsedMessage.type === 'typing_stop') {
                        // Broadcast typing status to all other clients
                        this.broadcast({
                            type: 'typing_update',
                            userId: parsedMessage.userId,
                            username: parsedMessage.username,
                            isTyping: parsedMessage.type === 'typing_start'
                        }, ws);
                    } else if (parsedMessage.type === 'mark_read') {
                        // Handle read receipt
                        this.handleMarkAsRead(parsedMessage, ws);
                    } else if (parsedMessage.type === 'ping') {
                        this.sendToClient(ws, { type: 'pong', timestamp: parsedMessage.timestamp });
                    } else {
                        // Save new message to database
                        this.saveMessage(parsedMessage);
                        // Broadcast the message to other clients
                        this.broadcast(parsedMessage, ws);
                    }
                    
                } catch (e) {
                    console.error('[WebSocket] Error processing message:', e);
                    this.sendToClient(ws, { type: 'error', content: 'Invalid message format' });
                }
            });

            ws.on('close', () => {
                const userId = this.activeConnections.get(ws);
                if (userId) {
                    console.log(`[WebSocket] Client disconnected (${userId})`);
                    const user = this.users.get(userId);
                    if (user) {
                        user.is_online = false;
                        user.last_seen = new Date().toISOString();
                        this.users.set(userId, user);
                        
                        this.broadcast({
                            type: 'user_status',
                            userId: userId,
                            status: 'offline',
                            last_seen: user.last_seen
                        });
                    }
                    this.activeConnections.delete(ws);
                } else {
                    console.log(`[WebSocket] Client disconnected (${ip})`);
                }
            });

            ws.on('error', (error) => {
                console.error(`[WebSocket] Error:`, error);
            });
        });
        
        console.log('[WebSocket] Service initialized and ready');
    }

    /**
     * Handle user join
     * @param {Object} msg 
     * @param {WebSocket} ws 
     */
    handleJoin(msg, ws) {
        if (!msg.user || !msg.user.id) return;

        const userId = msg.user.id;
        console.log(`[WebSocket] User joined: ${msg.user.username} (${userId})`);

        this.activeConnections.set(ws, userId);
        
        const userData = {
            ...msg.user,
            is_online: true,
            last_seen: new Date().toISOString()
        };
        
        this.users.set(userId, userData);

        // Broadcast status to others
        this.broadcast({
            type: 'user_status',
            userId: userId,
            status: 'online',
            user: userData
        }, ws);

        // Send current online users list to the new joiner
        // Filter users to only send necessary info
        const usersList = Array.from(this.users.values());
        this.sendToClient(ws, {
            type: 'users_list',
            users: usersList
        });
    }

    /**
     * Handle message edit
     * @param {Object} msg 
     * @param {WebSocket} ws 
     */
    handleEditMessage(msg, ws) {
        if (!msg.id || !msg.content) return;

        console.log(`[WebSocket] Edit request for message ${msg.id}`);

        // Update in database
        db.updateMessage(msg.id, msg.content, (err) => {
            if (err) {
                console.error('[WebSocket] Error updating message:', err);
                return;
            }

            // Broadcast update to all clients (including sender to confirm persistence)
            // We use 'broadcast' method which excludes sender, so we might need to send to sender too 
            // if we want to confirm, but usually optimistic UI handles it.
            // However, other clients need to know.
            
            const updateEvent = {
                type: 'edit',
                id: msg.id,
                content: msg.content,
                is_edited: true
            };

            this.broadcast(updateEvent, null); // Broadcast to ALL (passing null as sender sends to everyone)
        });
    }

    /**
     * Handle message deletion
     * @param {Object} msg 
     * @param {WebSocket} ws 
     */
    handleDeleteMessage(msg, ws) {
        if (!msg.id) return;

        console.log(`[WebSocket] Delete request for message ${msg.id}`);

        // Update in database
        db.deleteMessage(msg.id, (err) => {
            if (err) {
                console.error('[WebSocket] Error deleting message:', err);
                return;
            }

            // Broadcast delete event to all clients
            const deleteEvent = {
                type: 'delete',
                id: msg.id,
                deleted_at: new Date().toISOString()
            };

            this.broadcast(deleteEvent, null);
        });
    }

    /**
     * Handle reaction
     * @param {Object} msg 
     * @param {WebSocket} ws 
     */
    handleReaction(msg, ws) {
        if (!msg.messageId || !msg.emoji || !msg.userId || !msg.action) return;

        console.log(`[WebSocket] Reaction ${msg.action}: ${msg.emoji} on ${msg.messageId} by ${msg.userId}`);

        const reaction = {
            id: msg.id || Date.now().toString(),
            message_id: msg.messageId,
            user_id: msg.userId,
            emoji: msg.emoji,
            created_at: new Date().toISOString()
        };

        // Update in database
        db.updateMessageReaction(msg.messageId, reaction, msg.action, (err, updatedReactions) => {
            if (err) {
                console.error('[WebSocket] Error updating reaction:', err);
                return;
            }

            // Broadcast to all clients
            const reactionEvent = {
                type: 'reaction_update',
                messageId: msg.messageId,
                reactions: updatedReactions
            };

            this.broadcast(reactionEvent, null);
        });
    }

    /**
     * Handle mark as read
     * @param {Object} msg 
     * @param {WebSocket} ws 
     */
    handleMarkAsRead(msg, ws) {
        if (!msg.messageId) return;

        db.markMessageAsRead(msg.messageId, (err, updatedMessage) => {
            if (err) {
                console.error('[WebSocket] Error marking message as read:', err);
                return;
            }

            // Broadcast update
            const readEvent = {
                type: 'read_update',
                messageId: msg.messageId,
                is_read: true,
                viewed_at: updatedMessage.viewed_at
            };

            this.broadcast(readEvent, null);
        });
    }

    /**
     * Save message to SQLite database
     * @param {Object} msg 
     */
    saveMessage(msg) {
        console.log('[WebSocket] Attempting to save message:', msg.id, 'Content length:', msg.content ? msg.content.length : 0);
        
        // Skip system messages or invalid messages without content
        if (msg.type === 'system') {
            console.log('[WebSocket] Skipping save for system message');
            return;
        }
        
        if (!msg.content && !msg.image_data && !msg.audio_data && !msg.video_storage_path) {
            console.log('[WebSocket] Skipping save for empty message (no content/media)');
            return;
        }

        const query = `INSERT OR REPLACE INTO messages (
            id, content, sender_id, receiver_id, created_at, sender_data, full_message_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`;

        const id = msg.id || Date.now().toString();
        const content = msg.content || '';
        const senderId = msg.sender_id || 'unknown';
        const receiverId = msg.receiver_id || 'broadcast';
        const createdAt = msg.created_at || new Date().toISOString();
        const senderData = JSON.stringify(msg.sender || {});
        const fullData = JSON.stringify(msg);

        db.run(query, [id, content, senderId, receiverId, createdAt, senderData, fullData], (err) => {
            if (err) {
                console.error('[WebSocket] Error saving message to DB:', err.message);
            } else {
                console.log('[WebSocket] Message saved to DB successfully:', id);
            }
        });
    }

    /**
     * Send chat history to a client
     * @param {WebSocket} ws 
     */
    sendHistory(ws) {
        // Fetch latest 50 messages (DESC) instead of oldest (ASC)
        const query = `SELECT full_message_data FROM messages ORDER BY created_at DESC LIMIT 50`;
        
        db.all(query, [], (err, rows) => {
            if (err) {
                console.error('[WebSocket] Error fetching history:', err.message);
                return;
            }
            
            if (rows && rows.length > 0) {
                console.log(`[WebSocket] Sending ${rows.length} stored messages to new client`);
                // Reverse to send in chronological order (oldest -> newest)
                rows.reverse().forEach(row => {
                    try {
                        const msg = JSON.parse(row.full_message_data);
                        this.sendToClient(ws, msg);
                    } catch (e) {
                        console.error('[WebSocket] Error parsing stored message:', e);
                    }
                });
            }
        });
    }

    /**
     * Handle loading older messages
     * @param {Object} msg 
     * @param {WebSocket} ws 
     */
    handleLoadMore(msg, ws) {
        if (!msg.lastTimestamp) return;

        console.log(`[WebSocket] Loading more history before ${msg.lastTimestamp}`);

        // Get 50 messages older than the provided timestamp
        const query = `SELECT full_message_data FROM messages WHERE created_at < ? ORDER BY created_at DESC LIMIT 50`;
        
        db.all(query, [msg.lastTimestamp], (err, rows) => {
            if (err) {
                console.error('[WebSocket] Error loading more history:', err.message);
                return;
            }
            
            if (rows && rows.length > 0) {
                // Reverse to maintain chronological order in the batch
                const messages = rows.reverse().map(row => {
                    try {
                        return JSON.parse(row.full_message_data);
                    } catch (e) {
                        return null;
                    }
                }).filter(m => m !== null);
                
                this.sendToClient(ws, {
                    type: 'history_batch',
                    messages: messages
                });
            } else {
                this.sendToClient(ws, {
                    type: 'history_end'
                });
            }
        });
    }

    /**
     * Broadcast data to all connected clients except the sender
     * @param {Object} data - The data to send
     * @param {WebSocket} sender - The client who sent the message (to exclude)
     */
    broadcast(data, sender = null) {
        if (!this.wss) return;
        
        const messageStr = JSON.stringify(data);
        
        this.wss.clients.forEach((client) => {
            if (client !== sender && client.readyState === WebSocket.OPEN) {
                client.send(messageStr);
            }
        });
    }

    /**
     * Send data to a specific client
     * @param {WebSocket} ws - The target client
     * @param {Object} data - The data to send
     */
    sendToClient(ws, data) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    }
}

// Export a singleton instance
module.exports = new WebSocketService();
