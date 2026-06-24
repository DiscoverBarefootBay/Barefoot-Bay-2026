
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export function ComputerHealthcareVendor() {
  const queryClient = useQueryClient();
  const slug = 'vendors-technology-and-electronics-computer-healthcare';
  
  // Direct query with special handling
  const { data, isLoading } = useQuery({
    queryKey: ["/api/direct-vendor", slug],
    queryFn: async () => {
      const res = await fetch(`/api/pages/${slug}?debug=true`);
      if (!res.ok) throw new Error('Failed to fetch Computer Healthcare vendor');
      return res.json();
    },
    staleTime: 0,
    cacheTime: 0
  });
  
  if (isLoading) return <div className="p-4">Loading Computer Healthcare vendor information...</div>;
  
  return (
    <div className="vendor-details p-4">
      <h1 className="text-2xl font-bold mb-4">{data?.title || 'Computer Healthcare'}</h1>
      <div dangerouslySetInnerHTML={{ __html: data?.content || '<div>Computer Healthcare</div><div>772-581-0368</div>' }} />
    </div>
  );
}
