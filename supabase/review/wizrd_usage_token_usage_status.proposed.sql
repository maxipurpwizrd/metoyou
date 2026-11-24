-- Review-only proposal. Do not execute until the schema change is approved.
begin;

alter table public.wizrd_usage
  add column token_usage_status text;

update public.wizrd_usage
set token_usage_status = 'legacy_unverified'
where token_usage_status is null;

alter table public.wizrd_usage
  alter column token_usage_status set default 'legacy_unverified',
  alter column token_usage_status set not null,
  add constraint wizrd_usage_token_usage_status_check
    check (
      token_usage_status in (
        'pending',
        'reported',
        'partial',
        'unavailable',
        'failed',
        'legacy_unverified'
      )
    );

commit;
