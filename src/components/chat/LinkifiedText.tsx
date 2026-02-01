import React from 'react';
import { detectUrls, getPlatformInfo, extractYouTubeVideoId, extractTikTokVideoId, isTikTokUrl, extractInstagramId, isVideoUrl } from '@/utils/linkUtils';
import { useNativeLinkHandler } from '@/hooks/useNativeLinkHandler';
import { YouTubePlayer } from './YouTubePlayer';
import { TikTokPlayer } from './TikTokPlayer';
import { InstagramPlayer } from './InstagramPlayer';
import { GenericVideoPlayer } from './GenericVideoPlayer';
import { GoogleMapsPreview } from './GoogleMapsPreview';

interface LinkifiedTextProps {
  text: string;
  className?: string;
}

export const LinkifiedText: React.FC<LinkifiedTextProps> = ({ text, className }) => {
  const { openLink } = useNativeLinkHandler();
  
  const urls = detectUrls(text);
  
  if (urls.length === 0) {
    // No URLs found, return plain text with line breaks preserved
    return (
      <div className={className}>
        {text.split('\n').map((line, index) => (
          <React.Fragment key={index}>
            {line}
            {index < text.split('\n').length - 1 && <br />}
          </React.Fragment>
        ))}
      </div>
    );
  }
  
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  
  urls.forEach((urlMatch, index) => {
    const { url, start, end } = urlMatch;
    const linkInfo = getPlatformInfo(url);
    const youtubeId = extractYouTubeVideoId(url);
    const tiktokId = extractTikTokVideoId(url);
    const isTikTok = isTikTokUrl(url);
    const instagramId = extractInstagramId(url);
    const isVideo = isVideoUrl(url);
    const isGoogleMaps = url.includes('google.com/maps') || url.includes('maps.google.com') || url.includes('goo.gl/maps');
    
    // Add text before the URL
    if (start > lastIndex) {
      const beforeText = text.slice(lastIndex, start);
      elements.push(
        <span key={`text-${index}`}>
          {beforeText.split('\n').map((line, lineIndex) => (
            <React.Fragment key={lineIndex}>
              {line}
              {lineIndex < beforeText.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
        </span>
      );
    }
    
    // Add the clickable link or Video player
    if (youtubeId) {
      elements.push(
        <YouTubePlayer key={`youtube-${index}`} videoId={youtubeId} />
      );
    } else if (isTikTok) {
      elements.push(
        <TikTokPlayer key={`tiktok-${index}`} videoId={tiktokId || ''} url={url} />
      );
    } else if (instagramId) {
      elements.push(
        <InstagramPlayer key={`instagram-${index}`} videoId={instagramId} />
      );
    } else if (isVideo) {
      elements.push(
        <GenericVideoPlayer key={`video-${index}`} src={url} />
      );
    } else if (isGoogleMaps) {
      elements.push(
        <GoogleMapsPreview key={`maps-${index}`} url={url} />
      );
    } else {
      elements.push(
        <button
          key={`link-${index}`}
          onClick={() => openLink(linkInfo.url, linkInfo.nativeUrl)}
          className="text-blue-500 hover:text-blue-600 underline underline-offset-2 hover:underline-offset-4 transition-all duration-200 break-all"
          title={linkInfo.nativeUrl 
            ? `Abrir no app ${linkInfo.platform} (retorna à home primeiro): ${linkInfo.url}`
            : `Abrir no navegador: ${linkInfo.url}`
          }
        >
          {linkInfo.displayText}
        </button>
      );
    }
    
    lastIndex = end;
  });
  
  // Add remaining text after the last URL
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    elements.push(
      <span key="text-end">
        {remainingText.split('\n').map((line, index) => (
          <React.Fragment key={index}>
            {line}
            {index < remainingText.split('\n').length - 1 && <br />}
          </React.Fragment>
        ))}
      </span>
    );
  }
  
  return <div className={className}>{elements}</div>;
};