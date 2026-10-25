/**
 * Minimal structured logger. Production writes one JSON object per line to stdout/stderr, which any
 * container log collector (CloudWatch, etc.) can index without a parser. Development prints readable lines.
 * Silent under NODE_ENV=test.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';
type Fields = Record<string, unknown>;

function serializeError(err: unknown): unknown {
  if (err instanceof Error) return { name: err.name, message: err.message, stack: err.stack };
  return err;
}

function write(level: Level, msg: string, fields: Fields = {}) {
  if (process.env.NODE_ENV === 'test') return;
  if (level === 'debug' && process.env.LOG_LEVEL !== 'debug') return;
  const data: Fields = {};
  for (const [k, v] of Object.entries(fields)) data[k] = k === 'err' ? serializeError(v) : v;
  const out = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  if (process.env.NODE_ENV === 'production') {
    out.write(JSON.stringify({ time: new Date().toISOString(), level, msg, ...data }) + '\n');
  } else {
    const extra = Object.keys(data).length ? ' ' + JSON.stringify(data) : '';
    out.write(`[${level}] ${msg}${extra}\n`);
  }
}

export const logger = {
  debug: (msg: string, fields?: Fields) => write('debug', msg, fields),
  info: (msg: string, fields?: Fields) => write('info', msg, fields),
  warn: (msg: string, fields?: Fields) => write('warn', msg, fields),
  error: (msg: string, fields?: Fields) => write('error', msg, fields),
};
