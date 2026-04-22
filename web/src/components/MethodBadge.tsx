import { methodClass } from "@/lib/utils";

export default function MethodBadge({ method }: { method: string }) {
  return <span className={`chip ${methodClass(method)} font-mono`}>{method.toUpperCase()}</span>;
}
