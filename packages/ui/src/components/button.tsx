import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95",
  {
    variants: {
      variant: {
        default:
          "bg-meerkat-brown text-white shadow-lg shadow-meerkat-brown/25 hover:bg-meerkat-dark hover:shadow-xl hover:shadow-meerkat-brown/30",
        secondary:
          "bg-meerkat-tan text-meerkat-dark shadow-md shadow-meerkat-tan/20 hover:bg-meerkat-tan/90",
        outline:
          "border-2 border-meerkat-brown text-meerkat-brown hover:bg-meerkat-brown hover:text-white",
        ghost: "hover:bg-meerkat-sand hover:text-meerkat-dark",
        link: "text-meerkat-brown underline-offset-4 hover:underline hover:text-meerkat-dark",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-9 rounded-lg px-4",
        lg: "h-12 rounded-xl px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
