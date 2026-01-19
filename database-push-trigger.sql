-- Função que chama a Edge Function quando uma mensagem é inserida
CREATE OR REPLACE FUNCTION notify_message_push()
RETURNS TRIGGER AS $$
DECLARE
  sender_username TEXT;
  message_preview TEXT;
BEGIN
  -- Buscar username do remetente
  SELECT username INTO sender_username
  FROM users
  WHERE id = NEW.sender_id;
  
  -- Criar preview da mensagem (50 caracteres)
  IF NEW.has_image THEN
    message_preview := '📷 Imagem';
  ELSIF NEW.has_audio THEN
    message_preview := '🎵 Áudio';
  ELSIF NEW.has_video THEN
    message_preview := '🎥 Vídeo';
  ELSE
    message_preview := LEFT(NEW.content, 50);
    IF LENGTH(NEW.content) > 50 THEN
      message_preview := message_preview || '...';
    END IF;
  END IF;
  
  -- Chamar Edge Function (async via pg_net)
  -- Nota: Edge Function deve estar configurada com verify_jwt = false no config.toml
  PERFORM
    net.http_post(
      url := 'https://zhrymmzmkeyfkasyrqke.supabase.co/functions/v1/push-notification/send',
      headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpocnltbXpta2V5Zmthc3lycWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4ODI4NTAsImV4cCI6MjA3NTQ1ODg1MH0.471v3c3Te2JFfMzMujpr0l18Nm3SBbyUJfKscd6ySos"}'::jsonb,
      body := json_build_object(
        'recipientId', NEW.receiver_id,
        'senderId', NEW.sender_id,
        'senderName', sender_username,
        'messageContent', message_preview,
        'messageId', NEW.id
      )::jsonb
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger que dispara a função
DROP TRIGGER IF EXISTS on_message_insert_push ON messages;
CREATE TRIGGER on_message_insert_push
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_message_push();
