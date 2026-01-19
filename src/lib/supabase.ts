import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Mock client para evitar crashes quando as variáveis de ambiente não estiverem configuradas
const createMockClient = () => {
  console.warn('⚠️ Supabase credentials missing. Using mock client.');
  return new Proxy(() => {}, {
    get: (target, prop) => {
      if (prop === 'then') {
        return (resolve: any) => resolve({ data: null, error: null });
      }
      return createMockClient();
    },
    apply: () => createMockClient()
  }) as any;
};

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : createMockClient();

// Database types
export interface User {
  id: string;
  email: string;
  username: string;
  avatar_url?: string;
  created_at: string;
  last_seen: string;
  is_online: boolean;
}

export interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  is_read: boolean;
  image_data?: string;
  has_image?: boolean;
  audio_data?: string;
  has_audio?: boolean;
  audio_duration?: number;
  video_storage_path?: string;
  has_video?: boolean;
  video_duration?: number;
  video_thumbnail?: string;
  view_once?: boolean;
  viewed_at?: string;
  viewed_by?: string;
  edited_at?: string;
  deleted_at?: string;
  original_content?: string;
  reply_to_id?: string;
  reply_to?: Message;
  sender?: User;
  receiver?: User;
}

export interface TypingStatus {
  id: string;
  user_id: string;
  conversation_with: string;
  is_typing: boolean;
  last_updated: string;
  created_at: string;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message?: Message;
  created_at: string;
  updated_at: string;
  user1?: User;
  user2?: User;
}
