import { useState, useCallback } from 'react';
import { compressImageProgressive, validateImageFile } from '@/utils/imageCompression';

export interface ImageUploadState {
  isUploading: boolean;
  selectedImage: File | null;
  imagePreview: string | null;
  error: string | null;
  uploadProgress: number;
}

export interface ImageUploadActions {
  selectImage: (file: File) => void;
  removeImage: () => void;
  processAndUpload: (onSend: (imageData: string) => Promise<void>) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export const useImageUpload = (): [ImageUploadState, ImageUploadActions] => {
  const [state, setState] = useState<ImageUploadState>({
    isUploading: false,
    selectedImage: null,
    imagePreview: null,
    error: null,
    uploadProgress: 0
  });

  const selectImage = useCallback((file: File) => {
    console.log('🖼️ Selecting image:', file.name);
    
    if (!validateImageFile(file)) {
      setState(prev => ({
        ...prev,
        error: 'Arquivo inválido. Use JPEG, PNG ou WebP menor que 10MB.'
      }));
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = e.target?.result as string;
      setState(prev => ({
        ...prev,
        selectedImage: file,
        imagePreview: preview,
        error: null,
        uploadProgress: 0
      }));
      console.log('✅ Image preview created');
    };
    reader.onerror = () => {
      setState(prev => ({
        ...prev,
        error: 'Erro ao carregar preview da imagem.'
      }));
    };
    reader.readAsDataURL(file);
  }, []);

  const removeImage = useCallback(() => {
    console.log('🗑️ Removing selected image');
    setState(prev => ({
      ...prev,
      selectedImage: null,
      imagePreview: null,
      error: null,
      uploadProgress: 0
    }));
  }, []);

  const processAndUpload = useCallback(async (onSend: (imageData: string) => Promise<void>) => {
    if (!state.selectedImage) {
      setState(prev => ({ ...prev, error: 'Nenhuma imagem selecionada.' }));
      return;
    }

    setState(prev => ({ ...prev, isUploading: true, error: null, uploadProgress: 0 }));
    
    try {
      console.log('🔄 Starting image processing...');
      
      // Use original file without compression
      console.log('📤 Uploading original image to backend...');

      // Simulate upload progress since fetch doesn't support progress events easily
      const progressInterval = setInterval(() => {
        setState(prev => {
          const newProgress = Math.min(prev.uploadProgress + 10, 90);
          return { ...prev, uploadProgress: newProgress };
        });
      }, 200);

      // Create FormData
      const formData = new FormData();
      const filename = `${Date.now()}-${state.selectedImage.name}`;
      formData.append('file', state.selectedImage, filename);

      let response;
      try {
          console.log('🔒 Tentando upload via HTTPS...');
          // Tenta HTTPS primeiro (para produção/dispositivos reais)
          response = await fetch('https://iasminn.duckdns.org/upload', {
              method: 'POST',
              body: formData
          });
      } catch (e) {
          console.log('⚠️ HTTPS falhou, tentando HTTP...', e);
          // Fallback para HTTP (para desenvolvimento local)
          response = await fetch('http://iasminn.duckdns.org/upload', {
              method: 'POST',
              body: formData
          });
      }

      clearInterval(progressInterval);
      setState(prev => ({ ...prev, uploadProgress: 100 }));

      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Image uploaded successfully:', data.url);
      
      // Attempt to send the message with URL
      await onSend(data.url);
      
      console.log('✅ Image upload successful');
      
      // Clear form on success
      setState(prev => ({
        ...prev,
        selectedImage: null,
        imagePreview: null,
        isUploading: false,
        error: null
      }));
      
    } catch (error) {
      console.error('❌ Image upload failed:', error);
      
      let errorMessage = 'Erro ao enviar imagem. Tente novamente.';
      
      if (error instanceof Error) {
        if (error.message.includes('413') || error.message.includes('Payload too large')) {
          errorMessage = 'Imagem muito grande para o servidor. Tente com uma imagem menor.';
        } else if (error.message.includes('Unable to compress')) {
          errorMessage = 'Não foi possível comprimir a imagem adequadamente. Tente uma imagem menor.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Tempo limite excedido. Verifique sua conexão.';
        } else if (error.message.includes('network')) {
          errorMessage = 'Erro de conexão. Verifique sua internet.';
        }
      }
      
      setState(prev => ({
        ...prev,
        isUploading: false,
        error: errorMessage
      }));
    }
  }, [state.selectedImage]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const reset = useCallback(() => {
    setState({
      isUploading: false,
      selectedImage: null,
      imagePreview: null,
      error: null
    });
  }, []);

  return [
    state,
    {
      selectImage,
      removeImage,
      processAndUpload,
      clearError,
      reset
    }
  ];
};