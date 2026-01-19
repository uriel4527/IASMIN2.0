import React, { useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';

interface PasswordModalProps {
  isOpen: boolean;
  password: string;
  onPasswordChange: (value: string) => void;
  onClose: () => void;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({ 
  isOpen, 
  password, 
  onPasswordChange, 
  onClose 
}) => {
  const navigate = useNavigate();

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onPasswordChange(value);
    
    if (value === '4527' && value.length === 4) {
      sessionStorage.setItem('chatAccess', 'granted');
      navigate('/chat2');
    } else if (value.length === 4) {
      onPasswordChange('');
      onClose();
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onClose();
  };

  const handleInputClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Focus input when modal is opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        const input = document.querySelector('#password-input') as HTMLInputElement;
        if (input) {
          input.focus();
          input.click();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="absolute inset-0 flex items-center justify-center z-[100] bg-black/30"
      onClick={handleOverlayClick}
      style={{ 
        position: 'absolute',
        zIndex: 100,
        touchAction: 'manipulation'
      }}
    >
      <div onClick={handleInputClick}>
        <Input
          id="password-input"
          type="tel"
          maxLength={4}
          value={password}
          onChange={handlePasswordChange}
          className="w-8 h-8 opacity-0 text-transparent bg-transparent border-transparent"
          autoFocus
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder=""
          tabIndex={-1}
        />
      </div>
    </div>
  );
};