import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  targetDate: Date;
  onCountdownComplete: () => void;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

export function CountdownTimer({ targetDate, onCountdownComplete }: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    total: 0,
  });
  const [isImminent, setIsImminent] = useState(false);
  const [isReadyForLaunch, setIsReadyForLaunch] = useState(false);
  const [terminalText, setTerminalText] = useState('');
  
  // Function to calculate remaining time
  const getTimeRemaining = (endTime: Date): TimeRemaining => {
    const total = endTime.getTime() - new Date().getTime();
    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const days = Math.floor(total / (1000 * 60 * 60 * 24));
    
    return {
      total,
      days,
      hours,
      minutes,
      seconds,
    };
  };
  
  // Function to check if launch is imminent (within 5 minutes)
  const checkIfImminent = (time: TimeRemaining) => {
    if (time.days === 0 && time.hours === 0 && time.minutes <= 5) {
      return true;
    }
    return false;
  };
  
  // Update terminal text in typewriter fashion with current time
  useEffect(() => {
    const currentTime = new Date();
    const timestamp = currentTime.toLocaleTimeString('en-US', { hour12: false });
    const oneHourLater = new Date(currentTime.getTime() + 60 * 60 * 1000);
    const launchTime = oneHourLater.toLocaleTimeString('en-US', { hour12: false });
    
    const lines = [
      `[${timestamp}] INITIALIZING BAREFOOT BAY LAUNCH SEQUENCE...`,
      `[${timestamp}] CHECKING ALL SYSTEMS...`,
      `[${timestamp}] PROPULSION SYSTEMS ONLINE...`,
      `[${timestamp}] NAVIGATION SYSTEMS CALIBRATED...`,
      `[${timestamp}] COUNTDOWN CONFIGURED - T-MINUS 01:00:00`,
      `[${timestamp}] TARGET LAUNCH TIME SET TO ${launchTime}`,
      `[${timestamp}] COUNTDOWN ACTIVE...`,
    ];
    
    let currentLine = 0;
    let currentChar = 0;
    let outputText = '';
    
    const typeWriter = setInterval(() => {
      if (currentLine < lines.length) {
        if (currentChar < lines[currentLine].length) {
          outputText += lines[currentLine][currentChar];
          setTerminalText(outputText);
          currentChar++;
        } else {
          outputText += '\n';
          setTerminalText(outputText);
          currentLine++;
          currentChar = 0;
        }
      } else {
        clearInterval(typeWriter);
      }
    }, 30); // Slightly faster typing
    
    return () => clearInterval(typeWriter);
  }, []);
  
  // Update the countdown timer every second
  useEffect(() => {
    const updateTimer = () => {
      try {
        // Use the server's target date
        const remaining = getTimeRemaining(targetDate);
        
        // Check if the remaining time is negative (launch date already passed)
        if (remaining.total <= 0) {
          setTimeRemaining({
            days: 0,
            hours: 0,
            minutes: 0,
            seconds: 0,
            total: 0,
          });
          
          // Set the ready for launch state
          setIsReadyForLaunch(true);
          
          // Do NOT call the onCountdownComplete handler here
          // Let the admin trigger it manually with the LAUNCH NOW button
          return;
        }
        
        // Update the countdown values
        setTimeRemaining(remaining);
        
        // Check if launch is imminent
        setIsImminent(checkIfImminent(remaining));
        
        // Log for debugging if imminent
        if (checkIfImminent(remaining)) {
          const currentTime = new Date().toISOString();
          const launchTime = targetDate.toISOString();
          console.log("Current time:", currentTime, "Launch time:", launchTime);
          console.log("Time difference:", Math.floor(remaining.total / 60000), "minutes");
        }
      } catch (error) {
        console.error("Error updating countdown:", error);
      }
    };
    
    // Initial update
    updateTimer();
    
    // Set up interval for updates
    const interval = setInterval(updateTimer, 1000);
    
    // Cleanup on unmount
    return () => {
      clearInterval(interval);
    };
  }, [targetDate, onCountdownComplete]);
  
  // Format numbers as two digits
  const formatNumber = (num: number): string => {
    return num.toString().padStart(2, '0');
  };
  
  // Apply pulse animation when launch is imminent
  const getTimerClasses = () => {
    return `countdown-blocks ${isImminent ? 'imminent' : ''}`;
  };
  
  // Define animation keyframes object
  const blinkAnimation = {
    '0%, 49%': { opacity: 1 },
    '50%, 100%': { opacity: 0.5 }
  };

  return (
    <div style={{
      width: '100%',
      maxWidth: '800px',
      margin: '0 auto',
      fontFamily: 'monospace'
    }}>
      {/* Terminal output text */}
      <div style={{
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        border: '1px solid #0f0',
        borderRadius: '4px',
        padding: '10px',
        marginBottom: '20px',
        color: '#0f0',
        textAlign: 'left',
        height: '100px',
        overflowY: 'auto',
        fontSize: '14px'
      }}>
        {terminalText.split('\n').map((line, index) => (
          <div key={index} style={{ lineHeight: 1.5 }}>
            {line && (
              <>
                <span style={{ color: '#0f0', marginRight: '5px' }}>&gt;</span> {line}
              </>
            )}
          </div>
        ))}
      </div>
      
      {/* Digital clock heading */}
      <div className="text-center">
        <h2 className="text-2xl font-mono text-green-400 mt-4">
          BAREFOOT BAY COUNTDOWN SEQUENCE T-MINUS
        </h2>
      </div>
      
      {/* Main digital countdown - LCD/LED style */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        margin: '20px 0'
      }}>
        {/* Digital clock container */}
        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          border: isImminent ? '4px solid #f00' : '4px solid #333',
          borderRadius: '12px',
          padding: '20px 30px',
          boxShadow: isImminent ? 
            '0 0 30px rgba(255, 0, 0, 0.7), inset 0 0 20px rgba(0, 0, 0, 0.8)' : 
            '0 0 30px rgba(0, 255, 0, 0.4), inset 0 0 20px rgba(0, 0, 0, 0.8)',
          width: 'auto',
          display: 'inline-flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          {/* Days */}
          <div style={{
            textAlign: 'center',
            margin: '0 4px'
          }}>
            <div style={{
              fontFamily: 'monospace',
              fontSize: '76px',
              fontWeight: 'bold',
              color: isImminent ? '#f00' : '#0f0',
              textShadow: isImminent ? 
                '0 0 15px rgba(255, 0, 0, 1), 0 0 30px rgba(255, 0, 0, 0.8)' : 
                '0 0 15px rgba(0, 255, 0, 1), 0 0 30px rgba(0, 255, 0, 0.8)',
              lineHeight: 1,
              background: 'rgba(0, 0, 0, 0.4)',
              padding: '5px 15px',
              borderRadius: '8px',
              border: '2px solid rgba(100, 100, 100, 0.3)',
              letterSpacing: '2px'
            }}>{formatNumber(timeRemaining.days)}</div>
            <div style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#999',
              textTransform: 'uppercase',
              marginTop: '5px'
            }}>DAYS</div>
          </div>
          
          {/* Separator - blinking colon */}
          <div style={{
            fontSize: '76px',
            fontWeight: 'bold',
            color: isImminent ? '#f00' : '#0f0',
            textShadow: isImminent ? 
              '0 0 15px rgba(255, 0, 0, 1)' : 
              '0 0 15px rgba(0, 255, 0, 1)',
            margin: '0 2px',
            animation: 'blink 1s infinite',
            alignSelf: 'flex-start',
            marginTop: '5px',
            letterSpacing: '0'
          }}>:</div>
          
          {/* Hours */}
          <div style={{
            textAlign: 'center',
            margin: '0 4px'
          }}>
            <div style={{
              fontFamily: 'monospace',
              fontSize: '76px',
              fontWeight: 'bold',
              color: isImminent ? '#f00' : '#0f0',
              textShadow: isImminent ? 
                '0 0 15px rgba(255, 0, 0, 1), 0 0 30px rgba(255, 0, 0, 0.8)' : 
                '0 0 15px rgba(0, 255, 0, 1), 0 0 30px rgba(0, 255, 0, 0.8)',
              lineHeight: 1,
              background: 'rgba(0, 0, 0, 0.4)',
              padding: '5px 15px',
              borderRadius: '8px',
              border: '2px solid rgba(100, 100, 100, 0.3)',
              letterSpacing: '2px'
            }}>{formatNumber(timeRemaining.hours)}</div>
            <div style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#999',
              textTransform: 'uppercase',
              marginTop: '5px'
            }}>HOURS</div>
          </div>
          
          {/* Separator - blinking colon */}
          <div style={{
            fontSize: '76px',
            fontWeight: 'bold',
            color: isImminent ? '#f00' : '#0f0',
            textShadow: isImminent ? 
              '0 0 15px rgba(255, 0, 0, 1)' : 
              '0 0 15px rgba(0, 255, 0, 1)',
            margin: '0 2px',
            animation: 'blink 1s infinite',
            alignSelf: 'flex-start',
            marginTop: '5px',
            letterSpacing: '0'
          }}>:</div>
          
          {/* Minutes */}
          <div style={{
            textAlign: 'center',
            margin: '0 4px'
          }}>
            <div style={{
              fontFamily: 'monospace',
              fontSize: '76px',
              fontWeight: 'bold',
              color: isImminent ? '#f00' : '#0f0',
              textShadow: isImminent ? 
                '0 0 15px rgba(255, 0, 0, 1), 0 0 30px rgba(255, 0, 0, 0.8)' : 
                '0 0 15px rgba(0, 255, 0, 1), 0 0 30px rgba(0, 255, 0, 0.8)',
              lineHeight: 1,
              background: 'rgba(0, 0, 0, 0.4)',
              padding: '5px 15px',
              borderRadius: '8px',
              border: '2px solid rgba(100, 100, 100, 0.3)',
              letterSpacing: '2px'
            }}>{formatNumber(timeRemaining.minutes)}</div>
            <div style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#999',
              textTransform: 'uppercase',
              marginTop: '5px'
            }}>MINUTES</div>
          </div>
          
          {/* Separator - blinking colon */}
          <div style={{
            fontSize: '76px',
            fontWeight: 'bold',
            color: isImminent ? '#f00' : '#0f0',
            textShadow: isImminent ? 
              '0 0 15px rgba(255, 0, 0, 1)' : 
              '0 0 15px rgba(0, 255, 0, 1)',
            margin: '0 2px',
            animation: 'blink 1s infinite',
            alignSelf: 'flex-start',
            marginTop: '5px',
            letterSpacing: '0'
          }}>:</div>
          
          {/* Seconds */}
          <div style={{
            textAlign: 'center',
            margin: '0 4px'
          }}>
            <div style={{
              fontFamily: 'monospace',
              fontSize: '76px',
              fontWeight: 'bold',
              color: isImminent ? '#f00' : '#0f0',
              textShadow: isImminent ? 
                '0 0 15px rgba(255, 0, 0, 1), 0 0 30px rgba(255, 0, 0, 0.8)' : 
                '0 0 15px rgba(0, 255, 0, 1), 0 0 30px rgba(0, 255, 0, 0.8)',
              lineHeight: 1,
              background: 'rgba(0, 0, 0, 0.4)',
              padding: '5px 15px',
              borderRadius: '8px',
              border: '2px solid rgba(100, 100, 100, 0.3)',
              letterSpacing: '2px'
            }}>{formatNumber(timeRemaining.seconds)}</div>
            <div style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#999',
              textTransform: 'uppercase',
              marginTop: '5px'
            }}>SECONDS</div>
          </div>
        </div>
      </div>
      
      {/* Terminal status message */}
      <div style={{ marginTop: '20px', minHeight: '60px', textAlign: 'center' }}>
        {isImminent && (
          <div style={{
            animation: 'blink 1s infinite',
            fontWeight: 'bold',
            fontSize: '24px',
            letterSpacing: '2px',
            color: '#f00'
          }}>
            !!! LAUNCH IMMINENT !!! PREPARE FOR IGNITION !!!
          </div>
        )}
        
        {isReadyForLaunch && (
          <div>
            <div style={{
              animation: 'blink 1s infinite',
              fontWeight: 'bold',
              fontSize: '24px',
              letterSpacing: '2px',
              color: '#0f0',
              marginBottom: '10px'
            }}>
              SYSTEMS READY FOR LAUNCH
            </div>
            <div style={{
              color: '#0af',
              fontSize: '16px',
              marginTop: '5px'
            }}>
              ADMIN OVERRIDE REQUIRED: PRESS LAUNCH NOW TO INITIATE
            </div>
          </div>
        )}
      </div>

      {/* Define CSS keyframes for animations */}
      <style>
        {`
          @keyframes blink {
            0%, 49% {
              opacity: 1;
            }
            50%, 100% {
              opacity: 0.5;
            }
          }
        `}
      </style>
    </div>
  );
}