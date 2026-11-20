// Example prescriptions used in demo mode, and to seed a new Supabase database.
export const EXAMPLE_SETTINGS = {
  gloria_name: 'Gloria',
  caregiver_name: 'Bonnie',
  caregiver_phone: '',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
};

export const EXAMPLE_MEDICATIONS = [
  {
    name: 'Levothyroxine', strength: '50 mcg', amount: '1 tablet', times: ['07:00'],
    purpose: 'Thyroid', instructions: 'Empty stomach, with water. Wait 30 minutes before breakfast.',
    appearance: 'Small orange round pill',
  },
  {
    name: 'Lisinopril', strength: '10 mg', amount: '1 tablet', times: ['08:00'],
    purpose: 'Blood pressure', instructions: '', appearance: 'Pink round pill',
  },
  {
    name: 'Eliquis', strength: '5 mg', amount: '1 tablet', times: ['08:00', '20:00'],
    purpose: 'Blood thinner (prevents clots and stroke)', instructions: '', appearance: 'Small peach oval pill',
  },
  {
    name: 'Metformin', strength: '500 mg', amount: '1 tablet', times: ['08:00', '18:00'],
    purpose: 'Blood sugar', instructions: 'Take with food.', appearance: 'Large white oval pill',
  },
  {
    name: 'Atorvastatin', strength: '20 mg', amount: '1 tablet', times: ['21:00'],
    purpose: 'Cholesterol', instructions: '', appearance: 'White oval pill',
  },
  {
    name: 'Tylenol', strength: '500 mg', amount: '1 or 2 tablets', times: [], as_needed: true, max_per_day: 3,
    purpose: 'Pain or fever, when needed', instructions: 'No more than 6 tablets a day.',
    appearance: 'White capsule-shaped pill',
  },
];
