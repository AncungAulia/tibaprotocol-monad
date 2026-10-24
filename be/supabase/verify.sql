-- Read-only metadata audit. Run in Supabase SQL editor after migrations.
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;
select tablename, policyname, roles, cmd, qual, with_check from pg_policies where schemaname = 'public' order by tablename, policyname;
select table_name, column_name, data_type, is_nullable from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position;
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition from pg_constraint where connamespace = 'public'::regnamespace order by conrelid::regclass::text, conname;
select tablename, indexname, indexdef from pg_indexes where schemaname = 'public' order by tablename, indexname;
select pubname, schemaname, tablename from pg_publication_tables where schemaname = 'public';
select proname, prosecdef, proacl from pg_proc where pronamespace = 'public'::regnamespace and proname in ('accept_invite', 'save_profile');
select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role') order by table_name,grantee,privilege_type;
