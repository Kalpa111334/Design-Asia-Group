import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface UserRole {
  role: 'admin' | 'manager' | 'supervisor' | 'employee';
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isManager: boolean;
  isSupervisor: boolean;
  isEmployee: boolean;
  userRole: string | null;
  userRoles: UserRole[];
  getDashboardRoute: (userRole: string | null) => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [isEmployee, setIsEmployee] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Check user role when session changes
        if (session?.user) {
          setTimeout(() => {
            checkUserRole(session.user.id);
          }, 0);
        } else {
          setIsAdmin(false);
          setIsManager(false);
          setIsSupervisor(false);
          setIsEmployee(false);
          setUserRole(null);
          setUserRoles([]);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkUserRole(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUserRole = async (userId: string) => {
    try {
      console.log('Checking user role for userId:', userId);
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      console.log('User roles query result:', { data, error });

      if (!error && data) {
        const roles = data as UserRole[];
        console.log('User roles found:', roles);
        setUserRoles(roles);
        
        // Set individual role flags
        const adminRole = roles.some(r => r.role === 'admin');
        const managerRole = roles.some(r => r.role === 'manager');
        const supervisorRole = roles.some(r => r.role === 'supervisor');
        const employeeRole = roles.some(r => r.role === 'employee');
        
        console.log('Role flags:', { adminRole, managerRole, supervisorRole, employeeRole });
        
        setIsAdmin(adminRole);
        setIsManager(managerRole);
        setIsSupervisor(supervisorRole);
        setIsEmployee(employeeRole);
        
        // Set primary role (highest priority)
        if (adminRole) {
          setUserRole('admin');
        } else if (managerRole) {
          setUserRole('manager');
        } else if (supervisorRole) {
          setUserRole('supervisor');
        } else if (employeeRole) {
          setUserRole('employee');
        } else {
          setUserRole(null);
        }
      } else {
        console.log('No user roles found or error:', error);
        // If no roles found, check if this is the first user and make them admin
        const { data: userCount } = await supabase
          .from('user_roles')
          .select('id', { count: 'exact', head: true });
        
        if (userCount === 0 || (userCount === null && !error)) {
          console.log('First user detected, creating admin role');
          // This is the first user, make them admin
          const { error: insertError } = await supabase
            .from('user_roles')
            .insert([{ user_id: userId, role: 'admin' }]);
          
          if (!insertError) {
            console.log('Admin role created successfully');
            setIsAdmin(true);
            setIsManager(false);
            setIsSupervisor(false);
            setIsEmployee(false);
            setUserRole('admin');
            setUserRoles([{ role: 'admin' }]);
          } else {
            console.error('Error creating admin role:', insertError);
            setIsAdmin(false);
            setIsManager(false);
            setIsSupervisor(false);
            setIsEmployee(false);
            setUserRole(null);
            setUserRoles([]);
          }
        } else {
          setIsAdmin(false);
          setIsManager(false);
          setIsSupervisor(false);
          setIsEmployee(false);
          setUserRole(null);
          setUserRoles([]);
        }
      }
    } catch (error) {
      console.error('Error checking user role:', error);
      setIsAdmin(false);
      setIsManager(false);
      setIsSupervisor(false);
      setIsEmployee(false);
      setUserRole(null);
      setUserRoles([]);
    }
  };

  const getDashboardRoute = (userRole: string | null): string => {
    switch (userRole) {
      case 'admin':
        return '/dashboard/admin';
      case 'manager':
        return '/dashboard/manager';
      case 'supervisor':
        return '/dashboard/supervisor';
      case 'employee':
        return '/dashboard/employee';
      default:
        return '/dashboard';
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (!error) {
      // Check user role first, then redirect to appropriate dashboard
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await checkUserRole(user.id);
        // Use a small delay to ensure role is set before navigation
        setTimeout(() => {
          navigate(getDashboardRoute(userRole));
        }, 100);
      } else {
        navigate('/dashboard');
      }
    }
    
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        // No emailRedirectTo - email will be auto-confirmed by database trigger
      },
    });

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setIsManager(false);
    setIsSupervisor(false);
    setIsEmployee(false);
    setUserRole(null);
    setUserRoles([]);
    navigate('/auth');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        isAdmin,
        isManager,
        isSupervisor,
        isEmployee,
        userRole,
        userRoles,
        getDashboardRoute,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
