import React from "react";
import { Drawer } from "vaul";
import { IconX } from "@tabler/icons-react";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  maxWidthClass = "max-w-2xl"
}) => {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[2000] bg-black/70 backdrop-blur-sm" />
        <Drawer.Content
          className={`fixed bottom-0 left-0 right-0 z-[2001] mx-auto flex max-h-[92vh] w-full ${maxWidthClass} flex-col rounded-t-[24px] border-t border-x border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)] outline-none`}
          style={{ boxShadow: "var(--shadow-sheet)" }}
        >
          <div className="mx-auto mt-3 mb-2 h-1.5 w-11 flex-shrink-0 rounded-full bg-[var(--border-strong)]" />
          {(title || description) && (
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 pb-3.5 pt-1">
              <div className="min-w-0">
                {title && (
                  <Drawer.Title className="font-display text-lg font-extrabold tracking-tight break-words">
                    {title}
                  </Drawer.Title>
                )}
                {description && (
                  <Drawer.Description className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {description}
                  </Drawer.Description>
                )}
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="fl-btn !p-1.5 !rounded-full flex-shrink-0"
                aria-label="Zamknij"
              >
                <IconX size={16} stroke={1.75} />
              </button>
            </div>
          )}
          <div className="overflow-y-auto px-5 py-4 pb-safe">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};
