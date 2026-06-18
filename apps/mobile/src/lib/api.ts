/** A single shared ApiClient instance, pointed at the resolved backend URL. */
import { ApiClient } from '@concierge/shared';
import { API_URL } from '../config';

export const api = new ApiClient(API_URL);
