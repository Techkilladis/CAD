import request from 'supertest';
import app from '../server';
import { corsOrigins, loadEnv } from '../config/env';

describe('platform hardening', () => {
  it('liveness and readiness checks respond', async () => {
    await request(app).get('/api/health').expect(200, { status: 'ok' });
    await request(app).get('/api/health/ready').expect(200, { status: 'ready' });
  });

  it('generates a request id, or reuses a valid upstream one', async () => {
    const generated = await request(app).get('/api/health');
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

    const reused = await request(app).get('/api/health').set('x-request-id', 'lb-trace.123');
    expect(reused.headers['x-request-id']).toBe('lb-trace.123');

    const rejected = await request(app).get('/api/health').set('x-request-id', 'bad id with spaces');
    expect(rejected.headers['x-request-id']).not.toBe('bad id with spaces');
  });

  it('sets baseline security headers and hides the framework', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('returns JSON 404 for unknown API paths', async () => {
    const res = await request(app).get('/api/does-not-exist').expect(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});

describe('environment config', () => {
  it('applies defaults', () => {
    const env = loadEnv({ NODE_ENV: 'development' });
    expect(env.PORT).toBe(5000);
    expect(env.ALERT_SCHEDULER_ENABLED).toBe(true);
    expect(corsOrigins(env)).toBe(true);
  });

  it('parses flags and origin lists', () => {
    const env = loadEnv({ NODE_ENV: 'development', ALERT_SCHEDULER_ENABLED: 'false', CORS_ORIGIN: 'https://a.example, https://b.example', PORT: '8080' });
    expect(env.ALERT_SCHEDULER_ENABLED).toBe(false);
    expect(env.PORT).toBe(8080);
    expect(corsOrigins(env)).toEqual(['https://a.example', 'https://b.example']);
  });

  it('rejects invalid values and requires DATABASE_URL in production', () => {
    expect(() => loadEnv({ NODE_ENV: 'development', PORT: 'abc' })).toThrow(/PORT/);
    expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://x' })).not.toThrow();
  });
});
