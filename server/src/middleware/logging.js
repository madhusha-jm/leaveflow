// Structured logs: one JSON object per line, so a log search can filter on fields
// ({ $.res.statusCode = 401 }) instead of grepping text. `npm run dev` pipes them
// through pino-pretty to stay readable on your laptop; production keeps raw JSON.
const crypto = require('crypto');
const pino = require('pino');
const pinoHttp = require('pino-http');

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
});

const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const id = crypto.randomUUID();
    res.setHeader('X-Request-Id', id); // quote it in a bug report → find its log lines
    return id;
  },
  serializers: { res: (res) => ({ statusCode: res.statusCode }) }, // skip the header noise
  redact: ['req.headers.authorization', 'req.headers.cookie'], // JWTs never reach the logs
  customLogLevel: (req, res, err) =>
    err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
});

module.exports = { logger, httpLogger };
