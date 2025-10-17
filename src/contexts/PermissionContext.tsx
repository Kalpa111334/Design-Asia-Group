import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';

export type ResourceType = 
  | 'dashboard'
  | 'tasks'
  | 'jobs'
  | 'chat'
  | 'petty_cash'
  | 'locations'
  | 'inventory'
  | 'geofences'
  | 'users'
  | 'reports'
  | 'permissions'
  | 'employee_tracking'
  | 'meet'
  | 'index';

// Permission Types:
// - 'no_access': User cannot access the page at all - will see "No Access" message
// - 'view_only': User can view everything but cannot make any changes
// - 'edit_only': User can both view and edit (create, update, delete)
export type PermissionType = 'view_only' | 'edit_only' | 'no_access';

export type UserRole = 'admin' | 'manager' | 'supervisor' | 'employee';

interface Permission {
  resource: ResourceType;
  permission: PermissionType;
}

interface PermissionContextType {
  permissions: Permission[];
  loading: boolean;
  hasPermission: (resource: ResourceType, requiredPermission: PermissionType) => boolean;
  canView: (resource: ResourceType) => boolean;
  canEdit: (resource: ResourceType) => boolean;
  hasAccess: (resource: ResourceType) => boolean;
  checkAccessAndNavigate: (resource: ResourceType) => boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
};

interface PermissionProviderProps {
  children: React.ReactNode;
}

export const PermissionProvider: React.FC<PermissionProviderProps> = ({ children }) => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchPermissions = async () => {
    if (!user?.id) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_user_permissions', {
        user_uuid: user.id
      });

      if (error) throw error;

      setPermissions(data || []);
    } catch (error: any) {
      console.error('Error fetching permissions:', error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshPermissions = async () => {
    setLoading(true);
    await fetchPermissions();
  };

  useEffect(() => {
    fetchPermissions();
  }, [user?.id]);

  const hasPermission = (resource: ResourceType, requiredPermission: PermissionType): boolean => {
    const userPermission = permissions.find(p => p.resource === resource);
    
    if (!userPermission) {
      return false;
    }

    // Permission hierarchy: no_access < view_only < edit_only
    // - no_access: Cannot access at all
    // - view_only: Can view but not edit
    // - edit_only: Can both view and edit
    switch (requiredPermission) {
      case 'view_only':
        return userPermission.permission === 'view_only' || userPermission.permission === 'edit_only';
      case 'edit_only':
        return userPermission.permission === 'edit_only';
      case 'no_access':
        return userPermission.permission === 'no_access';
      default:
        return false;
    }
  };

  const canView = (resource: ResourceType): boolean => {
    // Returns true if user can view (view_only or edit_only)
    return hasPermission(resource, 'view_only');
  };

  const canEdit = (resource: ResourceType): boolean => {
    // Returns true only if user has edit_only permission
    return hasPermission(resource, 'edit_only');
  };

  const hasAccess = (resource: ResourceType): boolean => {
    // Returns true if user has any access (not no_access)
    const userPermission = permissions.find(p => p.resource === resource);
    return userPermission ? userPermission.permission !== 'no_access' : false;
  };

  const checkAccessAndNavigate = (resource: ResourceType): boolean => {
    const userPermission = permissions.find(p => p.resource === resource);
    
    if (!userPermission || userPermission.permission === 'no_access') {
      // Show alert and navigate back
      setTimeout(() => {
        alert(`Access Denied: You do not have permission to access ${resource.replace('_', ' ')}.`);
        navigate(-1); // Go back to previous page
      }, 100);
      return false;
    }
    
    return true;
  };

  const value: PermissionContextType = {
    permissions,
    loading,
    hasPermission,
    canView,
    canEdit,
    hasAccess,
    checkAccessAndNavigate,
    refreshPermissions,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};
