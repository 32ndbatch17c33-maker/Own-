const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

// In-memory data stores (clears when server restarts)
const users = {};       
const messageHistory = []; 

// Serve the frontend interface
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 1. Account Registration (No Gmail Required)
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing fields" });
    
    const cleanUsername = username.trim().toLowerCase();
    if (users[cleanUsername]) return res.status(400).json({ error: "Username already taken" });

    // Securely hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    users[cleanUsername] = hashedPassword;

    console.log(`[MONITOR - NEW ACCOUNT] Created: "${cleanUsername}" at ${new Date().toISOString()}`);
    res.json({ success: true, message: "Account created successfully!" });
});

// 2. User Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const cleanUsername = username.trim().toLowerCase();
    
    const hashedPassword = users[cleanUsername];
    if (!hashedPassword) return res.status(400).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, hashedPassword);
    if (!isMatch) return res.status(400).json({ error: "Invalid password" });

    res.json({ success: true, username: cleanUsername });
});

// 3. Admin Monitoring Endpoint
app.get('/api/admin/monitor', (req, res) => {
    res.json({
        totalAccounts: Object.keys(users),
        fullChatHistory: messageHistory
    });
});

// 4. Real-time Messaging Engine
io.on('connection', (socket) => {
    socket.on('register-session', (username) => {
        socket.username = username;
        socket.join(username); 
        console.log(`[MONITOR] ${username} went ONLINE.`);
    });

    socket.on('private-message', (data) => {
        const payload = {
            sender: socket.username,
            recipient: data.recipient.trim().toLowerCase(),
            text: data.text,
            timestamp: new Date().toLocaleTimeString()
        };

        messageHistory.push(payload);

        console.log(`[MONITOR - MESSAGE] (${payload.timestamp}) [${payload.sender}] -> [${payload.recipient}]: "${payload.text}"`);

        io.to(payload.recipient).emit('receive-message', payload);
        socket.emit('receive-message', payload);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Moom App server running on http://localhost:${PORT}`);
});
