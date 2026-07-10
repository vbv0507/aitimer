const Task = require('../models/Task');
const Schedule = require('../models/Schedule');
const User = require('../models/User');
const { parse, addMinutes, isBefore, isAfter, setHours, setMinutes, format } = require('date-fns');

const { agenticScheduleGeneration } = require('./aiService');

async function generateDailySchedule(userId, dateStr) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const baseDate = new Date(dateStr); // Today's date
    const dayOfWeek = baseDate.getDay(); // 0-6

    const recurringTasks = await Task.find({
        userId,
        isRecurring: true,
        recurrenceDays: dayOfWeek
    });

    const todayStart = setHours(setMinutes(baseDate, 0), 0);
    const todayEnd = setHours(setMinutes(baseDate, 59), 23);

    for (const rTask of recurringTasks) {
        const existingChild = await Task.findOne({
            userId,
            title: rTask.title,
            isRecurring: false,
            createdAt: { $gte: todayStart, $lte: todayEnd }
        });

        if (!existingChild) {
            await Task.create({
                userId: rTask.userId,
                title: rTask.title,
                estimatedDuration: rTask.estimatedDuration,
                priority: rTask.priority,
                category: rTask.category,
                isRecurring: false
            });
        }
    }

    let tasks = await Task.find({ 
        userId, 
        status: { $in: ['Pending', 'Delayed'] },
        isRecurring: false // Don't schedule the parent recurring template itself
    }).sort({ createdAt: 1 });

    const aiTimeline = await agenticScheduleGeneration(tasks, user.settings, baseDate);
    
    let timeline = [];
    
    if (aiTimeline && Array.isArray(aiTimeline)) {
        timeline = aiTimeline;
    } else {
        console.error("AI returned null schedule. Using empty schedule fallback.");
    }

    const scheduleDate = setHours(setMinutes(baseDate, 0), 0);
    
    let schedule = await Schedule.findOne({ userId, date: scheduleDate });
    if (schedule) {
        schedule.timeline = timeline;
        await schedule.save();
    } else {
        schedule = await Schedule.create({
            userId,
            date: scheduleDate,
            timeline
        });
    }

    return schedule;
}

module.exports = {
    generateDailySchedule
};
