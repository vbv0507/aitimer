const mongoose = require('mongoose');

const scheduleItemSchema = new mongoose.Schema({
    taskId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task'
    },
    title: String,
    startTime: Date,
    endTime: Date,
    type: {
        type: String,
        enum: ['Task', 'Break', 'Lunch'],
        default: 'Task'
    }
});

const scheduleSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    date: {
        type: Date, // The day this schedule applies to (e.g., 2023-10-25 00:00:00)
        required: true
    },
    timeline: [scheduleItemSchema]
}, { timestamps: true });

scheduleSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Schedule', scheduleSchema);
