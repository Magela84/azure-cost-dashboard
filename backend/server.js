// Azure Cost Visibility Dashboard - Express server entry point
// NOTE: Scaffold only. Business logic is intentionally not implemented yet.

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const costsRouter = require('./routes/costs');
const alertsRouter = require('./routes/alerts');
const logicAppsRouter = require('./routes/logicapps');
const analystRouter = require('./routes/analyst');
const idleRouter = require('./routes/idle');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API routes
app.use('/api/costs', costsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/logicapps', logicAppsRouter);
app.use('/api/analyst', analystRouter);
app.use('/api/idle', idleRouter);

// Central error handler — must be registered after routes.
app.use(errorHandler);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Azure Cost Dashboard backend listening on port ${PORT}`);
});

module.exports = app;
