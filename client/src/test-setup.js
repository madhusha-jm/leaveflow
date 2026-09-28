// Adds matchers like toBeDisabled() / toBeInTheDocument(), and unmounts
// each test's component afterwards so tests can't see each other's DOM.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());
