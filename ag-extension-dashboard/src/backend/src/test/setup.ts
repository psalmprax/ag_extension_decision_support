// Backend test setup
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.JWT_SECRET = 'test-secret';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Polyfill mime methods for compatibility between Superagent (expects mime.getType) and Express (expects mime.charsets.lookup)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mime = require('mime');
  if (typeof mime.getType !== 'function') {
    mime.getType = (type: string) => (mime.lookup ? mime.lookup(type) : type);
  }
  if (typeof mime.getExtension !== 'function') {
    mime.getExtension = (type: string) => (mime.extension ? mime.extension(type) : null);
  }
  if (!mime.charsets) {
    mime.charsets = {
      lookup: (type: string) => (mime.charset ? mime.charset(type) : 'UTF-8'),
    };
  }
} catch {
  // Ignore if mime is unavailable
}
