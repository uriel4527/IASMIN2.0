import React from 'react';

interface SecretButtonProps {
  onSecretActivate: () => void;
}

export const SecretButton: React.FC<SecretButtonProps> = ({ onSecretActivate }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSecretActivate();
  };

  const handleTouch = (e: React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSecretActivate();
  };

  return (
    <div className="mb-2 text-center relative">
      <div
        onClick={handleClick}
        onTouchStart={handleTouch}
        className="w-4 h-4 bg-green-500 opacity-50 cursor-pointer mx-auto mb-2 relative z-50 hover:opacity-70 transition-opacity"
        style={{ 
          position: 'relative', 
          zIndex: 50,
          touchAction: 'manipulation'
        }}
      />
    </div>
  );
};