const Task = require('../models/Task');
const Schedule = require('../models/Schedule');
const User = require('../models/User');
const { parse, addMinutes, isBefore, isAfter, setHours, setMinutes, format } = require('date-fns');

const priorityWeights = {
    'Critical': 4,
    'High': 3,
    'Medium': 2,
    'Low': 1
};

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

    tasks.sort((a, b) => {
        if (priorityWeights[a.priority] !== priorityWeights[b.priority]) {
            return priorityWeights[b.priority] - priorityWeights[a.priority];
        }
        if (a.deadline && b.deadline) {
            return new Date(a.deadline) - new Date(b.deadline);
        }
        if (a.deadline) return -1;
        if (b.deadline) return 1;
        
        return a.estimatedDuration - b.estimatedDuration;
    });

    const taskMap = new Map();
    tasks.forEach(t => taskMap.set(t._id.toString(), t));
    
    const sortedTasks = [];
    const visited = new Set();
    const visiting = new Set();

    function visit(task) {
        if (!task) return;
        const id = task._id.toString();
        if (visited.has(id)) return;
        if (visiting.has(id)) return; // Ignore circular dependencies
        
        visiting.add(id);
        
        if (task.dependsOn) {
            const depTask = taskMap.get(task.dependsOn.toString());
            if (depTask) visit(depTask);
        }
        
        visiting.delete(id);
        visited.add(id);
        sortedTasks.push(task);
    }

    tasks.forEach(t => visit(t));
    tasks = sortedTasks;

    const timeline = [];

    const startHourStr = user.workingHours.start || '09:00';
    const endHourStr = user.workingHours.end || '17:00';
    
    let currentTime = setMinutes(setHours(baseDate, parseInt(startHourStr.split(':')[0])), parseInt(startHourStr.split(':')[1]));
    const endTime = setMinutes(setHours(baseDate, parseInt(endHourStr.split(':')[0])), parseInt(endHourStr.split(':')[1]));

    const lunchStartStr = user.settings.lunchBreakStart || '12:00';
    const lunchStart = setMinutes(setHours(baseDate, parseInt(lunchStartStr.split(':')[0])), parseInt(lunchStartStr.split(':')[1]));
    const lunchEnd = addMinutes(lunchStart, user.settings.lunchBreakDuration || 60);
    const buffer = user.settings.bufferTime || 15;

    let lunchAdded = false;

    for (let task of tasks) {
        if (!lunchAdded && isAfter(currentTime, lunchStart) || (isBefore(currentTime, lunchStart) && isAfter(addMinutes(currentTime, task.estimatedDuration), lunchStart))) {
            timeline.push({
                title: 'Lunch Break',
                startTime: lunchStart,
                endTime: lunchEnd,
                type: 'Lunch'
            });
            currentTime = lunchEnd;
            lunchAdded = true;
        }

        const taskEndTime = addMinutes(currentTime, task.estimatedDuration);
        
        if (isAfter(taskEndTime, endTime)) {
            break; 
        }

        timeline.push({
            taskId: task._id,
            title: task.title,
            startTime: currentTime,
            endTime: taskEndTime,
            type: 'Task'
        });

        currentTime = addMinutes(taskEndTime, buffer);
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
