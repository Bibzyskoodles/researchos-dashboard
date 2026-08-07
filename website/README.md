# website/ — stale copy of the marketing page

**Do not upload `index.html` to the live site.** It is not the current page.

## What happened

The live FieldScore marketing page (`intelligencyai.com.ng/Fieldscore`) has a
**video hero background** and a **video of Ada**. Neither appears anywhere in
this file, in any commit that has ever touched it — no `<video>` tag, no
`.mp4`/`.webm` asset, not once in the whole history. The Ada section here still
renders the still `ada-avatar.jpg`.

Those videos were added directly on the live site and never brought back into
the repo. So this copy diverged the moment that happened, and every copy edit
committed here since has been an edit to a file that is a downgrade of what the
public sees. Publishing it would silently delete the videos.

## Why it is easy to get wrong

Nothing about this directory looks stale from inside the repo. It is not part
of the build either — `react-scripts build` packages only `src/` and `public/`,
nothing copies `website/` into the output, and `vercel.json` rewrites every
path to the React app's own `index.html`. So it neither deploys automatically
nor announces that it is out of date. It just sits here looking authoritative.

## How to change the marketing page today

Apply copy edits **by hand on the live page**. The videos are the reason: they
are the part that cannot be reproduced from here.

## How to stop this being a trap

Bring the live page back into the repo: save the current live HTML, commit it
over this file along with the video assets (or their URLs, if they are hosted
elsewhere), and confirm a diff of this file against live is empty. After that
this directory is a real source of truth and can be wired into the build, at
which point marketing copy ships with every merge like everything else.

Until then, treat the live page as the source of truth and this as a draft.
