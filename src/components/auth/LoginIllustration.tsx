import { useId } from 'react';

/** Decorative product illustration; no sample values or live data. */
export const LoginIllustration = () => {
  const gradientId = useId();
  return (
    <svg className="login-dashboard-art" viewBox="0 0 680 460" fill="none" aria-hidden="true">
      <defs>
        <linearGradient
          id={gradientId}
          x1="120"
          y1="80"
          x2="560"
          y2="400"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#fff" stopOpacity=".96" />
          <stop offset="1" stopColor="#dcece9" stopOpacity=".92" />
        </linearGradient>
      </defs>
      <rect
        x="55"
        y="58"
        width="570"
        height="350"
        rx="16"
        fill={`url(#${gradientId})`}
        stroke="#fff"
        strokeOpacity=".7"
      />
      <path d="M105 58v350M55 110h570" stroke="#b8ccc9" strokeOpacity=".5" />
      <rect x="72" y="77" width="16" height="16" rx="4" fill="#0f766e" />
      {[137, 181, 225, 269, 313].map((y, i) => (
        <rect
          key={y}
          x="71"
          y={y}
          width="18"
          height="18"
          rx="5"
          fill={i === 0 ? '#0f766e' : '#c5d8d6'}
        />
      ))}
      <rect x="126" y="79" width="118" height="8" rx="4" fill="#688982" />
      <rect x="532" y="75" width="68" height="18" rx="9" fill="#d4e7e2" />
      {[126, 287, 448].map((x, i) => (
        <g key={x}>
          <rect
            x={x}
            y="130"
            width="143"
            height="64"
            rx="8"
            fill="#fff"
            fillOpacity=".7"
            stroke="#ccded9"
          />
          <rect x={x + 14} y="144" width="46" height="5" rx="2.5" fill="#a9bfba" />
          <rect
            x={x + 14}
            y="162"
            width="70"
            height="10"
            rx="5"
            fill={['#0f766e', '#6ba395', '#879aab'][i]}
            fillOpacity=".65"
          />
          <circle cx={x + 119} cy="163" r="10" fill="#d9eee8" />
        </g>
      ))}
      <rect
        x="126"
        y="211"
        width="302"
        height="169"
        rx="9"
        fill="#fff"
        fillOpacity=".8"
        stroke="#ccded9"
      />
      <rect x="144" y="229" width="85" height="6" rx="3" fill="#8fa9a3" />
      {[264, 295, 326, 357].map((y) => (
        <path key={y} d={`M144 ${y}h266`} stroke="#dce8e5" />
      ))}
      <path
        d="M145 340C170 340 176 296 201 305S235 338 259 288S293 315 319 272S357 299 382 252L409 246V358H145Z"
        fill="#14b8a6"
        fillOpacity=".08"
      />
      <path
        className="login-art-line"
        pathLength="1"
        d="M145 340C170 340 176 296 201 305S235 338 259 288S293 315 319 272S357 299 382 252L409 246"
        stroke="#0d9488"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle
        className="login-art-point"
        cx="409"
        cy="246"
        r="5"
        fill="#0f766e"
        stroke="#fff"
        strokeWidth="3"
      />
      <rect
        x="445"
        y="211"
        width="146"
        height="169"
        rx="9"
        fill="#fff"
        fillOpacity=".8"
        stroke="#ccded9"
      />
      <rect x="461" y="229" width="70" height="6" rx="3" fill="#8fa9a3" />
      <circle cx="518" cy="298" r="37" stroke="#e0ece9" strokeWidth="13" />
      <circle
        className="login-art-ring"
        cx="518"
        cy="298"
        r="37"
        stroke="#14b8a6"
        strokeWidth="13"
        strokeDasharray="165 233"
        strokeLinecap="round"
        transform="rotate(-90 518 298)"
      />
      <rect x="481" y="355" width="74" height="5" rx="2.5" fill="#b9cec7" />
      <g className="login-art-float">
        <rect x="12" y="322" width="165" height="88" rx="12" fill="#f5fbf9" stroke="#fff" />
        <circle cx="42" cy="351" r="12" fill="#d9eee8" />
        <path
          d="m37 351 4 4 7-8"
          stroke="#0f766e"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="65" y="346" width="85" height="6" rx="3" fill="#88a79e" />
        <rect x="30" y="379" width="125" height="5" rx="2.5" fill="#d1e4dd" />
        <rect
          className="login-art-progress"
          x="30"
          y="379"
          width="93"
          height="5"
          rx="2.5"
          fill="#0d9488"
        />
      </g>
      <g className="login-art-float-secondary">
        <rect x="532" y="30" width="128" height="74" rx="12" fill="#f5fbf9" stroke="#fff" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect
            key={i}
            x={548 + i * 16}
            y={77 - i * 5}
            width="9"
            height={12 + i * 5}
            rx="3"
            fill={i > 3 ? '#0d9488' : '#a6cfc3'}
          />
        ))}
      </g>
    </svg>
  );
};
