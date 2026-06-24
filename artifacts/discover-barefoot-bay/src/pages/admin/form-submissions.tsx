import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { User, FormSubmission, CustomForm } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { useLocation, RouteComponentProps } from 'wouter';
import { ArrowLeft, FileDown, Download, Trash2, Plus, Pencil } from 'lucide-react';
import FormBuilder from '@/components/forms/form-builder';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface FormSubmissionWithUser extends FormSubmission {
  user?: User;
  form?: CustomForm;
  formData: Record<string, any>;
  _deletedForm?: boolean; // Indicates if the form was deleted but submissions preserved
}

// Props for the FormSubmissionsAdmin component that work with wouter routes
type FormSubmissionsAdminProps = RouteComponentProps<Record<string, string>>;

const FormSubmissionsAdmin = (props: FormSubmissionsAdminProps) => {
  const { isAdmin } = usePermissions();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('all');
  const [expandedSubmission, setExpandedSubmission] = useState<number | null>(null);
  const [groupedSubmissions, setGroupedSubmissions] = useState<{ [key: string]: FormSubmissionWithUser[] }>({});
  const [allForms, setAllForms] = useState<CustomForm[]>([]);
  const [formToDelete, setFormToDelete] = useState<CustomForm | null>(null);
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [formToEdit, setFormToEdit] = useState<CustomForm | null>(null);
  const [formToDeletePermanently, setFormToDeletePermanently] = useState<CustomForm | null>(null);
  const queryClient = useQueryClient();

  // Delete form mutation
  const deleteMutation = useMutation({
    mutationFn: async (formId: number) => {
      const response = await fetch(`/api/forms/${formId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete form');
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Form deleted successfully',
        description: 'The form has been removed from pages',
        variant: 'default',
      });
      
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/forms'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/form-submissions'] });
      
      // Close the delete dialog
      setFormToDelete(null);
      
      // Refresh the page after a short delay to show success message
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    },
    onError: (error) => {
      toast({
        title: 'Error deleting form',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    },
  });

  // Permanent delete form mutation (completely removes form and all data)
  const permanentDeleteMutation = useMutation({
    mutationFn: async (formId: number) => {
      const response = await fetch(`/api/forms/${formId}/permanent-delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to permanently delete form');
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Form permanently deleted',
        description: 'The form and all its data have been completely removed from the database',
        variant: 'default',
      });
      
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/forms'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/form-submissions'] });
      
      // Close the delete dialog
      setFormToDeletePermanently(null);
      
      // Refresh the page after a short delay to show success message
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    },
    onError: (error) => {
      toast({
        title: 'Error permanently deleting form',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    },
  });

  // Handle delete form
  const handleDeleteForm = (form: CustomForm) => {
    setFormToDelete(form);
  };

  // Handle permanent delete form
  const handlePermanentDeleteForm = (form: CustomForm) => {
    setFormToDeletePermanently(form);
  };

  // Confirm delete form
  const confirmDeleteForm = () => {
    if (formToDelete) {
      deleteMutation.mutate(formToDelete.id);
    }
  };

  // Confirm permanent delete form
  const confirmPermanentDeleteForm = () => {
    if (formToDeletePermanently) {
      permanentDeleteMutation.mutate(formToDeletePermanently.id);
    }
  };

  // Handle form builder save
  const handleFormSaved = () => {
    setShowFormBuilder(false);
    setFormToEdit(null);
    // Refresh forms data
    queryClient.invalidateQueries({ queryKey: ['/api/forms'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/form-submissions'] });
  };

  // Handle form builder cancel
  const handleFormCancel = () => {
    setShowFormBuilder(false);
    setFormToEdit(null);
  };

  // Handle editing a form
  const handleEditForm = (form: CustomForm) => {
    setFormToEdit(form);
    setShowFormBuilder(true);
  };

  // Fetch all form submissions
  const { data: submissions = [], isLoading, error } = useQuery<FormSubmission[]>({
    queryKey: ['/api/admin/form-submissions'],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await fetch('/api/admin/form-submissions', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch submissions: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Ensure we always return an array
      if (!Array.isArray(data)) {
        console.error('API returned non-array data for submissions:', data);
        return [];
      }
      
      return data;
    },
  });

  // Fetch all forms
  const { data: forms = [] } = useQuery<CustomForm[]>({
    queryKey: ['/api/forms'],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await fetch('/api/forms', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch forms: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Ensure we always return an array
      if (!Array.isArray(data)) {
        console.error('API returned non-array data for forms:', data);
        return [];
      }
      
      return data;
    },
  });

  // Fetch all users
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await fetch('/api/users', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status}`);
      }
      
      const data = await response.json();
      
      // API returns { success: true, users: [...] } format
      const usersArray = data.users || data;
      
      // Ensure we always return an array
      if (!Array.isArray(usersArray)) {
        console.error('API returned non-array data for users:', data);
        return [];
      }
      
      return usersArray;
    },
  });

  useEffect(() => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to view this page",
        variant: "destructive"
      });
      navigate('/');
    }
  }, [isAdmin, navigate, toast]);

  useEffect(() => {
    console.log('Form submissions effect triggered:', {
      submissions: Array.isArray(submissions) ? `array with ${submissions.length} items` : typeof submissions,
      forms: Array.isArray(forms) ? `array with ${forms.length} items` : typeof forms,
      users: Array.isArray(users) ? `array with ${users.length} items` : typeof users
    });

    // Ensure all data is available and is actually arrays
    if (!Array.isArray(submissions) || !Array.isArray(forms) || !Array.isArray(users)) {
      console.error('Invalid data types received:', {
        submissions: Array.isArray(submissions) ? 'array' : typeof submissions,
        forms: Array.isArray(forms) ? 'array' : typeof forms,
        users: Array.isArray(users) ? 'array' : typeof users
      });
      return;
    }

    if (submissions && forms && users) {
      try {
        const userMap = users.reduce((acc: Record<number, User>, user: User) => {
          if (user && typeof user.id === 'number') {
            acc[user.id] = user;
          }
          return acc;
        }, {} as Record<number, User>);

        const formMap = forms.reduce((acc: Record<number, CustomForm>, form: CustomForm) => {
          if (form && typeof form.id === 'number') {
            acc[form.id] = form;
          }
          return acc;
        }, {} as Record<number, CustomForm>);

        setAllForms(forms);

        // Enhance submissions with user and form data
        const enhancedSubmissions = submissions.map((submission: FormSubmission) => {
          // Ensure formData is an object
          const formData = submission.formData && typeof submission.formData === 'object' 
            ? submission.formData as Record<string, any> 
            : {} as Record<string, any>;
          
          // Handle submissions from deleted forms
          // If the form was deleted, the formId would be negative
          // If the _deletedForm flag is set, it means the form was deleted
          const isFromDeletedForm = submission._deletedForm || submission.formId < 0;
          
          // For deleted forms, use the actual negative formId to look up the deleted form
          // For active forms, use the positive formId
          const lookupFormId = submission.formId; // Use the actual formId (positive or negative)
          
          return {
            ...submission,
            user: submission.userId ? userMap[submission.userId] : undefined,
            form: lookupFormId ? formMap[lookupFormId] : undefined,
            formData,
            _deletedForm: isFromDeletedForm
          };
        });

        // Group submissions by form
        const grouped = enhancedSubmissions.reduce((acc: Record<string, FormSubmissionWithUser[]>, submission: FormSubmissionWithUser) => {
          const formTitle = submission.form?.title || `Form ID: ${submission.formId}`;
          if (!acc[formTitle]) {
            acc[formTitle] = [];
          }
          acc[formTitle].push(submission);
          return acc;
        }, {} as Record<string, FormSubmissionWithUser[]>);

        setGroupedSubmissions(grouped);
      } catch (error) {
        console.error('Error processing form submissions data:', error);
        setGroupedSubmissions({});
      }
    }
  }, [submissions, forms, users]);

  // Function to export form data as CSV
  const exportFormData = (formTitle: string, submissions: FormSubmissionWithUser[]) => {
    if (!submissions.length) return;

    // Get all possible keys from form data
    const allKeys = new Set<string>();
    submissions.forEach(submission => {
      if (submission.formData && typeof submission.formData === 'object') {
        Object.keys(submission.formData).forEach(key => allKeys.add(key));
      }
    });

    // Convert to CSV
    const headerRow = ['Submission ID', 'User', 'Email', 'Submission Date', ...Array.from(allKeys)];
    
    const rows = submissions.map(submission => {
      // Extract contact info from formData as fallback
      const contactInfo = extractContactInfo(submission.form, submission.formData);
      const displayName = submission.user?.username || contactInfo.name || 'Unknown';
      const displayEmail = submission.user?.email || contactInfo.email || 'No email';
      
      const basicData = [
        submission.id,
        displayName,
        displayEmail,
        submission.createdAt ? format(new Date(submission.createdAt), 'yyyy-MM-dd HH:mm') : 'Unknown date'
      ];

      // Add form field data
      const formFieldsData = Array.from(allKeys).map(key => {
        if (submission.formData && typeof submission.formData === 'object') {
          return submission.formData[key] || '';
        }
        return '';
      });

      return [...basicData, ...formFieldsData];
    });

    // Create CSV content
    const csvContent = [
      headerRow.join(','), 
      ...rows.map(row => row.map(cell => typeof cell === 'string' ? `"${cell.replace(/"/g, '""')}"` : cell).join(','))
    ].join('\n');

    // Create a blob and trigger a download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${formTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_submissions.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper function to extract contact information from formData
  const extractContactInfo = (form: CustomForm | undefined, formData: Record<string, any>) => {
    if (!formData || typeof formData !== 'object') {
      return { name: null, email: null };
    }

    let name: string | null = null;
    let email: string | null = null;

    // First, try to use form field definitions if available
    if (form?.formFields && Array.isArray(form.formFields)) {
      for (const field of form.formFields as any[]) {
        if (!field) continue;
        
        // Check for email field type
        if (field.type === 'email' && !email) {
          const fieldValue = formData[field.label] || formData[field.id];
          if (fieldValue && typeof fieldValue === 'string') {
            email = fieldValue;
          }
        }
        
        // Check for name fields by label
        if (!name && field.label) {
          const normalizedLabel = field.label.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (normalizedLabel.includes('name') || normalizedLabel.includes('fullname')) {
            const fieldValue = formData[field.label] || formData[field.id];
            if (fieldValue && typeof fieldValue === 'string') {
              name = fieldValue;
            }
          }
        }
      }
    }

    // Fallback: check common field name variations
    const nameKeys = [
      'name', 'Name', 'full_name', 'Full Name', 'fullName', 'FullName',
      'contact_name', 'Contact Name', 'contactName', 'ContactName',
      'your_name', 'Your Name', 'yourName', 'YourName'
    ];

    const emailKeys = [
      'email', 'Email', 'email_address', 'Email Address', 'emailAddress', 'EmailAddress',
      'contact_email', 'Contact Email', 'contactEmail', 'ContactEmail',
      'your_email', 'Your Email', 'yourEmail', 'YourEmail'
    ];

    // Find name if not already found
    if (!name) {
      for (const key of nameKeys) {
        if (formData[key] && typeof formData[key] === 'string') {
          name = formData[key];
          break;
        }
      }
    }

    // Find email if not already found
    if (!email) {
      for (const key of emailKeys) {
        if (formData[key] && typeof formData[key] === 'string') {
          email = formData[key];
          break;
        }
      }
    }

    return { name, email };
  };

  const renderFormDataDetails = (formData: Record<string, any>) => {
    if (!formData || typeof formData !== 'object') {
      return <p>No form data available</p>;
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2">
        {Object.entries(formData).map(([key, value]) => (
          <div key={key} className="flex flex-col">
            <span className="font-bold text-sm text-gray-700">{key}:</span>
            <span className="text-gray-900">{String(value)}</span>
          </div>
        ))}
      </div>
    );
  };

  if (!isAdmin) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Form Submissions</CardTitle>
            <CardDescription>Loading submissions data...</CardDescription>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>Failed to load form submissions</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-red-500">
              {error instanceof Error ? error.message : 'Unknown error occurred'}
            </p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Test function to directly delete form 11
  const testDeleteForm11 = async () => {
    try {
      const formId = 11; // ID of the BBRD form
      const response = await fetch(`/api/forms/${formId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        
        toast({
          title: 'Error deleting form',
          description: errorData.message || errorData.error || 'Failed to delete form',
          variant: 'destructive',
        });
        return;
      }
      
      const result = await response.json();
      console.log('Delete result:', result);
      
      toast({
        title: 'Form deleted successfully',
        description: 'The form has been removed from pages but submissions are preserved',
        variant: 'default',
      });
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/forms'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/form-submissions'] });
      
      // Refresh the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error deleting form:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto p-6">
      {/* Form Builder Dialog */}
      <Dialog open={showFormBuilder} onOpenChange={(open) => {
        setShowFormBuilder(open);
        if (!open) setFormToEdit(null);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{formToEdit ? 'Edit Form' : 'Create New Form'}</DialogTitle>
            <DialogDescription>
              {formToEdit 
                ? 'Modify the form fields and settings below.' 
                : 'Build a custom form with various field types including text, radio buttons, checkboxes, and more.'}
            </DialogDescription>
          </DialogHeader>
          <FormBuilder
            initialForm={formToEdit ? {
              id: formToEdit.id,
              title: formToEdit.title,
              description: formToEdit.description || '',
              slug: formToEdit.slug,
              fields: (() => {
                // Handle formFields which could be an array, JSON string, or undefined
                if (Array.isArray(formToEdit.formFields)) {
                  return formToEdit.formFields as any;
                }
                if (typeof formToEdit.formFields === 'string') {
                  try {
                    const parsed = JSON.parse(formToEdit.formFields);
                    return Array.isArray(parsed) ? parsed : [];
                  } catch {
                    return [];
                  }
                }
                return [];
              })(),
              submitButtonText: formToEdit.submitButtonText || 'Submit',
              successMessage: formToEdit.successMessage || 'Thank you for your submission!',
            } : undefined}
            onSaved={handleFormSaved}
            onCancel={handleFormCancel}
          />
        </DialogContent>
      </Dialog>
      
      {/* Alert Dialog for Delete Confirmation */}
      <AlertDialog open={!!formToDelete} onOpenChange={(open) => !open && setFormToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this form?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will remove the form from all pages but form submissions will still be accessible in the admin dashboard.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteForm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alert Dialog for Permanent Delete Confirmation */}
      <AlertDialog open={!!formToDeletePermanently} onOpenChange={(open) => !open && setFormToDeletePermanently(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ PERMANENT DELETION WARNING</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="font-semibold text-red-600">
                This action will PERMANENTLY DELETE the form "{formToDeletePermanently?.title}" and ALL its submission data from the database.
              </p>
              <p>
                This includes:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>The form definition and all its fields</li>
                <li>All user submissions and responses</li>
                <li>All uploaded files associated with submissions</li>
                <li>All historical data and timestamps</li>
              </ul>
              <p className="font-semibold text-red-600">
                This action CANNOT be undone. The data will be permanently lost.
              </p>
              <p>
                Are you absolutely sure you want to proceed?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmPermanentDeleteForm}
              className="bg-red-700 text-white hover:bg-red-800"
            >
              Yes, Permanently Delete Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Form Submissions</CardTitle>
              <CardDescription>
                Review and analyze user form submissions
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="default" 
                onClick={() => setShowFormBuilder(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create New Form
              </Button>
              <Button variant="outline" onClick={() => navigate('/')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs 
            defaultValue="all" 
            value={activeTab} 
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="mb-4 flex flex-wrap">
              <TabsTrigger value="all">All Forms</TabsTrigger>
              {allForms.map(form => (
                <TabsTrigger key={form.id} value={`form-${form.id}`}>
                  {form.title}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="all">
              <Card>
                <CardHeader>
                  <CardTitle>All Form Submissions</CardTitle>
                  <CardDescription>View submissions from all forms in one place</CardDescription>
                </CardHeader>
                <CardContent>
                  {Object.keys(groupedSubmissions).length === 0 ? (
                    <p>No form submissions found.</p>
                  ) : (
                    <div className="space-y-6">
                      {Object.entries(groupedSubmissions).map(([formTitle, formSubmissions]) => (
                        <Card key={formTitle} className="mb-4">
                          <CardHeader className="py-3">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center">
                                <CardTitle className="text-lg">{formTitle}</CardTitle>
                                {formSubmissions[0]?._deletedForm && (
                                  <Badge variant="outline" className="ml-2 bg-yellow-50 text-yellow-700 border-yellow-200">
                                    Deleted Form
                                  </Badge>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => exportFormData(formTitle, formSubmissions)}
                                >
                                  <Download className="mr-2 h-4 w-4" />
                                  Export CSV
                                </Button>
                                {formSubmissions[0]?.form && !formSubmissions[0]?._deletedForm && (
                                  <>
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => handleEditForm(formSubmissions[0].form!)}
                                      data-testid={`button-edit-form-${formSubmissions[0].form!.id}`}
                                    >
                                      <Pencil className="mr-2 h-4 w-4" />
                                      Edit Form
                                    </Button>
                                    <Button 
                                      variant="destructive" 
                                      size="sm"
                                      onClick={() => handleDeleteForm(formSubmissions[0].form!)}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete Form
                                    </Button>
                                  </>
                                )}
                                {formSubmissions[0]?._deletedForm && formSubmissions[0]?.form && (
                                  <Button 
                                    variant="destructive" 
                                    size="sm"
                                    onClick={() => handlePermanentDeleteForm(formSubmissions[0].form!)}
                                    className="bg-red-700 hover:bg-red-800"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Data
                                  </Button>
                                )}
                              </div>
                            </div>
                            <CardDescription>
                              {formSubmissions.length} submission{formSubmissions.length !== 1 ? 's' : ''}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <ScrollArea className="h-[400px]">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Submission ID</TableHead>
                                    <TableHead>User</TableHead>
                                    <TableHead>Submission Date</TableHead>
                                    <TableHead>Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {formSubmissions.map((submission) => {
                                    // Extract contact info from formData as fallback
                                    const contactInfo = extractContactInfo(submission.form, submission.formData);
                                    const displayName = submission.user?.username || contactInfo.name || 'Unknown user';
                                    const displayEmail = submission.user?.email || contactInfo.email || 'No email';
                                    
                                    return (
                                    <React.Fragment key={submission.id}>
                                      <TableRow>
                                        <TableCell>{submission.id}</TableCell>
                                        <TableCell>
                                          {displayName}<br />
                                          <span className="text-xs text-gray-500">{displayEmail}</span>
                                        </TableCell>
                                        <TableCell>
                                          {submission.createdAt ? format(new Date(submission.createdAt), 'yyyy-MM-dd HH:mm') : 'Unknown date'}
                                        </TableCell>
                                        <TableCell>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setExpandedSubmission(expandedSubmission === submission.id ? null : submission.id)}
                                          >
                                            {expandedSubmission === submission.id ? 'Hide Details' : 'View Details'}
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                      {expandedSubmission === submission.id && (
                                        <TableRow>
                                          <TableCell colSpan={4} className="bg-gray-50">
                                            <div className="p-2">
                                              <h4 className="font-semibold mb-2">Form Data:</h4>
                                              {renderFormDataDetails(submission.formData)}
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      )}
                                    </React.Fragment>
                                  );
                                  })}
                                </TableBody>
                              </Table>
                            </ScrollArea>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {allForms.map(form => (
              <TabsContent key={form.id} value={`form-${form.id}`}>
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <CardTitle>{form.title}</CardTitle>
                        {groupedSubmissions[form.title]?.[0]?._deletedForm && (
                          <Badge variant="outline" className="ml-2 bg-yellow-50 text-yellow-700 border-yellow-200">
                            Deleted Form
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            const formSubmissions = groupedSubmissions[form.title] || [];
                            exportFormData(form.title, formSubmissions);
                          }}
                        >
                          <FileDown className="mr-2 h-4 w-4" />
                          Export CSV
                        </Button>
                        {!groupedSubmissions[form.title]?.[0]?._deletedForm && (
                          <>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEditForm(form)}
                              data-testid={`button-edit-form-tab-${form.id}`}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit Form
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => handleDeleteForm(form)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Form
                            </Button>
                          </>
                        )}
                        {groupedSubmissions[form.title]?.[0]?._deletedForm && (
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => handlePermanentDeleteForm(form)}
                            className="bg-red-700 hover:bg-red-800 text-white"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Data
                          </Button>
                        )}
                      </div>
                    </div>
                    <CardDescription>
                      {form.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!groupedSubmissions[form.title] || groupedSubmissions[form.title].length === 0 ? (
                      <p>No submissions for this form yet.</p>
                    ) : (
                      <ScrollArea className="h-[500px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Submission ID</TableHead>
                              <TableHead>User</TableHead>
                              <TableHead>Submission Date</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {groupedSubmissions[form.title]?.map((submission) => {
                              // Extract contact info from formData as fallback
                              const contactInfo = extractContactInfo(submission.form, submission.formData);
                              const displayName = submission.user?.username || contactInfo.name || 'Unknown user';
                              const displayEmail = submission.user?.email || contactInfo.email || 'No email';
                              
                              return (
                              <React.Fragment key={submission.id}>
                                <TableRow>
                                  <TableCell>{submission.id}</TableCell>
                                  <TableCell>
                                    {displayName}<br />
                                    <span className="text-xs text-gray-500">{displayEmail}</span>
                                  </TableCell>
                                  <TableCell>
                                    {submission.createdAt ? format(new Date(submission.createdAt), 'yyyy-MM-dd HH:mm') : 'Unknown date'}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setExpandedSubmission(expandedSubmission === submission.id ? null : submission.id)}
                                    >
                                      {expandedSubmission === submission.id ? 'Hide Details' : 'View Details'}
                                    </Button>
                                  </TableCell>
                                </TableRow>
                                {expandedSubmission === submission.id && (
                                  <TableRow>
                                    <TableCell colSpan={4} className="bg-gray-50">
                                      <div className="p-2">
                                        <h4 className="font-semibold mb-2">Form Data:</h4>
                                        {renderFormDataDetails(submission.formData)}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </React.Fragment>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default FormSubmissionsAdmin;