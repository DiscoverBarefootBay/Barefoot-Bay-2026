import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { 
  generateVendorSlug, 
  dbSlugToPublicUrl, 
  publicUrlToDbSlug, 
  needsSlugRepair, 
  repairVendorSlug 
} from '../components/vendors/vendor-url-converter';

/**
 * Vendor URL Testing Page
 * 
 * This page allows testing of the vendor URL conversion functions to ensure
 * they work correctly for all categories and title combinations.
 */
const VendorUrlTestPage: React.FC = () => {
  // Test vendor data
  const [title, setTitle] = useState('Computer Healthcare');
  const [category, setCategory] = useState('Technology & Electronics');
  const [slug, setSlug] = useState('');
  const [publicUrl, setPublicUrl] = useState('');
  const [needsRepair, setNeedsRepair] = useState(false);

  // Sample data for testing problematic cases
  const sampleTests = [
    { title: 'Computer Healthcare', category: 'Technology & Electronics' },
    { title: 'Electronics Repair', category: 'Technology & Electronics' },
    { title: 'Health Center', category: 'Health & Wellness' },
    { title: 'Wellness Spa', category: 'Health & Wellness' },
    { title: 'Technology Consultants', category: 'Technology & Electronics' },
    { title: 'Electronic Services', category: 'Technology & Electronics' },
    { title: 'Real Estate Agent', category: 'Real Estate' },
    { title: 'Estate Planning', category: 'Professional Services' },
  ];

  // Category options for testing
  const categoryOptions = [
    'Technology & Electronics',
    'Health & Wellness',
    'Professional Services',
    'Real Estate',
    'Home Services',
    'Food & Dining',
    'Retail & Shops',
    'Insurance & Financial',
  ];

  // Update slug and public URL whenever title or category changes
  useEffect(() => {
    // Convert category input to slug format
    const categorySlug = category
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
    
    const generatedSlug = generateVendorSlug(title, categorySlug);
    setSlug(generatedSlug);

    const newPublicUrl = dbSlugToPublicUrl(generatedSlug);
    setPublicUrl(newPublicUrl);

    const needsFixing = needsSlugRepair(generatedSlug);
    setNeedsRepair(needsFixing);
  }, [title, category]);

  // Test repair function
  const handleRepairSlug = () => {
    // Convert category input to slug format
    const categorySlug = category
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
    
    const repairedSlug = repairVendorSlug(slug, categorySlug, title);
    setSlug(repairedSlug);
    
    const newPublicUrl = dbSlugToPublicUrl(repairedSlug);
    setPublicUrl(newPublicUrl);
    
    setNeedsRepair(needsSlugRepair(repairedSlug));
  };

  // Load a sample test case
  const loadSampleTest = (index: number) => {
    const test = sampleTests[index];
    setTitle(test.title);
    setCategory(test.category);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Vendor URL Format Testing</h1>
        <p className="text-gray-600 mb-4">
          This page tests the vendor URL formatting logic to ensure consistency across all pages.
        </p>
        <Link href="/admin/manage-vendors" className="text-blue-500 hover:underline">
          Go to Manage Vendors
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vendor Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vendor Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Database Slug (format stored in database)
            </label>
            <input
              type="text"
              value={slug}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Public URL (format shown in browser)
            </label>
            <input
              type="text"
              value={publicUrl}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50"
            />
          </div>
          
          <div className="pt-2">
            <span className={`text-sm ${needsRepair ? 'text-red-500' : 'text-green-500'}`}>
              {needsRepair ? 'Slug needs repair' : 'Slug format is correct'}
            </span>
            {needsRepair && (
              <button
                onClick={handleRepairSlug}
                className="ml-4 px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
              >
                Repair Slug
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-xl font-bold mb-4">Sample Test Cases</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sampleTests.map((test, index) => (
            <button
              key={index}
              onClick={() => loadSampleTest(index)}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-left"
            >
              <span className="font-medium">{test.title}</span>
              <span className="block text-sm text-gray-500">Category: {test.category}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6 mt-8">
        <h2 className="text-xl font-bold mb-4">URL Format Verification</h2>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Format
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Value
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                Expected URL Format
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                /vendors/[category]/[unique-identifier]
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                  Pattern
                </span>
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                Current Public URL
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 break-all">
                {publicUrl}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  publicUrl.split('/').length === 4 && !publicUrl.includes('//')
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {publicUrl.split('/').length === 4 && !publicUrl.includes('//')
                    ? 'Valid'
                    : 'Invalid'}
                </span>
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                URL Contains Duplicate Terms
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {publicUrl.toLowerCase().includes(title.toLowerCase().split(' ')[0].toLowerCase()) && 
                 publicUrl.toLowerCase().split('/')[2].includes(title.toLowerCase().split(' ')[0].toLowerCase()) 
                  ? 'Yes - Potential duplication detected'
                  : 'No - Unique terms'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  publicUrl.toLowerCase().includes(title.toLowerCase().split(' ')[0].toLowerCase()) && 
                  publicUrl.toLowerCase().split('/')[2].includes(title.toLowerCase().split(' ')[0].toLowerCase())
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-green-100 text-green-800'
                }`}>
                  {publicUrl.toLowerCase().includes(title.toLowerCase().split(' ')[0].toLowerCase()) && 
                   publicUrl.toLowerCase().split('/')[2].includes(title.toLowerCase().split(' ')[0].toLowerCase())
                    ? 'Warning'
                    : 'Good'}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VendorUrlTestPage;