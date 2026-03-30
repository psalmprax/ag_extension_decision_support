import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend expect with jest-dom matchers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
expect.extend(matchers as any);

// Reset any states between tests
afterEach(() => {
    cleanup();
});
