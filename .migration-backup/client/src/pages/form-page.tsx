import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

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
  slug: string;
  formFields: FormField[];
}

export default function FormPage() {
  const [, params] = useRoute("/forms/:slug");
  const slug = params?.slug;
  const [formData, setFormData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!slug) return;
    const loadForm = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/forms/by-slug/${slug}`);
        if (!response.ok) {
          throw new Error("Form not found");
        }
        const data = await response.json();
        setFormData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load form");
      } finally {
        setLoading(false);
      }
    };
    loadForm();
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    try {
      setSubmitting(true);
      setError(null);
      const response = await fetch(`/api/forms/${formData.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: formValues }),
        credentials: "include",
      });

      if (response.ok) {
        setSubmitted(true);
        setFormValues({});
      } else {
        const errorData = await response.json().catch(() => null);
        setError(errorData?.error || `Submission failed (${response.status})`);
      }
    } catch {
      setError("Failed to submit form. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error && !formData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 font-medium text-lg">Form not found</div>
          <p className="text-gray-500 mt-2">{error}</p>
          <Link href="/">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!formData) return null;

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Request Submitted!</h2>
            <p className="text-gray-600 mb-6">
              Thank you for your interest in a Platinum Sponsorship. Our team has been notified and will review your request shortly.
            </p>
            <div className="flex gap-3 justify-center">
              <Link href="/community/community/advertise-platinum-sponsor-packages-limited-availability">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Packages
                </Button>
              </Link>
              <Button onClick={() => { setSubmitted(false); setFormValues({}); }} variant="outline">
                Submit Another Request
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isPlatinum = formData.slug?.includes("platinum");

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        <Link href="/community/community/advertise-platinum-sponsor-packages-limited-availability">
          <Button variant="ghost" size="sm" className="mb-4 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Packages
          </Button>
        </Link>

        <div className={`bg-white rounded-xl shadow-lg overflow-hidden ${isPlatinum ? "border border-[#9CA3AF]" : ""}`}>
          {isPlatinum && (
            <div className="bg-gradient-to-r from-[#E5E7EB] via-[#D1D5DB] to-[#9CA3AF] px-6 py-4">
              <h1 className="text-xl font-bold text-gray-800">{formData.title}</h1>
              {formData.description && (
                <p className="text-gray-600 text-sm mt-1">{formData.description}</p>
              )}
            </div>
          )}

          {!isPlatinum && (
            <div className="px-6 pt-6">
              <h1 className="text-xl font-bold text-gray-900">{formData.title}</h1>
              {formData.description && (
                <p className="text-gray-600 text-sm mt-1">{formData.description}</p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            {formData.formFields.map((field) => (
              <div key={field.id} className="space-y-1.5">
                <label
                  htmlFor={`field-${field.id}`}
                  className="block text-sm font-medium text-gray-700"
                >
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>

                {field.type === "textarea" ? (
                  <textarea
                    id={`field-${field.id}`}
                    value={formValues[field.id] || ""}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    placeholder={field.placeholder || ""}
                    rows={4}
                    required={field.required}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  />
                ) : field.type === "select" ? (
                  <select
                    id={`field-${field.id}`}
                    value={formValues[field.id] || ""}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    required={field.required}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  >
                    <option value="">Select an option...</option>
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    id={`field-${field.id}`}
                    value={formValues[field.id] || ""}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    placeholder={field.placeholder || ""}
                    required={field.required}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  />
                )}

                {field.helpText && (
                  <p className="text-xs text-gray-500">{field.helpText}</p>
                )}
              </div>
            ))}

            <div className="pt-2">
              <Button
                type="submit"
                disabled={submitting}
                className={`w-full py-3 text-white font-semibold rounded-lg ${
                  isPlatinum
                    ? "bg-gradient-to-r from-[#6B7280] to-[#4B5563] hover:from-[#4B5563] hover:to-[#374151]"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  "Submit Request"
                )}
              </Button>
            </div>

            <p className="text-xs text-gray-400 text-center">
              This form does not process payments. Our team will contact you after reviewing your request.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
