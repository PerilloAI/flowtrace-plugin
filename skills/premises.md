# Premises

A **premise** is anything your work takes as true and would be wrong without: which path a case takes today (the
endpoint, function, table, queue or setting that serves it), what an outside thing does (an API, a library, a
provider), or what a name or a comment suggests. A premise feels like knowledge to whoever holds it, so list yours on
purpose, then prove each from its source:

- **About this code**: trace it from the way in, with your example's values, down to the call. Then search for whatever
  else does the same job (another endpoint, client, adapter, flag, code path), and say which one this case reaches and
  what chooses between them. A name that exists or a first search hit shows the code exists; the trace shows this case
  runs it.
- **About an outside thing**: its own docs for the version and mode in use, a record the repository keeps of it, or a
  real call that changes nothing. Say what the fact holds for, since an endpoint may serve one kind of request and a
  setting one plan.
- **What neither can show** (how production is configured, what someone intends, data you can't see): the premise
  stays unproved, and whoever relies on your work is told so.

Two premises that read as facts until traced:

- "Every reminder goes out through `send_email()`": it is named for the job and calls the provider, yet only a one-off
  script calls it; reminders go through a queue handled in another file.
- "Every export is written by `write_rows()`": it is the only writer with tests, yet a setting sends the default export
  down another path, which never calls it.
