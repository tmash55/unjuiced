import React from 'react';
import { IconBallBaseball, IconBallBasketball } from '@tabler/icons-react';

interface SportIconProps {
  sport: string;
  className?: string;
}

export function SportIcon({ sport, className = "h-5 w-5" }: SportIconProps) {
  const sportLower = sport.toLowerCase();

  // Football (American Football)
  if (sportLower.includes('football') || sportLower.includes('nfl') || sportLower === 'americanfootball' || sportLower === 'ncaaf') {
    return (
      <svg 
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        className={className}
        fill="currentColor"
      >
        <path d="m9.742 18.873l-4.615-4.615q-.152.988-.134 2.311T5.2 18.75q.69.214 2.151.254t2.391-.131m1.208-.208q1.494-.248 2.88-.915t2.32-1.6q.889-.888 1.556-2.253q.667-1.364.96-2.897L13 5.335q-1.425.254-2.796.943q-1.371.69-2.246 1.564t-1.565 2.25t-1.058 2.958zm7.923-8.873q.158-1.09.14-2.41T18.8 5.25q-.69-.22-2.151-.26t-2.391.137zM7.923 20q-1.213 0-2.273-.155t-1.238-.333q-.16-.185-.286-1.173T4 16.246q0-2.802.833-5.176T7.18 7.18q1.515-1.514 3.907-2.347T16.308 4q1.161 0 2.074.136q.912.135 1.11.314q.237.204.372 1.164q.136.959.136 2.113q0 2.867-.823 5.251t-2.32 3.88q-1.49 1.49-3.863 2.316T7.923 20m1.623-6.254l4.2-4.2q.14-.14.344-.15t.364.15t.16.354t-.16.354l-4.2 4.2q-.14.14-.344.15t-.364-.15t-.16-.354t.16-.354" />
      </svg>
    );
  }

  // WNBA — outline basketball to distinguish from NBA's filled icon
  if (sportLower === 'wnba' || sportLower === 'basketball_wnba') {
    return <IconBallBasketball className={className} stroke={1.75} />;
  }

  // Basketball (NBA / NCAAB)
  if (sportLower.includes('basketball') || sportLower.includes('nba') || sportLower === 'ncaab') {
    return (
      <svg 
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        className={className}
        fill="currentColor"
      >
        <path d="m10 9.293l1.083-1.083c-.439-.556-.785-1.246-1.062-1.964c-.345-.897-.594-1.877-.774-2.777l-.08-.42a6.97 6.97 0 0 0-3.75 1.66zm1.79-.376L10.707 10l4.584 4.584a6.97 6.97 0 0 0 1.66-3.75l-.418-.079c-.9-.18-1.88-.43-2.777-.775c-.719-.276-1.41-.623-1.966-1.063m5.208.91a6.98 6.98 0 0 0-1.707-4.41l-2.788 2.787c.43.32.983.601 1.612.843c.826.318 1.747.554 2.614.728zm-5.202-2.33l2.788-2.788a6.98 6.98 0 0 0-4.41-1.707l.053.27c.174.868.41 1.789.728 2.615c.241.628.521 1.18.841 1.61M10 10.706l-1.081 1.081c.44.556.786 1.247 1.063 1.966c.345.897.595 1.877.775 2.777q.042.213.08.42a6.97 6.97 0 0 0 3.747-1.66zM8.206 12.5l-2.79 2.79a6.98 6.98 0 0 0 4.412 1.707l-.052-.271c-.174-.868-.41-1.788-.728-2.614c-.241-.629-.522-1.181-.842-1.611m-.708-.706c-.43-.32-.982-.6-1.61-.842c-.826-.318-1.747-.555-2.614-.728l-.272-.053a6.98 6.98 0 0 0 1.707 4.412zm.713-.714L9.293 10L4.709 5.416a6.97 6.97 0 0 0-1.66 3.748q.208.038.421.08c.9.18 1.88.43 2.777.775c.718.276 1.409.623 1.964 1.062m7.446 4.576A8 8 0 1 1 4.343 4.343a8 8 0 0 1 11.314 11.314" />
      </svg>
    );
  }

  // Baseball
  if (sportLower.includes('baseball') || sportLower.includes('mlb')) {
    return <IconBallBaseball className={className} stroke={1.75} />;
  }

  // Hockey (Ice Hockey)
  if (sportLower.includes('hockey') || sportLower.includes('nhl')) {
    return (
      <svg 
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        className={className}
        fill="currentColor"
      >
        <path d="M17.49 6.871a.75.75 0 0 0-.62-.86c-.418-.069-.79.233-.865.638l-.018.09a7 7 0 0 1-.091.367c-.089.323-.238.79-.477 1.35a12.8 12.8 0 0 1-2.732 4.014a14.1 14.1 0 0 1-5.575 3.401a8 8 0 0 1-.497.14l-.022.006H6.59a.75.75 0 0 0-.574.892c.142.659.891.575.891.575l.003-.001h.004l.011-.003l.037-.01q.048-.01.132-.032q.169-.044.47-.136a15.6 15.6 0 0 0 6.185-3.771a14.3 14.3 0 0 0 3.049-4.486c.269-.628.44-1.16.544-1.541a8 8 0 0 0 .137-.577l.007-.037l.002-.012v-.005zM2.351 12.573c-.684 1.899-.775 3.874.438 5.1l.234.237a628 628 0 0 0 3.023 3.04c1.28 1.28 3.305 1.3 5.289.66c2.026-.655 4.25-2.062 6.226-4.038c1.976-1.975 3.382-4.2 4.037-6.226c.64-1.984.62-4.008-.66-5.288a757 757 0 0 1-2.892-2.912l-.362-.367l-.002.002c-1.225-1.214-3.201-1.123-5.1-.44c-1.965.709-4.149 2.144-6.119 4.114s-3.404 4.153-4.112 6.118m1.41.509c.619-1.715 1.914-3.717 3.763-5.567c1.85-1.85 3.852-3.144 5.566-3.762c1.777-.64 2.97-.473 3.54.099l.003-.002l.348.351l.876.885c.685.69 1.5 1.512 2.02 2.032c.675.675.875 1.967.293 3.767c-.567 1.757-1.826 3.783-3.67 5.627s-3.87 3.102-5.626 3.67c-1.8.581-3.093.381-3.767-.293a836 836 0 0 1-3.018-3.034l-.23-.232l.002-.001c-.572-.572-.74-1.764-.1-3.54" />
      </svg>
    );
  }

  // Soccer (Football internationally)
  if (sportLower.includes('soccer') || sportLower === 'mls') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z" />
      </svg>
    );
  }

  // Tennis
  if (sportLower.includes('tennis')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="9.5" cy="9" rx="4.2" ry="5.7" />
        <path d="M7.2 4.3c1.1 1.2 1.7 2.9 1.7 4.7s-.6 3.5-1.7 4.7" />
        <path d="M11.8 4.3c1.1 1.2 1.7 2.9 1.7 4.7s-.6 3.5-1.7 4.7" />
        <path d="M12.3 13.6l5.9 5.9" />
        <path d="M15.3 16.6l-1.8 1.8" />
        <circle cx="18.3" cy="6.2" r="1.6" />
      </svg>
    );
  }

  // Golf
  if (sportLower.includes('golf')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="18" r="4" />
        <line x1="12" y1="14" x2="12" y2="2" />
        <path d="M12 2l8 6-8-4-8 4z" />
      </svg>
    );
  }

  // MMA / UFC / Boxing
  if (sportLower.includes('mma') || sportLower.includes('ufc') || sportLower.includes('boxing') || sportLower.includes('fight')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z" />
        <path d="M9.1 13.8V9.6a2 2 0 0 1 2-2h2.5" />
        <path d="M13.6 7.6h1.3a1.6 1.6 0 0 1 1.6 1.6v3.1a2.8 2.8 0 0 1-2.8 2.8h-2.6a2 2 0 0 1-2-2" />
        <path d="M11.4 10.2h3.8" />
      </svg>
    );
  }

  // Default generic sport icon
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      <path d="M2 12h20" />
    </svg>
  );
}

