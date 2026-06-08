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
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-1">
        {RANGE_PRESETS.filter((p) => p.value !== "custom").map((p) => (
          <Button
            key={p.value}
            size="sm"
            variant={preset === p.value ? "default" : "ghost"}
            className={cn("h-8 px-3 text-xs", preset === p.value && "bg-brand-gradient text-primary-foreground")}
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
                "h-8 gap-1.5 px-3 text-xs",
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
      <span className="text-xs text-muted-foreground">{formatRangeLabel(range)}</span>
    </div>
  );
}