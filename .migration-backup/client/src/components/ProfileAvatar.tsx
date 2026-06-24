import React from 'react';
import './profile-avatar.css';

interface ProfileAvatarProps {
  src?: string;
  alt?: string;
  badgeText?: string; 
  size?: 'small' | 'medium' | 'large';
  showBadge?: boolean;
  className?: string;
}

/**
 * ProfileAvatar component that displays a circular avatar with an optional badge overlay
 */
const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  src = '',
  alt = 'Profile Avatar',
  badgeText = 'BB',
  size = 'medium',
  showBadge = true,
  className = '',
}) => {
  // Fallback content for when image is not available
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Create a fallback when src is not provided
  const renderAvatar = () => {
    if (src) {
      return <img src={src} alt={alt} className="profile-avatar" />;
    }
    
    // Fallback to initials with a gray background
    return (
      <div 
        className="profile-avatar" 
        style={{ 
          backgroundColor: '#f0f0f0', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#666',
          fontSize: size === 'small' ? '14px' : size === 'medium' ? '18px' : '24px',
          fontWeight: 'bold'
        }}
      >
        {getInitials(alt)}
      </div>
    );
  };

  return (
    <div className={`profile-wrapper ${size} ${className}`}>
      {renderAvatar()}
      {showBadge && (
        <div className="badge-overlay">
          {badgeText}
        </div>
      )}
    </div>
  );
};

export default ProfileAvatar;