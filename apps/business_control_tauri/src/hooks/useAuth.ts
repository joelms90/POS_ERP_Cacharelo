import { useAuthContext } from '../context/AuthContext';

export const useAuth = () => useAuthContext();
export type UseAuthResult = ReturnType<typeof useAuth>;
