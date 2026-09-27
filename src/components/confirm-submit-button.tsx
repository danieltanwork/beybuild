"use client";

// A plain <button type="submit"> inside a server-action <form> that asks for
// confirmation first — the action still runs as a normal form submit, this
// just intercepts the click to block it when the user cancels.
export function ConfirmSubmitButton({
  confirmMessage,
  className,
  children,
}: {
  confirmMessage: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
