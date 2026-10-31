-- v3 step 4: an optional Persian translation for each example sentence.
-- Empty is stored as null (the app trims it); only sentence rows can have one.
alter table public.card_entries
  add column translation text,
  add constraint card_entries_translation_only_on_sentences
    check (translation is null or kind = 'sentence'),
  add constraint card_entries_translation_not_blank
    check (translation is null or length(btrim(translation)) > 0);
