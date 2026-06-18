/** Express application entry point. */
import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import './db.js'; // side effect: open DB + create schema
import { authRouter } from './routes/auth.js';
import { broadcastRouter } from './routes/broadcast.js';
import { conciergeRouter } from './routes/concierge.js';
import { messagesRouter } from './routes/messages.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/auth', authRouter);
app.use('/broadcast', broadcastRouter);
app.use('/user/messages', messagesRouter);
app.use('/concierge', conciergeRouter);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Central error handler — keeps thrown errors from crashing the process.
app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  },
);

app.listen(config.port, () => {
  console.log(`Mobile Concierge API listening on http://localhost:${config.port}`);
});
