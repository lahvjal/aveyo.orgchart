ALTER TABLE departments
  ADD COLUMN parent_id UUID REFERENCES departments(id) ON DELETE SET NULL;

CREATE INDEX idx_departments_parent_id ON departments(parent_id);
