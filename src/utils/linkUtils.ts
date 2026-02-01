// URL detection and native app handling utilities

export interface LinkInfo {
  url: string;
  platform: string;
  nativeUrl?: string;
  displayText: string;
}

// Regex to detect URLs in text - improved to capture full URLs with special characters including hyphens
export const URL_REGEX = /(https?:\/\/(?:[-\w.])+(?:\:[0-9]+)?(?:\/(?:[\w\/_.\-@~%+]*)?)?(?:\?(?:[\w&=%.#\-+,]*)?)?(?:\#(?:[\w.\-+,]*)?)?)/g;

// Platform detection and native URL mapping
export const PLATFORM_MAPPINGS = {
  // YouTube - múltiplas variações
  'youtube.com': {
    name: 'YouTube',
    nativeScheme: 'youtube://',
    webToNative: (url: string) => {
      const videoId = extractYouTubeVideoId(url);
      return videoId ? `youtube://watch?v=${videoId}` : 'youtube://';
    }
  },
  'youtu.be': {
    name: 'YouTube',
    nativeScheme: 'youtube://',
    webToNative: (url: string) => {
      const videoId = url.split('/').pop()?.split('?')[0];
      return videoId ? `youtube://watch?v=${videoId}` : 'youtube://';
    }
  },
  'm.youtube.com': {
    name: 'YouTube',
    nativeScheme: 'youtube://',
    webToNative: (url: string) => {
      const videoId = extractYouTubeVideoId(url);
      return videoId ? `youtube://watch?v=${videoId}` : 'youtube://';
    }
  },
  
  // Instagram - múltiplas variações e tipos de conteúdo
  'instagram.com': {
    name: 'Instagram',
    nativeScheme: 'instagram://',
    webToNative: (url: string) => {
      if (url.includes('/p/')) {
        const postId = url.split('/p/')[1]?.split('/')[0]?.split('?')[0];
        return postId ? `instagram://media?id=${postId}` : 'instagram://camera';
      }
      if (url.includes('/reel/')) {
        const reelId = url.split('/reel/')[1]?.split('/')[0]?.split('?')[0];
        return reelId ? `instagram://reel?id=${reelId}` : 'instagram://camera';
      }
      if (url.includes('/stories/')) {
        const username = url.split('/stories/')[1]?.split('/')[0]?.split('?')[0];
        return username ? `instagram://user?username=${username}` : 'instagram://camera';
      }
      if (url.includes('/tv/')) {
        const tvId = url.split('/tv/')[1]?.split('/')[0]?.split('?')[0];
        return tvId ? `instagram://tv?id=${tvId}` : 'instagram://camera';
      }
      // Perfil de usuário
      const pathSegments = url.split('/').filter(s => s && s !== 'instagram.com');
      if (pathSegments.length > 0 && !pathSegments[0].includes('.') && pathSegments[0] !== 'www') {
        const username = pathSegments[0].split('?')[0];
        return `instagram://user?username=${username}`;
      }
      return 'instagram://camera';
    }
  },
  'www.instagram.com': {
    name: 'Instagram',
    nativeScheme: 'instagram://',
    webToNative: (url: string) => {
      return PLATFORM_MAPPINGS['instagram.com'].webToNative(url);
    }
  },
  
  // TikTok - múltiplas variações
  'tiktok.com': {
    name: 'TikTok',
    nativeScheme: 'tiktok://',
    webToNative: (url: string) => {
      if (url.includes('/video/')) {
        const videoId = url.split('/video/')[1]?.split('?')[0];
        return videoId ? `tiktok://video/${videoId}` : 'tiktok://';
      }
      if (url.includes('/@')) {
        const username = url.split('/@')[1]?.split('/')[0]?.split('?')[0];
        return username ? `tiktok://user?username=${username}` : 'tiktok://';
      }
      if (url.includes('/t/')) {
        const shortId = url.split('/t/')[1]?.split('?')[0];
        return shortId ? `tiktok://video/${shortId}` : 'tiktok://';
      }
      return 'tiktok://';
    }
  },
  'www.tiktok.com': {
    name: 'TikTok',
    nativeScheme: 'tiktok://',
    webToNative: (url: string) => {
      return PLATFORM_MAPPINGS['tiktok.com'].webToNative(url);
    }
  },
  'vm.tiktok.com': {
    name: 'TikTok',
    nativeScheme: 'tiktok://',
    webToNative: (url: string) => {
      // URLs curtas do TikTok
      return 'tiktok://';
    }
  },
  
  // X/Twitter - múltiplas variações
  'twitter.com': {
    name: 'X',
    nativeScheme: 'twitter://',
    webToNative: (url: string) => {
      if (url.includes('/status/')) {
        const tweetId = url.split('/status/')[1]?.split('?')[0];
        return tweetId ? `twitter://status?id=${tweetId}` : 'twitter://';
      }
      if (url.includes('/i/spaces/')) {
        const spaceId = url.split('/i/spaces/')[1]?.split('?')[0];
        return spaceId ? `twitter://spaces?id=${spaceId}` : 'twitter://';
      }
      const pathSegments = url.split('/').filter(s => s && s !== 'twitter.com' && s !== 'www');
      if (pathSegments.length > 0) {
        const username = pathSegments[0].split('?')[0];
        return `twitter://user?screen_name=${username}`;
      }
      return 'twitter://';
    }
  },
  'x.com': {
    name: 'X',
    nativeScheme: 'twitter://',
    webToNative: (url: string) => {
      return PLATFORM_MAPPINGS['twitter.com'].webToNative(url.replace('x.com', 'twitter.com'));
    }
  },
  'mobile.twitter.com': {
    name: 'X',
    nativeScheme: 'twitter://',
    webToNative: (url: string) => {
      return PLATFORM_MAPPINGS['twitter.com'].webToNative(url);
    }
  },
  
  // Facebook - múltiplas variações
  'facebook.com': {
    name: 'Facebook',
    nativeScheme: 'fb://',
    webToNative: (url: string) => {
      if (url.includes('/posts/')) {
        const postId = url.split('/posts/')[1]?.split('?')[0];
        return postId ? `fb://post/${postId}` : 'fb://';
      }
      if (url.includes('/photo')) {
        const photoId = url.split('fbid=')[1]?.split('&')[0];
        return photoId ? `fb://photo/${photoId}` : 'fb://';
      }
      if (url.includes('/videos/')) {
        const videoId = url.split('/videos/')[1]?.split('?')[0];
        return videoId ? `fb://video/${videoId}` : 'fb://';
      }
      const pathSegments = url.split('/').filter(s => s && s !== 'facebook.com' && s !== 'www');
      if (pathSegments.length > 0) {
        const pageOrProfile = pathSegments[0].split('?')[0];
        return `fb://page/${pageOrProfile}`;
      }
      return 'fb://';
    }
  },
  'www.facebook.com': {
    name: 'Facebook',
    nativeScheme: 'fb://',
    webToNative: (url: string) => {
      return PLATFORM_MAPPINGS['facebook.com'].webToNative(url);
    }
  },
  'm.facebook.com': {
    name: 'Facebook',
    nativeScheme: 'fb://',
    webToNative: (url: string) => {
      return PLATFORM_MAPPINGS['facebook.com'].webToNative(url);
    }
  },
  
  // WhatsApp
  'whatsapp.com': {
    name: 'WhatsApp',
    nativeScheme: 'whatsapp://',
    webToNative: (url: string) => {
      return url.replace('https://whatsapp.com', 'whatsapp://');
    }
  },
  'wa.me': {
    name: 'WhatsApp',
    nativeScheme: 'whatsapp://',
    webToNative: (url: string) => {
      const phone = url.split('wa.me/')[1]?.split('?')[0];
      return phone ? `whatsapp://send?phone=${phone}` : 'whatsapp://';
    }
  },
  
  // Novas plataformas
  'linkedin.com': {
    name: 'LinkedIn',
    nativeScheme: 'linkedin://',
    webToNative: (url: string) => {
      if (url.includes('/in/')) {
        const profileId = url.split('/in/')[1]?.split('/')[0]?.split('?')[0];
        return profileId ? `linkedin://profile/${profileId}` : 'linkedin://';
      }
      if (url.includes('/company/')) {
        const companyId = url.split('/company/')[1]?.split('/')[0]?.split('?')[0];
        return companyId ? `linkedin://company/${companyId}` : 'linkedin://';
      }
      return 'linkedin://';
    }
  },
  'br.linkedin.com': {
    name: 'LinkedIn',
    nativeScheme: 'linkedin://',
    webToNative: (url: string) => {
      return PLATFORM_MAPPINGS['linkedin.com'].webToNative(url);
    }
  },
  
  'open.spotify.com': {
    name: 'Spotify',
    nativeScheme: 'spotify://',
    webToNative: (url: string) => {
      if (url.includes('/track/')) {
        const trackId = url.split('/track/')[1]?.split('?')[0];
        return trackId ? `spotify://track/${trackId}` : 'spotify://';
      }
      if (url.includes('/playlist/')) {
        const playlistId = url.split('/playlist/')[1]?.split('?')[0];
        return playlistId ? `spotify://playlist/${playlistId}` : 'spotify://';
      }
      if (url.includes('/artist/')) {
        const artistId = url.split('/artist/')[1]?.split('?')[0];
        return artistId ? `spotify://artist/${artistId}` : 'spotify://';
      }
      if (url.includes('/album/')) {
        const albumId = url.split('/album/')[1]?.split('?')[0];
        return albumId ? `spotify://album/${albumId}` : 'spotify://';
      }
      return 'spotify://';
    }
  }
};

export function extractYouTubeVideoId(url: string): string | null {
  const match = url.match(/^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/);
  return match?.[1] || null;
}

export function extractTikTokVideoId(url: string): string | null {
  // Matches /video/1234567890, /v/1234567890, or /embed/1234567890
  const match = url.match(/tiktok\.com\/(?:.*\/video\/|v\/|embed\/)(\d+)/);
  return match?.[1] || null;
}

export function isTikTokUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    return hostname.includes('tiktok.com') || hostname === 'vt.tiktok.com' || hostname === 'vm.tiktok.com';
  } catch {
    return false;
  }
}

export function extractInstagramId(url: string): string | null {
  // Matches /p/ID, /reel/ID, /tv/ID
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/);
  return match?.[1] || null;
}

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url);
}

export function detectUrls(text: string): Array<{ url: string; start: number; end: number }> {
  const urls: Array<{ url: string; start: number; end: number }> = [];
  let match;
  
  while ((match = URL_REGEX.exec(text)) !== null) {
    urls.push({
      url: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }
  
  return urls;
}

export function getPlatformInfo(url: string): LinkInfo {
  try {
    const urlObj = new URL(url);
    let domain = urlObj.hostname.toLowerCase();
    
    // Primeiro tenta o domínio exato
    let platform = PLATFORM_MAPPINGS[domain as keyof typeof PLATFORM_MAPPINGS];
    
    // Se não encontrar, tenta sem www.
    if (!platform && domain.startsWith('www.')) {
      domain = domain.replace('www.', '');
      platform = PLATFORM_MAPPINGS[domain as keyof typeof PLATFORM_MAPPINGS];
    }
    
    // Se ainda não encontrar, tenta sem subdomínios (ex: m.facebook.com -> facebook.com)
    if (!platform) {
      const domainParts = domain.split('.');
      if (domainParts.length > 2) {
        const rootDomain = domainParts.slice(-2).join('.');
        platform = PLATFORM_MAPPINGS[rootDomain as keyof typeof PLATFORM_MAPPINGS];
      }
    }
    
    if (platform) {
      const nativeUrl = platform.webToNative(url);
      console.log('Platform detected:', { domain, platform: platform.name, nativeUrl });
      
      return {
        url,
        platform: platform.name,
        nativeUrl: nativeUrl || undefined,
        displayText: url
      };
    }
    
    return {
      url,
      platform: 'Web',
      displayText: url
    };
  } catch (error) {
    console.error('Error parsing URL:', error);
    return {
      url,
      platform: 'Web',
      displayText: url
    };
  }
}