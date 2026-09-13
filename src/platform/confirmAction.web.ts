import type { ConfirmationOptions } from './confirmAction';

export function confirmAction({
  title,
  message,
  onConfirm,
}: ConfirmationOptions): void {
  if (window.confirm(`${title}\n\n${message}`)) onConfirm();
}
