import { useState, useEffect } from 'react';
import { 
  Sun, 
  CloudSun, 
  Cloud, 
  CloudRain, 
  CloudLightning, 
  ThermometerSun, 
  Snowflake,
  CloudFog
} from 'lucide-react';
import { Link } from 'wouter';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { usePermissions } from '@/hooks/use-permissions';
import { useNavigationTooltip } from '@/contexts/navigation-tooltip-context';
import { WeatherBadge } from '@/components/shared/weather-badge';

interface WeatherData {
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  location: string;
  description: string;
  date: Date;
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { canSeeWeatherRocketIcons } = usePermissions();
  const { activeTooltip, toggleTooltip } = useNavigationTooltip();

  useEffect(() => {
    const fetchWeather = async () => {
      setLoading(true);
      try {
        // Coordinates for Barefoot Bay, Florida
        const lat = 27.9589;
        const lon = -80.5603;
        
        // Use the server-side proxy API endpoint instead of calling OpenWeatherMap directly
        // This avoids CORS issues and securely handles the API key
        console.log("Fetching weather data through server proxy");
        const url = `/api/weather?lat=${lat}&lon=${lon}&units=imperial`;
        
        const response = await fetch(url);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Weather API error response:", errorText);
          throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log("Weather data received:", data);
        
        setWeather({
          temperature: Math.round(data.main.temp),
          condition: data.weather[0].main,
          description: data.weather[0].description,
          humidity: data.main.humidity,
          windSpeed: Math.round(data.wind.speed),
          location: 'Barefoot Bay',
          date: new Date()
        });
        setError(null);
      } catch (err) {
        console.error('Error fetching weather:', err);
        setError('Could not load weather');
        
        // Use location-based seasonal data to provide a reasonable fallback
        const currentDate = new Date();
        const month = currentDate.getMonth(); // 0-11 (Jan-Dec)
        
        // Florida weather patterns by season
        // Spring (March-May): 75-85°F, mostly sunny
        // Summer (June-September): 85-95°F, partly cloudy, afternoon thunderstorms
        // Fall (October-November): 75-85°F, sunny
        // Winter (December-February): 65-75°F, sunny
        
        let condition, temperature, description, humidity, windSpeed;
        
        if (month >= 2 && month <= 4) {
          // Spring
          temperature = 80;
          condition = 'Clear';
          description = 'clear sky';
          humidity = 65;
          windSpeed = 8;
        } else if (month >= 5 && month <= 8) {
          // Summer
          temperature = 90;
          condition = month % 2 === 0 ? 'Clouds' : 'Thunderstorm';
          description = month % 2 === 0 ? 'scattered clouds' : 'thunderstorm';
          humidity = 75;
          windSpeed = 6;
        } else if (month >= 9 && month <= 10) {
          // Fall
          temperature = 78;
          condition = 'Clear';
          description = 'clear sky';
          humidity = 60;
          windSpeed = 7;
        } else {
          // Winter
          temperature = 70;
          condition = 'Clear';
          description = 'clear sky';
          humidity = 55;
          windSpeed = 9;
        }
        
        setWeather({
          temperature,
          condition,
          description,
          humidity,
          windSpeed,
          location: 'Barefoot Bay',
          date: currentDate
        });
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    // Refresh weather data every 30 minutes
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const getWeatherIcon = () => {
    if (!weather) return <ThermometerSun className="h-6 w-6" />;
    
    switch(weather.condition.toLowerCase()) {
      case 'clear':
        return <Sun className="h-6 w-6 text-amber-400" />;
      case 'clouds':
        return weather.description.includes('few') ? 
          <CloudSun className="h-6 w-6 text-gray-500" /> : 
          <Cloud className="h-6 w-6 text-gray-500" />;
      case 'rain':
      case 'drizzle':
        return <CloudRain className="h-6 w-6 text-blue-400" />;
      case 'thunderstorm':
        return <CloudLightning className="h-6 w-6 text-purple-500" />;
      case 'snow':
        return <Snowflake className="h-6 w-6 text-blue-200" />;
      case 'mist':
      case 'fog':
      case 'haze':
        return <CloudFog className="h-6 w-6 text-gray-400" />;
      default:
        return <Cloud className="h-6 w-6 text-gray-400" />;
    }
  };

  // Show as faded with tooltip when user doesn't have permission
  const isDisabled = !canSeeWeatherRocketIcons;

  // Handle mobile click to show tooltip
  const handleClick = () => {
    if (isDisabled) {
      toggleTooltip('weather');
    }
  };
  
  if (loading) {
    return (
      <div className="relative flex items-center bg-white/90 rounded-full px-3 py-2 shadow-sm">
        <ThermometerSun className="h-6 w-6 text-gray-400 animate-pulse mr-1" />
        <span className="font-medium text-navy">Loading...</span>
        <WeatherBadge />
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative flex items-center bg-white/90 rounded-full px-3 py-2 shadow-sm">
        <ThermometerSun className="h-6 w-6 text-gray-400 mr-1" />
        <span className="font-medium text-navy">--°F</span>
        <WeatherBadge />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip 
        open={isDisabled ? activeTooltip === 'weather' : undefined} 
        onOpenChange={(open) => isDisabled ? (open ? toggleTooltip('weather') : toggleTooltip(null)) : undefined}
        delayDuration={0}
      >
        <TooltipTrigger asChild>
          {isDisabled ? (
            <div className="relative">
              <button 
                className={`flex items-center gap-1 md:gap-2 bg-white/90 rounded-full px-2 md:px-3 py-1 md:py-2 cursor-not-allowed transition-all shadow-sm opacity-40 border-0 outline-none touch-manipulation`}
                onClick={handleClick}
                onTouchEnd={handleClick}
                disabled
                aria-label="Weather Widget - Registration Required"
              >
                {getWeatherIcon()}
                <span className="font-bold text-navy text-base md:text-lg whitespace-nowrap">
                  {weather?.temperature}°F
                </span>
              </button>
              <WeatherBadge />
            </div>
          ) : (
            <div className="relative">
              <Link href="/weather">
                <div className="flex items-center gap-1 md:gap-2 bg-white/90 rounded-full px-2 md:px-3 py-1 md:py-2 cursor-pointer transition-all hover:bg-white shadow-sm">
                  {getWeatherIcon()}
                  <span className="font-bold text-navy text-base md:text-lg whitespace-nowrap">
                    {weather?.temperature}°F
                  </span>
                </div>
              </Link>
              <WeatherBadge />
            </div>
          )}
        </TooltipTrigger>
        <TooltipContent>
          {isDisabled ? (
            <div className="p-3 text-center">
              <p className="font-bold text-lg mb-2">🌤️ Weather Widget</p>
              <p className="text-red-500 font-semibold mb-2">For Registered Users Only</p>
              <p className="text-sm text-gray-600 mb-2">
                Get real-time weather data and forecasts for Barefoot Bay
              </p>
              <a 
                href="/auth?tab=register" 
                className="text-xs text-blue-600 font-medium hover:underline cursor-pointer"
              >
                Sign up today to unlock this feature!
              </a>
            </div>
          ) : (
            <div className="p-2">
              <p className="font-bold text-lg mb-1">{weather?.location}</p>
              <p className="capitalize mb-1">{weather?.description}</p>
              <div className="text-sm text-gray-600">
                <p>Humidity: {weather?.humidity}%</p>
                <p>Wind: {weather?.windSpeed} mph</p>
              </div>
              <p className="text-xs mt-2 text-navy font-medium">Click for detailed forecast</p>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}