# Working rules for Claude

## Always end with choices

- End every reply with the next steps as clickable options (the AskUserQuestion tool), not a plain-text list.
- Offer 2-3 options. Give each a short label and a description of at most 10 words (what happens, main risk).
- Put the recommended option first and mark it "(Recommended)".
- Ask about the next step, not for permission for the last one. Don't repeat a question the user already answered.
- Do this even when nothing is blocked. If a real decision blocks the work, ask it first, then still end with the options.

## Status widget

- When the user's whole message is `جججج`, show the status widget instead of answering in text: run `node scripts/status-widget.mjs --out <scratchpad>/status.html --model <your model> --ctx-used <tokens used so far> --ctx-total <session token budget>`, turn it into an image with `node scripts/status-shot.mjs <scratchpad>/status.html <scratchpad>/status.png`, and send the PNG with SendUserFile (display: render). If the screenshot script fails, say so in one line and send only the artifact link.
- Also publish the interactive page (same command plus `--fragment`) to the artifact `https://claude.ai/artifact/FJ9myxgLKr9eHgrd3kQTAz` with the Artifact tool (`url`, after reading it) and give that link under the image.
- Quota: pass `--quota-week-left`, `--quota-5h-left` (percent left) and `--quota-renew` only when the user gave you numbers from `/usage`; otherwise the card says it is unavailable.
- Pass only numbers you actually know; leave a flag out and the widget shows "—". Say in one line that the device is the cloud container, not the user's computer.

## Version number

- The app version is `version` in `package.json`. It is shown in the app (Menu, bottom of Settings) next to the short commit id of the build.
- Raise it in every change that goes into a pull request: patch (x.y.Z) for fixes, tooling and refactors; minor (x.Y.0) for new or changed features and screens; major for a redesign or a change that breaks saved data.
- Use `npm version <patch|minor|major> --no-git-tag-version` so `package-lock.json` stays in sync. One bump per pull request is enough; follow-up commits on the same open PR don't need another.
- Run `npm run version:check` before pushing. It fails when the version is not higher than on `origin/main`.
- The deploy workflow runs `npm test` and the same check, against the commit that was on `main` before the push. A push to `main` that fails either is not deployed (the site keeps its current version). A manual run of the workflow skips the version check.
- Say the new version in the pull request description.
