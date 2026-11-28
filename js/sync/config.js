/* Optional cloud sync configuration.
   Leave both values empty and RecallHSC stays local-only (nothing ever leaves the browser).
   To enable sync, create a Supabase project (see docs/CLOUD_SYNC.md) and paste its PUBLIC values here:
     url      Project URL, e.g. https://abcdefghijklmno.supabase.co
     anonKey  The publishable ("anon") key. It is designed to be public; Row Level Security protects the data.
   Never put the service-role key or a database password in this file or anywhere in the repo. */
self.RECALL_CLOUD={
  url:'https://fcnqhlcumstgoyfovuzt.supabase.co',
  anonKey:'sb_publishable_YLDb1WPZSDEAeE5LlKs86g_yF-Du1py',
  // true once supabase/migrations/20261128000000_recallhsc_feedback.sql has been applied (shows Report marking)
  feedback:true,
};
