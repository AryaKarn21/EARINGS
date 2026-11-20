import React from "react";
import { ExternalLink } from "lucide-react";

export const SOCIAL_PROFILES = [
  {
    platform: "Instagram",
    handle: "@THEEARRINGBAR3",
    url: "https://www.instagram.com/theearringbar3/",
    description: "New designs, styling reels & curated looks",
    gradient: "from-pink-500 via-rose-500 to-amber-500",
    hoverBorder: "hover:border-pink-500/50 hover:bg-pink-500/10",
    badgeColor: "bg-gradient-to-tr from-pink-500 to-amber-400",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110"
        aria-hidden="true"
      >
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
      </svg>
    ),
  },
  {
    platform: "Facebook",
    handle: "The Earring Bar",
    url: "https://www.facebook.com/profile.php?id=61559333347423",
    description: "Official community & announcements",
    gradient: "from-sky-500 to-blue-600",
    hoverBorder: "hover:border-sky-400/50 hover:bg-sky-500/10",
    badgeColor: "bg-blue-600",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110"
        aria-hidden="true"
      >
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    platform: "TikTok",
    handle: "@theearringbar3",
    url: "https://www.tiktok.com/@theearringbar3?lang=en",
    description: "Styling videos, try-ons & jewellery inspiration",
    gradient: "from-cyan-400 via-rose-500 to-slate-900",
    hoverBorder: "hover:border-cyan-400/50 hover:bg-cyan-500/10",
    badgeColor: "bg-slate-900 border border-slate-700",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110"
        aria-hidden="true"
      >
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.82 4.49 6.27 6.27 0 0 0 1.86-4.49V8.71a8.17 8.17 0 0 0 4.91 1.62v-3.43a4.85 4.85 0 0 1-1-.21z" />
      </svg>
    ),
  },
];

/**
 * Reusable SocialLinks component for Aurélie.
 * Supports:
 * - 'footer-column': Rich cards showing platform, account handle, and subtle sky-blue hover states.
 * - 'compact': Simple icon pills with tooltip titles.
 */
export default function SocialLinks({ variant = "footer-column", className = "" }) {
  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        {SOCIAL_PROFILES.map((social) => (
          <a
            key={social.platform}
            href={social.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Follow Aurélie on ${social.platform} (${social.handle}) — opens in a new tab`}
            className="group relative p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 hover:border-sky-400/40 transition-all focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            title={`${social.platform}: ${social.handle}`}
          >
            {social.icon}
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      {SOCIAL_PROFILES.map((social) => (
        <a
          key={social.platform}
          href={social.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Follow Aurélie on ${social.platform} ${social.handle} (opens in a new tab)`}
          className={`group flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/10 ${social.hoverBorder} transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-1 focus:ring-offset-slate-950 text-left`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-white ${social.badgeColor} shadow-sm shrink-0`}
            >
              {social.icon}
            </div>
            <div className="truncate">
              <p className="text-[12.5px] font-semibold text-white tracking-wide leading-tight group-hover:text-sky-300 transition-colors">
                {social.platform}
              </p>
              <p className="text-[11px] font-mono text-white/60 truncate tracking-tight">
                {social.handle}
              </p>
            </div>
          </div>
          <ExternalLink
            size={13}
            className="text-white/40 group-hover:text-sky-400 transition-colors shrink-0 ml-1.5"
            aria-hidden="true"
          />
        </a>
      ))}
    </div>
  );
}
