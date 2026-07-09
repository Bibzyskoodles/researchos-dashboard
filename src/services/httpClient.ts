/**
 * httpClient — thin wrapper re-exporting the default axios instance from api.ts
 * so that components can import `{ httpClient }` from this module.
 */
import api from './api';

export const httpClient = api;
export default api;
