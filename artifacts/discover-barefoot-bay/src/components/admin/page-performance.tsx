import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, FileText } from 'lucide-react';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';

interface PagePerformanceRow {
  path: string;
  title: string;
  views: number;
  uniqueVisitors: number;
  avgTimeOnPage: number;
  bounceRate: number;
}

interface PagePerformanceProps {
  dateRange?: DateRange;
  refreshKey?: number;
}

// Format a duration in seconds as mm:ss
const formatDuration = (seconds: number): string => {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function PagePerformance({ dateRange, refreshKey }: PagePerformanceProps) {
  const [pages, setPages] = useState<PagePerformanceRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPagePerformance = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let queryParams = '';
      if (dateRange?.from && dateRange?.to) {
        const fromDate = format(dateRange.from, 'yyyy-MM-dd');
        const toDate = format(dateRange.to, 'yyyy-MM-dd');
        queryParams = `?startDate=${fromDate}&endDate=${toDate}`;
      }

      const response = await fetch(`/api/analytics/page-performance${queryParams}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch page performance: ${response.status}`);
      }

      const data = await response.json();
      setPages(Array.isArray(data.pages) ? data.pages : []);
    } catch (err) {
      console.error('Error fetching page performance:', err);
      setError('Failed to load page performance data');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchPagePerformance();
  }, [fetchPagePerformance, refreshKey]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <CardTitle>Page Performance</CardTitle>
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <CardDescription>Detailed metrics for individual pages</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-[300px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col justify-center items-center h-[300px] text-destructive">
            <p className="mb-4">{error}</p>
            <Button variant="outline" onClick={fetchPagePerformance}>Try Again</Button>
          </div>
        ) : pages.length === 0 ? (
          <div className="flex justify-center items-center h-[300px] text-muted-foreground">
            <p>No page views in the selected time frame</p>
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Unique Visitors</TableHead>
                  <TableHead className="text-right">Avg. Time on Page</TableHead>
                  <TableHead className="text-right">Bounce Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map((page) => (
                  <TableRow key={page.path}>
                    <TableCell className="max-w-[280px]">
                      <div className="font-medium truncate" title={page.title}>{page.title}</div>
                      <div className="text-xs text-muted-foreground truncate" title={page.path}>{page.path}</div>
                    </TableCell>
                    <TableCell className="text-right">{page.views.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{page.uniqueVisitors.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{formatDuration(page.avgTimeOnPage)}</TableCell>
                    <TableCell className="text-right">{page.bounceRate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
