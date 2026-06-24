import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

type PhoneNumberInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function PhoneNumberInput({ value, onChange, placeholder }: PhoneNumberInputProps) {
  const [formattedValue, setFormattedValue] = useState("");

  // Format phone number as user types
  const formatPhoneNumber = (input: string) => {
    // Remove all non-digits
    const numbers = input.replace(/\D/g, "");
    
    // Format the number
    let formatted = numbers;
    if (numbers.length > 0) {
      formatted = numbers.match(/(\d{0,3})(\d{0,3})(\d{0,4})/)?.slice(1).join("-") || "";
    }
    
    return formatted;
  };

  // Update formatted value when raw value changes
  useEffect(() => {
    setFormattedValue(formatPhoneNumber(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const numbers = input.replace(/\D/g, "");
    
    // Only allow up to 10 digits
    if (numbers.length <= 10) {
      setFormattedValue(formatPhoneNumber(input));
      onChange(numbers);
    }
  };

  return (
    <Input
      type="tel"
      value={formattedValue}
      onChange={handleChange}
      placeholder={placeholder || "Enter phone number"}
      className="w-full"
      aria-label="Phone number input"
      maxLength={12} // Account for two hyphens
    />
  );
}
