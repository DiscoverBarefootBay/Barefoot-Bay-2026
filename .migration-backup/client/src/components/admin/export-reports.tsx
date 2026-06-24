import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Loader2, Download, FileSpreadsheet, FilePieChart, FileBarChart2, FileText } from 'lucide-react';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { Label } from '@/components/ui/label';

// Report types
interface ReportOption {
  id: string;
  name: string;
  description: string;
  format: 'csv' | 'json';
  endpoint: string;
  icon: React.ReactNode;
}

export function ExportReports() {
  const [selectedReport, setSelectedReport] = useState<string>('page-views');
  const [format, setFormat] = useState<string>('csv');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Available report options
  const reportOptions: ReportOption[] = [
    {
      id: 'page-views',
      name: 'Page Views Report',
      description: 'Daily page views and unique visitors over time',
      format: 'csv',
      endpoint: '/api/analytics/export/page-views',
      icon: <FileBarChart2 className="h-5 w-5 text-blue-500" />
    },
    {
      id: 'user-journeys',
      name: 'User Journeys Report',
      description: 'Path transitions and navigation patterns',
      format: 'csv',
      endpoint: '/api/analytics/export/user-journeys',
      icon: <FilePieChart className="h-5 w-5 text-green-500" />
    },
    {
      id: 'events',
      name: 'Events Report',
      description: 'User interactions and event tracking data',
      format: 'csv',
      endpoint: '/api/analytics/export/events',
      icon: <FileText className="h-5 w-5 text-orange-500" />
    },
    {
      id: 'full-analytics',
      name: 'Complete Analytics Data',
      description: 'All analytics data in one comprehensive report',
      format: 'json',
      endpoint: '/api/analytics/export/full',
      icon: <FileSpreadsheet className="h-5 w-5 text-purple-500" />
    }
  ];
  
  // Get selected report option
  const getSelectedReport = (): ReportOption => {
    return reportOptions.find(option => option.id === selectedReport) || reportOptions[0];
  };
  
  // Export the selected report
  const exportReport = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const report = getSelectedReport();
      const exportFormat = format || report.format;
      
      const response = await fetch(`${report.endpoint}?format=${exportFormat}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to export report: ${response.statusText}`);
      }
      
      // Get filename from response headers or use default
      const contentDisposition = response.headers.get('content-disposition');
      let filename = '';
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }
      
      if (!filename) {
        const date = format(new Date(), 'yyyy-MM-dd');
        filename = `${report.id}-${date}.${exportFormat}`;
      }
      
      if (exportFormat === 'csv') {
        const text = await response.text();
        const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
        saveAs(blob, filename);
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        saveAs(blob, filename);
      }
    } catch (err) {
      console.error('Error exporting report:', err);
      setError('Failed to export report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Download className="h-5 w-5 mr-2" /> Export Reports
        </CardTitle>
        <CardDescription>
          Download analytics data in various formats
        </CardDescription>
      </CardHeader>
      
      <Separator />
      
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="report-type">Report Type</Label>
            <Select
              value={selectedReport}
              onValueChange={setSelectedReport}
            >
              <SelectTrigger id="report-type" className="w-full mt-1">
                <SelectValue placeholder="Select report type" />
              </SelectTrigger>
              <SelectContent>
                {reportOptions.map(option => (
                  <SelectItem key={option.id} value={option.id}>
                    <div className="flex items-center">
                      {option.icon}
                      <span className="ml-2">{option.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-1">
              {getSelectedReport().description}
            </p>
          </div>
          
          <div>
            <Label htmlFor="export-format">Export Format</Label>
            <Select
              value={format || getSelectedReport().format}
              onValueChange={setFormat}
            >
              <SelectTrigger id="export-format" className="w-full mt-1">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV (Excel Compatible)</SelectItem>
                <SelectItem value="json">JSON (Raw Data)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-1">
              {format === 'csv' ? 
                'CSV format is compatible with Excel and other spreadsheet software' : 
                'JSON format contains the complete raw data for advanced analysis'}
            </p>
          </div>
          
          {error && (
            <div className="text-sm text-destructive mt-2">
              {error}
            </div>
          )}
          
          <Button 
            className="w-full mt-4" 
            onClick={exportReport}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export {getSelectedReport().name}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}