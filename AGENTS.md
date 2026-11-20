<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- fal.ai calls go through server functions in `src/lib/video.functions.ts` using the visitor's own key per request; the key is never stored server-side (users pay for their own generations).
- The access code is checked only on the server (`src/lib/access.server.ts`, env `ACCESS_CODE` with a fallback) and re-checked on every generation call, so the lock screen is not just cosmetic.
- MP4 downloads stream through `/api/download`, restricted to `*.fal.media`, because cross-origin links ignore the `download` attribute.
- The app is installable via `public/manifest.json` + icons only (no service worker, no offline cache); the "Instalar App" button uses `beforeinstallprompt` on Android and shows manual steps on iPhone, because a service worker would risk stale caches and offline was not requested.
