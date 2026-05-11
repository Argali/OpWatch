import React from "react";

function FleetLogo({ size = 36 }) {
  const uid = React.useId().replace(/:/g, "");
  const s = size / 84; // scale factor (hexagon fits in 72×84 viewBox)
  return (
    <svg width={size * (72 / 84)} height={size} viewBox="-36 -42 72 84" xmlns="http://www.w3.org/2000/svg">
      <polygon
        points="0,-40 34,-20 34,20 0,40 -34,20 -34,-20"
        fill="#0C3B4A"
        stroke="#1FD38A"
        strokeWidth="2"
      />
      <rect x="-24" y="-24" width="48" height="48" fill="none" stroke="#1BA3A3" strokeWidth="1" />
      <line x1="-8" y1="-24" x2="-8" y2="24" stroke="#1BA3A3" strokeWidth="1" />
      <line x1="8" y1="-24" x2="8" y2="24" stroke="#1BA3A3" strokeWidth="1" />
      <line x1="-24" y1="-8" x2="24" y2="-8" stroke="#1BA3A3" strokeWidth="1" />
      <line x1="-24" y1="8" x2="24" y2="8" stroke="#1BA3A3" strokeWidth="1" />
      <circle cx="0" cy="0" r="6" fill="none" stroke="#1FD38A" strokeWidth="1" />
      <circle cx="0" cy="0" r="16" fill="none" stroke="#1FD38A" strokeWidth="1" />
      <path d="M0,0 L16,0 A16,16 0 0 1 0,16 Z" fill="rgba(31,211,138,0.35)" />
      <circle cx="0" cy="0" r="2.5" fill="#1FD38A" />
      <circle cx="-12" cy="-12" r="3" fill="#1FD38A" />
      <circle cx="14" cy="-6" r="3" fill="#7CFCC0" />
      <circle cx="10" cy="14" r="3" fill="#1FD38A" />
    </svg>
  );
}

export default FleetLogo;
