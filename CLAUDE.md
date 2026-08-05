# Working notes for Claude

Standing instructions from the site owner. These apply to every session in this
repo, not just the one they were given in.

## How to explain things

Explain in plain words. The owner is not a developer and reads these answers to
decide what to do next, not to review the code.

- Say what the problem was, what changed, and what it means for the site.
- Skip the jargon, or say what it means the first time it appears.
- Keep code and file paths for when they are genuinely the answer.
- Say plainly when something is unverified or not live yet — that has bitten
  this project before (see the mobile-screenshot warning in `handoff.md`).

## Pull requests

Only open a pull request when asked. Once one is open, turn on GitHub's
auto-merge so it merges by itself as soon as the Netlify checks go green — do
not wait to be asked a second time.

Auto-merge waits for the checks; it does not skip them. A pull request whose
checks fail stays open, and fixing it is the next job.
