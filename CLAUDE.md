# Working rules for Claude

## Always end with choices

- End every reply with the next steps as clickable options (the AskUserQuestion tool), not a plain-text list.
- Offer 2-4 options. Give each a short label and a one-line description of what happens and its main risk.
- Put the recommended option first and mark it "(Recommended)".
- Ask about the next step, not for permission for the last one. Don't repeat a question the user already answered.
- Do this even when nothing is blocked. If a real decision blocks the work, ask it first, then still end with the options.
