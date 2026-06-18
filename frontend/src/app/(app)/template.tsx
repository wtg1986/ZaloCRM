/**
 * template.tsx — re-mount mỗi lần điều hướng → fade-in nhẹ khi chuyển trang.
 * h-full để không phá layout flex của <main> (sidebar + nội dung).
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in h-full">{children}</div>;
}
