-- Create contact_messages table
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'replied', 'archived')),
  notes TEXT
);

-- Create index on created_at for faster sorting
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at DESC);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status);

-- Create index on email for searching
CREATE INDEX IF NOT EXISTS idx_contact_messages_email ON contact_messages(email);

-- Enable Row Level Security
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Create policy to allow inserts from anyone (for the contact form)
CREATE POLICY "Allow public inserts" ON contact_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Create policy to allow authenticated users to read all messages (for admin panel)
CREATE POLICY "Allow authenticated users to read" ON contact_messages
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policy to allow authenticated users to update messages (for admin panel)
CREATE POLICY "Allow authenticated users to update" ON contact_messages
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add comment to table
COMMENT ON TABLE contact_messages IS 'Stores contact form submissions from the website';

-- Add comments to columns
COMMENT ON COLUMN contact_messages.id IS 'Unique identifier for the message';
COMMENT ON COLUMN contact_messages.name IS 'Name of the person submitting the contact form';
COMMENT ON COLUMN contact_messages.email IS 'Email address of the person submitting the contact form';
COMMENT ON COLUMN contact_messages.message IS 'The message content';
COMMENT ON COLUMN contact_messages.created_at IS 'Timestamp when the message was submitted';
COMMENT ON COLUMN contact_messages.updated_at IS 'Timestamp when the message was last updated';
COMMENT ON COLUMN contact_messages.status IS 'Status of the message (unread, read, replied, archived)';
COMMENT ON COLUMN contact_messages.notes IS 'Internal notes about the message (for admin use)';

