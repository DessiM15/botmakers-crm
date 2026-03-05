-- Editable Documents: in-browser text documents (specs, meeting notes, SOPs, etc.)
-- Separate from the file-upload `documents` table

CREATE TYPE editable_doc_category AS ENUM ('spec','meeting_notes','sop','internal','other');

CREATE TABLE editable_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  entity_type TEXT NOT NULL DEFAULT 'global',
  entity_id UUID,
  category editable_doc_category NOT NULL DEFAULT 'other',
  is_portal_visible BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES team_users(id),
  updated_by UUID REFERENCES team_users(id),
  last_edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_editable_docs_entity ON editable_documents(entity_type, entity_id);
CREATE INDEX idx_editable_docs_category ON editable_documents(category);
CREATE INDEX idx_editable_docs_created_at ON editable_documents(created_at);
