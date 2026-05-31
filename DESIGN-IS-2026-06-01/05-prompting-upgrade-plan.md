# Make-Plan: Upgrade LLM Prompting to Adaptive, User-Friendly System

````
/make-plan Upgrade the Lexara RAG chat prompting system from a static single-system-prompt to an adaptive, user-aware conversation model.

## Problem statement
Current: One static SYSTEM_PROMPT in `backend/app/services/llm_service.py` (lines 21–49). It works well for direct answers but does not adapt to:
- User's apparent expertise level (beginner vs. expert)
- Length of prior conversation (first message vs. deep dialogue)
- Type of question (lookup vs. analysis vs. comparison)
- User's expressed preferences or feedback mid-session

Result: Every user gets identical framing regardless of context. Short factual questions get the same preamble as complex multi-part analyses. Users who ask simple questions in informal language get formal responses. Users who want detail get "conversational and tight" brevity.

## Goal
A prompting system that detects and adapts to the user's communication style, question complexity, and session depth — without adding visible friction or asking the user to configure anything.

## Files in scope
- `backend/app/services/llm_service.py` — SYSTEM_PROMPT, build_messages(), generate_answer(), generate_answer_stream()
- `backend/app/routes/chat.py` — where question, history, and context_chunks come together
- `backend/app/schemas/chat.py` — ChatQueryRequest (may need new optional fields)

## Adaptive dimensions to implement (prioritized)

### 1. Question-type detection → response format
Classify the question before prompting (no LLM call — rule-based heuristics):
- **Lookup** ("What does page 7 say?", "Who is the author?"): answer in 1–3 sentences, no headers
- **Summary** ("Summarize chapter 3"): answer in bullets, 5–8 items max
- **Comparison** ("How does X differ from Y?"): answer with a two-column or before/after structure
- **Analysis** ("Why does the author argue..."): fuller paragraph answer, cite section

Detection: check question length, presence of "summarize/compare/why/how does", sentence count.
Implementation: `_classify_question(question: str) -> Literal["lookup", "summary", "comparison", "analysis"]` in llm_service.py
Use: prepend a one-line format instruction to the system prompt based on type.

### 2. Session depth → verbosity tier
Track how many turns have happened in the current session (available from `history` list in ChatQueryRequest):
- 0–1 turns: warmer opener, more explanatory (new user may need orientation)
- 2–6 turns: standard direct mode (current default)
- 7+ turns: terse expert mode, skip scaffolding, just the answer

Implementation: `_verbosity_tier(history: list) -> Literal["orient", "standard", "terse"]` based on `len(history)`.
Use: append tier-specific instruction to system prompt (3 string constants, not a new LLM call).

### 3. Language formality mirroring
Current: "Match the user's language exactly" (handles language, not register).
Add: detect if user's question is informal (short, contractions, no punctuation) or formal (full sentences, punctuation).
- Informal question → casual response tone ("Here's what page 7 says...")
- Formal question → precise response tone ("Page 7 contains the following...")

Implementation: simple heuristic (`_is_informal(question: str) -> bool`) — question < 10 words, or ends without period, or contains "??" or casual markers.

### 4. Low-confidence fallback phrasing
Current: the `top_score < 0.15` branch appends a generic note about "partially relevant passages."
Upgrade: make the fallback phrasing match the question type:
- Lookup + low confidence: "I couldn't find a direct match for that on page X. Here's the closest section I have: [quote]"
- Summary + low confidence: "The excerpts I have cover [A, B, C] — here's what they say about [topic]:"
- Analysis + low confidence: "I can partially answer this from what I have..."

Implementation: `_low_confidence_note(question_type, context_chunks) -> str` replacing the current hardcoded string in build_messages().

### 5. DO NOT implement (explicit non-goals for this pass)
- User preference forms or explicit configuration UI — zero friction, all implicit
- Storing user style preferences in the database — derive from current session only
- Fine-tuning or retrieval-augmented generation of the prompt itself
- Multi-turn summarization or memory injection — separate concern
- Changing the retrieval (vector search) logic

## Implementation plan deliverables

1. `_classify_question(question: str) -> str` — rule-based classifier, no LLM call, with unit tests
2. `_verbosity_tier(history: list) -> str` — maps history length to verbosity level
3. `_is_informal(question: str) -> bool` — heuristic for register detection
4. Updated `build_messages()` — composes adaptive system prompt from base + question-type instruction + verbosity tier + formality note
5. Updated `_low_confidence_note()` — type-aware fallback string
6. Unit tests for each classifier (question types, edge cases, multilingual inputs)
7. Regression test: existing direct-answer behavior preserved for standard lookup queries

## Verification
- A lookup question ("What does page 7 say?") produces a 1–3 sentence response
- A summary question ("Summarize chapter 3") produces a bullet list
- A 10-turn session produces terser output than a 1-turn session for the same question
- An Uzbek informal question gets a casual Uzbek response
- All existing tests pass
````
