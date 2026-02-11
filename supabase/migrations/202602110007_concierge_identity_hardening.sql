-- Hardening for concierge employer creation/claim transfer flows.
-- 1) Prevent duplicate real contact emails at DB level.
-- 2) Ensure FK delete behavior does not block cleanup/ownership transfer.

-- Normalize real contact emails in-place (trim + lowercase).
update public.employer_profiles
set contact_email = lower(btrim(contact_email))
where contact_email is not null
  and btrim(contact_email) <> ''
  and contact_email !~* '@example\.invalid$';

-- Fail fast if duplicate real contact emails already exist.
do $$
declare
  duplicate_email text;
begin
  select lower(btrim(contact_email))
  into duplicate_email
  from public.employer_profiles
  where contact_email is not null
    and btrim(contact_email) <> ''
    and contact_email !~* '@example\.invalid$'
  group by lower(btrim(contact_email))
  having count(*) > 1
  limit 1;

  if duplicate_email is not null then
    raise exception
      'Duplicate employer_profiles.contact_email found for real email: %. Resolve duplicates before applying this migration.',
      duplicate_email;
  end if;
end
$$;

-- Enforce uniqueness for real (non-placeholder) contact emails.
create unique index if not exists employer_profiles_contact_email_real_unique_idx
  on public.employer_profiles (lower(btrim(contact_email)))
  where contact_email is not null
    and btrim(contact_email) <> ''
    and contact_email !~* '@example\.invalid$';

-- Optional lookup acceleration for dedupe-by-company logic.
create index if not exists employer_profiles_company_name_lookup_idx
  on public.employer_profiles (lower(btrim(company_name)));

-- admin_actions should not block internship deletion for historical audit rows.
alter table public.admin_actions
  drop constraint if exists admin_actions_internship_id_fkey;

alter table public.admin_actions
  add constraint admin_actions_internship_id_fkey
  foreign key (internship_id)
  references public.internships(id)
  on delete set null;

-- Claim tokens tied to internship should not block internship deletion.
alter table public.employer_claim_tokens
  drop constraint if exists employer_claim_tokens_internship_id_fkey;

alter table public.employer_claim_tokens
  add constraint employer_claim_tokens_internship_id_fkey
  foreign key (internship_id)
  references public.internships(id)
  on delete set null;

-- Public profile should follow employer user lifecycle.
alter table public.employer_public_profiles
  drop constraint if exists employer_public_profiles_employer_id_fkey;

alter table public.employer_public_profiles
  add constraint employer_public_profiles_employer_id_fkey
  foreign key (employer_id)
  references public.users(id)
  on delete cascade;
