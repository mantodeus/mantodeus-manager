import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex max-w-full items-center justify-center gap-2 whitespace-normal sm:whitespace-nowrap rounded-md text-sm font-medium disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 sm:shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "border border-primary-foreground/30 bg-primary text-primary-foreground hover:bg-primary/90 hover:border-primary-foreground/50 transition-[background-color,border-color,transform] duration-[var(--dur-quick)] ease-[var(--ease-out)]",
        destructive:
          "border border-white/30 bg-destructive text-white hover:bg-destructive/90 hover:border-white/50 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 transition-[background-color,border-color] duration-[var(--dur-quick)] ease-[var(--ease-out)]",
        "destructive-outline":
          "border border-destructive text-destructive bg-transparent hover:bg-destructive/10 dark:hover:bg-destructive/20 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 [&_svg]:transition-colors transition-[background-color,border-color] duration-[var(--dur-quick)] ease-[var(--ease-out)]",
        outline:
          "border border-foreground/30 bg-transparent shadow-xs text-foreground hover:bg-muted hover:text-foreground hover:border-foreground/50 dark:bg-transparent dark:border-foreground/30 dark:hover:bg-muted dark:hover:text-foreground dark:hover:border-foreground/50 [&_svg]:transition-colors transition-[background-color,border-color,color] duration-[var(--dur-quick)] ease-[var(--ease-out)]",
        secondary:
          "border border-secondary-foreground/30 bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:border-secondary-foreground/50 transition-[background-color,border-color] duration-[var(--dur-quick)] ease-[var(--ease-out)]",
        ghost:
          "border border-transparent hover:border-foreground/20 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 dark:hover:text-accent-foreground dark:hover:border-foreground/20 [&_svg]:transition-colors transition-[background-color,border-color] duration-[var(--dur-quick)] ease-[var(--ease-out)]",
        link: "border border-transparent text-primary underline-offset-4 hover:underline",
        // Pill variant - Superwhisper-inspired rounded CTA
        pill: "border border-primary-foreground/30 bg-primary text-primary-foreground hover:bg-primary/90 hover:border-primary-foreground/50 rounded-full hover:scale-[1.02] active:scale-[0.98] transition-[background-color,border-color,transform] duration-[var(--dur-quick)] ease-[var(--ease-out)] active:duration-[var(--dur-instant)] active:ease-[var(--ease-spring)]",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
