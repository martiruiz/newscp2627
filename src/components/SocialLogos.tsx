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

export function getPlatformLogo(platform: string) {
  const p = platform?.toLowerCase() || "instagram";
  switch (p) {
    case "instagram": return InstagramLogo;
    case "tiktok": return TikTokLogo;
    case "youtube": return YouTubeLogo;
    case "twitter": case "x": return TwitterLogo;
    case "facebook": return FacebookLogo;
    case "linkedin": return LinkedInLogo;
    default: return InstagramLogo;
  }
}
