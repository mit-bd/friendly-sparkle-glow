import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type PasswordInputProps = Omit<React.ComponentProps<"input">, "type">;

/**
 * Password field with an accessible show/hide toggle.
 *
 * - Defaults to hidden (masked).
 * - Toggling never changes the value and does not submit/refresh.
 * - Restores the caret position after switching type so editing is seamless.
 * - Toggle is keyboard reachable with a clear aria-label and aria-pressed.
 */
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, disabled, ...props }, forwardedRef) => {
    const [visible, setVisible] = React.useState(false);
    const innerRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(forwardedRef, () => innerRef.current as HTMLInputElement);

    const toggle = () => {
      const el = innerRef.current;
      const start = el?.selectionStart ?? null;
      const end = el?.selectionEnd ?? null;
      setVisible((v) => !v);
      // Restore focus + caret after the type change is applied.
      requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        if (start !== null && end !== null) {
          try {
            el.setSelectionRange(start, end);
          } catch {
            /* setSelectionRange is unsupported on some input states; ignore */
          }
        }
      });
    };

    return (
      <div className="relative">
        <Input
          ref={innerRef}
          type={visible ? "text" : "password"}
          disabled={disabled}
          className={cn("pr-10", className)}
          {...props}
        />
        <button
          type="button"
          onClick={toggle}
          disabled={disabled}
          tabIndex={0}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          title={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };