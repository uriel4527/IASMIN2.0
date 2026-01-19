const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite database
const dbPath = path.resolve(__dirname, 'chat.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        createTable();
    }
});

function createTable() {
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        content TEXT,
        sender_id TEXT,
        receiver_id TEXT,
        created_at TEXT,
        sender_data TEXT,
        full_message_data TEXT
    )`, (err) => {
        if (err) {
            console.error('Error creating table:', err.message);
        } else {
            console.log('Messages table ready.');
            
            // Create index on created_at for faster sorting/pagination
            db.run(`CREATE INDEX IF NOT EXISTS idx_created_at ON messages(created_at)`, (err) => {
                if (err) {
                    console.error('Error creating index:', err.message);
                } else {
                    console.log('Index on created_at ready.');
                }
            });
        }
    });
}

/**
 * Update message content in the database
 * @param {string} id - The message ID
 * @param {string} content - The new content
 * @param {Function} callback - Optional callback
 */
function updateMessage(id, content, callback) {
    // First retrieve the existing message to update its JSON data
    db.get(`SELECT full_message_data FROM messages WHERE id = ?`, [id], (err, row) => {
        if (err) {
            if (callback) callback(err);
            return;
        }

        if (!row) {
            if (callback) callback(new Error('Message not found'));
            return;
        }

        try {
            const msgData = JSON.parse(row.full_message_data);
            msgData.content = content;
            msgData.is_edited = true; // Flag as edited
            
            const updatedFullData = JSON.stringify(msgData);

            db.run(
                `UPDATE messages SET content = ?, full_message_data = ? WHERE id = ?`,
                [content, updatedFullData, id],
                (err) => {
                    if (callback) callback(err);
                }
            );
        } catch (e) {
            if (callback) callback(e);
        }
    });
}

/**
 * Soft delete a message
 * @param {string} id - The message ID
 * @param {Function} callback - Optional callback
 */
function deleteMessage(id, callback) {
    db.get(`SELECT full_message_data FROM messages WHERE id = ?`, [id], (err, row) => {
        if (err) {
            if (callback) callback(err);
            return;
        }

        if (!row) {
            if (callback) callback(new Error('Message not found'));
            return;
        }

        try {
            const msgData = JSON.parse(row.full_message_data);
            msgData.deleted_at = new Date().toISOString();
            
            const updatedFullData = JSON.stringify(msgData);

            db.run(
                `UPDATE messages SET full_message_data = ? WHERE id = ?`,
                [updatedFullData, id],
                (err) => {
                    if (callback) callback(err);
                }
            );
        } catch (e) {
            if (callback) callback(e);
        }
    });
}

/**
 * Update message reactions
 * @param {string} id - Message ID
 * @param {Object} reaction - Reaction object { emoji, user_id, ... }
 * @param {string} action - 'add' or 'remove'
 * @param {Function} callback
 */
function updateMessageReaction(id, reaction, action, callback) {
    db.get(`SELECT full_message_data FROM messages WHERE id = ?`, [id], (err, row) => {
        if (err) return callback(err);
        if (!row) return callback(new Error('Message not found'));

        try {
            const msgData = JSON.parse(row.full_message_data);
            if (!msgData.reactions) msgData.reactions = [];

            if (action === 'add') {
                // Check if already exists to avoid duplicates
                const exists = msgData.reactions.some(r => r.user_id === reaction.user_id && r.emoji === reaction.emoji);
                if (!exists) {
                    msgData.reactions.push(reaction);
                }
            } else if (action === 'remove') {
                msgData.reactions = msgData.reactions.filter(r => !(r.user_id === reaction.user_id && r.emoji === reaction.emoji));
            }

            const updatedFullData = JSON.stringify(msgData);
            db.run(`UPDATE messages SET full_message_data = ? WHERE id = ?`, [updatedFullData, id], (err) => {
                callback(err, msgData.reactions);
            });
        } catch (e) {
            callback(e);
        }
    });
}

/**
 * Mark message as read
 * @param {string} id - Message ID
 * @param {Function} callback
 */
function markMessageAsRead(id, callback) {
    db.get(`SELECT full_message_data FROM messages WHERE id = ?`, [id], (err, row) => {
        if (err) return callback(err);
        if (!row) return callback(new Error('Message not found'));

        try {
            const msgData = JSON.parse(row.full_message_data);
            if (msgData.is_read) {
                 // Already read, just return
                 return callback(null, msgData);
            }
            
            msgData.is_read = true;
            msgData.viewed_at = new Date().toISOString();

            const updatedFullData = JSON.stringify(msgData);
            db.run(`UPDATE messages SET full_message_data = ? WHERE id = ?`, [updatedFullData, id], (err) => {
                callback(err, msgData);
            });
        } catch (e) {
            callback(e);
        }
    });
}

module.exports = db;
module.exports.updateMessage = updateMessage;
module.exports.deleteMessage = deleteMessage;
module.exports.updateMessageReaction = updateMessageReaction;
module.exports.markMessageAsRead = markMessageAsRead;
