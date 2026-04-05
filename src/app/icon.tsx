import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <svg
        viewBox="0 0 24 24"
        width="32"
        height="32"
        fill="none"
        strokeWidth="1.5"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#08DDC8" />
            <stop offset="50%" stopColor="#83DD68" />
            <stop offset="100%" stopColor="#CF59F3" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="10.5" stroke="url(#g)" />
        <path d="M 6.5 3.5 Q 4 8 6 12 Q 8 16 6.5 20.5" stroke="url(#g)" strokeLinecap="round" />
        <path d="M 17.5 3.5 Q 20 8 18 12 Q 16 16 17.5 20.5" stroke="url(#g)" strokeLinecap="round" />
        <line x1="5.2" y1="5.5" x2="7.5" y2="6" stroke="url(#g)" strokeWidth="1" strokeLinecap="round" />
        <line x1="4.8" y1="8" x2="7" y2="8.8" stroke="url(#g)" strokeWidth="1" strokeLinecap="round" />
        <line x1="5.5" y1="10.5" x2="7.2" y2="11.2" stroke="url(#g)" strokeWidth="1" strokeLinecap="round" />
        <line x1="5.5" y1="13" x2="7.5" y2="13" stroke="url(#g)" strokeWidth="1" strokeLinecap="round" />
        <line x1="4.8" y1="15.5" x2="7" y2="15.5" stroke="url(#g)" strokeWidth="1" strokeLinecap="round" />
        <line x1="5.2" y1="18" x2="7.5" y2="18" stroke="url(#g)" strokeWidth="1" strokeLinecap="round" />
        <line x1="16.5" y1="6" x2="18.8" y2="5.5" stroke="url(#g)" strokeWidth="1" strokeLinecap="round" />
        <line x1="17" y1="8.8" x2="19.2" y2="8" stroke="url(#g)" strokeWidth="1" strokeLinecap="round" />
        <line x1="16.8" y1="11.2" x2="18.5" y2="10.5" stroke="url(#g)" strokeWidth="1" strokeLinecap="round" />
        <line x1="16.5" y1="13" x2="18.5" y2="13" stroke="url(#g)" strokeWidth="1" strokeLinecap="round" />
        <line x1="17" y1="15.5" x2="19.2" y2="15.5" stroke="url(#g)" strokeWidth="1" strokeLinecap="round" />
        <line x1="16.5" y1="18" x2="18.8" y2="18" stroke="url(#g)" strokeWidth="1" strokeLinecap="round" />
      </svg>
    ),
    { ...size }
  );
}
