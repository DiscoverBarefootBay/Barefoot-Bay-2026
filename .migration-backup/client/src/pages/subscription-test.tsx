import React from 'react';
import { Helmet } from 'react-helmet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SubscriptionTestPage() {
  return (
    <div className="space-y-6">
      <Helmet>
        <title>Subscription Test | Barefoot Bay</title>
      </Helmet>
      <div>
        <h1 className="text-3xl font-bold mb-2">Subscription Test</h1>
        <p className="text-muted-foreground">
          This is a test page for subscriptions
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Test Card</CardTitle>
        </CardHeader>
        <CardContent>
          <p>This is a basic test to see if we can render a subscription page</p>
        </CardContent>
      </Card>
    </div>
  );
}