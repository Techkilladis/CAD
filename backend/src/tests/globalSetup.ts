// Resets the TEST database (never the dev one) and applies all migrations once per jest run.
import path from 'path';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

export default async function globalSetup() {
  const root = path.resolve(__dirname, '../..');
  const parsed = dotenv.config({ path: path.join(root, '.env.test'), override: true }).parsed ?? {};
  const url = parsed.DATABASE_URL ?? process.env.DATABASE_URL ?? '';
  if (!/safehaven_test/.test(url)) {
    throw new Error('Refusing to reset: DATABASE_URL in .env.test must point at safehaven_test');
  }
  execSync('npx prisma migrate reset --force --skip-seed --skip-generate', {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
