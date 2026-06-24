import { useEffect, useState } from 'react';
import { useFlags } from '@/hooks/use-flags';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/components/providers/auth-provider';
import { Badge } from '@/components/ui/badge';
import { FeatureFlagName } from '@shared/schema';

// Define interface for environment variables
interface EnvVars {
  NODE_ENV: string;
  PORT: string;
  [key: string]: string;
}

// Dashboard to help developers troubleshoot development vs production differences
export default function DevParityDashboard() {
  const { user } = useAuth();
  const { flags, isLoading, isFeatureEnabled } = useFlags();
  const [envVars, setEnvVars] = useState<EnvVars>({ NODE_ENV: '', PORT: '' });
  const [isProdMode, setIsProdMode] = useState(localStorage.getItem('force_production_mode') === 'true');
  const [showAllFeatures, setShowAllFeatures] = useState(localStorage.getItem('show_all_features_for_admin') === 'true');
  const [debugMode, setDebugMode] = useState(localStorage.getItem('feature_flag_debug') === 'true');
  
  // Get environment variables
  useEffect(() => {
    fetch('/api/dev/environment')
      .then(res => {
        if (!res.ok) {
          throw new Error('Dev endpoint not available (normal in production)');
        }
        return res.json();
      })
      .then(data => {
        setEnvVars(data);
      })
      .catch(err => {
        console.error('Error fetching environment variables:', err);
        // Set default values based on browser environment
        setEnvVars({
          NODE_ENV: process.env.NODE_ENV || 'development',
          PORT: window.location.port || '3000',
        });
      });
  }, []);
  
  // Toggle production mode
  const toggleProductionMode = () => {
    const newValue = !isProdMode;
    localStorage.setItem('force_production_mode', newValue ? 'true' : 'false');
    setIsProdMode(newValue);
    window.location.reload();
  };
  
  // Toggle show all features for admin
  const toggleShowAllFeatures = () => {
    const newValue = !showAllFeatures;
    localStorage.setItem('show_all_features_for_admin', newValue ? 'true' : 'false');
    setShowAllFeatures(newValue);
  };
  
  // Toggle debug mode
  const toggleDebugMode = () => {
    const newValue = !debugMode;
    localStorage.setItem('feature_flag_debug', newValue ? 'true' : 'false');
    setDebugMode(newValue);
  };
  
  // Reset all settings
  const resetSettings = () => {
    localStorage.removeItem('force_production_mode');
    localStorage.removeItem('show_all_features_for_admin');
    localStorage.removeItem('feature_flag_debug');
    window.location.reload();
  };
  
  // Check if we're in actual production
  const isRealProduction = process.env.NODE_ENV === 'production';
  
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Development-Production Parity Dashboard</h1>
      
      {isRealProduction && (
        <div className="bg-red-100 border-l-4 border-red-500 p-4 mb-6">
          <p className="text-red-700">
            This dashboard is only meant for development use. You're seeing it in production mode 
            which is unusual. Consider removing this route from production.
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Environment Card */}
        <Card>
          <CardHeader>
            <CardTitle>Environment Configuration</CardTitle>
            <CardDescription>
              Current environment settings affecting feature visibility
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 border rounded bg-gray-50">
                <p className="font-medium">NODE_ENV:</p> 
                <p className={`mt-1 ${envVars.NODE_ENV === 'production' ? 'text-green-600' : 'text-amber-600'}`}>
                  {envVars.NODE_ENV}
                </p>
              </div>
              <div className="p-3 border rounded bg-gray-50">
                <p className="font-medium">PORT:</p> 
                <p className="mt-1">{envVars.PORT}</p>
              </div>
              <div className="p-3 border rounded bg-gray-50">
                <p className="font-medium">Simulated Mode:</p> 
                <p className={`mt-1 ${isProdMode ? 'text-green-600' : 'text-blue-600'}`}>
                  {isProdMode ? 'Production-like' : 'Development'}
                </p>
              </div>
              <div className="p-3 border rounded bg-gray-50">
                <p className="font-medium">User Role:</p> 
                <p className="mt-1">{user?.role || 'Not logged in'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Controls Card */}
        <Card>
          <CardHeader>
            <CardTitle>Parity Testing Controls</CardTitle>
            <CardDescription>
              Switches to simulate different environments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <p className="font-medium">Production-like Mode</p>
                <p className="text-sm text-gray-500">Simulate production behavior for features</p>
              </div>
              <Switch
                checked={isProdMode}
                onCheckedChange={toggleProductionMode}
              />
            </div>
            
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <p className="font-medium">Show All Features for Admin</p>
                <p className="text-sm text-gray-500">Make all features visible for admins</p>
              </div>
              <Switch
                checked={showAllFeatures}
                onCheckedChange={toggleShowAllFeatures}
                disabled={isProdMode} // Not available in production mode
              />
            </div>
            
            <div className="flex items-center justify-between pb-3">
              <div>
                <p className="font-medium">Debug Visualizations</p>
                <p className="text-sm text-gray-500">Show visual indicators for feature flags</p>
              </div>
              <Switch
                checked={debugMode}
                onCheckedChange={toggleDebugMode}
                disabled={isProdMode} // Not available in production mode
              />
            </div>
            
            <Button 
              variant="destructive" 
              onClick={resetSettings}
              className="w-full mt-4"
            >
              Reset All Settings
            </Button>
          </CardContent>
        </Card>
      </div>
      
      {/* Feature Flags Table */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Feature Flag Status</CardTitle>
          <CardDescription>
            Compare feature visibility in development vs. production
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading feature flags...</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 text-left">Feature</th>
                    <th className="p-2 text-left">Display Name</th>
                    <th className="p-2 text-center">Dev Status</th>
                    <th className="p-2 text-center">Prod Status</th>
                    <th className="p-2 text-center">Parity</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(FeatureFlagName).map(flagName => {
                    // Save the current setting
                    const currentSetting = localStorage.getItem('force_production_mode');
                    
                    // Check status in dev mode
                    localStorage.setItem('force_production_mode', 'false');
                    const isEnabledInDev = isFeatureEnabled(flagName);
                    
                    // Check status in prod-like mode
                    localStorage.setItem('force_production_mode', 'true');
                    const isEnabledInProd = isFeatureEnabled(flagName);
                    
                    // Restore the original setting
                    if (currentSetting) {
                      localStorage.setItem('force_production_mode', currentSetting);
                    } else {
                      localStorage.removeItem('force_production_mode');
                    }
                    
                    // Check if there's parity between environments
                    const hasParity = isEnabledInDev === isEnabledInProd;
                    
                    // Find the flag details
                    const flagDetails = Array.isArray(flags) 
                      ? flags.find(f => f.name === flagName)
                      : null;
                    
                    return (
                      <tr key={flagName} className="border-t">
                        <td className="p-2">{flagName}</td>
                        <td className="p-2">{flagDetails?.displayName || flagName}</td>
                        <td className="p-2 text-center">
                          <Badge variant={isEnabledInDev ? "default" : "outline"}>
                            {isEnabledInDev ? "Enabled" : "Disabled"}
                          </Badge>
                        </td>
                        <td className="p-2 text-center">
                          <Badge variant={isEnabledInProd ? "default" : "outline"}>
                            {isEnabledInProd ? "Enabled" : "Disabled"}
                          </Badge>
                        </td>
                        <td className="p-2 text-center">
                          <Badge variant={hasParity ? "success" : "destructive"}>
                            {hasParity ? "✓" : "×"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Navigation Items */}
      <Card>
        <CardHeader>
          <CardTitle>Navigation Item Status</CardTitle>
          <CardDescription>
            Compare navigation item visibility in development vs. production
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading navigation data...</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 text-left">Navigation Item</th>
                    <th className="p-2 text-center">Dev Status</th>
                    <th className="p-2 text-center">Prod Status</th>
                    <th className="p-2 text-center">Parity</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(flags) && flags
                    .filter(flag => flag.name.startsWith('nav-'))
                    .map(navFlag => {
                      // Get base feature name without nav- prefix
                      const baseName = navFlag.name.replace('nav-', '');
                      
                      // Save the current setting
                      const currentSetting = localStorage.getItem('force_production_mode');
                      
                      // Check status in dev mode
                      localStorage.setItem('force_production_mode', 'false');
                      const isEnabledInDev = isFeatureEnabled(baseName);
                      
                      // Check status in prod-like mode
                      localStorage.setItem('force_production_mode', 'true');
                      const isEnabledInProd = isFeatureEnabled(baseName);
                      
                      // Restore the original setting
                      if (currentSetting) {
                        localStorage.setItem('force_production_mode', currentSetting);
                      } else {
                        localStorage.removeItem('force_production_mode');
                      }
                      
                      // Check if there's parity between environments
                      const hasParity = isEnabledInDev === isEnabledInProd;
                      
                      return (
                        <tr key={navFlag.name} className="border-t">
                          <td className="p-2">{navFlag.displayName}</td>
                          <td className="p-2 text-center">
                            <Badge variant={isEnabledInDev ? "default" : "outline"}>
                              {isEnabledInDev ? "Visible" : "Hidden"}
                            </Badge>
                          </td>
                          <td className="p-2 text-center">
                            <Badge variant={isEnabledInProd ? "default" : "outline"}>
                              {isEnabledInProd ? "Visible" : "Hidden"}
                            </Badge>
                          </td>
                          <td className="p-2 text-center">
                            <Badge variant={hasParity ? "success" : "destructive"}>
                              {hasParity ? "✓" : "×"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}