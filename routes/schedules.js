const express = require('express');
const router = express.Router();
const Schedule = require('../models/Schedule');
const { protect } = require('../middleware/auth');

router.get('/', protect, async (req, res) => {
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const schedule = await Schedule.findOne({ userId: req.user._id, date: startOfDay });
        
        let events = [];
        if (schedule && schedule.timeline) {
            events = schedule.timeline.map(item => ({
                id: item._id,
                title: item.title,
                start: item.startTime,
                end: item.endTime,
                color: item.type === 'Lunch' ? '#eab308' : '#6366f1', // Yellow or Indigo
                extendedProps: {
                    type: item.type,
                    taskId: item.taskId
                }
            }));
        }

        res.json(events);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
