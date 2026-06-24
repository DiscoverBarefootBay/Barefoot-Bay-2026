import fs from 'fs';

// Create simple events with proper formats
const events = [
  {
    title: "LAP SWIMMING",
    startDate: "2025-03-24T09:00:00Z",
    endDate: "2025-03-24T10:00:00Z",
    location: "625 Barefoot Blvd, Barefoot Bay, FL 32976, USA",
    category: "social"
  },
  {
    title: "CRIBBAGE",
    startDate: "2025-03-24T12:30:00Z",
    endDate: "2025-03-24T15:30:00Z",
    location: "625 Barefoot Blvd, Barefoot Bay, FL 32976, USA",
    category: "social"
  },
  {
    title: "RIVER OF LIFE CHURCH",
    startDate: "2025-03-24T10:30:00Z",
    endDate: "2025-03-24T12:30:00Z",
    location: "1225 Barefoot Blvd, Barefoot Bay, FL 32976, USA",
    category: "social"
  },
  {
    title: "POOL 1",
    startDate: "2025-03-24T09:00:00Z",
    endDate: "2025-03-24T22:00:00Z",
    location: "625 Barefoot Blvd, Barefoot Bay, FL 32976, USA",
    category: "social"
  },
  {
    title: "AQUATIC AEROBICS",
    startDate: "2025-03-25T10:00:00Z",
    endDate: "2025-03-25T11:00:00Z",
    location: "625 Barefoot Blvd, Barefoot Bay, FL 32976, USA",
    category: "social"
  },
  {
    title: "BFB YOGA",
    startDate: "2025-03-25T07:45:00Z",
    endDate: "2025-03-25T08:45:00Z",
    location: "625 Barefoot Blvd, Barefoot Bay, FL 32976, USA",
    category: "social"
  },
  {
    title: "BRIDGE CLUB",
    startDate: "2025-03-25T18:00:00Z",
    endDate: "2025-03-25T21:30:00Z",
    location: "625 Barefoot Blvd, Barefoot Bay, FL 32976, USA",
    category: "social"
  },
  {
    title: "PICKLEBALL CLUB",
    startDate: "2025-03-25T08:00:00Z",
    endDate: "2025-03-25T11:00:00Z",
    location: "625 Barefoot Blvd, Barefoot Bay, FL 32976, USA",
    category: "social"
  },
  {
    title: "SOFTBALL PRACTICE",
    startDate: "2025-03-25T08:00:00Z",
    endDate: "2025-03-25T12:00:00Z",
    location: "1127 Wren Circle, Barefoot Bay, FL 32976, USA",
    category: "social"
  },
  {
    title: "CANADA SHUFFLEBOARD",
    startDate: "2025-03-25T13:00:00Z",
    endDate: "2025-03-25T15:00:00Z",
    location: "625 Barefoot Blvd, Barefoot Bay, FL 32976, USA",
    category: "social"
  }
];

// Write to JSON file
fs.writeFileSync('./uploads/simple-events.json', JSON.stringify(events, null, 2));
console.log('Created simple-events.json with 10 properly formatted events');

// Create a CSV version
const headers = ["title", "startDate", "endDate", "location", "category"];
const csvRows = [headers.join(',')];

events.forEach(event => {
  const values = headers.map(header => {
    const value = event[header];
    // Quote strings that contain commas
    return typeof value === 'string' && value.includes(',') 
      ? `"${value}"` 
      : value;
  });
  csvRows.push(values.join(','));
});

fs.writeFileSync('./uploads/simple-events.csv', csvRows.join('\n'));
console.log('Created simple-events.csv with 10 properly formatted events');