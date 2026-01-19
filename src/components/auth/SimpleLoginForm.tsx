import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, User } from 'lucide-react';

export const SimpleLoginForm: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { loginAsUser } = useAuth();
  
  // Check if there's a preferred user stored
  const getStoredPreference = () => {
    return localStorage.getItem('chatapp_preferred_user') as 'Sr' | 'Iasm' | null;
  };

  const handleLogin = async (username: 'Sr' | 'Iasm') => {
    setIsLoading(true);
    try {
      await loginAsUser(username);
    } catch (error) {
      // Error is handled in the context
    } finally {
      setIsLoading(false);
    }
  };

  const storedPreference = getStoredPreference();
  
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
          ChatApp
        </CardTitle>
        <CardDescription>
          {storedPreference 
            ? `Último usuário: ${storedPreference}. Escolha para continuar.`
            : "Escolha seu usuário para entrar no chat"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={() => handleLogin('Sr')}
          disabled={isLoading}
          className="w-full h-12 text-left justify-start gap-3"
          variant={storedPreference === 'Sr' ? "default" : "outline"}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            storedPreference === 'Sr' ? 'bg-secondary' : 'bg-primary'
          }`}>
            <User className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="text-left">
            <div className="font-medium">Sr {storedPreference === 'Sr' && '(Salvo)'}</div>
            <div className="text-sm text-muted-foreground">
              {storedPreference === 'Sr' ? 'Último usuário usado' : 'Primeiro usuário'}
            </div>
          </div>
          {isLoading && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
        </Button>

        <Button
          onClick={() => handleLogin('Iasm')}
          disabled={isLoading}
          className="w-full h-12 text-left justify-start gap-3"
          variant={storedPreference === 'Iasm' ? "default" : "outline"}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            storedPreference === 'Iasm' ? 'bg-secondary' : 'bg-primary-glow'
          }`}>
            <User className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="text-left">
            <div className="font-medium">Iasm {storedPreference === 'Iasm' && '(Salvo)'}</div>
            <div className="text-sm text-muted-foreground">
              {storedPreference === 'Iasm' ? 'Último usuário usado' : 'Segundo usuário'}
            </div>
          </div>
          {isLoading && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
        </Button>
      </CardContent>
    </Card>
  );
};