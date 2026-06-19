-- ============================================
-- SCHOOL ERP - COMPLETE SUPABASE SCHEMA
-- Supabase SQL Editor mein yeh poora paste karo
-- ============================================

-- Students
CREATE TABLE IF NOT EXISTS students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  class TEXT NOT NULL,
  section TEXT DEFAULT 'A',
  dob DATE,
  guardian_name TEXT,
  phone TEXT,
  address TEXT,
  admission_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Teachers
CREATE TABLE IF NOT EXISTS teachers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  subject TEXT,
  classes TEXT,
  qualification TEXT,
  joining_date DATE DEFAULT CURRENT_DATE,
  salary INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Attendance
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT CHECK (status IN ('P','A','L')) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(student_id, date)
);

-- Fees
CREATE TABLE IF NOT EXISTS fees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  month TEXT NOT NULL,
  year INTEGER DEFAULT EXTRACT(YEAR FROM NOW()),
  paid_on DATE,
  status TEXT CHECK (status IN ('Paid','Pending','Overdue')) DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Marks / Report Cards
CREATE TABLE IF NOT EXISTS marks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  exam TEXT NOT NULL,
  subject TEXT NOT NULL,
  marks INTEGER DEFAULT 0,
  max_marks INTEGER DEFAULT 100,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(student_id, exam, subject)
);

-- Timetable
CREATE TABLE IF NOT EXISTS timetable (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class TEXT NOT NULL,
  day TEXT NOT NULL,
  period TEXT NOT NULL,
  subject TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(class, day, period)
);

-- Notices / Homework
CREATE TABLE IF NOT EXISTS notices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'Notice',
  class_target TEXT DEFAULT 'All',
  subject TEXT DEFAULT 'General',
  due_date DATE,
  priority TEXT DEFAULT 'Normal',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE students    ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fees        ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices     ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users sab kuch kar sakein
DO $$ BEGIN
  CREATE POLICY "auth_all_students"   ON students   FOR ALL TO authenticated USING (true) WITH CHECK (true);
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "auth_all_teachers"   ON teachers   FOR ALL TO authenticated USING (true) WITH CHECK (true);
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "auth_all_attendance" ON attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "auth_all_fees"       ON fees       FOR ALL TO authenticated USING (true) WITH CHECK (true);
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "auth_all_marks"      ON marks      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "auth_all_timetable"  ON timetable  FOR ALL TO authenticated USING (true) WITH CHECK (true);
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "auth_all_notices"    ON notices    FOR ALL TO authenticated USING (true) WITH CHECK (true);
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Parent Portal: anon users apne student ka data dekh sakein (phone se)
CREATE POLICY "anon_read_students"   ON students   FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_fees"       ON fees       FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_attendance" ON attendance FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_notices"    ON notices    FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_marks"      ON marks      FOR SELECT TO anon USING (true);

-- Sample data
INSERT INTO students (name, class, section, dob, guardian_name, phone, address) VALUES
('Rahul Sharma',  '5', 'A', '2015-03-12', 'Ramesh Sharma',  '9876543210', 'Loni, Ghaziabad'),
('Priya Singh',   '3', 'B', '2017-07-22', 'Suresh Singh',   '9765432109', 'Dadri, GB Nagar'),
('Amit Kumar',    '7', 'A', '2013-11-05', 'Vijay Kumar',    '9654321098', 'Noida Sector 12'),
('Sneha Yadav',   '2', 'C', '2018-01-30', 'Rajesh Yadav',   '9543210987', 'Indirapuram')
ON CONFLICT DO NOTHING;
