import { useState, useCallback } from 'react';

export const useAudioUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadAudio = useCallback(async (audioBlob: Blob): Promise<string | null> => {
    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      // Detect extension from mime type or default to webm
      let extension = 'webm';
      if (audioBlob.type.includes('ogg')) extension = 'ogg';
      else if (audioBlob.type.includes('wav')) extension = 'wav';
      else if (audioBlob.type.includes('mp3')) extension = 'mp3';
      else if (audioBlob.type.includes('mp4')) extension = 'm4a';

      const filename = `audio-${Date.now()}.${extension}`;
      formData.append('file', audioBlob, filename);

      console.log(`📤 Uploading audio to backend (${audioBlob.size} bytes, type: ${audioBlob.type})...`);

      // Try HTTPS first, then HTTP domain, then localhost
      let response;
      try {
        console.log('🔄 Trying HTTPS upload (iasminnn.duckdns.org)...');
        response = await fetch('https://iasminnn.duckdns.org/upload', {
          method: 'POST',
          body: formData
        });
      } catch (e) {
        console.log('⚠️ HTTPS upload failed, trying HTTP (iasminnn.duckdns.org)...', e);
        try {
            response = await fetch('http://iasminnn.duckdns.org/upload', {
                method: 'POST',
                body: formData
            });
        } catch (e2) {
            console.log('⚠️ HTTP upload failed, trying localhost...', e2);
            response = await fetch('http://localhost:3010/upload', {
                method: 'POST',
                body: formData
            });
        }
      }

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Audio uploaded successfully:', data.url);
      return data.url;
    } catch (err) {
      console.error('Error uploading audio:', err);
      setError('Erro ao enviar áudio');
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return { uploadAudio, isUploading, error };
};
