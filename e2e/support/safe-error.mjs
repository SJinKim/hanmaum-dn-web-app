/**
 * The only error the suite lets out of a flow. Its message is a fixed code such as
 * `E2E_MISSING:guide-year`, never the original Playwright error, which can quote
 * locators, page text or call logs. There is deliberately no `cause`.
 */
export class SafeError extends Error {
  constructor(code) {
    super(code);
    this.name = 'SafeError';
  }
}

const CODE = /E2E_[A-Z0-9_]+(?::[a-z0-9-]+)?/;

/** The fixed code inside a reported error message, or `E2E_UNEXPECTED` for anything else. */
export function safeCode(message) {
  return (typeof message === 'string' && message.match(CODE)?.[0]) || 'E2E_UNEXPECTED';
}
