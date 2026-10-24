import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import shelterRoutes from './routes/shelter.routes';
import transferRoutes from './routes/transfer.routes';
import dashboardRoutes from './routes/dashboard.routes';
import authRoutes from './routes/auth.routes';
import { errorHandler } from './middleware/error.middleware';
import { startAlertScheduler } from './integrations/alertScheduler';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

import alertRoutes from './routes/alert.routes';
import volunteerRoutes from './routes/volunteer.routes';
import reunificationRoutes from './routes/reunification.routes';

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/shelters', shelterRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/volunteers', volunteerRoutes);
app.use('/api/reunification', reunificationRoutes);

// Error handling middleware
app.use(errorHandler);

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    const interval = Number(process.env.ALERT_SCAN_INTERVAL_MS);
    if (startAlertScheduler({ intervalMs: interval })) console.log(`Alert scheduler started (every ${interval} ms)`);
  });
}

export default app;
