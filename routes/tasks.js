const express = require('express');
const router = express.Router();
const { createTask, updateTaskStatus, delayTask, createChatbotTask, syncCalendar, logFocusTime, deleteTask } = require('../controllers/taskController');
const { protect } = require('../middleware/auth');

router.post('/', protect, createTask);
router.post('/chatbot', protect, createChatbotTask);
router.post('/sync-calendar', protect, syncCalendar);
router.put('/:id/status', protect, updateTaskStatus);
router.post('/:id/delay', protect, delayTask);
router.post('/:id/focus', protect, logFocusTime);
router.delete('/:id', protect, deleteTask);

module.exports = router;
