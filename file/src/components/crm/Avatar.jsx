'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';

function getInitials(name) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const Avatar = ({ src, name, size = 40, className = '' }) => {
  const [imgError, setImgError] = useState(false);

  const containerStyle = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    borderRadius: '50%',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: size * 0.38,
    fontWeight: 600,
    color: '#fff',
    background: '#033457',
  };

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name || 'Avatar'}
        className={`rounded-circle ${className}`}
        style={{ width: size, height: size, objectFit: 'cover' }}
        onError={() => setImgError(true)}
      />
    );
  }

  const initials = getInitials(name);

  if (initials) {
    return (
      <span className={className} style={containerStyle}>
        {initials}
      </span>
    );
  }

  return (
    <span className={className} style={containerStyle}>
      <Icon icon="solar:user-bold" style={{ fontSize: size * 0.5 }} />
    </span>
  );
};

export default Avatar;
