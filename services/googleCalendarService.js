const { google } = require('googleapis');
const User = require('../models/User');
const Task = require('../models/Task');
const { generateDailySchedule } = require('./scheduler');

async function syncGoogleCalendarEvents(userId) {
    try {
        const user = await User.findById(userId);
        if (!user || !user.googleAccessToken) {
            throw new Error('User does not have Google Calendar connected');
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );

        oauth2Client.setCredentials({
            access_token: user.googleAccessToken,
            refresh_token: user.googleRefreshToken
        });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const res = await calendar.events.list({
            calendarId: 'primary',
            timeMin: startOfDay.toISOString(),
            timeMax: endOfDay.toISOString(),
            maxResults: 20,
            singleEvents: true,
            orderBy: 'startTime',
        });

        const events = res.data.items;
        if (!events || events.length === 0) {
            return { message: 'No upcoming events found today.' };
        }

        await Task.deleteMany({ userId: user._id, category: 'Google Calendar Meeting' });

        for (const event of events) {
            if (event.start.dateTime && event.end.dateTime) {
                const startTime = new Date(event.start.dateTime);
                const endTime = new Date(event.end.dateTime);
                const durationMins = Math.round((endTime - startTime) / (1000 * 60));

                await Task.create({
                    title: event.summary || 'Meeting',
                    description: 'Synced from Google Calendar',
                    priority: 'Critical', // Force meetings to be critical so they get scheduled
                    estimatedDuration: durationMins,
                    userId: user._id,
                    category: 'Google Calendar Meeting',
                    deadline: endTime
                });
            }
        }

        await generateDailySchedule(user._id, new Date());
        
        return { message: `Synced ${events.length} events successfully.` };
    } catch (error) {
        console.error('The API returned an error: ' + error);
        throw error;
    }
}

module.exports = {
    syncGoogleCalendarEvents
};
