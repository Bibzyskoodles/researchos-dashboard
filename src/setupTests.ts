// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// TextEncoder/TextDecoder are standard in every browser and in Node, but the
// jsdom version CRA's jest pins predates them, so anything importing
// react-router v7 blew up at import time with "TextEncoder is not defined" —
// which is why App.test.tsx could not even start. Node's own implementation is
// the same one the browser exposes; this only fills the gap in the test
// environment and is not shipped.
import { TextEncoder, TextDecoder } from 'util';

const g = globalThis as unknown as Record<string, unknown>;
if (typeof g.TextEncoder === 'undefined') g.TextEncoder = TextEncoder;
if (typeof g.TextDecoder === 'undefined') g.TextDecoder = TextDecoder;
