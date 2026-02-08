---
description: Load project context by reading README and recursively following relevant documentation links based on a question or topic
---

You are being asked to load context about this project to help answer a specific question or explore a particular topic.

**IMPORTANT:**
**1. You are ONLY gathering information. DO NOT modify any files, make any changes, or suggest changes yet. This is purely a research and context-loading phase.**
**2. DO NOT READ ANY FILES LOCATED UNDER THE `specs/` FOLDER OR UNDER THE `docs/manual/` FOLDER**
**3. If a file called `gotchas.md` or `GOTCHAS.md` exists under the `docs/` folder, you MUST read it regardless of the topic or question. This file contains critical project-specific pitfalls and edge cases that are always relevant.**

## Your Task

The user has provided this question or topic:
```
{{ARGS}}
```

## Process: Recursive Documentation Discovery

Follow this iterative process to build up context:

### Step 1: Read the README.md

Start by reading the README.md file (if it exists in the current directory). This is your entry point to understand:
1. What this project does
2. Its main features and capabilities
3. Links to other documentation files

### Step 2: Extract and Evaluate Links

From the README.md, identify all links to other documentation files (markdown files, text files, or other documentation). For each link, evaluate whether it's relevant to the user's question/topic.

**Relevance criteria:**
- Does the link description or surrounding context relate to the question/topic?
- Would this documentation help answer the user's question or provide necessary background?

**Track what you've read:**
- Keep a mental list of all files you've already read to avoid infinite loops
- If a link points to a file you've already read, skip it

### Step 3: Read Relevant Linked Documentation

Read each relevant documentation file you identified. As you read each file:
1. Extract key information related to the user's question/topic
2. Look for MORE links to other documentation files within this document
3. Evaluate those new links for relevance (same criteria as Step 2)
4. Add relevant unread files to your reading list

### Step 4: Repeat Recursively

Continue the process:
- Read next relevant documentation file from your list
- Extract information and find new links
- Evaluate new links for relevance
- Read those relevant docs
- Keep going until you've exhausted all relevant documentation paths

**Important safeguards:**
- Never read the same file twice (check your tracking list)
- Stop when no new relevant documentation links are found
- Don't follow links that are clearly not relevant to the question/topic
- Limit to documentation files in the project (don't follow external URLs)

### Step 5: Summarize Your Findings

After completing the recursive documentation discovery, provide:
1. **List of files read**: Show which documentation files you read and in what order
2. **Why each was relevant**: Brief explanation of why you chose to read each file
3. **Key findings**: Summarize the information relevant to the user's question/topic
4. **Context loaded**: Confirm that you now have sufficient context to help with their question

### Step 6: Wait for User's Next Instruction

**DO NOT make any changes or suggestions yet.** Simply state that you've loaded the context and are ready to help with the user's question or task.

---

## Example Process Flow

```
User question: "How does X feature work?"

1. Read README.md
   → Find link to docs/architecture.md (relevant ✓)
   → Find link to docs/api.md (relevant ✓)
   → Find link to docs/changelog.md (not relevant ✗)

2. Read docs/architecture.md
   → Find link to docs/core-concepts.md (relevant ✓)
   → Find link to docs/README.md (already read ✗)

3. Read docs/api.md
   → Find link to docs/examples.md (relevant ✓)
   → Find link to docs/architecture.md (already read ✗)

4. Read docs/core-concepts.md
   → No new relevant links found

5. Read docs/examples.md
   → No new relevant links found

6. Done - summarize findings
```

Remember: This is a context-loading phase only. No modifications, no suggestions, just information gathering.
