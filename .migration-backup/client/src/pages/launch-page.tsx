import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX, SkipForward, RotateCcw } from 'lucide-react';

export default function LaunchPage() {
  const [isCountdownActive, setIsCountdownActive] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [showReplay, setShowReplay] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [showAnimationPrompt, setShowAnimationPrompt] = useState(false);
  const [homepageRevealed, setHomepageRevealed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    setShowAnimationPrompt(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
      setShowAnimationPrompt(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Mission control comms based on countdown
  const getCommsMessage = (count: number): string => {
    const messages: Record<number, string> = {
      10: "Barefoot Bay, we are clear for launch.",
      7: "Go/No-Go poll complete—Barefoot Bay is go for launch.",
      5: "Range green. Weather is a go.",
      4: "Auto-sequence start.",
      3: "Guidance is internal.",
      2: "Main engine arm enabled.",
      1: "Ignition sequence start.",
      0: "Liftoff—Barefoot Bay is live!"
    };
    return messages[count] || "";
  };

  // Handle countdown - 3 seconds per number for 30 second total
  useEffect(() => {
    if (!isCountdownActive || countdown <= 0) return;

    const timer = setTimeout(() => {
      setCountdown(prev => prev - 1);
    }, 3000);

    return () => clearTimeout(timer);
  }, [isCountdownActive, countdown]);

  // Handle countdown completion - show LIFTOFF for 3 seconds then launch
  useEffect(() => {
    if (isCountdownActive && countdown === 0) {
      setTimeout(() => {
        handleLaunch();
      }, 3000);
    }
  }, [isCountdownActive, countdown]);

  const handleLaunch = () => {
    setIsLaunching(true);
    setIsCountdownActive(false); // Immediately stop countdown to prevent re-triggering
    
    // Reset and play audio if enabled
    if (soundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => console.error('Audio play failed:', err));
    }

    // Complete launch sequence after animation - reveal homepage and change URL
    setTimeout(() => {
      setHomepageRevealed(true);
      setIsComplete(true);
      setShowReplay(true);
      setIsLaunching(false);
      
      // Smoothly transition URL from /launch to /
      window.history.replaceState({}, '', '/');
    }, prefersReducedMotion ? 100 : 3500);
  };

  const handleStartCountdown = () => {
    setIsCountdownActive(true);
    setShowAnimationPrompt(false);
    
    // Reset audio if it exists
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const handleSkip = () => {
    window.location.href = '/';
  };

  const handleReplay = () => {
    setIsCountdownActive(false);
    setIsLaunching(false);
    setIsComplete(false);
    setShowReplay(false);
    setCountdown(10);
    setHomepageRevealed(false);
    
    // Reset audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const toggleSound = () => {
    setSoundEnabled(!soundEnabled);
  };

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-[#0D1F22]">
      {/* Homepage iframe - revealed after launch */}
      <iframe
        ref={iframeRef}
        src="/"
        className={`absolute inset-0 w-full h-full border-0 transition-opacity duration-1000 ${homepageRevealed ? 'opacity-100 z-0' : 'opacity-0 -z-10'}`}
        title="Barefoot Bay Homepage"
        style={{ backgroundColor: '#0D1F22' }}
      />

      {/* Beach Scene Background */}
      <div className={`absolute inset-0 beach-background transition-opacity duration-500 ${homepageRevealed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {/* Sky gradient - golden hour */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#FFB75E] via-[#ED8F5B] to-[#87CEEB]" />
        
        {/* Sun */}
        <div className="sun" />
        
        {/* Clouds */}
        <div className="cloud cloud-1" />
        <div className="cloud cloud-2" />
        <div className="cloud cloud-3" />
        
        {/* Ocean */}
        <div className="ocean">
          <div className="wave wave-1" />
          <div className="wave wave-2" />
          <div className="wave wave-3" />
        </div>
        
        {/* Beach sand */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#F4E4C1] via-[#EDD9B0] to-transparent" />
      </div>

      {/* Main Content */}
      <div className={`relative z-10 h-full flex flex-col items-center justify-center transition-opacity duration-500 ${homepageRevealed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {!isCountdownActive && !isLaunching && !homepageRevealed && (
          <div className="text-center mb-8">
            <h1 className="text-5xl md:text-7xl font-bold text-white drop-shadow-lg mb-4" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
              Welcome to Barefoot Bay
            </h1>
            {showAnimationPrompt ? (
              <div className="mt-8">
                <p className="text-xl text-white mb-4">Animation disabled due to motion preferences</p>
                <Button
                  size="lg"
                  onClick={handleStartCountdown}
                  className="bg-coral hover:bg-coral/90 text-white font-bold px-8 py-6 text-2xl"
                  data-testid="button-play-animation"
                >
                  Play Animation
                </Button>
              </div>
            ) : (
              <Button
                size="lg"
                onClick={handleStartCountdown}
                className="bg-coral hover:bg-coral/90 text-white font-bold px-12 py-8 text-3xl launch-button"
                data-testid="button-launch"
              >
                Launch
              </Button>
            )}
          </div>
        )}

        {/* Countdown Timer & Mission Control */}
        {isCountdownActive && countdown > 0 && (
          <div className="text-center countdown-display">
            <div className="text-8xl md:text-9xl font-bold text-white countdown-number" data-testid="text-countdown">
              T-{countdown}
            </div>
            <div className="mt-6 mission-control-strip">
              <div className="text-xl md:text-2xl text-white font-mono bg-black/40 px-6 py-3 rounded-lg backdrop-blur-sm comms-text" data-testid="text-mission-control">
                {getCommsMessage(countdown)}
              </div>
            </div>
          </div>
        )}

        {countdown === 0 && isCountdownActive && (
          <div className="text-center">
            <div className="text-8xl md:text-9xl font-bold text-white" data-testid="text-liftoff">
              LIFTOFF!
            </div>
            <div className="mt-6 text-2xl text-white font-mono bg-black/40 px-6 py-3 rounded-lg backdrop-blur-sm">
              Barefoot Bay is live!
            </div>
          </div>
        )}

        {/* Rocket on Tiki Launch Pad */}
        <div className={`rocket-container ${isLaunching ? 'launching' : 'idle'}`} data-testid="rocket">
          {/* Tiki Launch Pad */}
          <div className="tiki-pad">
            <div className="tiki-pole tiki-left" />
            <div className="tiki-pole tiki-right" />
            <div className="launch-platform" />
          </div>
          
          {/* Rocket with surfboard fins */}
          <div className="rocket">
            <div className="rocket-nose" />
            <div className="rocket-body" />
            <div className="surfboard-fin fin-left" />
            <div className="surfboard-fin fin-right" />
            
            {/* Nav lights */}
            <div className="nav-light nav-light-1" />
            <div className="nav-light nav-light-2" />
            
            {/* Smoke puffs */}
            <div className="smoke smoke-1" />
            <div className="smoke smoke-2" />
            <div className="smoke smoke-3" />
          </div>
          
          {/* Launch effects */}
          {isLaunching && (
            <>
              <div className="launch-smoke" />
              <div className="contrail" />
            </>
          )}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={toggleSound}
          className="bg-white/80 hover:bg-white"
          data-testid="button-sound-toggle"
        >
          {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </Button>
        
        {!isLaunching && (
          <Button
            variant="outline"
            onClick={handleSkip}
            className="bg-white/80 hover:bg-white"
            data-testid="button-skip"
          >
            <SkipForward className="h-4 w-4 mr-2" />
            Skip Intro
          </Button>
        )}
        
        {showReplay && (
          <Button
            variant="outline"
            onClick={handleReplay}
            className="bg-white/80 hover:bg-white"
            data-testid="button-replay"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Replay
          </Button>
        )}
      </div>

      {/* Pull-away screen overlay */}
      {isLaunching && !prefersReducedMotion && (
        <div className="screen-pull-overlay" />
      )}

      {/* Post-launch overlay - rocket in corner with contrail */}
      {homepageRevealed && (
        <div className="post-launch-overlay">
          {/* Ambient beach elements */}
          <div className="ambient-waves" />
          <div className="ambient-clouds" />
          
          {/* Rocket in corner */}
          <div className="rocket-corner">
            <div className="rocket-small">
              <div className="rocket-nose-small" />
              <div className="rocket-body-small" />
            </div>
            {/* Contrail underline */}
            <div className="contrail-underline" />
          </div>
        </div>
      )}

      {/* Audio element */}
      <audio ref={audioRef} preload="auto">
        <source src="/sounds/rocket-launch.mp3" type="audio/mpeg" />
      </audio>

      <style>{`
        .beach-background {
          animation: ambient-shimmer 8s ease-in-out infinite;
        }

        @keyframes ambient-shimmer {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.95; }
        }

        /* Sun */
        .sun {
          position: absolute;
          top: 10%;
          right: 15%;
          width: 120px;
          height: 120px;
          background: radial-gradient(circle, #FFF4E6 0%, #FFD700 50%, #FFB75E 100%);
          border-radius: 50%;
          box-shadow: 0 0 60px rgba(255, 215, 0, 0.6);
          animation: sun-glow 4s ease-in-out infinite;
        }

        @keyframes sun-glow {
          0%, 100% { box-shadow: 0 0 60px rgba(255, 215, 0, 0.6); }
          50% { box-shadow: 0 0 80px rgba(255, 215, 0, 0.8); }
        }

        /* Clouds */
        .cloud {
          position: absolute;
          background: rgba(255, 255, 255, 0.6);
          border-radius: 100px;
          opacity: 0.8;
        }

        .cloud::before,
        .cloud::after {
          content: '';
          position: absolute;
          background: rgba(255, 255, 255, 0.6);
          border-radius: 100px;
        }

        .cloud-1 {
          width: 100px;
          height: 40px;
          top: 15%;
          left: 10%;
          animation: cloud-drift-1 40s linear infinite;
        }

        .cloud-1::before {
          width: 50px;
          height: 50px;
          top: -25px;
          left: 10px;
        }

        .cloud-1::after {
          width: 60px;
          height: 40px;
          top: -15px;
          right: 10px;
        }

        .cloud-2 {
          width: 120px;
          height: 45px;
          top: 25%;
          right: 20%;
          animation: cloud-drift-2 50s linear infinite;
        }

        .cloud-2::before {
          width: 60px;
          height: 60px;
          top: -30px;
          left: 15px;
        }

        .cloud-2::after {
          width: 70px;
          height: 45px;
          top: -20px;
          right: 15px;
        }

        .cloud-3 {
          width: 80px;
          height: 35px;
          top: 35%;
          left: 30%;
          animation: cloud-drift-3 60s linear infinite;
        }

        .cloud-3::before {
          width: 40px;
          height: 40px;
          top: -20px;
          left: 10px;
        }

        .cloud-3::after {
          width: 50px;
          height: 35px;
          top: -15px;
          right: 10px;
        }

        @keyframes cloud-drift-1 {
          0% { transform: translateX(0); }
          100% { transform: translateX(100vw); }
        }

        @keyframes cloud-drift-2 {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100vw); }
        }

        @keyframes cloud-drift-3 {
          0% { transform: translateX(0); }
          100% { transform: translateX(100vw); }
        }

        /* Ocean waves */
        .ocean {
          position: absolute;
          bottom: 80px;
          left: 0;
          right: 0;
          height: 200px;
          overflow: hidden;
        }

        .wave {
          position: absolute;
          bottom: 0;
          width: 200%;
          height: 100%;
          background: linear-gradient(to bottom, rgba(135, 206, 235, 0.3) 0%, rgba(70, 130, 180, 0.5) 100%);
        }

        .wave-1 {
          animation: wave-motion 8s ease-in-out infinite;
          opacity: 0.4;
        }

        .wave-2 {
          animation: wave-motion 6s ease-in-out infinite reverse;
          opacity: 0.3;
          animation-delay: -2s;
        }

        .wave-3 {
          animation: wave-motion 10s ease-in-out infinite;
          opacity: 0.2;
          animation-delay: -4s;
        }

        @keyframes wave-motion {
          0%, 100% {
            transform: translateX(0) translateY(0);
            border-radius: 40% 60% 50% 50%;
          }
          25% {
            transform: translateX(-5%) translateY(-3%);
            border-radius: 50% 50% 40% 60%;
          }
          50% {
            transform: translateX(-10%) translateY(0);
            border-radius: 60% 40% 60% 40%;
          }
          75% {
            transform: translateX(-5%) translateY(3%);
            border-radius: 50% 60% 50% 40%;
          }
        }

        /* Launch Button */
        .launch-button {
          background: linear-gradient(135deg, #FF6F61 0%, #FF8A75 100%) !important;
          border: 3px solid white;
          box-shadow: 0 4px 20px rgba(255, 111, 97, 0.4);
          animation: button-pulse 2s ease-in-out infinite;
        }

        @keyframes button-pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 4px 20px rgba(255, 111, 97, 0.4);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 6px 30px rgba(255, 111, 97, 0.6);
          }
        }

        /* Countdown */
        .countdown-number {
          text-shadow: 3px 3px 6px rgba(0,0,0,0.4);
          animation: countdown-pulse 1s ease-in-out;
        }

        @keyframes countdown-pulse {
          0% {
            transform: scale(0.8);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .comms-text {
          animation: comms-appear 0.5s ease-out;
        }

        @keyframes comms-appear {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Rocket Container */
        .rocket-container {
          position: fixed;
          bottom: 50px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 20;
        }

        .rocket-container.idle {
          animation: rocket-idle 3s ease-in-out infinite;
        }

        .rocket-container.launching {
          animation: rocket-launch 3.5s cubic-bezier(0.19, 1, 0.22, 1) forwards;
        }

        @keyframes rocket-idle {
          0%, 100% {
            transform: translateX(-50%) translateY(0);
          }
          50% {
            transform: translateX(-50%) translateY(-10px);
          }
        }

        @keyframes rocket-launch {
          0% {
            transform: translateX(-50%) translateY(0) scale(1);
            opacity: 1;
          }
          20% {
            transform: translateX(-50%) translateY(-100px) scale(1.1);
          }
          100% {
            transform: translateX(-50%) translateY(-1500px) scale(0.5);
            opacity: 0;
          }
        }

        /* Tiki Launch Pad */
        .tiki-pad {
          position: relative;
          width: 200px;
          height: 40px;
        }

        .launch-platform {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 20px;
          background: linear-gradient(to bottom, #8B4513 0%, #654321 100%);
          border-radius: 4px;
        }

        .tiki-pole {
          position: absolute;
          bottom: 20px;
          width: 8px;
          height: 60px;
          background: linear-gradient(to right, #654321 0%, #8B4513 50%, #654321 100%);
          border-radius: 4px;
        }

        .tiki-left {
          left: 20px;
        }

        .tiki-right {
          right: 20px;
        }

        /* Rocket */
        .rocket {
          position: absolute;
          bottom: 40px;
          left: 50%;
          transform: translateX(-50%);
          width: 60px;
          height: 120px;
        }

        .rocket-nose {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 20px solid transparent;
          border-right: 20px solid transparent;
          border-bottom: 40px solid #FF6F61;
        }

        .rocket-body {
          position: absolute;
          top: 40px;
          left: 50%;
          transform: translateX(-50%);
          width: 40px;
          height: 80px;
          background: linear-gradient(to bottom, #FF6F61 0%, #FF8A75 100%);
          border-radius: 4px;
        }

        /* Surfboard-style fins */
        .surfboard-fin {
          position: absolute;
          bottom: 0;
          width: 25px;
          height: 50px;
          background: linear-gradient(135deg, #87CEEB 0%, #4682B4 100%);
          border-radius: 0 0 15px 15px;
        }

        .fin-left {
          left: -15px;
          transform: skewX(-10deg);
        }

        .fin-right {
          right: -15px;
          transform: skewX(10deg);
        }

        /* Nav lights */
        .nav-light {
          position: absolute;
          width: 6px;
          height: 6px;
          background: #FFD700;
          border-radius: 50%;
          box-shadow: 0 0 8px #FFD700;
        }

        .nav-light-1 {
          top: 60px;
          left: 10px;
          animation: blink-1 1.5s infinite;
        }

        .nav-light-2 {
          top: 60px;
          right: 10px;
          animation: blink-2 1.5s infinite;
        }

        @keyframes blink-1 {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }

        @keyframes blink-2 {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }

        /* Smoke puffs */
        .smoke {
          position: absolute;
          bottom: -10px;
          left: 50%;
          transform: translateX(-50%);
          width: 20px;
          height: 20px;
          background: rgba(200, 200, 200, 0.6);
          border-radius: 50%;
          animation: smoke-rise 2s ease-out infinite;
        }

        .smoke-1 {
          animation-delay: 0s;
        }

        .smoke-2 {
          animation-delay: 0.7s;
        }

        .smoke-3 {
          animation-delay: 1.4s;
        }

        @keyframes smoke-rise {
          0% {
            transform: translateX(-50%) translateY(0) scale(0.5);
            opacity: 0.6;
          }
          100% {
            transform: translateX(-50%) translateY(-40px) scale(1.5);
            opacity: 0;
          }
        }

        /* Launch smoke */
        .launch-smoke {
          position: absolute;
          bottom: -20px;
          left: 50%;
          transform: translateX(-50%);
          width: 80px;
          height: 80px;
          background: radial-gradient(circle, rgba(255, 200, 100, 0.8) 0%, rgba(255, 150, 50, 0.4) 50%, transparent 100%);
          border-radius: 50%;
          animation: smoke-bloom 2s ease-out forwards;
        }

        @keyframes smoke-bloom {
          0% {
            transform: translateX(-50%) scale(0.5);
            opacity: 1;
          }
          100% {
            transform: translateX(-50%) scale(3);
            opacity: 0;
          }
        }

        /* Contrail */
        .contrail {
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 4px;
          height: 0;
          background: linear-gradient(to bottom, rgba(255, 255, 255, 0.8) 0%, transparent 100%);
          animation: contrail-extend 3s ease-out forwards;
        }

        @keyframes contrail-extend {
          0% {
            height: 0;
            opacity: 1;
          }
          100% {
            height: 800px;
            opacity: 0.3;
          }
        }

        /* Screen pull-away overlay */
        .screen-pull-overlay {
          position: fixed;
          inset: 0;
          background: linear-gradient(to bottom, #FFB75E 0%, #ED8F5B 50%, #87CEEB 100%);
          z-index: 100;
          animation: screen-pull 3s ease-in-out 0.5s forwards;
        }

        @keyframes screen-pull {
          0% {
            transform: translateY(0);
            opacity: 1;
          }
          60% {
            transform: translateY(-100%);
            opacity: 1;
          }
          100% {
            transform: translateY(-100%);
            opacity: 0;
          }
        }

        /* Post-launch overlay */
        .post-launch-overlay {
          position: fixed;
          inset: 0;
          z-index: 30;
          pointer-events: none;
        }

        /* Ambient waves */
        .ambient-waves {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 100px;
          background: linear-gradient(to bottom, rgba(135, 206, 235, 0.1) 0%, rgba(70, 130, 180, 0.2) 100%);
          animation: ambient-wave-shimmer 6s ease-in-out infinite;
        }

        @keyframes ambient-wave-shimmer {
          0%, 100% {
            opacity: 0.3;
            transform: translateY(0);
          }
          50% {
            opacity: 0.5;
            transform: translateY(-5px);
          }
        }

        /* Ambient clouds */
        .ambient-clouds {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 200px;
          background: radial-gradient(ellipse at top, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
          animation: ambient-cloud-drift 10s ease-in-out infinite;
        }

        @keyframes ambient-cloud-drift {
          0%, 100% {
            opacity: 0.2;
          }
          50% {
            opacity: 0.4;
          }
        }

        /* Rocket in corner */
        .rocket-corner {
          position: absolute;
          top: 20px;
          right: 20px;
          animation: rocket-settle 2s ease-out forwards;
        }

        @keyframes rocket-settle {
          0% {
            transform: translate(200px, -200px) rotate(45deg);
            opacity: 0;
          }
          100% {
            transform: translate(0, 0) rotate(-15deg);
            opacity: 1;
          }
        }

        /* Small rocket */
        .rocket-small {
          position: relative;
          width: 30px;
          height: 60px;
        }

        .rocket-nose-small {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 10px solid transparent;
          border-right: 10px solid transparent;
          border-bottom: 20px solid #FF6F61;
        }

        .rocket-body-small {
          position: absolute;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          width: 20px;
          height: 40px;
          background: linear-gradient(to bottom, #FF6F61 0%, #FF8A75 100%);
          border-radius: 2px;
        }

        /* Contrail underline */
        .contrail-underline {
          position: absolute;
          top: 70px;
          right: 0;
          width: 150px;
          height: 3px;
          background: linear-gradient(to left, rgba(255, 111, 97, 0.6) 0%, transparent 100%);
          box-shadow: 0 0 10px rgba(255, 111, 97, 0.4);
          animation: contrail-fade-in 2s ease-out 1s forwards;
          opacity: 0;
        }

        @keyframes contrail-fade-in {
          0% {
            opacity: 0;
            width: 0;
          }
          100% {
            opacity: 1;
            width: 150px;
          }
        }

        /* Reduced motion overrides */
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        /* Custom color */
        .bg-coral {
          background-color: #FF6F61;
        }
      `}</style>
    </div>
  );
}
