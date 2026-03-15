import { Navigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { user, setUser } = useAppStore();

    // Check if user is logged in - first check store, then check localStorage
    if (!user) {
        // Check localStorage for persisted user
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('token');

        if (storedUser && token) {
            // Restore user from localStorage
            try {
                const parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);
                return <>{children}</>;
            } catch (e) {
                // Invalid JSON, redirect to login
                return <Navigate to="/login" replace />;
            }
        }

        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}

export default ProtectedRoute;
