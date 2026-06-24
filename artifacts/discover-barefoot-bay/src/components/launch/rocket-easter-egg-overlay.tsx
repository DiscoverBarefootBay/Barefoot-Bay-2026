import { useEffect, useState, useCallback, useMemo, useRef } from 'react';

interface RocketEasterEggOverlayProps {
  isActive: boolean;
  onComplete: () => void;
}

type AnimationState = 'idle' | 'emerging' | 'ready' | 'countdown' | 'launch' | 'clearing' | 'complete';

const getSmokeParticleCount = (state: AnimationState, countdown: number): number => {
  if (state === 'launch') return 100;
  if (state === 'countdown') return Math.min(20 + (5 - countdown) * 8, 60);
  if (state === 'ready') return 12;
  if (state === 'emerging') return 8;
  return 0;
};

const getFlameSparkCount = (countdown: number): number => {
  return Math.min(2 + (5 - countdown) * 2, 12);
};

const getSparkIntensity = (countdown: number): number => {
  return (5 - countdown) / 5;
};

export function RocketEasterEggOverlay({ isActive, onComplete }: RocketEasterEggOverlayProps) {
  const [animationState, setAnimationState] = useState<AnimationState>('idle');
  const [countdownValue, setCountdownValue] = useState(5);
  const [flameVisible, setFlameVisible] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  
  const timersRef = useRef<{
    emerge?: ReturnType<typeof setTimeout>;
    ready?: ReturnType<typeof setTimeout>;
    countdown?: ReturnType<typeof setInterval>;
    launch?: ReturnType<typeof setTimeout>;
    clear?: ReturnType<typeof setTimeout>;
  }>({});

  const smokeParticles = useMemo(() => {
    return Array.from({ length: 100 }, (_, i) => ({
      id: i,
      xOffset: (Math.random() - 0.5) * 40,
      yOffset: Math.random() * 15,
      delay: i * 0.05,
    }));
  }, []);

  const flameSparkParticles = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      id: i,
      angle: Math.random() * 360,
      distance: 20 + Math.random() * 30,
      delay: i * 0.1,
    }));
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const reset = useCallback(() => {
    if (timersRef.current.emerge) clearTimeout(timersRef.current.emerge);
    if (timersRef.current.ready) clearTimeout(timersRef.current.ready);
    if (timersRef.current.countdown) clearInterval(timersRef.current.countdown);
    if (timersRef.current.launch) clearTimeout(timersRef.current.launch);
    if (timersRef.current.clear) clearTimeout(timersRef.current.clear);
    timersRef.current = {};
    setAnimationState('idle');
    setCountdownValue(5);
    setFlameVisible(false);
  }, []);

  useEffect(() => {
    if (!isActive) {
      reset();
      return;
    }

    if (prefersReducedMotion) {
      setAnimationState('emerging');
      
      timersRef.current.emerge = setTimeout(() => {
        setAnimationState('complete');
        onComplete();
      }, 2000);
      
      return () => {
        if (timersRef.current.emerge) clearTimeout(timersRef.current.emerge);
      };
    }

    setAnimationState('emerging');

    timersRef.current.emerge = setTimeout(() => {
      setAnimationState('ready');
      
      timersRef.current.ready = setTimeout(() => {
        setAnimationState('countdown');
        setCountdownValue(5);
        
        let countdown = 5;
        timersRef.current.countdown = setInterval(() => {
          countdown--;
          
          if (countdown < 0) {
            if (timersRef.current.countdown) clearInterval(timersRef.current.countdown);
            setAnimationState('launch');
            setFlameVisible(true);
            
            timersRef.current.launch = setTimeout(() => {
              setAnimationState('clearing');
              setFlameVisible(false);
              
              timersRef.current.clear = setTimeout(() => {
                setAnimationState('complete');
                onComplete();
              }, 1000);
            }, 2000);
          } else {
            setCountdownValue(countdown);
          }
        }, 1000);
      }, 1000);
    }, 2000);

    return () => {
      if (timersRef.current.emerge) clearTimeout(timersRef.current.emerge);
      if (timersRef.current.ready) clearTimeout(timersRef.current.ready);
      if (timersRef.current.countdown) clearInterval(timersRef.current.countdown);
      if (timersRef.current.launch) clearTimeout(timersRef.current.launch);
      if (timersRef.current.clear) clearTimeout(timersRef.current.clear);
      timersRef.current = {};
    };
  }, [isActive, prefersReducedMotion, onComplete, reset]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isActive) {
        onComplete();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isActive, onComplete]);

  if (!isActive || animationState === 'idle' || animationState === 'complete') {
    return null;
  }

  return (
    <div 
      className={`fixed inset-0 z-[9999] pointer-events-none rocket-overlay-bg ${
        animationState === 'emerging' ? 'bg-emerging' :
        animationState === 'ready' || animationState === 'countdown' ? 'bg-ready' :
        animationState === 'launch' ? 'bg-launch' :
        animationState === 'clearing' ? 'bg-clearing' : ''
      }`}
      role="presentation"
      aria-hidden="true"
    >
      <div 
        className={`rocket-container-wrapper ${
          animationState === 'emerging' ? 'rocket-emerging' :
          animationState === 'ready' || animationState === 'countdown' ? 'rocket-ready' :
          animationState === 'launch' ? 'rocket-launching' :
          ''
        }`}
      >
        {/* Countdown flame sparks - progressive build-up */}
        {animationState === 'countdown' && (
          <div 
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              top: 'calc(100% - 20px)',
              zIndex: 1,
            }}
          >
            <div className="flame-spark-container">
              {flameSparkParticles.slice(0, getFlameSparkCount(countdownValue)).map((particle) => (
                <div
                  key={particle.id}
                  className="flame-spark"
                  style={{
                    '--spark-angle': `${particle.angle}deg`,
                    '--spark-distance': `${particle.distance}px`,
                    '--spark-intensity': getSparkIntensity(countdownValue),
                    animationDelay: `${particle.delay}s`,
                  } as React.CSSProperties}
                />
              ))}
            </div>
          </div>
        )}

        {/* Smoke plume - positioned with flame */}
        {(animationState === 'emerging' || animationState === 'ready' || animationState === 'countdown' || animationState === 'launch') && (
          <div 
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              top: 'calc(100% - 15px)',
              zIndex: 0,
            }}
          >
            <div className="smoke-plume-container">
              {smokeParticles.slice(0, getSmokeParticleCount(animationState, countdownValue)).map((particle) => (
                <div
                  key={particle.id}
                  className={animationState === 'launch' ? 'smoke-thrust' : 'smoke-idle'}
                  style={{
                    '--smoke-x': `${particle.xOffset}px`,
                    '--smoke-y': `${particle.yOffset}px`,
                    animationDelay: `${particle.delay}s`,
                  } as React.CSSProperties}
                />
              ))}
            </div>
          </div>
        )}
        
        {flameVisible && (
          <div 
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              top: 'calc(100% - 18px)',
              zIndex: -1,
            }}
          >
            <div className="easter-egg-flame-container">
              <div className="flame-base"></div>
              <div className="flame-middle"></div>
              <div className="flame-tip"></div>
              <div className="spark spark1"></div>
              <div className="spark spark2"></div>
              <div className="spark spark3"></div>
              <div className="smoke smoke1"></div>
              <div className="smoke smoke2"></div>
            </div>
          </div>
        )}
        
        <img
          src="/rocket-images/barefoot-bay-rocket.png"
          alt=""
          className={`h-48 sm:h-64 md:h-80 lg:h-96 w-auto object-contain ${
            animationState === 'ready' || animationState === 'countdown' || animationState === 'launch' ? 'animate-launch-vibration' : ''
          }`}
          style={{
            filter: 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.5))',
            position: 'relative',
            zIndex: 0,
          }}
        />
      </div>

      {animationState === 'countdown' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-8xl sm:text-9xl font-bold text-white mb-4 animate-pulse-slow" style={{
            textShadow: '0 0 30px rgba(255, 255, 255, 0.8), 0 0 60px rgba(255, 100, 100, 0.6)',
          }}>
            T-{countdownValue}
          </div>
          {countdownValue >= 2 && (
            <div className="text-xl sm:text-2xl text-white/90 font-advent-pro max-w-2xl text-center px-4" style={{
              textShadow: '0 2px 10px rgba(0, 0, 0, 0.8)',
            }}>
              Barefoot Bay, we are clear for launch.
            </div>
          )}
          {countdownValue <= 1 && (
            <div className="text-xl sm:text-2xl text-white/90 font-advent-pro max-w-2xl text-center px-4" style={{
              textShadow: '0 2px 10px rgba(0, 0, 0, 0.8)',
            }}>
              Liftoff! Welcome to Barefoot Bay.
            </div>
          )}
        </div>
      )}

      {animationState === 'launch' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-xl sm:text-2xl text-white/90 font-advent-pro max-w-2xl text-center px-4 animate-pulse-slow" style={{
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.8)',
          }}>
            Liftoff! Welcome to Barefoot Bay.
          </div>
        </div>
      )}

      <style>{`
        .rocket-overlay-bg {
          transition: background 0.3s ease-out;
          background: transparent;
        }

        .rocket-overlay-bg.bg-emerging {
          background: radial-gradient(ellipse at bottom, rgba(27, 39, 53, 0.3), rgba(9, 10, 15, 0.24));
        }

        .rocket-overlay-bg.bg-ready,
        .rocket-overlay-bg.bg-countdown {
          background: radial-gradient(ellipse at bottom, rgba(27, 39, 53, 0.3), rgba(9, 10, 15, 0.24));
        }

        .rocket-overlay-bg.bg-launch {
          background: radial-gradient(ellipse at bottom, rgba(27, 39, 53, 0.8), rgba(9, 10, 15, 0.64));
          transition: background 0.5s ease-out;
        }

        .rocket-overlay-bg.bg-clearing {
          background: transparent;
          transition: background 1s ease-out;
        }

        .rocket-container-wrapper {
          position: absolute;
          left: 50%;
          bottom: 0;
          transform: translateX(-50%) translateY(400px);
          will-change: transform;
        }

        .rocket-container-wrapper.rocket-emerging {
          animation: rocket-emerge 2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .rocket-container-wrapper.rocket-ready {
          transform: translateX(-50%) translateY(0);
        }

        .rocket-container-wrapper.rocket-launching {
          animation: rocket-launch 2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        @keyframes rocket-emerge {
          0% {
            transform: translateX(-50%) translateY(400px);
          }
          100% {
            transform: translateX(-50%) translateY(0);
          }
        }

        @keyframes rocket-launch {
          0% {
            transform: translateX(-50%) translateY(0);
          }
          100% {
            transform: translateX(-50%) translateY(calc(-100vh - 200px));
          }
        }

        @keyframes launch-vibration {
          0% { transform: translate(0, 0) rotate(0deg); }
          10% { transform: translate(-1px, 2px) rotate(-1deg); }
          20% { transform: translate(2px, -1px) rotate(1.2deg); }
          30% { transform: translate(-2px, 1px) rotate(-0.8deg); }
          40% { transform: translate(1px, -2px) rotate(1.5deg); }
          50% { transform: translate(-1px, 2px) rotate(-1.2deg); }
          60% { transform: translate(2px, 0) rotate(0.8deg); }
          70% { transform: translate(-1px, -1px) rotate(-1deg); }
          80% { transform: translate(1px, 1px) rotate(1deg); }
          90% { transform: translate(-2px, 0) rotate(-0.5deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }

        @keyframes pulse-slow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
        
        @keyframes smoke-rise-idle {
          0% {
            transform: translate(0, 0) scale(0.4);
            opacity: 0;
          }
          15% {
            opacity: 0.5;
          }
          100% {
            transform: translate(var(--smoke-x, 0), calc(80px + var(--smoke-y, 0))) scale(1.4);
            opacity: 0;
          }
        }

        @keyframes smoke-rise-thrust {
          0% {
            transform: translate(0, 0) scale(0.5);
            opacity: 0;
          }
          10% {
            opacity: 0.7;
          }
          100% {
            transform: translate(calc(var(--smoke-x, 0) * 1.8), calc(120px + var(--smoke-y, 0))) scale(2.0);
            opacity: 0;
          }
        }

        @keyframes flame-flicker {
          0%, 100% {
            transform: scaleY(1) scaleX(1);
            opacity: 1;
          }
          50% {
            transform: scaleY(1.2) scaleX(0.9);
            opacity: 0.8;
          }
        }

        .animate-launch-vibration {
          animation: launch-vibration 0.08s ease-in-out infinite;
        }

        .animate-pulse-slow {
          animation: pulse-slow 1s ease-in-out infinite;
        }

        .smoke-container {
          position: relative;
          width: 60px;
          height: 60px;
        }

        .smoke-particle {
          position: absolute;
          width: 20px;
          height: 20px;
          background: radial-gradient(circle, rgba(200, 200, 200, 0.8), rgba(150, 150, 150, 0.4));
          border-radius: 50%;
          filter: blur(4px);
          animation: smoke-rise 2s ease-out infinite;
        }

        .easter-egg-flame-container {
          position: relative;
          width: 60px;
          height: 100px;
          display: flex;
          flex-direction: column;
          align-items: center;
          overflow: visible;
          z-index: -1;
        }

        .easter-egg-flame-container .flame-base {
          width: 50px;
          height: 70px;
        }

        .easter-egg-flame-container .flame-middle {
          width: 40px;
          height: 60px;
          bottom: 10px;
        }

        .easter-egg-flame-container .flame-tip {
          width: 30px;
          height: 50px;
          bottom: 20px;
        }

        .easter-egg-flame-container .spark {
          width: 6px;
          height: 6px;
        }

        .easter-egg-flame-container .smoke {
          width: 10px;
          height: 10px;
        }

        .smoke-plume-container {
          position: relative;
          width: 60px;
          height: 80px;
        }

        .smoke-idle {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 20px;
          height: 20px;
          margin-left: -10px;
          margin-top: -10px;
          background: radial-gradient(
            circle at center,
            rgba(255, 200, 100, 0.7) 0%,
            rgba(255, 160, 80, 0.5) 40%,
            rgba(255, 120, 60, 0) 70%
          );
          border-radius: 50%;
          filter: blur(6px);
          animation: smoke-rise-idle 2s ease-out infinite;
          transform-origin: center;
        }

        .smoke-thrust {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 28px;
          height: 28px;
          margin-left: -14px;
          margin-top: -14px;
          background: radial-gradient(
            circle at center,
            rgba(255, 220, 120, 0.8) 0%,
            rgba(255, 180, 100, 0.6) 40%,
            rgba(255, 120, 60, 0) 70%
          );
          border-radius: 50%;
          filter: blur(8px);
          animation: smoke-rise-thrust 1.5s ease-out infinite;
          transform-origin: center;
        }

        .flame-spark-container {
          position: relative;
          width: 60px;
          height: 60px;
        }

        .flame-spark {
          position: absolute;
          left: 50%;
          top: 50%;
          width: calc(6px + 6px * var(--spark-intensity, 0));
          height: calc(6px + 6px * var(--spark-intensity, 0));
          margin-left: calc(-3px - 3px * var(--spark-intensity, 0));
          margin-top: calc(-3px - 3px * var(--spark-intensity, 0));
          background: radial-gradient(
            circle at center,
            rgba(255, 220, 120, 1) 0%,
            rgba(255, 180, 100, 0.9) 40%,
            rgba(255, 120, 60, 0) 70%
          );
          border-radius: 50%;
          filter: blur(3px) brightness(calc(1.2 + 0.8 * var(--spark-intensity, 0)));
          animation: spark-shoot calc(0.8s - 0.3s * var(--spark-intensity, 0)) ease-out infinite;
          transform-origin: center;
          box-shadow: 0 0 8px rgba(255, 200, 100, 0.8);
        }

        @keyframes spark-shoot {
          0% {
            transform: 
              rotate(var(--spark-angle, 0deg))
              translateX(0)
              scale(1);
            opacity: 0;
          }
          20% {
            opacity: calc(0.8 + 0.2 * var(--spark-intensity, 0));
          }
          100% {
            transform: 
              rotate(var(--spark-angle, 0deg))
              translateX(var(--spark-distance, 30px))
              scale(0.3);
            opacity: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-launch-vibration,
          .animate-pulse-slow,
          .smoke-idle,
          .smoke-thrust,
          .flame-spark,
          .flame {
            animation: none !important;
          }
          
          .smoke-idle,
          .smoke-thrust,
          .flame-spark {
            opacity: 0.3 !important;
          }
        }
      `}</style>
    </div>
  );
}
