import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";

interface BigButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  description?: string; // sub-line
  icon?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:brightness-110 active:brightness-95 shadow-[var(--shadow-card)]",
  secondary:
    "bg-card text-foreground border-2 border-border hover:bg-accent hover:border-primary",
  ghost: "bg-transparent text-foreground hover:bg-muted",
};

export const BigButton = forwardRef<HTMLButtonElement, BigButtonProps>(
  ({ className, variant = "primary", description, icon, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "w-full rounded-2xl px-8 py-7 text-2xl font-bold leading-tight",
          "min-h-[88px] flex flex-col items-center justify-center gap-1",
          "transition-all duration-150 ease-out",
          "focus-visible:outline-4 focus-visible:outline-ring focus-visible:outline-offset-4",
          variants[variant],
          className,
        )}
        {...props}
      >
        <span className="flex items-center justify-center gap-3">
          {icon}
          <span>{children}</span>
        </span>
        {description && (
          <span className="text-base font-medium opacity-85">{description}</span>
        )}
      </button>
    );
  },
);
BigButton.displayName = "BigButton";
