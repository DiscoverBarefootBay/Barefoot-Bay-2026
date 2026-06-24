# Barefoot Bay Event Upload Documentation

This document provides comprehensive guidelines for uploading events to the Barefoot Bay community website, including both single event creation and bulk CSV uploads.

## 📋 Template Files

The following template files are provided in the `uploads` directory:

- `FixedEventTemplate.csv` - Basic template with the correct column names (use this one!)
- `FixedEventTemplateWithMedia.csv` - Template with media URLs and correct column names (use this one!)
- `EVENT_UPLOAD_FIXED_TEMPLATE.md` - Troubleshooting guide for the CSV uploader

Note: The following templates have incorrect column headers and may not work properly:
- `BulkEventsUploaderTemplate.csv` - Old template (not recommended)
- `BulkEventsWithMediaTemplate.csv` - Old template (not recommended)

## 📊 CSV Format Requirements

Your CSV file must include the following columns with exact names:

```
title,description,startDate,endDate,location,category,businessName,contactInfo,hoursOfOperation,isRecurring,recurrenceFrequency,recurrenceEndDate,mediaUrls
```

Required fields include:
- **title** - Event title
- **startDate** - Format: YYYY-MM-DDT09:00:00.000Z (ISO format)
- **endDate** - Format: YYYY-MM-DDT12:00:00.000Z (ISO format)
- **location** - Where the event will be held
- **category** - Must be one of: `social`, `entertainment`, or `government`
- **isRecurring** - Use lowercase `true` or `false`

For recurring events, these are also required:
- **recurrenceFrequency** - One of: `daily`, `weekly`, `biweekly`, `monthly`, or `yearly`
- **recurrenceEndDate** - Format: YYYY-MM-DDT00:00:00.000Z (ISO format)

### ⚠️ Important Notes for CSV Files

- The CSV file **must** have a header row with exactly the column names listed above
- Dates must use the ISO format with timezone: `YYYY-MM-DDT09:00:00.000Z`
- If your text contains commas, enclose the entire field in double quotes
- Complex fields like `contactInfo` and `hoursOfOperation` must be valid JSON strings
- Media URLs must be separated with a pipe character (`|`) when multiple URLs are provided

## 🧰 Handling Media URLs

Media URLs in the CSV can be:

1. **Relative paths** to files already uploaded to the server, e.g., `/uploads/events/image.jpg`
2. **Absolute URLs** to external images, e.g., `https://example.com/image.jpg`

When providing multiple media URLs, separate them with a pipe character (`|`), for example:
```
/uploads/events/image1.jpg|/uploads/events/image2.jpg
```

## 🔄 Converting Between Formats

If you need to convert between CSV and JSON formats, use the provided conversion utility:

```
node uploads/convert-events-to-json.js
```

You can modify the input and output file paths in the script as needed.

## 🛠️ Troubleshooting

If your upload fails, check for these common issues:

1. **Incorrect column names** - Headers must match exactly: `title`, `startDate`, `endDate`, etc.
2. **Date format errors** - Use ISO format with timezone: `YYYY-MM-DDT09:00:00.000Z`
3. **Missing required fields** - All required fields must be included
4. **Invalid category** - Must be one of: `social`, `entertainment`, or `government`
5. **JSON format errors** - Complex fields like `contactInfo` must be valid JSON
6. **Media URL format** - If multiple URLs are provided, ensure they are pipe-separated
7. **CSV formatting** - Text with commas must be enclosed in double quotes

## 🤝 Support and Feedback

For additional help or to report any issues with the event upload functionality, please contact the Barefoot Bay website administrator.