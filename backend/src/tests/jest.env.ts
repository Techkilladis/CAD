// Loaded by jest `setupFiles`: forces the test database before Prisma is imported.
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true });
process.env.NODE_ENV = 'test';
if (!/safehaven_test/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('Refusing to run tests: DATABASE_URL must point at safehaven_test');
}
