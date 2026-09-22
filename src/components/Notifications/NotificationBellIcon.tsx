import React from 'react';

/** Premium custom notification bell SVG — real product-quality icon */
export const NotificationBellIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    {/* Bell body */}
    <path
      d="M12 3C8.686 3 6 5.686 6 9v5l-1.5 2.5A.75.75 0 005.25 18H18.75a.75.75 0 00.65-1.125L18 14V9c0-3.314-2.686-6-6-6z"
      fill="currentColor"
      fillOpacity="0.15"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Clapper */}
    <path
      d="M10 18a2 2 0 104 0"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    {/* Subtle rim line at top of bell body */}
    <path
      d="M12 3v0"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);
