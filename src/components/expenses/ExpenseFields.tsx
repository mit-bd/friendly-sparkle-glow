import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EXPENSE_STATUS,
  SUBMITTABLE_STATUSES,
  type ExpenseCategory,
  type ExpenseStatus,
  type ExpenseSubcategory,
} from "@/lib/expenses";
import { DictationButton } from "@/components/voice/DictationButton";

export interface ExpenseFormValues {
  expense_date: string;
  category_id: string;
  subcategory_id: string;
  amount: string;
  description: string;
  notes: string;
  status: ExpenseStatus;
}

interface ExpenseFieldsProps {
  value: ExpenseFormValues;
  onChange: (patch: Partial<ExpenseFormValues>) => void;
  categories: ExpenseCategory[];
  subcategories: ExpenseSubcategory[];
  /** When editing, allow showing the current (possibly approval) status as read context. */
  extraStatuses?: ExpenseStatus[];
  disabled?: boolean;
  /** Optional content rendered directly beneath the primary description field (e.g. AI suggestions). */
  afterDescription?: React.ReactNode;
  /** Optional control rendered on the description label row (e.g. a voice mic button). */
  descriptionVoice?: React.ReactNode;
  /** Enable live voice dictation into the description field. */
  descriptionDictation?: {
    onFinal?: (text: string) => void;
    busy?: boolean;
  };
}

export function ExpenseFields({
  value,
  onChange,
  categories,
  subcategories,
  extraStatuses = [],
  disabled,
  afterDescription,
  descriptionVoice,
  descriptionDictation,
}: ExpenseFieldsProps) {
  const availableSubs = subcategories.filter((s) => s.category_id === value.category_id);
  const statusOptions = [...new Set([...SUBMITTABLE_STATUSES, ...extraStatuses])];
  const descRef = useRef<HTMLTextAreaElement>(null);
  const selRef = useRef<{ start: number; end: number } | null>(null);

  function trackCaret(e: React.SyntheticEvent<HTMLTextAreaElement>) {
    const t = e.currentTarget;
    selRef.current = { start: t.selectionStart, end: t.selectionEnd };
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="exp-description">Expense description</Label>
          {descriptionDictation ? (
            <DictationButton
              targetRef={descRef}
              selectionRef={selRef}
              value={value.description}
              onChange={(v) => onChange({ description: v })}
              onFinal={descriptionDictation.onFinal}
              busy={descriptionDictation.busy}
            />
          ) : (
            descriptionVoice
          )}
        </div>
        <Textarea
          id="exp-description"
          ref={descRef}
          rows={2}
          maxLength={1000}
          disabled={disabled}
          value={value.description}
          onChange={(e) => onChange({ description: e.target.value })}
          onSelect={trackCaret}
          onKeyUp={trackCaret}
          onClick={trackCaret}
          onBlur={trackCaret}
          placeholder="e.g. Facebook Ads June Campaign, Carton Purchase, Office Internet Bill"
        />
        {afterDescription}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="exp-date">Expense date</Label>
          <Input
            id="exp-date"
            type="date"
            required
            disabled={disabled}
            value={value.expense_date}
            onChange={(e) => onChange({ expense_date: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exp-amount">Amount</Label>
          <Input
            id="exp-amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            required
            disabled={disabled}
            value={value.amount}
            onChange={(e) => onChange({ amount: e.target.value })}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="exp-category">Category</Label>
          <Select
            value={value.category_id || undefined}
            disabled={disabled}
            onValueChange={(v) => onChange({ category_id: v, subcategory_id: "" })}
          >
            <SelectTrigger id="exp-category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="exp-subcategory">Subcategory</Label>
          <Select
            value={value.subcategory_id || undefined}
            disabled={disabled || !value.category_id}
            onValueChange={(v) => onChange({ subcategory_id: v })}
          >
            <SelectTrigger id="exp-subcategory">
              <SelectValue
                placeholder={value.category_id ? "Select subcategory" : "Select a category first"}
              />
            </SelectTrigger>
            <SelectContent>
              {availableSubs.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  No subcategories
                </div>
              ) : (
                availableSubs.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="exp-status">Status</Label>
        <Select
          value={value.status}
          disabled={disabled}
          onValueChange={(v) => onChange({ status: v as ExpenseStatus })}
        >
          <SelectTrigger id="exp-status" className="sm:w-[260px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {EXPENSE_STATUS[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Submissions stay out of financial totals until an approver marks them Approved.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="exp-notes">Notes</Label>
        <Textarea
          id="exp-notes"
          rows={2}
          maxLength={1000}
          disabled={disabled}
          value={value.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Internal notes (optional)"
        />
      </div>
    </div>
  );
}