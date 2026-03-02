import * as React from "react";
import { cn } from "@/lib/utils";

type DialogContextValue = {
  open: boolean;
  setOpen: (next: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext(): DialogContextValue {
  const ctx = React.useContext(DialogContext);
  if (!ctx) return { open: true, setOpen: () => {} };
  return ctx;
}

export type DialogProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
};

export function Dialog({ open, defaultOpen = false, onOpenChange, children }: DialogProps) {
  const isControlled = typeof open === "boolean";
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState<boolean>(defaultOpen);

  const actualOpen = isControlled ? (open as boolean) : uncontrolledOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  return <DialogContext.Provider value={{ open: actualOpen, setOpen }}>{children}</DialogContext.Provider>;
}

export function DialogTrigger({
  className,
  children,
  asChild,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const { setOpen } = useDialogContext();

  const handleClick = (e: React.MouseEvent) => {
    props.onClick?.(e as any);
    setOpen(true);
  };

  if (asChild && React.isValidElement(children)) {
    const childAny = children as React.ReactElement<any>;
    return React.cloneElement(childAny, {
      className: cn(childAny.props?.className, className),
      onClick: (e: React.MouseEvent) => {
        childAny.props?.onClick?.(e);
        handleClick(e);
      },
    });
  }

  return (
    <button
      type="button"
      className={cn(className)}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
}

export function DialogContent({ className, children, ...props }: React.ComponentProps<"div">) {
  const { open, setOpen } = useDialogContext();
  if (!open) return null;

  return (
    <div
      data-slot="dialog-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        data-slot="dialog-content"
        className={cn("w-full rounded-xl border bg-background p-6 shadow-lg outline-none", className)}
        role="dialog"
        aria-modal="true"
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-1.5", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="dialog-title"
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

export function DialogDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="dialog-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}
