-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Create profiles table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  display_name text,
  avatar_url text,
  role text default 'member',
  is_online boolean default false,
  created_at timestamptz default now(),
  last_seen timestamptz default now(),
  current_streak integer default 0,
  longest_streak integer default 0,
  last_task_completed_date text,
  unlocked_titles text[] default '{}'
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Profiles policies
create policy "Public profiles are viewable by everyone"
  on profiles for select
  using ( true );

create policy "Users can insert their own profile"
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile"
  on profiles for update
  using ( auth.uid() = id );

-- Trigger for new user creation
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists to avoid errors on re-run
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Create tasks table
create table if not exists public.tasks (
  id bigint primary key,
  user_id uuid references auth.users(id) on delete cascade,
  text text,
  completed boolean default false,
  created_at timestamptz default now(),
  deadline timestamptz,
  priority text,
  raw_data jsonb
);

-- Enable RLS on tasks
alter table public.tasks enable row level security;

-- Tasks policies
create policy "Users can manage their own tasks"
  on tasks for all
  using (auth.uid() = user_id);

create policy "Admins can view all tasks"
  on tasks for select
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
