import React from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Trash2, Edit, Reply } from 'lucide-react';
import { Message } from '@/lib/supabase';
import { useContextMenu } from '@/hooks/useContextMenu';

interface MessageContextMenuProps {
  message: Message;
  isOwn: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onReply: () => void;
  children: React.ReactNode;
}

export const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  message,
  isOwn,
  onDelete,
  onEdit,
  onReply,
  children
}) => {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const allowOpenRef = React.useRef(false);
  
  const { handlers } = useContextMenu({
    onLongPress: () => {
      allowOpenRef.current = true;
      setDropdownOpen(true);
    },
    onRightClick: () => {} // Handled by ContextMenu
  });

  // For touch devices, exclude onContextMenu from handlers to avoid conflicts
  const touchHandlers = {
    onTouchStart: handlers.onTouchStart,
    onTouchMove: handlers.onTouchMove,
    onTouchEnd: handlers.onTouchEnd,
    onTouchCancel: handlers.onTouchCancel
  };

  // Control opening: only allow programmatic opens triggered by long-press
  const handleOpenChange = React.useCallback((open: boolean) => {
    if (open) {
      if (allowOpenRef.current) {
        allowOpenRef.current = false;
        setDropdownOpen(true);
      }
      // Ignore open attempts not triggered by long-press
      return;
    }
    // Always allow closing
    setDropdownOpen(false);
    allowOpenRef.current = false;
  }, []);

  const isTextMessage = !message.has_image && !message.has_audio;
  const isDeleted = !!message.deleted_at;

  const menuItems = (
    <>
      {!isDeleted && (
        <DropdownMenuItem onClick={onReply} className="gap-2">
          <Reply className="h-4 w-4" />
          Responder
        </DropdownMenuItem>
      )}
      {isOwn && !isDeleted && isTextMessage && (
        <DropdownMenuItem onClick={onEdit} className="gap-2">
          <Edit className="h-4 w-4" />
          Editar
        </DropdownMenuItem>
      )}
      {isOwn && !isDeleted && (
        <DropdownMenuItem onClick={onDelete} className="gap-2 text-destructive">
          <Trash2 className="h-4 w-4" />
          Excluir
        </DropdownMenuItem>
      )}
    </>
  );

  const contextMenuItems = (
    <>
      {!isDeleted && (
        <ContextMenuItem onClick={onReply} className="gap-2">
          <Reply className="h-4 w-4" />
          Responder
        </ContextMenuItem>
      )}
      {isOwn && !isDeleted && isTextMessage && (
        <ContextMenuItem onClick={onEdit} className="gap-2">
          <Edit className="h-4 w-4" />
          Editar
        </ContextMenuItem>
      )}
      {isOwn && !isDeleted && (
        <ContextMenuItem onClick={onDelete} className="gap-2 text-destructive">
          <Trash2 className="h-4 w-4" />
          Excluir
        </ContextMenuItem>
      )}
    </>
  );

  // Mobile: Use DropdownMenu with long press
  const mobileMenu = (
    <DropdownMenu open={dropdownOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <div
          {...touchHandlers}
          className="cursor-pointer"
          onPointerDownCapture={(e) => {
            // Prevent Radix from toggling menu on regular taps
            if (e.pointerType === 'touch') {
              e.stopPropagation();
            }
          }}
        >
          {children}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={isOwn ? "end" : "start"} className="w-48">
        {menuItems}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Desktop: Use ContextMenu with right-click
  const desktopMenu = (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div>
          {children}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {contextMenuItems}
      </ContextMenuContent>
    </ContextMenu>
  );

  // Detect if mobile based on touch support
  const isTouchDevice = 'ontouchstart' in window;

  return isTouchDevice ? mobileMenu : desktopMenu;
};