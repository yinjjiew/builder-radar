"use client";

/**
 * A submit button that asks before it goes through.
 *
 * Deletion here is permanent by design — a removed post is recorded so the sync
 * cannot collect it again — so the one irreversible action in the app should not
 * be a single unguarded click. If scripting is unavailable the button still
 * submits, which is the right failure direction for a form the owner deliberately
 * pressed.
 */
export function ConfirmButton({
  message,
  children,
  className = "danger-button"
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
