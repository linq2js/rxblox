import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { enableMapSet } from 'immer';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Enable Immer plugins for tests
enableMapSet();

// Cleanup after each test
afterEach(() => {
  cleanup();
});

