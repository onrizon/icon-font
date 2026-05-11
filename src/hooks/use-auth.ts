export interface AuthUser {
  id: string;
}

export function useAuth(): { user: AuthUser | null; loading: boolean } {
  return { user: { id: 'stub' }, loading: false };
}
