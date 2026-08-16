// Backend test setup
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.JWT_SECRET = 'test-secret';

// Increase timeout for integration tests
jest.setTimeout(30000);
