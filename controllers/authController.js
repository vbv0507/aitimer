const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

const registerUser = async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Please add all fields' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
        return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
        name,
        email,
        password,
        workingHours: { start: '09:00', end: '17:00' },
        settings: { lunchBreakStart: '12:00', lunchBreakDuration: 60, bufferTime: 15 }
    });

    if (user) {
        const token = generateToken(user._id);
        res.cookie('token', token, { httpOnly: true });
        res.redirect('/dashboard');
    } else {
        res.status(400).json({ message: 'Invalid user data' });
    }
};

const loginUser = async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
        const token = generateToken(user._id);
        res.cookie('token', token, { httpOnly: true });
        res.redirect('/dashboard');
    } else {
        res.status(401).json({ message: 'Invalid credentials' });
    }
};

const logoutUser = (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
};

module.exports = {
    registerUser,
    loginUser,
    logoutUser
};
