"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * ThemeProvider — bọc next-themes, dùng strategy "class" để thêm `.dark` vào
 * <html>, khớp với selector `.dark` trong globals.css. Mặc định light, cho phép
 * theo hệ thống + chuyển thủ công.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
