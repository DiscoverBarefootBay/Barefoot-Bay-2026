import React, { useState, useEffect } from 'react';

interface RocketAnimationProps {
  isLaunching: boolean;
  onLaunchComplete: () => void;
  customRocketIcon?: string; // This prop is maintained for compatibility but no longer used
}

export const RocketAnimation: React.FC<RocketAnimationProps> = ({
  isLaunching,
  onLaunchComplete,
}) => {
  const [rocketState, setRocketState] = useState<'idle' | 'prep' | 'launch' | 'completed'>('idle');
  const [rocketPosition, setRocketPosition] = useState(0);
  const [screenPullPosition, setScreenPullPosition] = useState(0);
  const [screenOpacity, setScreenOpacity] = useState(1);
  
  // Effect to handle launch sequence
  useEffect(() => {
    if (isLaunching && rocketState === 'idle') {
      // Start the prep animation
      setRocketState('prep');
      console.log("Rocket prep state activated");
      
      // After prep animation, start launch
      const prepTimer = setTimeout(() => {
        setRocketState('launch');
        console.log("Rocket launch state activated");
        
        // Calculate viewport height for animation
        const viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
        
        // Duration of launch animation in milliseconds
        // Using longer animation duration for more dramatic effect
        const launchDuration = 4500;
        const fps = 60;
        const totalFrames = launchDuration / (1000 / fps);
        const distancePerFrame = viewportHeight / totalFrames;
        
        // Animation interval
        let frame = 0;
        const animationInterval = setInterval(() => {
          frame++;
          
          // Update rocket position
          setRocketPosition(prev => prev - distancePerFrame);
          
          // Start the screen pull effect after the rocket has traveled 20% up
          if (frame > totalFrames * 0.2) {
            // Calculate screen pull position - follows the rocket but with delay and easing
            const screenPullProgress = Math.min(1, (frame - totalFrames * 0.2) / (totalFrames * 0.8));
            setScreenPullPosition(-screenPullProgress * viewportHeight * 1.2); // Pull screen up and a bit further
            
            // Fade out the screen as it gets pulled up
            if (frame > totalFrames * 0.6) {
              const opacityProgress = 1 - (frame - totalFrames * 0.6) / (totalFrames * 0.4);
              setScreenOpacity(Math.max(0, opacityProgress));
            }
          }
          
          // End animation
          if (frame >= totalFrames) {
            clearInterval(animationInterval);
            setRocketState('completed');
            onLaunchComplete(); // This will redirect to homepage
          }
        }, 1000 / fps);
        
        // Cleanup interval
        return () => {
          clearInterval(animationInterval);
        };
      }, 2000); // Prep animation duration
      
      // Cleanup
      return () => {
        clearTimeout(prepTimer);
      };
    }
  }, [isLaunching, rocketState, onLaunchComplete]);
  
  // Helper to get rocket classes based on state
  const getRocketClasses = () => {
    switch (rocketState) {
      case 'idle':
        return 'rocket-idle';
      case 'prep':
        return 'rocket-prep';
      case 'launch':
        return 'rocket-launching';
      case 'completed':
        return 'rocket-completed';
      default:
        return '';
    }
  };
  
  // Helper to get rocket transform style
  const getRocketStyle = () => {
    if (rocketState === 'launch' || rocketState === 'completed') {
      // Use the transform with translateX for our fixed rocket positioning
      return {
        transform: `translateY(${rocketPosition}px) translateX(-50%)`,
      };
    }
    return {};
  };
  
  // Get screen pull transform style
  const getScreenStyle = () => {
    return {
      transform: `translateY(${screenPullPosition}px)`,
      opacity: screenOpacity,
    };
  };
  
  // Get exhaust classes based on state
  const getExhaustClasses = () => {
    if (rocketState === 'idle') return 'rocket-exhaust-idle';
    if (rocketState === 'prep') return 'rocket-exhaust-prep';
    if (rocketState === 'launch') return 'rocket-exhaust-launch';
    return '';
  };
  
  return (
    <>
      {/* Screen overlay that will be pulled with the rocket */}
      {rocketState === 'launch' && (
        <div 
          className="screen-overlay" 
          style={getScreenStyle()}
        />
      )}
      
      <div className="rocket-animation-container">
        <div 
          className={`rocket-container ${getRocketClasses()}`}
          style={getRocketStyle()}
        >
          {/* Always use the specified Barefoot Bay rocket image */}
          <img
            src="/rocket-images/barefoot-bay-rocket.png"
            alt="Barefoot Bay Rocket"
            className={`rocket-image full-rocket ${rocketState === 'launch' ? 'rocket-launching' : ''}`}
            onLoad={() => console.log("Rocket image loaded successfully")}
            onError={(e) => {
              console.error("Error loading rocket image, using Asset1.svg instead:", e);
              
              // Get the parent element
              const parent = e.currentTarget.parentElement;
              if (parent) {
                // Remove the failed image
                e.currentTarget.remove();
                
                // Create a new img with Asset1.svg (no space)
                const assetImg = document.createElement("img");
                assetImg.src = "/uploads/icons/Asset1.svg";
                assetImg.alt = "Barefoot Bay Rocket";
                assetImg.className = `rocket-image full-rocket ${rocketState === 'launch' ? 'rocket-launching' : ''}`;
                
                // Add to parent
                parent.appendChild(assetImg);
              }
            }}
          />
          
          {/* Rocket exhaust */}
          <div className={`rocket-exhaust ${getExhaustClasses()}`}>
            <div className="exhaust-particle"></div>
            <div className="exhaust-particle"></div>
            <div className="exhaust-particle"></div>
            <div className="exhaust-particle"></div>
            <div className="exhaust-particle"></div>
            <div className="exhaust-particle"></div>
            <div className="exhaust-particle"></div>
            <div className="exhaust-particle"></div>
          </div>
        </div>
        
        {/* Launch pad base */}
        <div className="launch-pad"></div>
      </div>
      
      {/* CSS for animations */}
      <style>{`
        .rocket-animation-container {
          position: absolute;
          width: 100%;
          height: 100%;
          pointer-events: none;
          overflow: hidden;
          z-index: 20;
        }
        
        .screen-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: radial-gradient(ellipse at bottom, #1B2735 0%, #090A0F 100%);
          z-index: 15;
          transition: transform 0.1s linear;
          will-change: transform, opacity;
        }
        
        .rocket-container {
          position: absolute;
          left: 50%;
          bottom: 80px;
          transform: translateX(-50%);
          transition: transform 0.2s ease-in-out;
          z-index: 30;
          will-change: transform;
        }
        
        .rocket-icon {
          width: 64px;
          height: 64px;
          color: white;
          filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.7));
        }
        
        .rocket-image {
          width: 80px;
          height: 100px;
          object-fit: contain;
          filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.7));
        }
        
        .full-rocket {
          width: auto;
          height: 300px; /* Smaller height to ensure it fits */
          position: fixed; /* Use fixed positioning to ensure it's always visible */
          bottom: 100px; /* Position above the bottom of the screen */
          left: 50%;
          transform: translateX(-50%);
          z-index: 1000; /* Very high z-index to ensure it's above everything */
          background-color: transparent; /* Ensure background is transparent */
          display: block; /* Force display */
          pointer-events: none; /* Allow clicking through the rocket */
        }
        
        .rocket-idle {
          animation: hover 3s ease-in-out infinite;
        }
        
        .rocket-prep {
          animation: shake 0.5s ease-in-out infinite;
        }
        
        .rocket-launching {
          transition: transform 3s cubic-bezier(0.4, 0.0, 0.2, 1);
        }
        
        /* Special animation for full rocket */
        .full-rocket.rocket-launching {
          transition: transform 4.5s cubic-bezier(0.19, 1, 0.22, 1);
        }
        
        .launch-pad {
          position: absolute;
          bottom: 60px;
          left: 50%;
          width: 120px;
          height: 20px;
          background-color: #555;
          border-radius: 10px;
          transform: translateX(-50%);
        }
        
        /* Exhaust effects */
        .rocket-exhaust {
          position: absolute;
          bottom: -20px;
          left: 50%;
          transform: translateX(-50%);
          width: 20px;
          height: 10px;
          opacity: 0;
        }
        
        /* Adjust exhaust position for full rocket */
        .full-rocket + .rocket-exhaust {
          position: fixed;
          bottom: 0;
          width: 40px;
          z-index: 999;
        }
        
        .rocket-exhaust-idle {
          opacity: 0.3;
          height: 20px;
        }
        
        .rocket-exhaust-prep {
          opacity: 0.7;
          height: 40px;
          animation: flicker 0.2s ease-in-out infinite;
        }
        
        .rocket-exhaust-launch {
          opacity: 1;
          height: 100px;
          animation: expand 0.1s ease-in-out infinite;
        }
        
        .exhaust-particle {
          position: absolute;
          width: 10px;
          height: 10px;
          background-color: orange;
          border-radius: 50%;
          filter: blur(2px);
          animation: particle 1s ease-out infinite;
        }
        
        /* Animation keyframes */
        @keyframes hover {
          0%, 100% {
            transform: translateY(0) translateX(-50%);
          }
          50% {
            transform: translateY(-10px) translateX(-50%);
          }
        }
        
        @keyframes shake {
          0%, 100% {
            transform: translateY(0) translateX(-50%);
          }
          25% {
            transform: translateY(-2px) translateX(-49%);
          }
          50% {
            transform: translateY(0) translateX(-51%);
          }
          75% {
            transform: translateY(2px) translateX(-50%);
          }
        }
        
        @keyframes flicker {
          0%, 100% {
            opacity: 0.7;
          }
          50% {
            opacity: 0.9;
          }
        }
        
        @keyframes expand {
          0% {
            height: 80px;
          }
          50% {
            height: 120px;
          }
          100% {
            height: 100px;
          }
        }
        
        @keyframes particle {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 1;
          }
          100% {
            transform: translateY(60px) translateX(${Math.random() * 30 - 15}px);
            opacity: 0;
          }
        }
        
        .exhaust-particle:nth-child(1) { left: 0; bottom: 0; animation-delay: 0s; }
        .exhaust-particle:nth-child(2) { left: 5px; bottom: 5px; animation-delay: 0.1s; }
        .exhaust-particle:nth-child(3) { left: 10px; bottom: 0; animation-delay: 0.2s; }
        .exhaust-particle:nth-child(4) { left: 15px; bottom: 5px; animation-delay: 0.3s; }
        .exhaust-particle:nth-child(5) { left: 2px; bottom: 10px; animation-delay: 0.4s; }
        .exhaust-particle:nth-child(6) { left: 7px; bottom: 15px; animation-delay: 0.5s; }
        .exhaust-particle:nth-child(7) { left: 12px; bottom: 10px; animation-delay: 0.6s; }
        .exhaust-particle:nth-child(8) { left: 17px; bottom: 15px; animation-delay: 0.7s; }
      `}</style>
    </>
  );
};