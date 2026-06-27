interface Props {
  size?: number;
  className?: string;
}

export function TokenIcon({ size = 24, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <radialGradient id="coinBg" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#92400e" />
        </radialGradient>
        <radialGradient id="coinShine" cx="30%" cy="25%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <filter id="coinShadow">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#92400e" floodOpacity="0.5" />
        </filter>
      </defs>

      {/* Outer ring */}
      <circle cx="20" cy="20" r="19" fill="url(#coinBg)" filter="url(#coinShadow)" />
      <circle cx="20" cy="20" r="19" fill="url(#coinShine)" />
      <circle cx="20" cy="20" r="19" fill="none" stroke="#fde68a" strokeWidth="1.2" strokeOpacity="0.6" />
      <circle cx="20" cy="20" r="16" fill="none" stroke="#d97706" strokeWidth="0.6" strokeOpacity="0.5" />

      {/* Trophy cup */}
      <g transform="translate(20,20)" fill="#92400e">
        {/* Cup body */}
        <path d="M-6,-8 Q-7,0 -4,4 L-2,6 L2,6 L4,4 Q7,0 6,-8 Z" fill="#7c2d12" fillOpacity="0.4"/>
        <path d="M-5.5,-8 Q-6.5,0 -3.5,4 L-2,5.5 L2,5.5 L3.5,4 Q6.5,0 5.5,-8 Z" fill="#fde68a" fillOpacity="0.9"/>
        {/* Handles */}
        <path d="M-5.5,-6 Q-9,-4 -8,0 Q-6.5,2 -4,1" fill="none" stroke="#fde68a" strokeWidth="1.5" strokeOpacity="0.9" strokeLinecap="round"/>
        <path d="M5.5,-6 Q9,-4 8,0 Q6.5,2 4,1" fill="none" stroke="#fde68a" strokeWidth="1.5" strokeOpacity="0.9" strokeLinecap="round"/>
        {/* Base */}
        <rect x="-2.5" y="5.5" width="5" height="1.2" rx="0.5" fill="#fde68a" fillOpacity="0.9"/>
        <rect x="-4" y="6.7" width="8" height="1.2" rx="0.6" fill="#fde68a" fillOpacity="0.9"/>
      </g>
    </svg>
  );
}
