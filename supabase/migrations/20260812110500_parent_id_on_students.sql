-- Migration: Add parent_id foreign key column to students table
-- Date: 2026-08-12

alter table public.students
  add column if not exists parent_id uuid references public.parents(id) on delete set null;

create index if not exists students_parent_id_idx on public.students (school_id, parent_id);
