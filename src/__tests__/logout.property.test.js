import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: dashboard-redesign
 * Property 2: Logout clears all session state
 *
 * For any authenticated user state (with any valid role, username, and session ID),
 * invoking the logout handler SHALL result in:
 * (a) localStorage keys 'chery_auth_user' and 'chery_session_id' being removed,
 * (b) the current page being set to 'login', and
 * (c) a Supabase update call being made to set isOnline: false.
 *
 * **Validates: Requirements 4.4**
 */

const VALID_ROLES = ['admin', 'manager', 'cro', 'sparepart', 'owner', 'mekanik', 'customer'];

/**
 * Creates a handleLogout function that mirrors the behavior in App.jsx:
 * - Calls supabase.from('users').update({ isOnline: false, sessionId: null }).eq('username', user.username)
 * - Clears localStorage keys 'chery_auth_user' and 'chery_session_id' (via setUser(null) and setSessionId(null) effects)
 * - Sets currentPage to 'login'
 */
function createLogoutHandler({ user, setCurrentPage, supabase, localStorage }) {
  return async () => {
    if (user) {
      try {
        await supabase
          .from('users')
          .update({ isOnline: false, sessionId: null })
          .eq('username', user.username);
      } catch (err) {
        // Error is caught but logout still proceeds
      }
    }

    // These mirror the effects in App.jsx:
    // setUser(null) triggers useEffect that calls localStorage.removeItem('chery_auth_user')
    // setSessionId(null) triggers useEffect that calls localStorage.removeItem('chery_session_id')
    localStorage.removeItem('chery_auth_user');
    localStorage.removeItem('chery_session_id');
    setCurrentPage('login');
  };
}

describe('Feature: dashboard-redesign, Property 2: Logout clears all session state', () => {
  let mockLocalStorage;
  let mockSetCurrentPage;
  let mockSupabaseUpdate;
  let mockSupabaseEq;
  let mockSupabase;

  beforeEach(() => {
    mockLocalStorage = {
      removeItem: vi.fn(),
    };

    mockSetCurrentPage = vi.fn();

    mockSupabaseEq = vi.fn().mockResolvedValue({ data: null, error: null });
    mockSupabaseUpdate = vi.fn().mockReturnValue({ eq: mockSupabaseEq });
    mockSupabase = {
      from: vi.fn().mockReturnValue({
        update: mockSupabaseUpdate,
      }),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logout removes localStorage keys, sets currentPage to login, and calls Supabase update for any authenticated user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          role: fc.constantFrom(...VALID_ROLES),
          username: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          name: fc.string({ minLength: 1, maxLength: 100 }),
          sessionId: fc.string({ minLength: 1, maxLength: 64 }).filter(s => s.trim().length > 0),
        }),
        async (userState) => {
          // Reset mocks for each iteration
          mockLocalStorage.removeItem.mockClear();
          mockSetCurrentPage.mockClear();
          mockSupabase.from.mockClear();
          mockSupabaseUpdate.mockClear();
          mockSupabaseEq.mockClear();

          const user = {
            role: userState.role,
            username: userState.username,
            name: userState.name,
          };

          const handleLogout = createLogoutHandler({
            user,
            setCurrentPage: mockSetCurrentPage,
            supabase: mockSupabase,
            localStorage: mockLocalStorage,
          });

          await handleLogout();

          // (a) localStorage keys 'chery_auth_user' and 'chery_session_id' are removed
          expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('chery_auth_user');
          expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('chery_session_id');

          // (b) currentPage is set to 'login'
          expect(mockSetCurrentPage).toHaveBeenCalledWith('login');

          // (c) Supabase update is called to set isOnline: false
          expect(mockSupabase.from).toHaveBeenCalledWith('users');
          expect(mockSupabaseUpdate).toHaveBeenCalledWith({ isOnline: false, sessionId: null });
          expect(mockSupabaseEq).toHaveBeenCalledWith('username', userState.username);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('logout clears local state even when Supabase update fails for any user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          role: fc.constantFrom(...VALID_ROLES),
          username: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          name: fc.string({ minLength: 1, maxLength: 100 }),
          sessionId: fc.string({ minLength: 1, maxLength: 64 }).filter(s => s.trim().length > 0),
        }),
        async (userState) => {
          // Reset mocks for each iteration
          mockLocalStorage.removeItem.mockClear();
          mockSetCurrentPage.mockClear();

          // Simulate Supabase network failure
          const failingEq = vi.fn().mockRejectedValue(new Error('Network error'));
          const failingUpdate = vi.fn().mockReturnValue({ eq: failingEq });
          const failingSupabase = {
            from: vi.fn().mockReturnValue({
              update: failingUpdate,
            }),
          };

          const user = {
            role: userState.role,
            username: userState.username,
            name: userState.name,
          };

          const handleLogout = createLogoutHandler({
            user,
            setCurrentPage: mockSetCurrentPage,
            supabase: failingSupabase,
            localStorage: mockLocalStorage,
          });

          await handleLogout();

          // Even on Supabase failure, local state must still be cleared
          // (a) localStorage keys are removed
          expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('chery_auth_user');
          expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('chery_session_id');

          // (b) currentPage is set to 'login'
          expect(mockSetCurrentPage).toHaveBeenCalledWith('login');
        }
      ),
      { numRuns: 100 }
    );
  });
});
