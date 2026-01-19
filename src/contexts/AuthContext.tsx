import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, User } from '@/lib/supabase';


interface AuthContextType {
  user: User | null;
  loginAsUser: (username: 'Sr' | 'Iasm') => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Fixed user data
const USERS = {
  Sr: {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'sr@chat.com',
    username: 'Sr',
    created_at: new Date().toISOString(),
    last_seen: new Date().toISOString(),
    is_online: true,
  },
  Iasm: {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'iasm@chat.com',
    username: 'Iasm',
    created_at: new Date().toISOString(),
    last_seen: new Date().toISOString(),
    is_online: true,
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  

  useEffect(() => {
    // Check if user is stored in localStorage with permanent storage
    const storedUser = localStorage.getItem('chatapp_user');
    const storedTimestamp = localStorage.getItem('chatapp_user_timestamp');
    
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        
        // Validate that the stored user is one of our valid users
        if (userData.username === 'Sr' || userData.username === 'Iasm') {
          setUser(userData);
          updateUserStatus(userData.id, true);
          
          // Update timestamp to show last access
          localStorage.setItem('chatapp_user_timestamp', new Date().toISOString());
        } else {
          // Invalid user data, clear storage
          localStorage.removeItem('chatapp_user');
          localStorage.removeItem('chatapp_user_timestamp');
        }
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        localStorage.removeItem('chatapp_user');
        localStorage.removeItem('chatapp_user_timestamp');
      }
    }
    setLoading(false);
  }, []);

  const updateUserStatus = async (userId: string, isOnline: boolean) => {
    try {
      await supabase
        .from('users')
        .upsert({
          id: userId,
          email: userId === USERS.Sr.id ? USERS.Sr.email : USERS.Iasm.email,
          username: userId === USERS.Sr.id ? USERS.Sr.username : USERS.Iasm.username,
          created_at: new Date().toISOString(),
          last_seen: new Date().toISOString(),
          is_online: isOnline,
        });
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  const loginAsUser = async (username: 'Sr' | 'Iasm') => {
    try {
      setLoading(true);
      const userData = USERS[username];
      
      // Update user status in database
      await updateUserStatus(userData.id, true);
      
      // Store user permanently in localStorage with timestamp
      setUser(userData);
      localStorage.setItem('chatapp_user', JSON.stringify(userData));
      localStorage.setItem('chatapp_user_timestamp', new Date().toISOString());
      
      // Also store user preference separately for extra persistence
      localStorage.setItem('chatapp_preferred_user', username);

      console.log(`Bem-vindo, ${username}!`);
    } catch (error: any) {
      console.error("Erro no login:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (user) {
        // Deactivate push subscription before logout
        try {
          await supabase.functions.invoke('push-notification/unregister', {
            body: { userId: user.id }
          });
          console.log('🔕 Push subscription deactivated');
        } catch (error) {
          console.error('Error deactivating push subscription:', error);
        }

        // Update user status to offline
        await updateUserStatus(user.id, false);
      }

      setUser(null);
      // Remove all stored user data
      localStorage.removeItem('chatapp_user');
      localStorage.removeItem('chatapp_user_timestamp');
      localStorage.removeItem('chatapp_preferred_user');

      console.log("Logout realizado - Dados do usuário removidos");
    } catch (error: any) {
      console.error("Erro no logout:", error);
    }
  };

  const value = {
    user,
    loginAsUser,
    logout,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};