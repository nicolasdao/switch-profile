Update the relevant documentation files based on the recent changes **only if those changes meaningfully impact how the project should be understood, used, or maintained**.
Minor updates—such as internal refactors, small bug fixes, or other changes that do not affect usage, behavior, APIs, workflows, or conceptual understanding—**do not need to be documented**. Use judgment based on the current project context and the existing documentation.

When a change *does* require documentation:

1. **Update or remove outdated content**

   * If a change modifies or overrides previous behavior, remove outdated descriptions and replace them with accurate, up-to-date explanations reflecting the new behavior.

2. **Maintain the Table of Contents**

   * For each modified document, update its Table of Contents (TOC) accordingly—up to heading level 4 (`h4`).

3. **Handle newly created documentation files**

   * If new documents are added under `docs/`, include their links in the root `README.md`.
   * Add a short summary explaining what each new document covers, so readers can decide whether they want to explore those topics in depth.

4. **Scope limitations**

   * **Do NOT update any files under the `specs/` folder.**
   * **Do NOT update any files under the `docs/manual/` folder.**
