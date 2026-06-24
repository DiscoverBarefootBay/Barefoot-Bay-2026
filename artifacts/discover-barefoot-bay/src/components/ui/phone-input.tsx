import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function PhoneInput({ value, onChange, placeholder = "(555) 555-5555", disabled = false }: PhoneInputProps) {
  // Keep an internal state for handling the raw input
  const [inputValue, setInputValue] = useState(value);

  // Update internal state when prop changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const formatPhoneNumber = (input: string) => {
    // Remove all non-digits
    const digits = input.replace(/\D/g, '');
    
    // Format according to length
    if (digits.length <= 3) {
      return digits.length ? `(${digits}` : '';
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setInputValue(formatted);
    onChange(formatted);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const formatted = formatPhoneNumber(pastedText);
    setInputValue(formatted);
    onChange(formatted);
  };

  return (
    <Input
      type="tel"
      value={inputValue}
      onChange={handleChange}
      onPaste={handlePaste}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={14} // (XXX) XXX-XXXX
      className="font-mono" // Use monospace font for better number alignment
    />
  );
}
