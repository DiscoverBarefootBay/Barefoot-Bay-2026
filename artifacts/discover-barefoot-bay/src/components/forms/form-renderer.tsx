import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage, Form } from "@/components/ui/form";
import { CustomFormDefinition, FormField as CustomFormField } from "@/components/forms/custom-form-types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Check } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

interface FormRendererProps {
  form: CustomFormDefinition;
  onSubmissionComplete?: () => void;
}

export default function FormRenderer({ form, onSubmissionComplete }: FormRendererProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  // Dynamically build the Zod schema based on form fields
  const buildFormSchema = () => {
    const schemaFields: Record<string, any> = {};
    
    form.fields.forEach(field => {
      let fieldSchema: any = z.any();
      
      // Apply basic field type validations
      switch (field.type) {
        case 'text':
        case 'textarea':
          fieldSchema = z.string();
          break;
        case 'number':
          fieldSchema = z.number();
          break;
        case 'email':
          fieldSchema = z.string().email('Please enter a valid email address');
          break;
        case 'tel':
          fieldSchema = z.string().regex(/^\d{10}$/, 'Phone number must be 10 digits');
          break;
        case 'select':
        case 'radio':
          if (field.options && field.options.length > 0) {
            const values = field.options.map(opt => opt.value);
            fieldSchema = z.enum(values as [string, ...string[]]);
          } else {
            fieldSchema = z.string();
          }
          break;
        case 'checkbox':
          fieldSchema = z.boolean();
          break;
        case 'date':
          fieldSchema = z.string(); // Handle as string initially
          break;
        case 'file':
          // For file uploads, we can't easily validate with Zod
          fieldSchema = z.any();
          break;
        default:
          fieldSchema = z.string();
      }
      
      // Apply additional validations based on field properties
      if (field.validations) {
        if (field.type === 'text' || field.type === 'textarea' || field.type === 'email' || field.type === 'tel') {
          if (field.validations.minLength) {
            fieldSchema = fieldSchema.min(
              field.validations.minLength, 
              `Must be at least ${field.validations.minLength} characters`
            );
          }
          if (field.validations.maxLength) {
            fieldSchema = fieldSchema.max(
              field.validations.maxLength, 
              `Must be at most ${field.validations.maxLength} characters`
            );
          }
        }
        
        if (field.type === 'number') {
          if (field.validations.min !== undefined) {
            fieldSchema = fieldSchema.min(
              field.validations.min, 
              `Must be at least ${field.validations.min}`
            );
          }
          if (field.validations.max !== undefined) {
            fieldSchema = fieldSchema.max(
              field.validations.max, 
              `Must be at most ${field.validations.max}`
            );
          }
        }
      }
      
      // Make field required or optional
      if (field.required) {
        // For z.any() type fields, we need to use different required mechanism
        if (field.type === 'file') {
          // For file fields, we need special handling
          fieldSchema = z.any().refine(val => val instanceof FileList && val.length > 0, {
            message: `${field.label} is required`
          });
        } else if (field.type === 'checkbox') {
          // For checkbox, we refine to ensure it's checked
          fieldSchema = z.boolean().refine(val => val === true, {
            message: `${field.label} is required`
          });
        } else {
          // For string or number fields, we add a non-empty check
          fieldSchema = fieldSchema.refine(val => val !== undefined && val !== null && val !== '', {
            message: `${field.label} is required`
          });
        }
      } else {
        // For optional fields
        fieldSchema = fieldSchema.optional();
      }
      
      schemaFields[field.id] = fieldSchema;
    });
    
    // Add terms and conditions acceptance field if present
    if (form.termsAndConditions) {
      schemaFields.termsAccepted = z.boolean()
        .refine(value => value === true, {
          message: "You must accept the terms and conditions to submit this form"
        });
    }
    
    return z.object(schemaFields);
  };
  
  const formSchema = buildFormSchema();
  type FormValues = z.infer<typeof formSchema>;
  
  const formMethods = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: form.fields.reduce((acc, field) => {
      if (field.type === 'checkbox') {
        acc[field.id] = false;
      } else {
        acc[field.id] = '';
      }
      return acc;
    }, {} as Record<string, any>)
  });
  
  const submitMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      if (!form.id) {
        throw new Error("Form ID is required");
      }
      
      // Create FormData for file uploads
      const formData = new FormData();
      const jsonData: Record<string, any> = {};
      
      // Process file fields separately
      const fileFields = form.fields.filter(f => f.type === 'file');
      const fileUploads: File[] = [];
      
      // Process form data
      Object.entries(data).forEach(([key, value]) => {
        const field = form.fields.find(f => f.id === key);
        
        if (field && field.type === 'file') {
          // File fields are handled separately with FormData
          if (value instanceof FileList && value.length > 0) {
            for (let i = 0; i < value.length; i++) {
              fileUploads.push(value[i]);
            }
          }
        } else {
          // All other fields go into the JSON data
          jsonData[key] = value;
        }
      });
      
      // Add any file uploads to the FormData
      fileUploads.forEach((file, index) => {
        formData.append('files', file);
      });
      
      // Add the form data as JSON
      formData.append('formData', JSON.stringify(jsonData));
      
      // Add terms acceptance
      formData.append('termsAccepted', data.termsAccepted ? 'true' : 'false');
      
      // Submit to API
      const response = await fetch(`/api/forms/${form.id}/submit`, {
        method: 'POST',
        headers: {
          // Don't set Content-Type when using FormData
        },
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error submitting form');
      }
      
      return response.json();
    },
    onSuccess: () => {
      setIsSubmitted(true);
      
      if (onSubmissionComplete) {
        onSubmissionComplete();
      }
    },
    onError: (error) => {
      toast({
        title: "Form Submission Failed",
        description: error instanceof Error ? error.message : "An error occurred while submitting the form.",
        variant: "destructive",
      });
    }
  });
  
  const onSubmit = (data: FormValues) => {
    submitMutation.mutate(data);
  };
  
  // If the user is not authenticated, show a message
  if (!user) {
    return (
      <Alert>
        <AlertTitle>Authentication Required</AlertTitle>
        <AlertDescription>
          You must be logged in to submit this form. Please sign in to continue.
        </AlertDescription>
      </Alert>
    );
  }
  
  // If the form has been submitted successfully, show the success message
  if (isSubmitted) {
    return (
      <div className="p-6 bg-muted rounded-md flex flex-col items-center justify-center gap-4">
        <div className="rounded-full p-3 bg-green-100 w-16 h-16 flex items-center justify-center">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold">Form Submitted Successfully</h2>
        <p className="text-center text-muted-foreground">
          {form.successMessage || "Thank you for your submission. We have received your response."}
        </p>
      </div>
    );
  }
  
  // Render a form field based on its type
  const renderField = (field: CustomFormField) => {
    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
        return (
          <FormField
            key={field.id}
            control={formMethods.control}
            name={field.id}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</FormLabel>
                <FormControl>
                  <Input
                    {...formField}
                    type={field.type === 'tel' ? 'tel' : field.type === 'email' ? 'email' : 'text'}
                    placeholder={field.placeholder}
                  />
                </FormControl>
                {field.helpText && <FormDescription>{field.helpText}</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />
        );
      
      case 'textarea':
        return (
          <FormField
            key={field.id}
            control={formMethods.control}
            name={field.id}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</FormLabel>
                <FormControl>
                  <Textarea
                    {...formField}
                    placeholder={field.placeholder}
                    rows={5}
                  />
                </FormControl>
                {field.helpText && <FormDescription>{field.helpText}</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />
        );
      
      case 'number':
        return (
          <FormField
            key={field.id}
            control={formMethods.control}
            name={field.id}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</FormLabel>
                <FormControl>
                  <Input
                    {...formField}
                    type="number"
                    placeholder={field.placeholder}
                  />
                </FormControl>
                {field.helpText && <FormDescription>{field.helpText}</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />
        );
      
      case 'select':
        return (
          <FormField
            key={field.id}
            control={formMethods.control}
            name={field.id}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</FormLabel>
                <Select
                  onValueChange={formField.onChange}
                  defaultValue={formField.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={field.placeholder || "Select an option"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {field.options?.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {field.helpText && <FormDescription>{field.helpText}</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />
        );
      
      case 'radio':
        return (
          <FormField
            key={field.id}
            control={formMethods.control}
            name={field.id}
            render={({ field: formField }) => (
              <FormItem className="space-y-3">
                <FormLabel>{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={formField.onChange}
                    defaultValue={formField.value}
                    className="flex flex-col space-y-1"
                  >
                    {field.options?.map(option => (
                      <FormItem key={option.value} className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value={option.value} />
                        </FormControl>
                        <FormLabel className="font-normal">
                          {option.label}
                        </FormLabel>
                      </FormItem>
                    ))}
                  </RadioGroup>
                </FormControl>
                {field.helpText && <FormDescription>{field.helpText}</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />
        );
      
      case 'checkbox':
        return (
          <FormField
            key={field.id}
            control={formMethods.control}
            name={field.id}
            render={({ field: formField }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-md">
                <FormControl>
                  <Checkbox
                    checked={formField.value}
                    onCheckedChange={formField.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</FormLabel>
                  {field.helpText && <FormDescription>{field.helpText}</FormDescription>}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      
      case 'date':
        return (
          <FormField
            key={field.id}
            control={formMethods.control}
            name={field.id}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</FormLabel>
                <FormControl>
                  <Input
                    {...formField}
                    type="date"
                    placeholder={field.placeholder}
                  />
                </FormControl>
                {field.helpText && <FormDescription>{field.helpText}</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />
        );
      
      case 'file':
        return (
          <FormField
            key={field.id}
            control={formMethods.control}
            name={field.id}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</FormLabel>
                <FormControl>
                  <Input
                    type="file"
                    onChange={(e) => {
                      // Update the form with the FileList
                      formField.onChange(e.target.files);
                    }}
                  />
                </FormControl>
                {field.helpText && <FormDescription>{field.helpText}</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />
        );
      
      default:
        return null;
    }
  };
  
  return (
    <div className="space-y-6">
      {form.description && (
        <div className="bg-muted p-4 rounded-md">
          <p className="text-sm text-muted-foreground">{form.description}</p>
        </div>
      )}
      
      <Form {...formMethods}>
        <form onSubmit={formMethods.handleSubmit(onSubmit)} className="space-y-6">
          {form.fields.map(field => renderField(field))}
          
          {form.termsAndConditions && (
            <FormField
              control={formMethods.control}
              name="termsAccepted"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-md">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>I accept the terms and conditions</FormLabel>
                    <div className="text-sm text-muted-foreground mt-1">
                      {form.termsAndConditions}
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          
          <Button 
            type="submit" 
            disabled={submitMutation.isPending}
            className="w-full"
          >
            {submitMutation.isPending ? "Submitting..." : form.submitButtonText || "Submit"}
          </Button>
        </form>
      </Form>
    </div>
  );
}