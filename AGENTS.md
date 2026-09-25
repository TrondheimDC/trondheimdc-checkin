# TDC Innsjekk

Staff UI is Norwegian bokmål. Keep established product words: printer, Smooth Print, P-touch Editor, QR, MAC.

## Forms → Zod → database

Admin forms use **React Hook Form** with **`zodResolver`** and the same Zod schemas that gate API bodies / Drizzle writes (`src/lib/db/schema.ts`).

- Define the shape once in Zod (aligned with the Drizzle table).
- Wire the form with `useForm({ resolver: zodResolver(schema), … })`.
- Parse again on the server with that schema before insert/update.
- Do not hand-roll parallel validation that can drift from the DB.

## No pop-in

The first paint of a screen is the real screen.

- Load the data on the server when the page needs it. Do not render “Henter…” and then swap in the list. Prefer TanStack Query with server hydration / `setQueryData` from the RSC payload.
- Mutations use `useMutation` and update the query cache (`invalidateQueries` / optimistic `setQueryData`). Do not hand-roll `busy` + `fetch` + `router.refresh` for resource CRUD.
- Empty, error, and ready states each have a stable layout. An empty state is an illustration, a short heading, and one action. It is not a leftover sentence.
- If something must arrive later, reserve its box. Do not grow the page when it appears.

## Copy

Write labels the way the rest of the app speaks. “Deltakere”, not “Import attendees”. “Ny printer”, not “New printer” and not “skriver”.
Keep blurb text short and useful — not a dump of paper sizes and protocol details.
