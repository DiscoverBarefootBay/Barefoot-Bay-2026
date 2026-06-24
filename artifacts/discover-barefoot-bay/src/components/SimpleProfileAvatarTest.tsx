import React from 'react';
import ProfileAvatar from './ProfileAvatar';

/**
 * Simple test page for the ProfileAvatar component focusing on the badge positioning
 */
const SimpleProfileAvatarTest: React.FC = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Profile Avatar with Badge Test</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-semibold mb-4">Implementation based on the provided structure</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-md font-medium mb-3">Using ProfileAvatar Component</h3>
            <div className="flex flex-col items-start space-y-4">
              <div>
                <ProfileAvatar 
                  src="/profile.jpg" 
                  alt="User" 
                  badgeText="BB"
                  size="medium"
                />
              </div>
              <div>
                <ProfileAvatar 
                  src="/profile.jpg" 
                  alt="User" 
                  badgeText="BB"
                  size="large"
                />
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">With user's actual avatar:</p>
                <ProfileAvatar 
                  src="/uploads/avatar-1743871719936-482986751.jpg" 
                  alt="Michael" 
                  badgeText="BB"
                  size="large"
                />
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-md font-medium mb-3">Basic HTML/CSS Implementation</h3>
            <div className="flex flex-col items-start space-y-4">
              <div className="profile-wrapper medium">
                <img src="/profile.jpg" className="profile-avatar" alt="Profile" />
                <div className="badge-overlay">BB</div>
              </div>
              
              <div className="profile-wrapper large">
                <img src="/profile.jpg" className="profile-avatar" alt="Profile" />
                <div className="badge-overlay">BB</div>
              </div>
              
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">With user's actual avatar:</p>
                <div className="profile-wrapper large">
                  <img src="/uploads/avatar-1743871719936-482986751.jpg" className="profile-avatar" alt="Michael" />
                  <div className="badge-overlay">BB</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-semibold mb-4">CSS Explanation</h2>
        <div className="text-sm bg-gray-100 p-4 rounded-md">
          <pre className="whitespace-pre-wrap">
{`.profile-wrapper {
  position: relative;
  display: inline-block;
  transform-style: preserve-3d; /* Helps prevent clipping */
}

.profile-avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.badge-overlay {
  position: absolute;
  bottom: -4px;
  right: -4px;
  background-color: #4FB3CF;
  color: white;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  z-index: 1; /* Ensures badge appears above image */
}`}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default SimpleProfileAvatarTest;