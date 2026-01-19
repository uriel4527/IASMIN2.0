import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface DeveloperModeRedirectProps {
  children: React.ReactNode;
  redirectTo: string;
}

export const DeveloperModeRedirect: React.FC<DeveloperModeRedirectProps> = ({ 
  children, 
  redirectTo 
}) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem('developer_mode') === 'enabled') {
      navigate(redirectTo, { replace: true });
    }
  }, [navigate, redirectTo]);

  // Sempre renderizar children; o redirecionamento ocorre via efeito
  return <>{children}</>;
};
