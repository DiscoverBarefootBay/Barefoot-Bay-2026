import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface FormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: Array<{ value: string; label: string }>;
}

interface FormData {
  id: number;
  title: string;
  description?: string;
  formFields: FormField[];
}

interface EmbeddedFormRendererProps {
  formId: number;
  formTitle?: string;
}

/**
 * Component that renders an actual interactive form from a form ID
 * This replaces the simple placeholders when content is displayed
 */
export default function EmbeddedFormRenderer({ formId, formTitle }: EmbeddedFormRendererProps) {
  const [formData, setFormData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});

  // Load form data
  useEffect(() => {
    const loadForm = async () => {
      try {
        setLoading(true);
        console.log(`[EmbeddedFormRenderer] Loading form ${formId}...`);
        const response = await apiRequest({
          url: `/api/forms/${formId}`,
          method: 'GET',
        });
        console.log(`[EmbeddedFormRenderer] Response status: ${response.status}`);
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[EmbeddedFormRenderer] Error response: ${errorText}`);
          throw new Error(`Failed to load form: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        console.log(`[EmbeddedFormRenderer] Form data loaded:`, data);
        setFormData(data);
      } catch (err) {
        console.error(`[EmbeddedFormRenderer] Error loading form ${formId}:`, err);
        setError(err instanceof Error ? err.message : 'Failed to load form');
      } finally {
        setLoading(false);
      }
    };

    loadForm();
  }, [formId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      setError(null);

      console.log('[EmbeddedFormRenderer] Submitting form data:', formValues);
      const response = await apiRequest({
        url: `/api/forms/${formId}/submit`,
        method: 'POST',
        body: { formData: formValues },
      });

      console.log(`[EmbeddedFormRenderer] Response status: ${response.status}`);
      if (response.ok) {
        const result = await response.json();
        console.log(`[EmbeddedFormRenderer] Form submission successful:`, result);
        setSubmitted(true);
        setFormValues({});
      } else {
        console.error(`[EmbeddedFormRenderer] Form submission failed with status: ${response.status}`);
        try {
          const errorData = await response.json();
          const errorMessage = errorData.error || `Server error: ${response.status}`;
          console.error(`[EmbeddedFormRenderer] Error details:`, errorData);
          setError(errorMessage);
        } catch (parseError) {
          console.error(`[EmbeddedFormRenderer] Could not parse error response:`, parseError);
          const errorText = await response.text();
          console.error(`[EmbeddedFormRenderer] Raw error response:`, errorText);
          setError(`Server error: ${response.status} - ${errorText}`);
        }
      }
    } catch (err) {
      setError('Failed to submit form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormValues(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  if (loading) {
    return (
      <div className="form-embed border rounded-lg p-6 bg-white shadow-sm mb-4">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span className="text-gray-600">Loading form...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="form-embed border border-red-200 rounded-lg p-6 bg-red-50 mb-4">
        <div className="text-center">
          <div className="text-red-600 font-medium">Failed to load form</div>
          <div className="text-red-500 text-sm mt-1">{error}</div>
          <div className="text-gray-500 text-xs mt-2">Form ID: {formId}</div>
        </div>
      </div>
    );
  }

  if (!formData) {
    return (
      <div className="form-embed border border-gray-200 rounded-lg p-6 bg-gray-50 mb-4">
        <div className="text-center text-gray-600">
          Form not found (ID: {formId})
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="form-embed border border-green-200 rounded-lg p-6 bg-green-50 mb-4">
        <div className="text-center">
          <div className="text-green-600 font-medium">✓ Form submitted successfully!</div>
          <div className="text-green-500 text-sm mt-1">Thank you for your submission.</div>
          <Button 
            onClick={() => setSubmitted(false)} 
            variant="outline" 
            size="sm" 
            className="mt-3"
          >
            Submit Another Response
          </Button>
        </div>
      </div>
    );
  }

  const renderField = (field: FormField) => {
    const fieldValue = formValues[field.id] || '';

    const fieldElement = (() => {
      switch (field.type) {
        case 'text':
        case 'email':
        case 'tel':
          return (
            <input
              type={field.type}
              id={`field-${field.id}`}
              value={fieldValue}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder || ''}
              required={field.required}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          );

        case 'textarea':
          return (
            <textarea
              id={`field-${field.id}`}
              value={fieldValue}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder || ''}
              rows={4}
              required={field.required}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          );

        case 'number':
          return (
            <input
              type="number"
              id={`field-${field.id}`}
              value={fieldValue}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder || ''}
              required={field.required}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          );

        case 'select':
          return (
            <select
              id={`field-${field.id}`}
              value={fieldValue}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              required={field.required}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select an option...</option>
              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          );

        case 'radio':
          return (
            <div className="space-y-2">
              {field.options?.map((option, index) => (
                <div key={option.value} className="flex items-center">
                  <input
                    type="radio"
                    id={`field-${field.id}-${index}`}
                    name={`field-${field.id}`}
                    value={option.value}
                    checked={fieldValue === option.value}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    required={field.required && index === 0}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <label htmlFor={`field-${field.id}-${index}`} className="ml-2 text-sm text-gray-700">
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          );

        case 'checkbox':
          return (
            <div className="flex items-center">
              <input
                type="checkbox"
                id={`field-${field.id}`}
                checked={fieldValue === true || fieldValue === 'true'}
                onChange={(e) => handleFieldChange(field.id, e.target.checked)}
                required={field.required}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor={`field-${field.id}`} className="ml-2 text-sm text-gray-700">
                {field.label}
              </label>
            </div>
          );

        case 'date':
          return (
            <input
              type="date"
              id={`field-${field.id}`}
              value={fieldValue}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              required={field.required}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          );

        case 'file':
          return (
            <input
              type="file"
              id={`field-${field.id}`}
              onChange={(e) => handleFieldChange(field.id, e.target.files?.[0] || null)}
              required={field.required}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          );

        default:
          return null;
      }
    })();

    return (
      <div key={field.id} className="form-field">
        {field.type !== 'checkbox' && (
          <label htmlFor={`field-${field.id}`} className="block text-sm font-medium text-gray-700 mb-1">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        {fieldElement}
        {field.helpText && (
          <p className="text-xs text-gray-500 mt-1">{field.helpText}</p>
        )}
      </div>
    );
  };

  return (
    <div className="form-embed border rounded-lg p-6 bg-white shadow-sm mb-4">
      <div className="form-header mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{formData.title}</h3>
        {formData.description && (
          <p className="text-sm text-gray-600 mt-1">{formData.description}</p>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {formData.formFields.map(renderField)}
        
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="text-red-600 text-sm">{error}</div>
          </div>
        )}
        
        <div className="form-submit pt-4">
          <Button 
            type="submit" 
            disabled={submitting}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Submitting...
              </>
            ) : (
              'Submit'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}