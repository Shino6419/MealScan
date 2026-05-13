-- Supabase schema for MealScan.
-- Version: calorie-goal only.
-- Run this file in Supabase SQL Editor after creating a Supabase project.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  daily_calorie_goal integer not null default 2000 check (daily_calorie_goal > 0),
  timezone text not null default 'Asia/Ho_Chi_Minh',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  meal_date date not null,
  eaten_at timestamptz not null default now(),
  meal_type text not null default 'snack' check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_name text not null,
  calories integer not null default 0 check (calories >= 0),
  image_url text,
  source text not null default 'ai_scan' check (source in ('ai_scan', 'manual')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meal_ai_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  meal_id uuid references public.meals(id) on delete set null,
  image_url text,
  detected_food_name text,
  estimated_calories integer check (estimated_calories >= 0 or estimated_calories is null),
  confidence numeric(4,3) check (confidence >= 0 and confidence <= 1 or confidence is null),
  raw_response jsonb,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed', 'confirmed', 'rejected')),
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  summary_date date not null,
  total_calories integer not null default 0 check (total_calories >= 0),
  meal_count integer not null default 0 check (meal_count >= 0),
  calorie_goal integer not null default 2000 check (calorie_goal > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, summary_date)
);

create index if not exists meals_user_date_idx on public.meals(user_id, meal_date);
create index if not exists meals_user_eaten_at_idx on public.meals(user_id, eaten_at desc);
create index if not exists meal_ai_results_user_idx on public.meal_ai_results(user_id);
create index if not exists meal_ai_results_meal_idx on public.meal_ai_results(meal_id);
create index if not exists daily_summaries_user_date_idx on public.daily_summaries(user_id, summary_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_meals_updated_at on public.meals;
create trigger set_meals_updated_at
before update on public.meals
for each row execute function public.set_updated_at();

drop trigger if exists set_daily_summaries_updated_at on public.daily_summaries;
create trigger set_daily_summaries_updated_at
before update on public.daily_summaries
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.recalculate_daily_summary(target_user_id uuid, target_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  goal integer;
begin
  select daily_calorie_goal
  into goal
  from public.profiles
  where id = target_user_id;

  insert into public.daily_summaries (
    user_id,
    summary_date,
    total_calories,
    meal_count,
    calorie_goal
  )
  select
    target_user_id,
    target_date,
    coalesce(sum(calories), 0)::integer,
    count(*)::integer,
    coalesce(goal, 2000)
  from public.meals
  where user_id = target_user_id and meal_date = target_date
  on conflict (user_id, summary_date)
  do update set
    total_calories = excluded.total_calories,
    meal_count = excluded.meal_count,
    calorie_goal = excluded.calorie_goal,
    updated_at = now();
end;
$$;

create or replace function public.refresh_daily_summary_from_meal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.recalculate_daily_summary(new.user_id, new.meal_date);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    perform public.recalculate_daily_summary(new.user_id, new.meal_date);

    if old.meal_date <> new.meal_date then
      perform public.recalculate_daily_summary(old.user_id, old.meal_date);
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.recalculate_daily_summary(old.user_id, old.meal_date);
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists refresh_daily_summary_after_meal_change on public.meals;
create trigger refresh_daily_summary_after_meal_change
after insert or update or delete on public.meals
for each row execute function public.refresh_daily_summary_from_meal();

alter table public.profiles enable row level security;
alter table public.meals enable row level security;
alter table public.meal_ai_results enable row level security;
alter table public.daily_summaries enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert
with check (auth.uid() = id);

drop policy if exists "Users can view own meals" on public.meals;
create policy "Users can view own meals"
on public.meals for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own meals" on public.meals;
create policy "Users can insert own meals"
on public.meals for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own meals" on public.meals;
create policy "Users can update own meals"
on public.meals for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own meals" on public.meals;
create policy "Users can delete own meals"
on public.meals for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own ai results" on public.meal_ai_results;
create policy "Users can view own ai results"
on public.meal_ai_results for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own ai results" on public.meal_ai_results;
create policy "Users can insert own ai results"
on public.meal_ai_results for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own ai results" on public.meal_ai_results;
create policy "Users can update own ai results"
on public.meal_ai_results for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own ai results" on public.meal_ai_results;
create policy "Users can delete own ai results"
on public.meal_ai_results for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own daily summaries" on public.daily_summaries;
create policy "Users can view own daily summaries"
on public.daily_summaries for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own daily summaries" on public.daily_summaries;
create policy "Users can insert own daily summaries"
on public.daily_summaries for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own daily summaries" on public.daily_summaries;
create policy "Users can update own daily summaries"
on public.daily_summaries for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Storage buckets should be created in the Supabase dashboard:
-- 1. meal-images
-- 2. avatars
--
-- Recommended private storage path:
-- meal-images/{user_id}/2026/05/file.jpg
-- avatars/{user_id}/avatar.jpg
