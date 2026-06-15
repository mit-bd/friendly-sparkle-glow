import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { DateRange as DayPickerRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  RANGE_PRESETS,
  formatRangeLabel,
  resolveRange,
  type DateRange,
  type RangePreset,
} from "@/lib/analytics";
import { cn } from "@/lib/utils";

interface DateRangeFilterProps {
  preset: RangePreset;
  range: DateRange;
  onChange: (preset: RangePreset, range: DateRange) => void;
}

export function DateRangeFilter({ preset, range, onChange }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DayPickerRange | undefined>({
    from: parseISO(range.from),
    to: parseISO(range.to),
  });

  const applyCustom = () => {
    if (!draft?.from) return;
    const to = draft.to ?? draft.from;
    onChange("custom", {
      from: format(draft.from, "yyyy-MM-dd"),
      to: format(to, "yyyy-MM-dd"),
    });
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="-mx-4 flex items-center gap-1 overflow-x-auto px-4 hide-scrollbar sm:mx-0 sm:flex-wrap sm:overflow-visible sm:rounded-lg sm:border sm:border-border sm:bg-card sm:px-1 sm:py-1">
        {RANGE_PRESETS.filter((p) => p.value !== "custom").map((p) => (
          <Button
            key={p.value}
            size="sm"
            variant={preset === p.value ? "default" : "ghost"}
            className={cn(
              "h-9 shrink-0 rounded-full border border-border px-4 text-xs sm:h-8 sm:rounded-md sm:border-0 sm:px-3",
              preset === p.value && "bg-brand-gradient text-primary-foreground",
            )}
            onClick={() => onChange(p.value, resolveRange(p.value))}
          >
            {p.label}
          </Button>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant={preset === "custom" ? "default" : "ghost"}
              className={cn(
                "h-9 shrink-0 gap-1.5 rounded-full border border-border px-4 text-xs sm:h-8 sm:rounded-md sm:border-0 sm:px-3",
                preset === "custom" && "bg-brand-gradient text-primary-foreground",
              )}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              Custom
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              numberOfMonths={1}
              defaultMonth={draft?.from}
              selected={draft}
              onSelect={setDraft}
              className="p-3"
            />
            <div className="flex items-center justify-between gap-2 border-t border-border p-3">
              <span className="text-xs text-muted-foreground">
                {draft?.from
                  ? `${format(draft.from, "dd MMM")}${draft.to ? ` – ${format(draft.to, "dd MMM")}` : ""}`
                  : "Pick a start & end date"}
              </span>
              <Button size="sm" className="h-7 px-3 text-xs" disabled={!draft?.from} onClick={applyCustom}>
                Apply
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <span className="px-0.5 text-xs text-muted-foreground">{formatRangeLabel(range)}</span>
    </div>
  );
}