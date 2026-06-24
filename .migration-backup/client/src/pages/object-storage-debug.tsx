import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import axios from 'axios';

export default function ObjectStorageDebugPage() {
  const [objectKey, setObjectKey] = useState<string>('/real-estate-media/');
  const [logs, setLogs] = useState<string[]>([]);
  const [checkResult, setCheckResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [testImageUrl, setTestImageUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  function addLog(message: string) {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  }
  
  async function checkObjectExists(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setCheckResult(null);
    
    try {
      addLog(`Checking if object exists: ${objectKey}`);
      
      const response = await axios.get('/api/debug/object-storage', {
        params: { key: objectKey }
      });
      
      setCheckResult(response.data);
      
      if (response.data.exists) {
        addLog(`✅ Object exists! Presigned URL generated.`);
        if (response.data.url) {
          setTestImageUrl(response.data.url);
        }
      } else {
        addLog(`❌ Object does not exist in storage.`);
      }
    } catch (error: any) {
      addLog(`Error checking object: ${error.message}`);
      setCheckResult({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  }
  
  async function uploadTestImage(e: React.FormEvent) {
    e.preventDefault();
    
    if (!fileInputRef.current?.files?.length) {
      addLog('No file selected');
      return;
    }
    
    const file = fileInputRef.current.files[0];
    const formData = new FormData();
    formData.append('media', file);
    
    setIsLoading(true);
    try {
      addLog(`Uploading test image: ${file.name}`);
      
      // Use the real estate media upload endpoint - note the correct endpoint name
      const response = await axios.post('/api/upload/real-estate-media', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setUploadResult(response.data);
      
      // Response from real-estate-media endpoint has mediaUrls array
      if (response.data.mediaUrls && response.data.mediaUrls.length > 0) {
        const uploadedUrl = response.data.mediaUrls[0];
        addLog(`✅ Upload successful: ${uploadedUrl}`);
        setObjectKey(uploadedUrl);
        // Test the uploaded image URL
        retrieveImage(uploadedUrl);
      } else if (response.data.success && response.data.url) {
        // Fallback for standard upload endpoint format
        addLog(`✅ Upload successful: ${response.data.url}`);
        setObjectKey(response.data.url);
        retrieveImage(response.data.url);
      } else {
        addLog(`❌ Upload failed: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      addLog(`Error uploading image: ${error.message}`);
      setUploadResult({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  }
  
  async function retrieveImage(url: string = objectKey) {
    setIsLoading(true);
    try {
      addLog(`Retrieving image: ${url}`);
      
      // Check if the URL already includes http or https
      if (url.startsWith('http')) {
        setTestImageUrl(url);
        addLog('Using direct URL');
      } else {
        // Otherwise, use the storage proxy API
        const response = await axios.get('/api/debug/object-storage', {
          params: { key: url }
        });
        
        if (response.data.exists && response.data.url) {
          setTestImageUrl(response.data.url);
          addLog(`✅ Retrieved presigned URL: ${response.data.url.substring(0, 50)}...`);
        } else {
          addLog(`❌ Failed to get presigned URL - object may not exist`);
          setTestImageUrl('');
        }
      }
    } catch (error: any) {
      addLog(`Error retrieving image: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }
  
  function testMediaDisplay(url: string) {
    setTestImageUrl(url);
    addLog(`Testing media display with URL: ${url}`);
  }
  
  function clearLogs() {
    setLogs([]);
  }
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Object Storage Debugging</h1>
      <p className="text-gray-500 mb-6">
        This tool helps diagnose issues with Object Storage media files, particularly for real estate listings.
      </p>
      
      <Tabs defaultValue="check">
        <TabsList className="mb-4">
          <TabsTrigger value="check">Check Object</TabsTrigger>
          <TabsTrigger value="upload">Upload Test</TabsTrigger>
          <TabsTrigger value="display">Display Test</TabsTrigger>
        </TabsList>
        
        <TabsContent value="check">
          <Card>
            <CardHeader>
              <CardTitle>Check if Object Exists</CardTitle>
              <CardDescription>
                Enter an object key/path to check if it exists in Object Storage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={checkObjectExists} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="objectKey">Object Key/Path</Label>
                  <Input
                    id="objectKey"
                    value={objectKey}
                    onChange={(e) => setObjectKey(e.target.value)}
                    placeholder="/real-estate-media/filename.jpg"
                  />
                  <p className="text-xs text-gray-500">
                    Include the leading slash in the path, e.g. "/real-estate-media/filename.jpg"
                  </p>
                </div>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Checking...' : 'Check Object'}
                </Button>
              </form>
              
              {checkResult && (
                <div className="mt-4">
                  <Separator className="my-4" />
                  <h3 className="text-lg font-medium">Result</h3>
                  <pre className="bg-gray-100 p-4 rounded-md mt-2 overflow-x-auto text-sm">
                    {JSON.stringify(checkResult, null, 2)}
                  </pre>
                  
                  {checkResult.exists && checkResult.url && (
                    <>
                      <h3 className="text-lg font-medium mt-4">Preview</h3>
                      <div className="mt-2 border border-gray-300 rounded-md p-2">
                        <img 
                          src={checkResult.url} 
                          alt="Object storage preview"
                          className="max-w-full h-auto" 
                          onError={() => addLog("⚠️ Image failed to load")}
                          onLoad={() => addLog("✅ Image loaded successfully")}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Upload Test Image</CardTitle>
              <CardDescription>
                Upload a test image to Object Storage using the real estate media upload endpoint
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={uploadTestImage} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="fileInput">Select Image File</Label>
                  <Input
                    id="fileInput"
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                  />
                </div>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Uploading...' : 'Upload Image'}
                </Button>
              </form>
              
              {uploadResult && (
                <div className="mt-4">
                  <Separator className="my-4" />
                  <h3 className="text-lg font-medium">Upload Result</h3>
                  <pre className="bg-gray-100 p-4 rounded-md mt-2 overflow-x-auto text-sm">
                    {JSON.stringify(uploadResult, null, 2)}
                  </pre>
                  
                  {(uploadResult.success && uploadResult.url) || 
                   (uploadResult.mediaUrls && uploadResult.mediaUrls.length > 0) ? (
                    <>
                      <h3 className="text-lg font-medium mt-4">Preview</h3>
                      <div className="mt-2 border border-gray-300 rounded-md p-2">
                        <img 
                          src={uploadResult.mediaUrls ? 
                            `/api/storage-proxy/REAL_ESTATE/${uploadResult.mediaUrls[0].replace(/^\/real-estate-media\//, '')}` : 
                            uploadResult.url
                          } 
                          alt="Uploaded image preview"
                          className="max-w-full h-auto" 
                          onError={() => addLog("⚠️ Uploaded image failed to load")}
                          onLoad={() => addLog("✅ Uploaded image loaded successfully")}
                        />
                      </div>
                    </>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="display">
          <Card>
            <CardHeader>
              <CardTitle>Test Media Display</CardTitle>
              <CardDescription>
                Test different URL formats to diagnose media display issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="testUrl">Test URL</Label>
                  <Input
                    id="testUrl"
                    value={testImageUrl}
                    onChange={(e) => setTestImageUrl(e.target.value)}
                    placeholder="Enter URL to test"
                  />
                </div>
                
                <div className="flex flex-col gap-2">
                  <Button onClick={() => retrieveImage()} disabled={isLoading}>
                    {isLoading ? 'Retrieving...' : 'Get Presigned URL'}
                  </Button>
                  
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Button 
                      variant="outline"
                      onClick={() => testMediaDisplay(`/api/storage-proxy/REAL_ESTATE/${objectKey.replace(/^\//, '')}`)}
                    >
                      Test with Storage Proxy
                    </Button>
                    
                    <Button 
                      variant="outline"
                      onClick={() => testMediaDisplay(`/real-estate-media/${objectKey.split('/').pop()}`)}
                    >
                      Test with Direct Path
                    </Button>
                  </div>
                </div>
                
                {testImageUrl && (
                  <div className="mt-4">
                    <h3 className="text-lg font-medium">Media Preview</h3>
                    <p className="text-sm text-gray-500 break-all mb-2">{testImageUrl}</p>
                    <div className="mt-2 border border-gray-300 rounded-md p-2">
                      <img 
                        src={testImageUrl} 
                        alt="Media preview"
                        className="max-w-full h-auto" 
                        onError={() => addLog("⚠️ Image failed to load")}
                        onLoad={() => addLog("✅ Image loaded successfully")}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Debug Logs</CardTitle>
          <CardDescription>
            Activity log for debugging Object Storage operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            className="font-mono text-sm h-40"
            readOnly
            value={logs.join('\n')}
          />
        </CardContent>
        <CardFooter>
          <Button variant="outline" onClick={clearLogs}>Clear Logs</Button>
        </CardFooter>
      </Card>
    </div>
  );
}