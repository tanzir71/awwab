import type { KeyboardEvent } from "react";

export function focusListItem(event: KeyboardEvent<HTMLElement>, selector = "a[href], button") {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
    || (event.key !== "j" && event.key !== "k")) return;

  const { currentTarget } = event;
  const items = [...currentTarget.querySelectorAll<HTMLElement>(selector)].filter(item =>
    item.tabIndex >= 0 && !item.matches(":disabled, [aria-disabled='true']") && item.getClientRects().length > 0);
  const focused = items.indexOf(currentTarget.ownerDocument.activeElement as HTMLElement);
  if (focused < 0 || items.length < 2) return;

  event.preventDefault();
  const offset = event.key === "j" ? 1 : -1;
  items[(focused + offset + items.length) % items.length].focus();
}
