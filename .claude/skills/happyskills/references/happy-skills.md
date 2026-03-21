# Section 8 — Happy Skills

A **happy skill** is a managed skill in the HappySkills ecosystem (appears in `data.skills` from `list --json`). An **unhappy skill** is an external skill not yet converted (appears in `data.external` from `list --json`).

### Status Check ("are my skills happy?", "why are my skills not happy?")

1. Run `npx happyskills list --json`
2. Count managed skills (`data.skills` keys) and external skills (`data.external` array).
3. **All happy** (no external skills) → cheerful confirmation: "All N of your skills are happy!"
4. **Some unhappy** → one warm, playful line acknowledging the unhappy skills, then list them clearly.
   - Standard: "N skills are happy, but M are feeling left out — they haven't joined the HappySkills family yet."
   - "Why" variant: "They're not happy because they're not HappySkills yet! Here are the ones waiting to join the party:" then list them.

### Conversion Workflow ("make my skills happy")

1. Run `npx happyskills list --json` to identify external (unhappy) skills.
2. **None found** → "All your skills are already happy! Nothing to convert."
3. **External skills found** → present the list and use AskUserQuestion to ask which to convert. Offer "All of them" as the first option, plus individual skill names.
4. Authenticate if needed (Section 2 — `convert` requires auth).
5. For each selected skill, run `npx happyskills convert <name> -y --json`, then run Post-Convert Enrichment (Section 7).
6. After all conversions, ask if the user wants to publish the newly happy skills to the registry.
7. Present a cheerful summary: "N skills are now happy! Welcome to the family, skill-a, skill-b, and skill-c."

### Tone Guidelines

- One playful line per response, max. Dry wit over slapstick. Warm over sarcastic.
- Never block useful information behind humor — always show the skill list and status clearly.
