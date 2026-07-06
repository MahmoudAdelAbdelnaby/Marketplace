import React from 'react';
import { useNavigate } from 'react-router-dom';

export const APP_NAME = 'Concentrix Marketplace';

export default function Logo({ size = 30, showName = true }) {
  const nav = useNavigate();
  // Make the logo image 20% smaller than the container size requested
  const imgHeight = size * 0.8;
  
  return (
    <div onClick={() => nav('/catalog')} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
      <img 
        src="/concentrix-blue-logo.webp" 
        alt="Concentrix" 
        className="logo-light" 
        style={{ height: imgHeight, objectFit: 'contain' }} 
      />
      <img 
        src="/concentrix-white-logo.webp" 
        alt="Concentrix" 
        className="logo-dark" 
        style={{ height: imgHeight, objectFit: 'contain' }} 
      />
      
      {showName && (
        <div style={{ 
          fontFamily: 'var(--font-sans)', 
          fontWeight: 600, 
          fontSize: imgHeight * 0.85, 
          letterSpacing: '-0.02em',
          color: 'var(--text-primary)',
          borderLeft: '1px solid var(--border-color)',
          paddingLeft: 10,
          marginLeft: 4,
          marginTop: 8,
          display: 'flex',
          alignItems: 'center',
          height: imgHeight * 0.9
        }}>
          <span style={{ transform: 'translateY(-1px)' }}>Marketplace</span>
        </div>
      )}
    </div>
  );
}
