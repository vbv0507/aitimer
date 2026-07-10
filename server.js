const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const expressLayouts = require('express-ejs-layouts');
const cookieParser = require('cookie-parser');

dotenv.config();

connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const session = require('express-session');
const passport = require('passport');
require('./config/passport'); // Load Passport config

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'partials/layout'); // We will create a layout.ejs

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log('New client connected');
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

const reminderService = require('./services/reminderService');
reminderService.init(io);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/schedules', require('./routes/schedules'));

const { protect } = require('./middleware/auth');
const Task = require('./models/Task');
const Schedule = require('./models/Schedule');

const { generateAIInsights } = require('./services/aiService');

app.get('/', (req, res) => res.render('login', { title: 'Login - Time Manager AI' }));
app.get('/login', (req, res) => res.render('login', { title: 'Login - Time Manager AI' }));
app.get('/dashboard', protect, async (req, res) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const schedule = await Schedule.findOne({ userId: req.user._id, date: startOfDay }).populate('timeline.taskId');
    const tasks = await Task.find({ userId: req.user._id, status: { $in: ['Pending', 'Delayed'] } });
    
    const aiInsight = await generateAIInsights(tasks, schedule);
    
    res.render('dashboard', { title: 'Dashboard - Time Manager AI', user: req.user, schedule, tasks, aiInsight });
});
app.get('/planner', protect, async (req, res) => {
    const tasks = await Task.find({ userId: req.user._id, status: { $in: ['Pending', 'Delayed'] }, isRecurring: false });
    const allTasks = await Task.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.render('planner', { title: 'AI Daily Planner', user: req.user, tasks, allTasks });
});
app.get('/calendar', protect, (req, res) => res.render('calendar', { title: 'Calendar', user: req.user }));

app.get('/focus', protect, async (req, res) => {
    const tasks = await Task.find({ userId: req.user._id, status: { $in: ['Pending', 'Delayed'] } });
    res.render('focus', { title: 'Focus Mode', user: req.user, tasks });
});

app.get('/settings', protect, (req, res) => {
    res.render('settings', { title: 'Settings & Integrations', user: req.user });
});

app.get('/analytics', protect, async (req, res) => {
    const tasks = await Task.find({ userId: req.user._id });
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const pending = tasks.filter(t => t.status !== 'Completed').length;
    const focusTime = tasks.filter(t => t.status === 'Completed').reduce((sum, t) => sum + t.estimatedDuration, 0);

    res.render('analytics', { title: 'Analytics', user: req.user, completed, pending, focusTime });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, console.log(`Server running on port ${PORT}`));
