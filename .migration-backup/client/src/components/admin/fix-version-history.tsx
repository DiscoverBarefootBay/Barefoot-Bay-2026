import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2Icon, AlertTriangleIcon, CheckCircleIcon } from 'lucide-react';

export function FixVersionHistory() {
  const [isFixing, setIsFixing] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);
  const [message, setMessage] = useState('');

  const runFix = async () => {
    if (!confirm('This will analyze and fix all version history issues in the database. Continue?')) {
      return;
    }

    setIsFixing(true);
    setResult(null);
    setMessage('');

    try {
      console.log('Running emergency version history fix...');
      const response = await apiRequest('POST', '/api/admin/fix-version-history');
      
      if (response.ok) {
        const data = await response.json();
        setResult('success');
        setMessage(data.message || 'Version history system has been fixed successfully!');
        toast({
          title: 'Success',
          description: 'Version history system has been fixed.',
        });
      } else {
        const errorData = await response.json();
        setResult('error');
        setMessage(errorData.message || 'Failed to fix version history system');
        toast({
          title: 'Error',
          description: 'Failed to fix version history system.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fixing version history:', error);
      setResult('error');
      setMessage(error instanceof Error ? error.message : 'Unknown error occurred');
      toast({
        title: 'Error',
        description: 'An error occurred while fixing version history.',
        variant: 'destructive',
      });
    } finally {
      setIsFixing(false);
    }
  };

  const resetState = () => {
    setResult(null);
    setMessage('');
  };

  return (
    <Card className="max-w-xl mx-auto">
      <CardHeader>
        <CardTitle>Fix Version History System</CardTitle>
        <CardDescription>
          Use this tool to repair issues with the content version history system.
          This will analyze all content and versions, fix sequence numbers, and create missing versions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {result === 'success' && (
          <Alert className="mb-4 bg-green-50 border-green-600">
            <CheckCircleIcon className="h-4 w-4 text-green-600" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        
        {result === 'error' && (
          <Alert className="mb-4 bg-red-50 border-red-600">
            <AlertTriangleIcon className="h-4 w-4 text-red-600" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-2">
          <Label htmlFor="fix-button">Emergency Fix</Label>
          <p className="text-sm text-muted-foreground">
            This tool will scan the database for issues with the version history system and apply fixes. 
            It should be used when version history is not working correctly, such as when versions aren't 
            appearing in the history or when restored versions don't show up correctly.
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        {result && (
          <Button variant="outline" onClick={resetState} disabled={isFixing}>
            Reset
          </Button>
        )}
        <Button 
          onClick={runFix} 
          disabled={isFixing}
          className="ml-auto"
        >
          {isFixing && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
          {isFixing ? 'Fixing...' : 'Run Version History Fix'}
        </Button>
      </CardFooter>
    </Card>
  );
}