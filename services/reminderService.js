const cron = require('node-cron');
const Schedule = require('../models/Schedule');
const { differenceInMinutes } = require('date-fns');

function init(io) {
    cron.schedule('* * * * *', async () => {
        try {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const schedules = await Schedule.find({ date: startOfDay }).populate('timeline.taskId');
            const now = new Date();

            schedules.forEach(schedule => {
                schedule.timeline.forEach(item => {
                    if (item.type === 'Task' && item.taskId && item.taskId.status !== 'Completed') {
                        const minsUntil = differenceInMinutes(new Date(item.startTime), now);

                        let reminderMessage = null;
                        if (minsUntil === 15) {
                            reminderMessage = `Reminder: "${item.title}" starts in 15 minutes!`;
                        } else if (minsUntil === 5) {
                            reminderMessage = `Get ready: "${item.title}" starts in 5 minutes!`;
                        } else if (minsUntil === 0) {
                            reminderMessage = `Time to start: "${item.title}"!`;
                        }

                        if (reminderMessage) {
                            io.emit('reminder', { 
                                message: reminderMessage, 
                                userId: schedule.userId,
                                taskId: item.taskId._id || item.taskId,
                                title: item.title
                            });
                        }
                    }
                });
            });
        } catch (error) {
            console.error('Error in reminder cron:', error);
        }
    });

    console.log('Reminder service initialized');
}

module.exports = { init };
