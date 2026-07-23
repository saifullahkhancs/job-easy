# Prompt: Fix "Upload New Template" page — form/card looks too small

Paste this into a new chat (on this same branch, `arena/019f9081-job-easy`) to have the agent apply the fix.

---

## Prompt

> On the **Upload New Template** page (`frontend/src/pages/UploadPage.jsx`), the main white `.card` containing the form looks too small and cramped compared to the rest of the page — there's a lot of empty gradient background around it on larger screens instead of the card filling the available space nicely.
>
> Please fix the sizing/layout so the card looks properly proportioned to the page:
>
> 1. **Investigate root cause** in `frontend/src/App.css`:
>    - `.app-main-content` currently uses `padding: 40px 60px` with no `max-width`, so on wide viewports the card can appear narrow relative to the empty space, or oddly sized depending on content height.
>    - `.card` has `padding: 32px` and no explicit `width`/`max-width`/`min-height` — check whether it needs a `max-width` (e.g. `1100px–1200px`, centered) so it doesn't look tiny on ultra-wide screens, or whether it needs to expand to better fill the main content area.
>    - `.split-layout` uses a fixed `grid-template-columns: 1fr 380px` — on very wide screens the left form column can stretch too much while the right 380px dark preview panel stays fixed, making the overall composition feel unbalanced/small in the middle. Consider capping the left column's effective width or capping `.card`'s max-width so field inputs (`input`, `select`, `textarea`) don't stretch excessively.
>    - Check `.form` (`display: grid; gap: 16px;`) and the input styles (`input, select, textarea { padding: 12px 16px; }`) — the fields might look small relative to a very wide card; consider adjusting padding/font-size slightly for larger screens, or constrain the card width instead of scaling type.
> 2. **Make it responsive**: ensure the fix works on typical desktop widths (1280–1920px) without breaking smaller windows (add a `max-width` with `margin: 0 auto` on `.card` or `.app-main-content`, and/or a media query if `split-layout` needs to collapse to a single column below ~900px, since it currently has no responsive breakpoint at all).
> 3. **Keep it consistent** with the rest of the app (`.card` class is reused on other pages like templates list/detail, sending, and admin pages), so verify the change doesn't shrink or awkwardly stretch those pages — check `frontend/src/pages/*.jsx` that use `className="card"`.
> 4. **Do not** change the hidden-form submission pattern (`form="upload-form"` attributes), the job-type auto-select behavior, or any backend logic — this is purely a CSS/layout sizing fix.
> 5. After the fix, briefly describe what caused the "too small" look and what was changed (e.g., added `max-width` + centering, adjusted grid columns, or added a responsive breakpoint).

---

## Reference: relevant files & current values

- `frontend/src/pages/UploadPage.jsx` — page markup (`.card` > `.page-header` + `.split-layout` > `.form` / `.dark-preview-card`)
- `frontend/src/App.css`:
  - `.app-main-content { flex: 1; padding: 40px 60px; overflow-y: auto; height: 100vh; display: grid; gap: 24px; align-content: start; }`
  - `.card { background: #fff; border: 1px solid #f2e8e8; border-radius: 24px; padding: 32px; box-shadow: 0 8px 32px rgba(226, 118, 94, 0.05); }`
  - `.split-layout { display: grid; grid-template-columns: 1fr 380px; gap: 32px; }`
  - `.form { display: grid; gap: 16px; margin-top: 20px; }`
  - `input, select, textarea { width: 100%; padding: 12px 16px; border-radius: 12px; ... }`
  - No `max-width` is set anywhere on `.card`, `.app-main-content`, or `.split-layout` — likely the main cause of the "too small in a big empty page" perception on wide screens.
- `frontend/src/components/Layout.jsx` — sidebar (260px fixed) + `<main className="app-main-content">` wrapping `<Outlet />`.
