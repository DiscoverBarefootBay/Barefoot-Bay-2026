import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Search, Calendar, MessageSquare, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import FormBuilder from "@/components/forms/form-builder";
import { CustomFormDefinition } from "@/components/forms/custom-form-types";

interface FormInsertDialogProps {
  children: React.ReactNode;
  onFormInsert?: (formHtml: string) => void; // Keep for backward compatibility
  onBeforeOpen?: () => void;
  onAfterClose?: () => void;
  insertAtCursor?: (html: string) => void; // Preferred method for proper cursor insertion
}

interface FormSummary {
  id: number;
  title: string;
  description: string;
  fieldCount: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// Helper function to generate form HTML from form data
const generateFormHTML = async (formId: number): Promise<string> => {
  try {
    // Fetch the form data to get all fields using authenticated apiRequest
    const response = await apiRequest({
      url: `/api/forms/${formId}`,
      method: 'GET',
    });
    if (!response.ok) {
      throw new Error('Failed to fetch form data');
    }
    
    const form = await response.json();
    
    // Create a simple, contentEditable-friendly placeholder that will be processed later
    // This approach is similar to how media embeds work in the editor
    return `
      <div class="form-embed-placeholder" 
           contenteditable="false" 
           data-form-id="${formId}" 
           data-form-title="${form.title}"
           style="border: 2px dashed #ccc; padding: 16px; margin: 16px 0; border-radius: 8px; background: #f9f9f9; text-align: center; display: block;">
        <div style="color: #666; font-weight: 500;">📝 Interactive Form: ${form.title}</div>
        <div style="color: #888; font-size: 12px; margin-top: 4px;">Form ID: ${formId} • Click to interact when published</div>
      </div>
    `;
  } catch (error) {
    console.error('Error generating form HTML:', error);
    // Fallback to a simple placeholder if form data can't be fetched
    return `
      <div class="form-embed-placeholder" 
           contenteditable="false" 
           data-form-id="${formId}" 
           style="border: 2px dashed #f56565; padding: 16px; margin: 16px 0; border-radius: 8px; background: #fed7d7; text-align: center; display: block;">
        <div style="color: #c53030; font-weight: 500;">⚠️ Form Not Found</div>
        <div style="color: #9c2424; font-size: 12px; margin-top: 4px;">Form ID: ${formId}</div>
      </div>
    `;
  }
};

export function FormInsertDialog({ 
  children, 
  onFormInsert, 
  onBeforeOpen, 
  onAfterClose,
  insertAtCursor
}: FormInsertDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("existing");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFormId, setSelectedFormId] = useState<number | null>(null);
  const [showFormBuilder, setShowFormBuilder] = useState(false);

  // Fetch existing forms
  const { data: forms, isLoading, refetch } = useQuery({
    queryKey: ['forms-list'],
    queryFn: async () => {
      const response = await apiRequest({
        url: '/api/forms',
        method: 'GET',
      });
      return response.forms as FormSummary[];
    },
    enabled: isOpen && activeTab === "existing"
  });

  // Filter forms based on search term
  const filteredForms = forms?.filter(form => 
    !form.isDeleted && (
      form.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      form.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
  ) || [];

  const handleOpenChange = (open: boolean) => {
    if (open && onBeforeOpen) {
      onBeforeOpen();
    }
    
    setIsOpen(open);
    
    if (!open) {
      // Reset state when closing
      setActiveTab("existing");
      setSearchTerm("");
      setSelectedFormId(null);
      setShowFormBuilder(false);
      
      if (onAfterClose) {
        onAfterClose();
      }
    }
  };

  const handleFormSelect = async (formId: number) => {
    try {
      console.log(`[FormInsertDialog] Selecting form ID: ${formId}`);
      
      // Generate actual form HTML with all fields
      const formHtml = await generateFormHTML(formId);
      console.log(`[FormInsertDialog] Generated form HTML:`, formHtml);

      // Use insertAtCursor if available (preferred method), otherwise fall back to onFormInsert
      if (insertAtCursor) {
        console.log(`[FormInsertDialog] Using insertAtCursor method for proper positioning`);
        insertAtCursor(formHtml);
      } else if (onFormInsert) {
        console.log(`[FormInsertDialog] Using fallback onFormInsert method`);
        onFormInsert(formHtml);
      } else {
        console.error('No insertion method available');
        return;
      }

      setIsOpen(false);
    } catch (error) {
      console.error('Error inserting form:', error);
    }
  };

  const handleNewFormSaved = (form: CustomFormDefinition) => {
    setShowFormBuilder(false);
    refetch(); // Refresh the forms list
    
    // Auto-select the newly created form if it has an ID
    if (form.id) {
      handleFormSelect(form.id);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getFormIcon = (title: string) => {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('contact') || titleLower.includes('message')) {
      return <MessageSquare size={16} />;
    }
    if (titleLower.includes('event') || titleLower.includes('calendar')) {
      return <Calendar size={16} />;
    }
    if (titleLower.includes('profile') || titleLower.includes('user')) {
      return <User size={16} />;
    }
    return <FileText size={16} />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={20} />
            Insert Form
          </DialogTitle>
        </DialogHeader>

        {showFormBuilder ? (
          <div className="flex-1 overflow-auto">
            <FormBuilder
              onSaved={handleNewFormSaved}
              onCancel={() => setShowFormBuilder(false)}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="existing">Existing Forms</TabsTrigger>
                <TabsTrigger value="new">Create New Form</TabsTrigger>
              </TabsList>

              <TabsContent value="existing" className="flex-1 flex flex-col gap-4">
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <Input
                      placeholder="Search forms..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <div className="flex-1 overflow-auto max-h-[400px] space-y-2">
                    {isLoading ? (
                      <div className="text-center py-8 text-gray-500">
                        Loading forms...
                      </div>
                    ) : filteredForms.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        {searchTerm ? 'No forms match your search.' : 'No forms available. Create your first form!'}
                      </div>
                    ) : (
                      filteredForms.map((form) => (
                        <Card 
                          key={form.id} 
                          className={`cursor-pointer transition-all hover:shadow-md border-2 ${
                            selectedFormId === form.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                          }`}
                          onClick={() => setSelectedFormId(form.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  {getFormIcon(form.title)}
                                  <h3 className="font-semibold text-lg">{form.title}</h3>
                                  <Badge variant="secondary" className="text-xs">
                                    {form.fieldCount} field{form.fieldCount !== 1 ? 's' : ''}
                                  </Badge>
                                </div>
                                {form.description && (
                                  <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                                    {form.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  <span>Created: {formatDate(form.createdAt)}</span>
                                  {form.updatedAt !== form.createdAt && (
                                    <span>Updated: {formatDate(form.updatedAt)}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex justify-between border-t pt-4">
                  <Button variant="outline" onClick={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => selectedFormId && handleFormSelect(selectedFormId)}
                    disabled={!selectedFormId}
                  >
                    Insert Selected Form
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="new" className="flex-1 flex flex-col">
                <div className="text-center py-8 space-y-4">
                  <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                    <Plus size={32} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Create a New Form</h3>
                    <p className="text-gray-600 mb-4">
                      Build a custom form with various field types and insert it directly into your content.
                    </p>
                    <Button onClick={() => setShowFormBuilder(true)} className="gap-2">
                      <Plus size={16} />
                      Start Building Form
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}