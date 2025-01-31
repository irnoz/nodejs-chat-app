// app.js

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
const authRoutes = require('./routes/auth');
const User = require('./models/User');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.log(err));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/', authRoutes);

function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

app.get('/chat', isAuthenticated, async (req, res) => {
    try {
        const messages = await Message.find().populate('user').sort({ createdAt: 1 });
        res.render('chat', { user: req.session.user, messages });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

io.use((socket, next) => {
    const sessionMiddleware = session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
    });
    sessionMiddleware(socket.request, {}, next);
});

io.on('connection', (socket) => {
    const session = socket.request.session;
    if (!session.userId) {
        return;
    }

    socket.on('chat message', async (msg) => {
        try {
            const user = await User.findById(session.userId);
            const message = new Message({
                content: msg,
                user: user._id,
            });
            await message.save();
            const populatedMessage = await message.populate('user').execPopulate();
            io.emit('chat message', {
                content: populatedMessage.content,
                author: populatedMessage.user.name,
            });
        } catch (err) {
            console.error(err);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
