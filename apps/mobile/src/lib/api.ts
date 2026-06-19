/**
 * The app's data client. Backed by Firebase/Firestore (shared with the web app)
 * so both platforms read and write the same records in real time.
 *
 * Kept at this path so screens keep importing `{ api } from '../lib/api'`.
 */
export { api } from './firestore';
export type { Api } from './firestore';
