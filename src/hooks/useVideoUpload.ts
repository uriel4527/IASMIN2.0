import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { VideoRecorder, CompressedVideoData, TrimData, GalleryVideoData, VideoProcessor, ProcessingOptions } from '@/utils/videoCompression';

export interface VideoUploadState {
  isRecording: boolean;
  isProcessing: boolean;
  isUploading: boolean;
  videoData: CompressedVideoData | null;
  recordingTime: number;
  stream: MediaStream | null;
  error: string | null;
  uploadProgress: number;
  // Gallery video states
  galleryVideoData: GalleryVideoData | null;
  isTrimming: boolean;
  isLoadingGallery: boolean;
  isShowingGalleryOptions: boolean;
}

export interface VideoUploadActions {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  cancelRecording: () => void;
  uploadAndSend: (onSend: (videoPath: string, duration: number, thumbnail: string, viewOnce?: boolean) => Promise<void>, viewOnce?: boolean) => Promise<void>;
  clearError: () => void;
  reset: () => void;
  switchCamera: () => Promise<void>;
  getCurrentFacingMode: () => 'user' | 'environment' | null;
  // Gallery video actions
  selectGalleryVideo: (file: File) => Promise<void>;
  trimGalleryVideo: (trimData: TrimData, options?: ProcessingOptions) => Promise<void>;
  cancelGalleryVideo: () => void;
  uploadRawVideo: (onSend: (videoPath: string, duration: number, thumbnail: string, viewOnce?: boolean) => Promise<void>, viewOnce?: boolean) => Promise<void>;
  chooseEditVideo: () => void;
}

export const useVideoUpload = (userId: string): [VideoUploadState, VideoUploadActions] => {
  const [state, setState] = useState<VideoUploadState>({
    isRecording: false,
    isProcessing: false,
    isUploading: false,
    videoData: null,
    recordingTime: 0,
    stream: null,
    error: null,
    uploadProgress: 0,
    galleryVideoData: null,
    isTrimming: false,
    isLoadingGallery: false,
    isShowingGalleryOptions: false,
  });

  const recorderRef = useRef<VideoRecorder | null>(null);
  const videoProcessorRef = useRef<VideoProcessor | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      recorderRef.current = new VideoRecorder();
      await recorderRef.current.startRecording();
      
      const stream = recorderRef.current.getStream();
      setState(prev => ({ 
        ...prev, 
        isRecording: true, 
        recordingTime: 0,
        stream 
      }));

      // Start timer
      timerRef.current = setInterval(() => {
        setState(prev => ({
          ...prev,
          recordingTime: prev.recordingTime + 1
        }));
      }, 1000);

    } catch (error) {
      console.error('Failed to start video recording:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Erro ao iniciar gravação de vídeo'
      }));
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recorderRef.current) return;

    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setState(prev => ({ 
        ...prev, 
        isProcessing: true, 
        isRecording: false,
        stream: null
      }));

      const videoData = await recorderRef.current.stopRecording();
      
      setState(prev => ({
        ...prev,
        videoData,
        isProcessing: false
      }));

    } catch (error) {
      console.error('Failed to stop recording:', error);
      setState(prev => ({
        ...prev,
        isProcessing: false,
        isRecording: false,
        stream: null,
        error: error instanceof Error ? error.message : 'Erro ao processar vídeo'
      }));
    }
  }, []);

  const cancelRecording = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.cancelRecording();
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isRecording: false,
      isProcessing: false,
      videoData: null,
      recordingTime: 0,
      stream: null,
      error: null
    }));
  }, []);

  const uploadFileInChunks = async (file: Blob | File, filename: string): Promise<string> => {
    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    console.log(`📤 Starting chunked upload: ${filename}, ${totalChunks} chunks`);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const formData = new FormData();
      // Append metadata fields BEFORE the file to ensure they are available in multer's destination callback
      formData.append('fileName', filename);
      formData.append('chunkIndex', chunkIndex.toString());
      formData.append('totalChunks', totalChunks.toString());
      formData.append('chunk', chunk);

      let response;
      try {
        try {
          response = await fetch('https://iasminnn.duckdns.org/upload-chunk', {
            method: 'POST',
            body: formData
          });
        } catch (e) {
          console.log('⚠️ HTTPS chunk upload failed, trying HTTP...', e);
          response = await fetch('http://iasminnn.duckdns.org/upload-chunk', {
            method: 'POST',
            body: formData
          });
        }

        if (!response.ok) {
          throw new Error(`Upload failed for chunk ${chunkIndex}: ${response.status}`);
        }

        const data = await response.json();
        
        // Update progress
        const progress = Math.round(((chunkIndex + 1) / totalChunks) * 100);
        setState(prev => ({ ...prev, uploadProgress: progress }));

        if (data.completed) {
          return data.url;
        }

      } catch (error) {
        console.error(`❌ Chunk ${chunkIndex} upload failed:`, error);
        throw error;
      }
    }
    
    throw new Error('Upload finished but no completion response received');
  };

  const uploadAndSend = useCallback(async (
    onSend: (videoPath: string, duration: number, thumbnail: string, viewOnce?: boolean) => Promise<void>,
    viewOnce: boolean = false
  ) => {
    if (!state.videoData) {
      setState(prev => ({ ...prev, error: 'Nenhum vídeo para enviar' }));
      return;
    }

    try {
      setState(prev => ({ ...prev, isUploading: true, uploadProgress: 0, error: null }));

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `${timestamp}.webm`;
      
      console.log('📤 Uploading video to Backend (Chunked)...');

      // Use chunked upload
      const videoUrl = await uploadFileInChunks(state.videoData.blob, filename);

      console.log('✅ Video uploaded successfully:', videoUrl);

      // Send message with video path
      await onSend(videoUrl, Math.round(state.videoData.duration), state.videoData.thumbnail, viewOnce);

      // Reset state on success
      setState(prev => ({
        ...prev,
        isUploading: false,
        videoData: null,
        uploadProgress: 0
      }));

    } catch (error) {
      console.error('❌ Video upload failed:', error);
      
      let errorMessage = 'Erro ao enviar vídeo. Tente novamente.';
      
      if (error instanceof Error) {
        if (error.message.includes('413') || error.message.includes('too large')) {
          errorMessage = 'Vídeo muito grande para o servidor. Tente um vídeo mais curto.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Tempo limite excedido. Verifique sua conexão.';
        } else if (error.message.includes('network')) {
          errorMessage = 'Erro de conexão. Verifique sua internet.';
        }
      }
      
      setState(prev => ({
        ...prev,
        isUploading: false,
        uploadProgress: 0,
        error: errorMessage
      }));
    }
  }, [state.videoData, userId]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const selectGalleryVideo = useCallback(async (file: File) => {
    try {
      setState(prev => ({ ...prev, isLoadingGallery: true, error: null }));
      
      if (!videoProcessorRef.current) {
        videoProcessorRef.current = new VideoProcessor();
      }

      const galleryVideoData = await videoProcessorRef.current.loadGalleryVideo(file);
      
      setState(prev => ({ 
        ...prev, 
        galleryVideoData,
        isLoadingGallery: false,
        isShowingGalleryOptions: true 
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Erro ao carregar vídeo da galeria',
        isLoadingGallery: false 
      }));
    }
  }, []);

  const trimGalleryVideo = useCallback(async (trimData: TrimData, options?: ProcessingOptions) => {
    if (!state.galleryVideoData || !videoProcessorRef.current) return;

    try {
      setState(prev => ({ ...prev, isProcessing: true, error: null }));
      
      const compressedVideo = await videoProcessorRef.current!.trimVideo(
        state.galleryVideoData.file, 
        trimData,
        options
      );
      
      setState(prev => ({ 
        ...prev, 
        videoData: compressedVideo,
        isProcessing: false,
        isTrimming: false,
        galleryVideoData: null
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Erro ao cortar vídeo',
        isProcessing: false 
      }));
    }
  }, [state.galleryVideoData]);

  const cancelGalleryVideo = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      galleryVideoData: null,
      isTrimming: false,
      isLoadingGallery: false,
      isShowingGalleryOptions: false
    }));
  }, []);

  const chooseEditVideo = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      isTrimming: true,
      isShowingGalleryOptions: false
    }));
  }, []);

  const uploadRawVideo = useCallback(async (
    onSend: (videoPath: string, duration: number, thumbnail: string, viewOnce?: boolean) => Promise<void>,
    viewOnce: boolean = false
  ) => {
    if (!state.galleryVideoData) {
      setState(prev => ({ ...prev, error: 'Nenhum vídeo selecionado' }));
      return;
    }

    try {
      setState(prev => ({ ...prev, isUploading: true, uploadProgress: 0, error: null }));

      // Generate thumbnail from original video
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      return new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = async () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          video.currentTime = 1; // Get frame at 1 second
          
          video.onseeked = async () => {
            try {
              ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
              const thumbnail = canvas.toDataURL('image/jpeg', 0.8);

              // Generate unique filename
              const timestamp = Date.now();
              const extension = state.galleryVideoData!.file.name.split('.').pop() || 'mp4';
              const filename = `${timestamp}_original.${extension}`;

              console.log('📤 Uploading original video to Backend (Chunked)...');

              // Use chunked upload
              const videoUrl = await uploadFileInChunks(state.galleryVideoData!.file, filename);

              console.log('✅ Original video uploaded successfully:', videoUrl);

              // Send message with video URL
              await onSend(videoUrl, Math.round(state.galleryVideoData!.duration), thumbnail, viewOnce);

              // Reset state on success
              setState(prev => ({
                ...prev,
                isUploading: false,
                galleryVideoData: null,
                isShowingGalleryOptions: false,
                uploadProgress: 0
              }));

              resolve();
            } catch (error) {
              reject(error);
            }
          };
        };

        video.onerror = () => {
          reject(new Error('Erro ao processar vídeo'));
        };

        video.src = URL.createObjectURL(state.galleryVideoData!.file);
      });

    } catch (error) {
      console.error('❌ Original video upload failed:', error);
      
      let errorMessage = 'Erro ao enviar vídeo original. Tente novamente.';
      
      if (error instanceof Error) {
        if (error.message.includes('413') || error.message.includes('too large')) {
          errorMessage = 'Vídeo muito grande para o servidor. Tente comprimir ou um vídeo menor.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Tempo limite excedido. Verifique sua conexão.';
        } else if (error.message.includes('network')) {
          errorMessage = 'Erro de conexão. Verifique sua internet.';
        }
      }
      
      setState(prev => ({
        ...prev,
        isUploading: false,
        uploadProgress: 0,
        error: errorMessage
      }));
    }
  }, [state.galleryVideoData, userId]);

  const reset = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.cancelRecording();
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setState({
      isRecording: false,
      isProcessing: false,
      isUploading: false,
      videoData: null,
      recordingTime: 0,
      stream: null,
      error: null,
      uploadProgress: 0,
      galleryVideoData: null,
      isTrimming: false,
      isLoadingGallery: false,
      isShowingGalleryOptions: false,
    });
  }, []);

  const switchCamera = useCallback(async () => {
    if (!recorderRef.current) {
      setState(prev => ({ ...prev, error: 'Nenhuma gravação ativa para alternar câmera' }));
      return;
    }

    try {
      await recorderRef.current.switchCamera();
      // Update stream in state
      const newStream = recorderRef.current.getStream();
      setState(prev => ({ ...prev, stream: newStream }));
    } catch (error) {
      console.error('Failed to switch camera:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Erro ao alternar câmera'
      }));
    }
  }, []);

  const getCurrentFacingMode = useCallback(() => {
    return recorderRef.current?.getCurrentFacingMode() || null;
  }, []);

  // Auto-stop recording after max duration (120s)
  useEffect(() => {
    if (state.isRecording && state.recordingTime >= 120) {
      stopRecording();
    }
  }, [state.isRecording, state.recordingTime, stopRecording]);

  return [
    state,
    {
      startRecording,
      stopRecording,
      cancelRecording,
      uploadAndSend,
      clearError,
      reset,
      switchCamera,
      getCurrentFacingMode,
      selectGalleryVideo,
      trimGalleryVideo,
      cancelGalleryVideo,
      uploadRawVideo,
      chooseEditVideo,
    }
  ];
};