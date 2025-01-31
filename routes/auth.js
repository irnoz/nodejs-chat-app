// routes/auth.js

const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.get('/register', (req, res) => {
    res.render('register', { errors: [], name: '', email: '', password: '', confirmPassword: '' });
});

router.post('/register', async (req, res) => {
    const { name, email, password, confirmPassword } = req.body;
    let errors = [];

    if (!name || !email || !password || !confirmPassword) {
        errors.push({ msg: 'Please enter all fields' });
    }

    if (password !== confirmPassword) {
        errors.push({ msg: 'Passwords do not match' });
    }

    if (password && password.length < 6) {
        errors.push({ msg: 'Password must be at least 6 characters' });
    }

    if (errors.length > 0) {
        res.render('register', { errors, name, email, password, confirmPassword });
    } else {
        try {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                errors.push({ msg: 'Email already registered' });
                res.render('register', { errors, name, email, password, confirmPassword });
            } else {
                const newUser = new User({ name, email, password });
                await newUser.save();
                req.session.userId = newUser._id;
                req.session.user = { id: newUser._id, name: newUser.name, email: newUser.email };
                res.redirect('/chat');
            }
        } catch (err) {
            console.error(err);
            res.status(500).send('Server Error');
        }
    }
});

router.get('/login', (req, res) => {
    res.render('login', { errors: [], email: '', password: '' });
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    let errors = [];

    if (!email || !password) {
        errors.push({ msg: 'Please enter all fields' });
        return res.render('login', { errors, email, password });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            errors.push({ msg: 'Invalid credentials' });
            return res.render('login', { errors, email, password });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            errors.push({ msg: 'Invalid credentials' });
            return res.render('login', { errors, email, password });
        }

        req.session.userId = user._id;
        req.session.user = { id: user._id, name: user.name, email: user.email };
        res.redirect('/chat');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/chat');
        }
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

router.get('/', (req, res) => {
    if (req.session.userId) {
        res.redirect('/chat');
    } else {
        res.redirect('/login');
    }
});

module.exports = router;
