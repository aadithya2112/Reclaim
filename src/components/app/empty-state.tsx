import { Inbox } from "lucide-react";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="grid min-h-40 place-items-center px-5 py-10 text-center"><div><Inbox className="mx-auto mb-3 size-5 text-muted-foreground" /><p className="font-medium">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div></div>;
}
