-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user_plans table
CREATE TABLE IF NOT EXISTS user_plans (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{"subjects":[],"tasks":[],"studySessions":[],"settings":{"darkMode":true},"seeds":{"tasks":false,"sessions":false}}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_user_plans_user_id ON user_plans(user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_plans_updated_at
BEFORE UPDATE ON user_plans
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE user_plans ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Allow users to see only their own data
CREATE POLICY "Users can view their own plans"
ON user_plans FOR SELECT
USING (auth.uid() = user_id);

-- Allow users to insert their own data
CREATE POLICY "Users can insert their own plans"
ON user_plans FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own data
CREATE POLICY "Users can update their own plans"
ON user_plans FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own data
CREATE POLICY "Users can delete their own plans"
ON user_plans FOR DELETE
USING (auth.uid() = user_id);
