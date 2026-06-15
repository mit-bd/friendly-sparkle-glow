---
name: AI Voice & Smart Expense Assistant
description: Voice-to-entry + ledger Q&A assistant — Web Speech mic, AI smart parsing/routing (Bangla/English/Banglish), floating dashboard assistant, ai-assistant edge function
type: feature
---
# AI Voice & Smart Expense Assistant

Adds voice-driven, AI-parsed transaction entry with smart routing across Expenses / Receivables / Payables, plus a ledger Q&A assistant.

## Backend
- Edge function supabase/functions/ai-assistant/index.ts (Lovable AI gateway, model google/gemini-3-flash-preview, uses LOVABLE_API_KEY). Auth via caller JWT (anon client + Authorization header so RLS is respected). No schema changes.
  - action parse: NL (Bangla/English/Banglish, Bangla+Latin digits) -> JSON { intent, person_name, party_type, amount, date, due_date, description, category_name, notes, summary, confidence }. Intents: expense | receivable (you lent) | payable (you borrowed) | collection (repaid to you) | payment (you repaid) | unknown. Resolves relative dates.
  - action ask: fetches APPROVED receivables/payables + approved expenses (RLS), builds aggregate context, answers in user's language with the taka sign.

## Client
- src/lib/voice.ts — useSpeechRecognition hook + isSpeechSupported, Web Speech API (langs bn-BD, en-US). V1 = browser STT; architecture allows server STT upgrade later.
- src/lib/assistant.ts — parseTransaction(text,{categories,parties}), askAssistant(question), ParsedTransaction type, INTENT_META.
- src/components/voice/VoiceButton.tsx — reusable mic button w/ language toggle; renders nothing if unsupported.
- src/components/app/AiAssistant.tsx — floating brand-gradient sparkles button (bottom-right), mounted in AppShell. Tabs: Smart Entry (voice/text -> parse -> editable AI Summary card -> Confirm & Create with smart routing) and Ask (single-session Q&A + suggested questions + voice). Expense via direct insert (category matched, subcategory null OK); receivable/payable via finance createReceivable/createPayable (pending_approval).
- Add Expense (expenses.add.tsx): mic in description label via ExpenseFields descriptionVoice prop; SmartParsePanel shows AI Summary under description — "Apply to expense form" for expenses, "Create Receivable/Payable" routing for loan intents.

## Notes
- Records created are pending_approval (respects approved-only totals rule).
- collection/payment intents create base receivable/payable then route to detail to settle (no auto-match of existing record yet).
