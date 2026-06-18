import { Hammer } from "lucide-react";

/** Placeholder nhất quán cho các màn chưa dựng (IA mới đang triển khai dần). */
export function ComingSoon({
  title,
  desc,
}: {
  title: string;
  desc?: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-muted">
        <Hammer className="size-7 text-muted-foreground" />
      </div>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {desc ?? "Màn này đang được dựng theo IA mới. Sắp có."}
      </p>
    </div>
  );
}
