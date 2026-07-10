const Task = require('../models/Task');
const { generateDailySchedule } = require('../services/scheduler');

const createTask = async (req, res) => {
    try {
        const { title, description, priority, estimatedDuration, deadline, category, tags, dependsOn, isRecurring, recurrencePattern, recurrenceDays } = req.body;
        
        const task = await Task.create({
            title,
            description,
            priority,
            estimatedDuration,
            deadline,
            category,
            tags: tags ? tags.split(',').map(t => t.trim()) : [],
            dependsOn,
            isRecurring,
            recurrencePattern,
            recurrenceDays,
            userId: req.user._id
        });

        await generateDailySchedule(req.user._id, new Date());

        res.status(201).json(task);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const updateTaskStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const task = await Task.findById(req.params.id);
        
        if (!task || task.userId.toString() !== req.user._id.toString()) {
            return res.status(404).json({ message: 'Task not found' });
        }

        task.status = status;
        await task.save();

        await generateDailySchedule(req.user._id, new Date());

        res.json(task);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const delayTask = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task || task.userId.toString() !== req.user._id.toString()) {
            return res.status(404).json({ message: 'Task not found' });
        }

        task.status = 'Delayed';
        await task.save();

        await generateDailySchedule(req.user._id, new Date());
        res.json({ success: true, message: 'Task delayed and schedule recalculated.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const { parseTaskFromText } = require('../services/aiService');

const createChatbotTask = async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ message: 'No text provided' });

        const taskData = await parseTaskFromText(text);

        const task = await Task.create({
            title: taskData.title,
            description: 'Generated via AI Chatbot',
            priority: taskData.priority,
            estimatedDuration: taskData.estimatedDuration,
            userId: req.user._id,
            category: 'General'
        });

        await generateDailySchedule(req.user._id, new Date());
        res.json({ success: true, task });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const { syncGoogleCalendarEvents } = require('../services/googleCalendarService');

const syncCalendar = async (req, res) => {
    try {
        const result = await syncGoogleCalendarEvents(req.user._id);
        res.json({ success: true, message: result.message });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const logFocusTime = async (req, res) => {
    try {
        const task = await Task.findOne({ _id: req.params.id, userId: req.user._id });
        if (!task) return res.status(404).json({ message: 'Task not found' });
        
        const focusMins = parseInt(req.body.minutes) || 0;
        
        if (task.actualFocusTime === undefined) {
            task.actualFocusTime = 0;
        }
        task.actualFocusTime += focusMins;
        await task.save();
        
        res.json({ success: true, message: 'Focus time logged' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteTask = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task || task.userId.toString() !== req.user._id.toString()) {
            return res.status(404).json({ message: 'Task not found' });
        }
        await Task.deleteOne({ _id: req.params.id });
        await generateDailySchedule(req.user._id, new Date());
        res.json({ success: true, message: 'Task deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createTask,
    updateTaskStatus,
    delayTask,
    createChatbotTask,
    syncCalendar,
    logFocusTime,
    deleteTask
};
