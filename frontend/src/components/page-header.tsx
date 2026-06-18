import * as React from "react";

// Header chuẩn cho các trang nội dung (title + mô tả + action bên phải).
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b px-6 py-4">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children ? (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}
