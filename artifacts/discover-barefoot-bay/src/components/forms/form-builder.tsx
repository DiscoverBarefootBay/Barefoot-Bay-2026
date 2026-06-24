import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, MoveUp, MoveDown, PlusCircle } from "lucide-react";
import { 
  FormField, 
  FormFieldType, 
  CustomFormDefinition 
} from "@/components/forms/custom-form-types";
import { v4 as uuidv4 } from "uuid";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface FormBuilderProps {
  initialForm?: CustomFormDefinition;
  onSaved?: (form: CustomFormDefinition) => void;
  onCancel?: () => void;
}

export default function FormBuilder({ initialForm, onSaved, onCancel }: FormBuilderProps) {
  const [form, setForm] = useState<CustomFormDefinition>(
    initialForm || {
      title: "",
      description: "",
      slug: "",
      fields: [],
      submitButtonText: "Submit",
      successMessage: "Thank you for your submission!",
    }
  );
  
  const [activeTab, setActiveTab] = useState("general");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Add a new field to the form
  const addField = (type: FormFieldType) => {
    const newField: FormField = {
      id: uuidv4(),
      label: `New ${type} field`,
      type,
      required: false,
    };
    
    if (type === "select" || type === "radio" || type === "checkbox") {
      newField.options = [
        { label: "Option 1", value: "option1" },
        { label: "Option 2", value: "option2" }
      ];
    }
    
    setForm({
      ...form,
      fields: [...form.fields, newField]
    });
  };

  // Remove a field from the form
  const removeField = (fieldId: string) => {
    setForm({
      ...form,
      fields: form.fields.filter(field => field.id !== fieldId)
    });
  };

  // Update a field's properties
  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    setForm({
      ...form,
      fields: form.fields.map(field => 
        field.id === fieldId ? { ...field, ...updates } : field
      )
    });
  };

  // Add an option to a select/radio/checkbox field
  const addOption = (fieldId: string) => {
    setForm({
      ...form,
      fields: form.fields.map(field => {
        if (field.id === fieldId) {
          const options = field.options || [];
          return {
            ...field,
            options: [
              ...options,
              { label: `Option ${options.length + 1}`, value: `option${options.length + 1}` }
            ]
          };
        }
        return field;
      })
    });
  };

  // Remove an option from a select/radio/checkbox field
  const removeOption = (fieldId: string, optionIndex: number) => {
    setForm({
      ...form,
      fields: form.fields.map(field => {
        if (field.id === fieldId && field.options) {
          return {
            ...field,
            options: field.options.filter((_, index) => index !== optionIndex)
          };
        }
        return field;
      })
    });
  };

  // Update an option in a select/radio/checkbox field
  const updateOption = (
    fieldId: string, 
    optionIndex: number, 
    updates: { label?: string; value?: string }
  ) => {
    setForm({
      ...form,
      fields: form.fields.map(field => {
        if (field.id === fieldId && field.options) {
          const newOptions = [...field.options];
          newOptions[optionIndex] = { 
            ...newOptions[optionIndex], 
            ...updates 
          };
          return { ...field, options: newOptions };
        }
        return field;
      })
    });
  };

  // Move a field up in the list
  const moveFieldUp = (fieldId: string) => {
    const fieldIndex = form.fields.findIndex(field => field.id === fieldId);
    if (fieldIndex > 0) {
      const newFields = [...form.fields];
      [newFields[fieldIndex - 1], newFields[fieldIndex]] = 
        [newFields[fieldIndex], newFields[fieldIndex - 1]];
      setForm({ ...form, fields: newFields });
    }
  };

  // Move a field down in the list
  const moveFieldDown = (fieldId: string) => {
    const fieldIndex = form.fields.findIndex(field => field.id === fieldId);
    if (fieldIndex < form.fields.length - 1) {
      const newFields = [...form.fields];
      [newFields[fieldIndex], newFields[fieldIndex + 1]] = 
        [newFields[fieldIndex + 1], newFields[fieldIndex]];
      setForm({ ...form, fields: newFields });
    }
  };

  // Generate a slug from the title
  const generateSlug = () => {
    const slug = form.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
      
    setForm({ ...form, slug });
  };

  // Save the form to the backend
  const saveMutation = useMutation({
    mutationFn: async (formData: CustomFormDefinition) => {
      // Validate form before saving
      if (!formData.title) {
        throw new Error("Form title is required");
      }
      
      if (!formData.slug) {
        throw new Error("Form slug is required");
      }
      
      if (formData.fields.length === 0) {
        throw new Error("Form must have at least one field");
      }
      
      // Convert fields to formFields for backend compatibility
      // Also clean dates to ensure they don't cause issues with database
      const formDataForBackend = {
        ...formData,
        formFields: formData.fields, // Map fields to formFields for database
        // Remove date objects that might cause issues with database
        createdAt: undefined,
        updatedAt: undefined
      };
      
      // Save to backend
      if (formData.id) {
        // Update existing form
        const response = await apiRequest({
          url: `/api/forms/${formData.id}`,
          method: 'PATCH',
          body: formDataForBackend
        });
        return response.json();
      } else {
        // Create new form
        const response = await apiRequest({
          url: '/api/forms',
          method: 'POST',
          body: formDataForBackend
        });
        return response.json();
      }
    },
    onSuccess: (savedForm) => {
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/forms", form.id] });
      
      // Also invalidate by-slug queries
      if (form.slug) {
        queryClient.invalidateQueries({ queryKey: [`/api/forms/by-slug/${form.slug}`] });
      }
      
      toast({
        title: "Form Saved",
        description: `The form "${savedForm.title}" has been saved successfully.`,
      });
      
      if (onSaved) {
        onSaved(savedForm);
      }
    },
    onError: (error) => {
      toast({
        title: "Error Saving Form",
        description: error instanceof Error ? error.message : "An error occurred while saving the form.",
        variant: "destructive",
      });
    }
  });

  // Render field options for select/radio/checkbox fields
  const renderFieldOptions = (field: FormField) => {
    if (!field.options || field.type !== "select" && field.type !== "radio" && field.type !== "checkbox") {
      return null;
    }

    return (
      <div className="mt-4 space-y-2">
        <div className="flex justify-between items-center">
          <Label>Options</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addOption(field.id)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Option
          </Button>
        </div>
        
        {field.options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={option.label}
              onChange={(e) => updateOption(field.id, index, { label: e.target.value })}
              placeholder="Option label"
              className="flex-1"
            />
            <Input
              value={option.value}
              onChange={(e) => updateOption(field.id, index, { value: e.target.value })}
              placeholder="Option value"
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeOption(field.id, index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="general">General Settings</TabsTrigger>
          <TabsTrigger value="fields">Form Fields</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Form Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Form Title</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Enter form title..."
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description || ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Enter form description..."
                  rows={4}
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="slug">Form Slug</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={generateSlug}
                    disabled={!form.title}
                  >
                    Generate from title
                  </Button>
                </div>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="my-custom-form"
                />
                <p className="text-sm text-muted-foreground">
                  This will be used in the URL and to identify the form.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="fields" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Form Fields</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Select onValueChange={(value) => addField(value as FormFieldType)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Add Field" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text Field</SelectItem>
                    <SelectItem value="textarea">Textarea</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="tel">Phone</SelectItem>
                    <SelectItem value="select">Dropdown</SelectItem>
                    <SelectItem value="radio">Radio Buttons</SelectItem>
                    <SelectItem value="checkbox">Checkboxes</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="file">File Upload</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.fields.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 bg-muted rounded-md">
                  <p className="text-muted-foreground mb-4">No fields added yet</p>
                  <Button 
                    variant="outline" 
                    onClick={() => addField("text")}
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add your first field
                  </Button>
                </div>
              ) : (
                form.fields.map((field, index) => (
                  <Card key={field.id} className="relative">
                    <CardContent className="pt-6 pb-4">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{field.type.charAt(0).toUpperCase() + field.type.slice(1)} Field</p>
                            <p className="text-xs text-muted-foreground">{field.id}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => moveFieldUp(field.id)}
                              disabled={index === 0}
                            >
                              <MoveUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => moveFieldDown(field.id)}
                              disabled={index === form.fields.length - 1}
                            >
                              <MoveDown className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeField(field.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor={`field-${field.id}-label`}>Field Label</Label>
                          <Input
                            id={`field-${field.id}-label`}
                            value={field.label}
                            onChange={(e) => updateField(field.id, { label: e.target.value })}
                            placeholder="Enter field label..."
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor={`field-${field.id}-placeholder`}>Placeholder</Label>
                          <Input
                            id={`field-${field.id}-placeholder`}
                            value={field.placeholder || ""}
                            onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                            placeholder="Enter placeholder text..."
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor={`field-${field.id}-help`}>Help Text</Label>
                          <Input
                            id={`field-${field.id}-help`}
                            value={field.helpText || ""}
                            onChange={(e) => updateField(field.id, { helpText: e.target.value })}
                            placeholder="Enter help text..."
                          />
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`field-${field.id}-required`}
                            checked={field.required}
                            onCheckedChange={(checked) => updateField(field.id, { required: checked })}
                          />
                          <Label htmlFor={`field-${field.id}-required`}>Required field</Label>
                        </div>
                        
                        {renderFieldOptions(field)}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="submitButtonText">Submit Button Text</Label>
                <Input
                  id="submitButtonText"
                  value={form.submitButtonText || "Submit"}
                  onChange={(e) => setForm({ ...form, submitButtonText: e.target.value })}
                  placeholder="Submit"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="successMessage">Success Message</Label>
                <Textarea
                  id="successMessage"
                  value={form.successMessage || ""}
                  onChange={(e) => setForm({ ...form, successMessage: e.target.value })}
                  placeholder="Form submitted successfully!"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="termsAndConditions">Terms and Conditions</Label>
                <Textarea
                  id="termsAndConditions"
                  value={form.termsAndConditions || ""}
                  onChange={(e) => setForm({ ...form, termsAndConditions: e.target.value })}
                  placeholder="Enter terms and conditions..."
                  rows={6}
                />
                <p className="text-sm text-muted-foreground">
                  If provided, users will be required to accept these terms before submitting the form.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        <Button
          type="button"
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? "Saving..." : "Save Form"}
        </Button>
      </div>
    </div>
  );
}