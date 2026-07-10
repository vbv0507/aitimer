const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    priority: {
        type: String,
        enum: ['Critical', 'High', 'Medium', 'Low'],
        default: 'Medium'
    },
    estimatedDuration: {
        type: Number, // in minutes
        required: true
    },
    deadline: {
        type: Date
    },
    category: {
        type: String,
        default: 'General'
    },
    actualFocusTime: {
        type: Number,
        default: 0
    },
    dependsOn: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task'
    },
    isRecurring: {
        type: Boolean,
        default: false
    },
    recurrencePattern: {
        type: String,
        enum: ['daily', 'weekly', 'none'],
        default: 'none'
    },
    recurrenceDays: [{
        type: Number // 0-6 (Sunday-Saturday)
    }],
    tags: [{
        type: String
    }],
    status: {
        type: String,
        enum: ['Pending', 'Running', 'Completed', 'Skipped', 'Delayed', 'Cancelled'],
        default: 'Pending'
    },
    timeSpent: {
        type: Number,
        default: 0 // minutes spent on this task
    }
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
