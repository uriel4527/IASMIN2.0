import { useEffect } from 'react';
import { Camera } from '@capacitor/camera';
import { Filesystem } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

export const RequestPermissions = () => {
  useEffect(() => {
    const requestPermissions = async () => {
      if (!Capacitor.isNativePlatform()) return;

      try {
        // Request Camera Permissions
        const cameraStatus = await Camera.checkPermissions();
        if (cameraStatus.camera !== 'granted' || cameraStatus.photos !== 'granted') {
          await Camera.requestPermissions();
        }

        // Request Filesystem Permissions
        const fsStatus = await Filesystem.checkPermissions();
        if (fsStatus.publicStorage !== 'granted') {
          await Filesystem.requestPermissions();
        }

        // Request Microphone Permissions (using Web API as it triggers the prompt)
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop()); // Close stream immediately
        } catch (e) {
          console.log('Microphone permission denied or error', e);
        }

        // Request Notification Permissions (if not already handled by Push)
        // Usually Push component handles this, but we can double check
        if (Notification.permission !== 'granted') {
          await Notification.requestPermission();
        }

      } catch (error) {
        console.error('Error requesting permissions:', error);
        // toast.error('Erro ao solicitar permissões');
      }
    };

    requestPermissions();
  }, []);

  return null; // This component doesn't render anything
};
