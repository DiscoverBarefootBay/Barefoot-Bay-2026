// Define field types for custom forms
export type FormFieldType = 
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'tel'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'file';

// Interface for a single field in a custom form
export interface FormField {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { label: string; value: string }[]; // For select, radio, checkbox
  validations?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
  };
}

// Interface for the entire form structure
export interface CustomFormDefinition {
  id?: number; // Optional as it might not exist before creation
  title: string;
  description?: string;
  slug: string;
  fields: FormField[];
  submitButtonText?: string;
  successMessage?: string;
  termsAndConditions?: string;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: number;
}

// Interface for form submission data
export interface FormSubmissionData {
  id?: number;
  formId: number;
  userId?: number;
  submitterEmail?: string;
  formData: Record<string, any>;
  termsAccepted: boolean;
  fileUploads?: string[];
  ipAddress?: string;
  createdAt?: Date;
}