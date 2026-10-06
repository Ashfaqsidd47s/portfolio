/** Shared look for the menu bar's menus, the desktop context menu and the Windows menu. */
export const menu = {
  content:
    "z-[1000] min-w-52 overflow-hidden rounded-lg border border-border bg-elevated/95 p-1 text-foreground shadow-lg backdrop-blur-md " +
    "origin-(--radix-popper-transform-origin) data-[state=open]:animate-[os-pop_120ms_ease-out]",
  item:
    "group relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none " +
    "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
  radio: "pl-7",
  indicator: "absolute left-2 inline-flex size-3.5 items-center justify-center",
  label: "px-2 pb-1 pt-1.5 text-[0.6875rem] font-medium text-muted-foreground",
  separator: "my-1 h-px bg-border",
  shortcut: "ml-auto pl-4 text-[0.6875rem] tracking-wide text-muted-foreground group-data-[highlighted]:text-accent-foreground/80",
  trigger:
    "flex h-7 select-none items-center gap-1.5 rounded-md px-2 text-xs font-medium outline-none " +
    "hover:bg-muted data-[state=open]:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
}
