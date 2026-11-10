/**
 * Versionierte SQL-Migrationen. Sie laufen beim ersten Datenbankzugriff
 * automatisch und sind in einer Tabelle `_migrations` protokolliert.
 * Neue Schemaänderungen werden als weiterer Eintrag angehängt – bestehende
 * Einträge niemals nachträglich ändern.
 */
export const migrations: { id: number; sql: string }[] = [
  {
    id: 1,
    sql: `
      create table users (
        id uuid primary key default gen_random_uuid(),
        email text not null unique,
        name text not null,
        password_hash text not null,
        created_at timestamptz not null default now()
      );
      create table sessions (
        id uuid primary key default gen_random_uuid(),
        token_hash text not null unique,
        user_id uuid not null references users(id) on delete cascade,
        expires_at timestamptz not null,
        created_at timestamptz not null default now()
      );
      create index sessions_user_idx on sessions(user_id);

      create table projects (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        name text not null,
        description text not null default '',
        status text not null default 'active',
        color integer not null default 1,
        due_date date,
        created_at timestamptz not null default now()
      );
      create index projects_user_idx on projects(user_id);

      create table tasks (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        project_id uuid references projects(id) on delete cascade,
        title text not null,
        notes text not null default '',
        priority text not null default 'medium',
        status text not null default 'todo',
        due_date date,
        completed_on date,
        created_at timestamptz not null default now()
      );
      create index tasks_user_idx on tasks(user_id);
      create index tasks_project_idx on tasks(project_id);

      create table events (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        title text not null,
        description text not null default '',
        location text not null default '',
        date date not null,
        start_time text,
        end_time text,
        color integer not null default 1,
        created_at timestamptz not null default now()
      );
      create index events_user_date_idx on events(user_id, date);

      create table goals (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        title text not null,
        description text not null default '',
        category text not null default 'personal',
        current double precision not null default 0,
        target double precision not null default 100,
        unit text not null default '%',
        deadline date,
        completed_on date,
        created_at timestamptz not null default now()
      );
      create index goals_user_idx on goals(user_id);

      create table habits (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        name text not null,
        color integer not null default 1,
        target_per_week integer not null default 7,
        created_at timestamptz not null default now()
      );
      create index habits_user_idx on habits(user_id);

      create table habit_logs (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        habit_id uuid not null references habits(id) on delete cascade,
        date date not null
      );
      create unique index habit_logs_unique on habit_logs(habit_id, date);
      create index habit_logs_user_date_idx on habit_logs(user_id, date);

      create table notes (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        title text not null default '',
        content text not null default '',
        pinned boolean not null default false,
        updated_at timestamptz not null default now(),
        created_at timestamptz not null default now()
      );
      create index notes_user_idx on notes(user_id);

      create table transactions (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        type text not null,
        amount_cents integer not null,
        category text not null,
        description text not null default '',
        date date not null,
        created_at timestamptz not null default now()
      );
      create index transactions_user_date_idx on transactions(user_id, date);
    `,
  },
];
