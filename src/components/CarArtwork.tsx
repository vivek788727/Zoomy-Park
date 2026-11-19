import React from 'react';
import { CarConfig } from '../game/types';

export const TitleLogoSvg: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 540 160"
    className={className}
    role="img"
    aria-label="Zoomy Park!"
  >
    <defs>
      <linearGradient id="zp-title-grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="52%" stopColor="#FBBF24" />
        <stop offset="100%" stopColor="#F97316" />
      </linearGradient>
      <linearGradient id="zp-flag-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#EF4444" />
        <stop offset="50%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#10B981" />
      </linearGradient>
      <filter id="zp-shadow" x="-10%" y="-10%" width="120%" height="130%">
        <feDropShadow dx="0" dy="6" stdDeviation="3" floodColor="#0F172A" floodOpacity="0.32" />
      </filter>
    </defs>

    {/* Checkered racing ribbon */}
    <g transform="translate(88, 12)">
      <rect x="0" y="0" width="364" height="24" rx="12" fill="url(#zp-flag-grad)" stroke="#FFFFFF" strokeWidth="3" />
      <text
        x="182"
        y="16.5"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="Fredoka, system-ui, sans-serif"
        fontWeight="700"
        fontSize="13"
        letterSpacing="2.2"
      >
        ENDLESS KIDS CAR ADVENTURE
      </text>
    </g>

    {/* Main chunky comic title */}
    <g filter="url(#zp-shadow)">
      <text
        x="270"
        y="108"
        textAnchor="middle"
        fontFamily="Fredoka, system-ui, sans-serif"
        fontWeight="700"
        fontSize="82"
        stroke="#0F172A"
        strokeWidth="12"
        strokeLinejoin="round"
        fill="#0F172A"
      >
        ZOOMY PARK!
      </text>
      <text
        x="270"
        y="108"
        textAnchor="middle"
        fontFamily="Fredoka, system-ui, sans-serif"
        fontWeight="700"
        fontSize="82"
        stroke="#FFFFFF"
        strokeWidth="5"
        strokeLinejoin="round"
        fill="url(#zp-title-grad)"
      >
        ZOOMY PARK!
      </text>
    </g>

    {/* Little decorative stars flanking the title */}
    <g transform="translate(26, 70) rotate(-14)">
      <polygon
        points="16,0 20.5,10 31.5,11.2 23.2,18.8 25.5,29.8 16,24.2 6.5,29.8 8.8,18.8 0.5,11.2 11.5,10"
        fill="#FACC15"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </g>
    <g transform="translate(482, 62) rotate(16)">
      <polygon
        points="16,0 20.5,10 31.5,11.2 23.2,18.8 25.5,29.8 16,24.2 6.5,29.8 8.8,18.8 0.5,11.2 11.5,10"
        fill="#FACC15"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </g>
  </svg>
);

export const CarPreviewSvg: React.FC<{ car: CarConfig; className?: string }> = ({
  car,
  className = 'w-14 h-20',
}) => (
  <svg viewBox="0 0 80 112" className={className} aria-hidden="true">
    {/* Wheels */}
    <rect x="6" y="18" width="12" height="24" rx="5" fill="#1E293B" />
    <rect x="62" y="18" width="12" height="24" rx="5" fill="#1E293B" />
    <rect x="6" y="70" width="12" height="24" rx="5" fill="#1E293B" />
    <rect x="62" y="70" width="12" height="24" rx="5" fill="#1E293B" />

    {/* Car body */}
    <rect
      x="14"
      y="10"
      width="52"
      height="92"
      rx="18"
      fill={car.bodyColor}
      stroke="#0F172A"
      strokeWidth="3.5"
    />

    {/* Racing stripe */}
    <rect x="34" y="12" width="12" height="88" rx="4" fill={car.stripeColor} opacity="0.95" />

    {/* Windshield */}
    <path
      d="M22 36 C22 28, 58 28, 58 36 L55 52 L25 52 Z"
      fill="#BAE6FD"
      stroke="#0F172A"
      strokeWidth="2.5"
    />

    {/* Cabin roof */}
    <rect
      x="22"
      y="48"
      width="36"
      height="32"
      rx="10"
      fill={car.roofColor}
      stroke="#0F172A"
      strokeWidth="2.5"
    />

    {/* Special roof detail per car */}
    {car.id === 'blue_siren' && (
      <g>
        <rect x="28" y="57" width="11" height="8" rx="3" fill="#EF4444" stroke="#0F172A" strokeWidth="1.5" />
        <rect x="41" y="57" width="11" height="8" rx="3" fill="#38BDF8" stroke="#0F172A" strokeWidth="1.5" />
      </g>
    )}
    {car.id === 'minty_cone' && (
      <circle cx="40" cy="64" r="9" fill="#FFFDF7" stroke="#0F172A" strokeWidth="2" />
    )}

    {/* Headlights */}
    <ellipse cx="24" cy="18" rx="5" ry="4" fill="#FEF08A" stroke="#0F172A" strokeWidth="1.5" />
    <ellipse cx="56" cy="18" rx="5" ry="4" fill="#FEF08A" stroke="#0F172A" strokeWidth="1.5" />
  </svg>
);

export const StarIconSvg: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    <polygon
      points="16,2 20.2,10.6 29.6,12 22.8,18.6 24.4,28 16,23.5 7.6,28 9.2,18.6 2.4,12 11.8,10.6"
      fill="#FACC15"
      stroke="#B45309"
      strokeWidth="2.2"
      strokeLinejoin="round"
    />
  </svg>
);

export const HeartIconSvg: React.FC<{ filled: boolean; className?: string }> = ({
  filled,
  className = 'w-7 h-7',
}) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    <path
      d="M16 28 C16 28 4 20.2 4 11.5 C4 7.4 7.3 4 11.4 4 C13.8 4 15.9 5.2 16 6.8 C16.1 5.2 18.2 4 20.6 4 C24.7 4 28 7.4 28 11.5 C28 20.2 16 28 16 28 Z"
      fill={filled ? '#EF4444' : '#E2E8F0'}
      stroke={filled ? '#991B1B' : '#94A3B8'}
      strokeWidth="2.2"
      strokeLinejoin="round"
    />
    {filled && <circle cx="10.5" cy="10" r="2.2" fill="#FCA5A5" />}
  </svg>
);
