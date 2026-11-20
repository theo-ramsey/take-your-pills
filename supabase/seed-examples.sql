-- Optional: load the example medicines so you can try things out. Bonnie can edit or delete them.
insert into medications (name, strength, amount, times, as_needed, max_per_day, purpose, instructions, appearance, sort) values
  ('Levothyroxine', '50 mcg', '1 tablet', '{07:00}', false, null, 'Thyroid', 'Empty stomach, with water. Wait 30 minutes before breakfast.', 'Small orange round pill', 0),
  ('Lisinopril', '10 mg', '1 tablet', '{08:00}', false, null, 'Blood pressure', '', 'Pink round pill', 1),
  ('Eliquis', '5 mg', '1 tablet', '{08:00,20:00}', false, null, 'Blood thinner (prevents clots and stroke)', '', 'Small peach oval pill', 2),
  ('Metformin', '500 mg', '1 tablet', '{08:00,18:00}', false, null, 'Blood sugar', 'Take with food.', 'Large white oval pill', 3),
  ('Atorvastatin', '20 mg', '1 tablet', '{21:00}', false, null, 'Cholesterol', '', 'White oval pill', 4),
  ('Tylenol', '500 mg', '1 or 2 tablets', '{}', true, 3, 'Pain or fever, when needed', 'No more than 6 tablets a day.', 'White capsule-shaped pill', 5);
