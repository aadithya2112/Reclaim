import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function ErrorState({ title, description, onRetry }: { title: string; description: string; onRetry?: () => void }) {
  return <Alert variant="destructive" className="p-4"><AlertCircle /><AlertTitle>{title}</AlertTitle><AlertDescription>{description}</AlertDescription>{onRetry ? <Button variant="outline" size="sm" className="mt-3 w-fit" onClick={onRetry}>Retry</Button> : null}</Alert>;
}
