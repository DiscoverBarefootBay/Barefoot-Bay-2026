import React from 'react';
import ProfileAvatar from './ProfileAvatar';

/**
 * Demo component to showcase the ProfileAvatar component with different configurations
 */
const ProfileAvatarDemo: React.FC = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Profile Avatar Component</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-4">Small Size</h2>
          <div className="flex items-center space-x-4">
            <ProfileAvatar 
              src="https://i.pravatar.cc/100?img=1" 
              alt="Jane Doe"
              size="small" 
              badgeText="BB"
            />
            <ProfileAvatar 
              src="" 
              alt="John Smith"
              size="small" 
              badgeText="JS"
            />
            <ProfileAvatar 
              src="https://i.pravatar.cc/100?img=3" 
              alt="Alice Johnson"
              size="small" 
              showBadge={false}
            />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-4">Medium Size (Default)</h2>
          <div className="flex items-center space-x-4">
            <ProfileAvatar 
              src="https://i.pravatar.cc/100?img=4" 
              alt="Robert Brown"
              badgeText="RB"
            />
            <ProfileAvatar 
              src="" 
              alt="Emily Davis"
              badgeText="ED"
            />
            <ProfileAvatar 
              src="https://i.pravatar.cc/100?img=6" 
              alt="Michael Wilson"
              showBadge={false}
            />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-4">Large Size</h2>
          <div className="flex items-center space-x-4">
            <ProfileAvatar 
              src="https://i.pravatar.cc/100?img=7" 
              alt="Sarah Taylor"
              size="large" 
              badgeText="ST"
            />
            <ProfileAvatar 
              src="" 
              alt="David Miller"
              size="large" 
              badgeText="DM"
            />
            <ProfileAvatar 
              src="https://i.pravatar.cc/100?img=9" 
              alt="Olivia Anderson"
              size="large" 
              showBadge={false}
            />
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-semibold mb-4">Example Usage</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-md font-medium mb-3">User Card</h3>
            <div className="flex items-center space-x-4 p-4 border rounded-lg">
              <ProfileAvatar 
                src="https://i.pravatar.cc/100?img=10" 
                alt="William Jones"
                size="medium" 
                badgeText="WJ"
              />
              <div>
                <p className="font-semibold">William Jones</p>
                <p className="text-sm text-gray-600">william.jones@example.com</p>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-md font-medium mb-3">Comment Section</h3>
            <div className="p-4 border rounded-lg">
              <div className="flex items-start space-x-3 mb-3">
                <ProfileAvatar 
                  src="https://i.pravatar.cc/100?img=11" 
                  alt="Elizabeth Martin"
                  size="small" 
                  badgeText="EM"
                />
                <div>
                  <p className="font-semibold">Elizabeth Martin</p>
                  <p className="text-sm text-gray-700">Great post! Thanks for sharing.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <ProfileAvatar 
                  src="https://i.pravatar.cc/100?img=12" 
                  alt="Richard Thompson"
                  size="small" 
                  badgeText="RT"
                />
                <div>
                  <p className="font-semibold">Richard Thompson</p>
                  <p className="text-sm text-gray-700">I agree with the points mentioned here.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileAvatarDemo;