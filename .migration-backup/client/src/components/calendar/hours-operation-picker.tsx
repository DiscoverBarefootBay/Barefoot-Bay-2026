import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

type DaySchedule = {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
};

type Schedule = Record<string, DaySchedule>;

type HoursOperationPickerProps = {
  value: string;
  onChange: (value: string) => void;
};

const defaultHours = {
  Monday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
  Tuesday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
  Wednesday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
  Thursday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
  Friday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
  Saturday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
  Sunday: { isOpen: true, openTime: "09:00", closeTime: "17:00" }
};

export function HoursOperationPicker({ value, onChange }: HoursOperationPickerProps) {
  // Set initial visibility based on whether we have valid hours data
  const [isVisible, setIsVisible] = useState(() => {
    try {
      if (!value || value === '' || value === 'null' || value === 'undefined') return false;
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0;
    } catch {
      return false;
    }
  });

  // Initialize schedule state
  const [schedule, setSchedule] = useState<Schedule>(() => {
    try {
      if (!isVisible) return defaultHours;
      return JSON.parse(value) || defaultHours;
    } catch {
      return defaultHours;
    }
  });

  const updateSchedule = (day: string, field: keyof DaySchedule, newValue: string | boolean) => {
    const newSchedule = {
      ...schedule,
      [day]: {
        ...schedule[day],
        [field]: newValue,
      },
    };
    setSchedule(newSchedule);
    if (isVisible) {
      onChange(JSON.stringify(newSchedule));
    }
  };

  // Debug output to help us understand what values are being processed
  console.log("HoursOperationPicker: ", { value, isVisible, schedule });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base">Hours of Operation</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {isVisible ? 'Hide' : 'Show'}
          </span>
          <Switch
            checked={isVisible}
            onCheckedChange={(checked) => {
              setIsVisible(checked);
              console.log("Switch toggled: ", { checked });
              
              if (!checked) {
                // When turning off hours, set to empty object - but stringify it
                // This ensures we have valid JSON in the database
                onChange(JSON.stringify({}));
              } else {
                // When turning on hours, set default values
                onChange(JSON.stringify(defaultHours));
                // Update the local state to match
                setSchedule(defaultHours);
              }
            }}
          />
        </div>
      </div>

      {isVisible && (
        <div className="space-y-4 pt-4">
          {DAYS.map((day) => (
            <div key={day} className="flex items-center gap-4">
              <div className="w-32">
                <Label>{day}</Label>
              </div>
              <Select
                value={schedule[day].isOpen ? "open" : "closed"}
                onValueChange={(value) => updateSchedule(day, "isOpen", value === "open")}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              {schedule[day].isOpen && (
                <>
                  <Input
                    type="time"
                    value={schedule[day].openTime}
                    onChange={(e) => updateSchedule(day, "openTime", e.target.value)}
                    className="w-[120px]"
                  />
                  <span>to</span>
                  <Input
                    type="time"
                    value={schedule[day].closeTime}
                    onChange={(e) => updateSchedule(day, "closeTime", e.target.value)}
                    className="w-[120px]"
                  />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}