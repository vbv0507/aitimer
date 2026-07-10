const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: function() { return !this.googleId; } // Password is not required if using Google Auth
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    googleAccessToken: {
        type: String
    },
    googleRefreshToken: {
        type: String
    },
    workingHours: {
        start: { type: String, default: '09:00' },
        end: { type: String, default: '17:00' }
    },
    settings: {
        lunchBreakStart: { type: String, default: '12:00' },
        lunchBreakDuration: { type: Number, default: 60 }, // minutes
        bufferTime: { type: Number, default: 15 } // minutes between tasks
    }
}, { timestamps: true });

userSchema.pre('save', async function () {
    if (!this.isModified('password') || !this.password) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
