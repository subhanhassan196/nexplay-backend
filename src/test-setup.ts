/**
 * Test environment setup. Provides the minimum env vars the config
 * modules validate at import time, so unit tests can import code that
 * transitively pulls in `@/config/env` without a real .env file.
 * These are throwaway values — no test touches a real service.
 */
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.JWT_ACCESS_SECRET = "test-access-secret-at-least-32-characters-long";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-at-least-32-characters-long";
process.env.CLIENT_URL = "http://localhost:3000";
process.env.API_URL = "http://localhost:5000";
process.env.PORT = "5000";
