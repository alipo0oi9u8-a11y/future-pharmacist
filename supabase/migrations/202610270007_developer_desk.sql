begin;

create or replace function public.review_notes_bulk(
  p_note_ids uuid[],
  p_status public.note_status,
  p_rejection_reason text default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pending_count integer;
  note_id uuid;
begin
  if not public.is_developer() then
    raise exception 'Developer permission required' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('approved', 'rejected') then
    raise exception 'Review status must be approved or rejected' using errcode = '22023';
  end if;
  if p_note_ids is null or cardinality(p_note_ids) not between 1 and 50
     or array_position(p_note_ids, null) is not null then
    raise exception 'Select between 1 and 50 unique pending notes' using errcode = '22023';
  end if;
  if (select count(distinct id) from unnest(p_note_ids) as selected(id)) <> cardinality(p_note_ids) then
    raise exception 'Duplicate note identifiers are not allowed' using errcode = '22023';
  end if;
  if p_status = 'rejected'
     and (nullif(trim(p_rejection_reason), '') is null or length(trim(p_rejection_reason)) > 1000) then
    raise exception 'A rejection reason of up to 1,000 characters is required' using errcode = '22023';
  end if;
  if p_status = 'approved' and p_rejection_reason is not null then
    raise exception 'Approval decisions do not accept a rejection reason' using errcode = '22023';
  end if;

  select count(*)::integer into pending_count
  from public.notes n
  where n.id = any(p_note_ids) and n.status = 'pending';
  if pending_count <> cardinality(p_note_ids) then
    raise exception 'One or more selected notes are no longer pending' using errcode = 'P0002';
  end if;

  foreach note_id in array p_note_ids loop
    perform public.review_note(note_id, p_status, p_rejection_reason);
  end loop;
  return pending_count;
end;
$$;
revoke all on function public.review_notes_bulk(uuid[], public.note_status, text) from public, anon;
grant execute on function public.review_notes_bulk(uuid[], public.note_status, text) to authenticated;

create or replace function public.developer_analytics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_developer() then
    raise exception 'Developer permission required' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'activeUsers',
    (select count(*)::integer from public.profiles p where p.status = 'active'),
    'popularSubjects',
    coalesce((
      select jsonb_agg(
        jsonb_build_object('subject', popular.name, 'helpfulReactions', popular.reaction_count)
        order by popular.reaction_count desc, popular.name asc
      )
      from (
        select s.name, count(r.user_id)::integer as reaction_count
        from public.subjects s
        join public.notes n on n.subject_id = s.id and n.status = 'approved'
        join public.note_reactions r on r.note_id = n.id and r.helpful
        where s.is_active
        group by s.id, s.name
        order by reaction_count desc, s.name asc
        limit 5
      ) popular
    ), '[]'::jsonb),
    'pendingQueueAgeMinutes',
    coalesce((
      select greatest(0, floor(extract(epoch from (now() - min(n.created_at))) / 60)::integer)
      from public.notes n
      where n.status = 'pending'
    ), 0)
  );
end;
$$;
revoke all on function public.developer_analytics() from public, anon;
grant execute on function public.developer_analytics() to authenticated;

commit;
