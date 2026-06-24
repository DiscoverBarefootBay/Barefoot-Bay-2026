import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { AlertCircle, CheckCircle, Database, CloudUpload, RefreshCw } from 'lucide-react';
import { Spinner } from '../ui/spinner';

/**
 * Calendar Media Migration Tool 
 * 
 * This component provides an interface for migrating calendar event media
 * from filesystem storage to Replit Object Storage.
 */
export default function CalendarMediaMigration() {
  const [loading, setLoading] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null);
  
  // Stats for filesystem URLs
  const [filesystemStats, setFilesystemStats] = useState<{ count: number, events: any[] } | null>(null);
  const [filesystemLoading, setFilesystemLoading] = useState(false);
  
  // Stats for direct Object Storage URLs
  const [directStorageStats, setDirectStorageStats] = useState<{ count: number, events: any[] } | null>(null);
  const [directStorageLoading, setDirectStorageLoading] = useState(false);

  /**
   * Start the migration process
   */
  const startMigration = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      setMigrationStatus('loading');
      setMigrationMessage('Starting migration process...');
      
      const response = await fetch('/api/admin/migrate-calendar-media', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setMigrationStatus('success');
        setMigrationMessage(data.message || 'Migration completed successfully');
        // Refresh stats after successful migration
        loadFilesystemStats();
        loadDirectStorageStats();
      } else {
        setMigrationStatus('error');
        setErrorMessage(data.error || data.message || 'Migration failed');
      }
    } catch (error) {
      console.error('Error during migration:', error);
      setMigrationStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Migration failed');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load statistics about events with filesystem media URLs
   */
  const loadFilesystemStats = async () => {
    if (filesystemLoading) return;
    
    try {
      setFilesystemLoading(true);
      
      const response = await fetch('/api/admin/calendar-media/filesystem-urls');
      const data = await response.json();
      
      if (response.ok && data.success) {
        setFilesystemStats({
          count: data.count,
          events: data.events
        });
      } else {
        console.error('Failed to load filesystem stats:', data);
      }
    } catch (error) {
      console.error('Error loading filesystem stats:', error);
    } finally {
      setFilesystemLoading(false);
    }
  };

  /**
   * Load statistics about events with direct Object Storage URLs
   */
  const loadDirectStorageStats = async () => {
    if (directStorageLoading) return;
    
    try {
      setDirectStorageLoading(true);
      
      const response = await fetch('/api/admin/calendar-media/direct-storage-urls');
      const data = await response.json();
      
      if (response.ok && data.success) {
        setDirectStorageStats({
          count: data.count,
          events: data.events
        });
      } else {
        console.error('Failed to load direct storage stats:', data);
      }
    } catch (error) {
      console.error('Error loading direct storage stats:', error);
    } finally {
      setDirectStorageLoading(false);
    }
  };

  // Load stats on component mount
  React.useEffect(() => {
    loadFilesystemStats();
    loadDirectStorageStats();
  }, []);

  return (
    <div className="space-y-6 p-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold mb-4">Calendar Media Migration Tool</h1>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => {
              loadFilesystemStats();
              loadDirectStorageStats();
            }}
            disabled={filesystemLoading || directStorageLoading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Stats
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Filesystem Media Stats */}
        <Card className="p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Database className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold">Filesystem Media</h2>
          </div>
          
          {filesystemLoading ? (
            <div className="flex items-center justify-center h-24">
              <Spinner size="md" />
            </div>
          ) : filesystemStats ? (
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Events using filesystem media URLs:
              </p>
              <p className="text-3xl font-bold mb-4">
                {filesystemStats.count}
              </p>
              {filesystemStats.count > 0 && (
                <div className="text-sm">
                  <p className="text-muted-foreground mb-1">
                    These events need to be migrated to Object Storage.
                  </p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-medium">View affected events</summary>
                    <div className="mt-2 text-xs max-h-40 overflow-y-auto">
                      <ul className="list-disc pl-4 space-y-1">
                        {filesystemStats.events.map(event => (
                          <li key={event.id}>
                            Event {event.id}: {event.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </details>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No data available</p>
          )}
        </Card>
        
        {/* Direct Object Storage URLs Stats */}
        <Card className="p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <CloudUpload className="h-5 w-5 text-green-500" />
            <h2 className="text-lg font-semibold">Direct Object Storage URLs</h2>
          </div>
          
          {directStorageLoading ? (
            <div className="flex items-center justify-center h-24">
              <Spinner size="md" />
            </div>
          ) : directStorageStats ? (
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Events using direct Object Storage URLs:
              </p>
              <p className="text-3xl font-bold mb-4">
                {directStorageStats.count}
              </p>
              {directStorageStats.count > 0 && (
                <div className="text-sm">
                  <p className="text-muted-foreground mb-1">
                    These URLs need to be converted to proxy URL format.
                  </p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-medium">View affected events</summary>
                    <div className="mt-2 text-xs max-h-40 overflow-y-auto">
                      <ul className="list-disc pl-4 space-y-1">
                        {directStorageStats.events.map(event => (
                          <li key={event.id}>
                            Event {event.id}: {event.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </details>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No data available</p>
          )}
        </Card>
      </div>
      
      {/* Migration Action */}
      <Card className="p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Migration Actions</h2>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will migrate all calendar event media from filesystem storage to Replit Object Storage,
            and convert direct Object Storage URLs to the proxy format.
          </p>
          
          <div className="flex flex-col gap-4">
            <Button 
              onClick={startMigration} 
              disabled={loading || (filesystemStats?.count === 0 && directStorageStats?.count === 0)}
              className="w-full md:w-auto"
            >
              {loading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Running Migration...
                </>
              ) : (
                <>
                  <CloudUpload className="mr-2 h-4 w-4" />
                  Start Migration
                </>
              )}
            </Button>
            
            {migrationStatus === 'success' && (
              <Alert variant="success" className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>
                  {migrationMessage || 'Migration completed successfully'}
                </AlertDescription>
              </Alert>
            )}
            
            {migrationStatus === 'error' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {errorMessage || 'An error occurred during migration'}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}