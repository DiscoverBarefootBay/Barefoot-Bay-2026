import { Helmet } from 'react-helmet';
import ProductionAuthFix from '@/components/production-auth-fix';
import { ShieldAlert } from 'lucide-react';

export default function ProductionAuthFixPage() {
  return (
    <>
      <Helmet>
        <title>Authentication Fix | Barefoot Bay</title>
      </Helmet>
      
      <div className="container mx-auto py-10">
        <div className="flex items-center space-x-2 mb-6">
          <ShieldAlert className="h-6 w-6 text-red-500" />
          <h1 className="text-3xl font-bold">Authentication Fix</h1>
        </div>
        
        <div className="mb-6">
          <p className="text-muted-foreground">
            This page provides troubleshooting tools to diagnose and fix authentication issues,
            especially for production environments where cross-domain cookie problems can occur.
          </p>
        </div>
        
        <ProductionAuthFix />
      </div>
    </>
  );
}