import * as React from "react";
import { cn } from "../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border-2 border-meerkat-tan/40 bg-white px-4 py-2 text-sm text-meerkat-dark placeholder:text-meerkat-brown/50 transition-all",
          "focus:border-meerkat-orange focus:outline-none focus:ring-2 focus:ring-meerkat-orange/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
