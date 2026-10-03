export function isDatabaseEnabled() {
  return process.env.DATABASE_MODE === 'postgres' && Boolean(process.env.DATABASE_URL);
}
