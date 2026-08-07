"use client";

export function InstagramLogo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#fdf497" />
          <stop offset="5%" stopColor="#fdf497" />
          <stop offset="45%" stopColor="#fd5949" />
          <stop offset="60%" stopColor="#d6249f" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig-grad)" strokeWidth="1.5" fill="none" />
      <circle cx="12" cy="12" r="5" stroke="url(#ig-grad)" strokeWidth="1.5" fill="none" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="url(#ig-grad)" />
    </svg>
  );
}

export function TikTokLogo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" stroke="#25F4EE" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" stroke="#FE2C55" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" transform="translate(0.5, 0.5)" opacity="0.6" />
    </svg>
  );
}

export function YouTubeLogo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2" y="4" width="20" height="16" rx="4" fill="#FF0000" opacity="0.9" />
      <polygon points="10,8 10,16 16,12" fill="white" />
    </svg>
  );
}

export function TwitterLogo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 4l6.5 8L4 20h2l5.5-6.8L16 20h4l-7-8.5L19.5 4h-2L12.5 10 8 4H4z" fill="white" />
    </svg>
  );
}

export function FacebookLogo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="10" fill="#1877F2" />
      <path d="M15.5 8H14c-1.1 0-2 .9-2 2v2h3l-.5 3H12v5h-3v-5H7v-3h2v-2c0-2.2 1.8-4 4-4h2.5v2z" fill="white" />
    </svg>
  );
}

export function LinkedInLogo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2" y="2" width="20" height="20" rx="3" fill="#0A66C2" />
      <path d="M7 10v7M7 7v.01M10 17v-4c0-1.1.9-2 2-2s2 .9 2 2v4M10 10v7" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function PinterestLogo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        fill="#E60023"
        fillRule="evenodd"
        d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.372 12-12S18.627 0 12 0z"
      />
    </svg>
  );
}

export function getPlatformLogo(platform: string) {
  const p = platform?.toLowerCase() || "instagram";
  switch (p) {
    case "instagram": return InstagramLogo;
    case "tiktok": return TikTokLogo;
    case "youtube": return YouTubeLogo;
    case "twitter": case "x": return TwitterLogo;
    case "facebook": return FacebookLogo;
    case "linkedin": return LinkedInLogo;
    case "pinterest": return PinterestLogo;
    default: return InstagramLogo;
  }
}
