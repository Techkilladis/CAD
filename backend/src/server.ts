import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import shelterRoutes from './routes/shelter.routes';
import transferRoutes from './routes/transfer.routes';
import dashboardRoutes from './routes/dashboard.routes';
import authRoutes from './routes/auth.routes';
import alertRoutes from './routes/alert.routes';
import volunteerRoutes from './routes/volunteer.routes';
import reunificationRoutes from './routes/reunification.routes';
import donationRoutes from './routes/donation.routes';
import { auditRouter, settingsRouter, usersRouter } from './routes/admin.routes';
import { errorHandler } from './middleware/error.middleware';
import { startAlertScheduler } from './integrations/alertScheduler';
import { getSettings } from './services/settings.service';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/shelters', shelterRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/volunteers', volunteerRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/reunification', reunificationRoutes);
app.use('/api/audit', auditRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/users', usersRouter);

app.use(errorHandler);

if (require.main === module) {
  app.listen(port, async () => {
    console.log(`Server is running on port ${port}`);
    // Interval comes from ALERT_SCAN_INTERVAL_MS, else the saved setting (0 = off). Never starts under test.
    let interval = Number(process.env.ALERT_SCAN_INTERVAL_MS);
    if (!Number.isFinite(interval) || interval <= 0) {
      try {
        interval = (await getSettings()).alertScanIntervalMs;
      } catch {
        interval = 0;
      }
    }
    if (startAlertScheduler({ intervalMs: interval })) console.log(`Alert scheduler started (every ${interval} ms)`);
  });
}

export default app;
