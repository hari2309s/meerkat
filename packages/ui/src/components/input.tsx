import * as React from "react";
import { cn } from "../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border-2 px-4 py-2 text-sm transition-all",
          "focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        style={
          {
            background: "var(--color-input-bg)",
            borderColor: "var(--color-input-border)",
            color: "var(--color-text-primary)",
          } as React.CSSProperties
        }
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
