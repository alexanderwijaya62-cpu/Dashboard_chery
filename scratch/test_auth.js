import { validateSession } from '../api/auth.js';

console.log('Successfully imported validateSession');
try {
  await validateSession({ headers: {} });
} catch (e) {
  console.log('Expected error:', e.message);
}
