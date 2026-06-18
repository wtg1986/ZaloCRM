import { Bell, Check, MoreHorizontal, Paperclip, Search, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";

/** Khối tiêu đề mỗi mục trong style guide. */
function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {desc ? <p className="text-sm text-muted-foreground">{desc}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Swatch({
  name,
  className,
  ring,
}: {
  name: string;
  className: string;
  ring?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div
        className={`h-16 rounded-lg ${className} ${
          ring ? "ring-1 ring-inset ring-border" : ""
        }`}
      />
      <p className="text-xs font-medium text-muted-foreground">{name}</p>
    </div>
  );
}

export default function StyleGuidePage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12 space-y-14">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Badge variant="secondary" className="rounded-full">
            Design System
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight">
            ZaloCRM — Calm Professional · Indigo
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Nguồn chân lý cho màu, typography, spacing, component. Mọi màn hình
            kế thừa từ đây để đảm bảo đồng bộ — nhất quán, light &amp; dark.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Separator />

      {/* Colors — brand & surfaces */}
      <Section
        title="Màu nền tảng"
        desc="Token ngữ nghĩa (semantic) — component dùng tên vai trò, không dùng mã màu."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6">
          <Swatch name="background" className="bg-background" ring />
          <Swatch name="card" className="bg-card" ring />
          <Swatch name="muted" className="bg-muted" />
          <Swatch name="accent" className="bg-accent" />
          <Swatch name="border" className="bg-border" />
          <Swatch name="foreground" className="bg-foreground" />
        </div>
      </Section>

      {/* Colors — brand & semantic */}
      <Section
        title="Thương hiệu &amp; trạng thái"
        desc="Indigo là màu hành động chính. Semantic dùng nhất quán cho thành công / cảnh báo / lỗi / thông tin."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6">
          <Swatch name="primary" className="bg-primary" />
          <Swatch name="success" className="bg-success" />
          <Swatch name="warning" className="bg-warning" />
          <Swatch name="destructive" className="bg-destructive" />
          <Swatch name="info" className="bg-info" />
          <Swatch name="online" className="bg-online" />
        </div>
      </Section>

      {/* Typography */}
      <Section
        title="Typography"
        desc="Inter (Latin + tiếng Việt). Thang cỡ rõ ràng, dễ nhìn lâu."
      >
        <div className="space-y-3 rounded-xl border bg-card p-6">
          <p className="text-4xl font-bold tracking-tight">
            Chăm khách không sót một tin
          </p>
          <p className="text-2xl font-semibold tracking-tight">
            Quản lý đa nick Zalo cho đội sale
          </p>
          <p className="text-lg font-medium">Tiêu đề mục — Heading nhỡ</p>
          <p className="text-base text-foreground">
            Đoạn văn thường: Nguyễn Văn Aạ Đệ Ữ — kiểm tra dấu tiếng Việt hiển
            thị mượt, không vỡ chữ, không layout shift.
          </p>
          <p className="text-sm text-muted-foreground">
            Văn bản phụ (muted) — chú thích, mô tả, metadata.
          </p>
          <p className="font-mono text-sm tabular-nums text-muted-foreground">
            JetBrains Mono · 0123456789 · 12:04 · 200/ngày
          </p>
        </div>
      </Section>

      {/* Buttons */}
      <Section title="Button" desc="Biến thể &amp; kích cỡ — dùng cho mọi hành động.">
        <div className="flex flex-wrap items-center gap-3">
          <Button>
            <Send className="size-4" /> Gửi tin
          </Button>
          <Button variant="secondary">Thứ cấp</Button>
          <Button variant="outline">Viền</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Xoá</Button>
          <Button variant="link">Liên kết</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Nhỏ</Button>
          <Button size="default">Mặc định</Button>
          <Button size="lg">Lớn</Button>
          <Button size="icon" aria-label="Thêm">
            <MoreHorizontal className="size-4" />
          </Button>
          <Button disabled>
            <Check className="size-4" /> Vô hiệu
          </Button>
        </div>
      </Section>

      {/* Badges & status */}
      <Section title="Badge &amp; nhãn trạng thái">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Mới</Badge>
          <Badge variant="secondary">Đã liên hệ</Badge>
          <Badge variant="outline">Quan tâm</Badge>
          <Badge className="bg-success text-success-foreground">Chốt đơn</Badge>
          <Badge className="bg-warning text-warning-foreground">Chờ chăm</Badge>
          <Badge className="bg-overdue text-destructive-foreground">
            Quá hạn
          </Badge>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="size-2 rounded-full bg-online" /> Đang online
          </span>
        </div>
      </Section>

      {/* Form */}
      <Section title="Form input">
        <div className="grid max-w-md gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tên khách hàng</Label>
            <Input id="name" placeholder="Nguyễn Văn A" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="search">Tìm kiếm</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="search" className="pl-9" placeholder="Tìm hội thoại, khách, SĐT..." />
            </div>
          </div>
        </div>
      </Section>

      {/* Cards & shadows */}
      <Section title="Card &amp; đổ bóng" desc="Bóng mềm, ít tương phản — đúng tinh thần Calm.">
        <div className="grid gap-4 sm:grid-cols-3">
          {(["shadow-sm", "shadow-md", "shadow-lg"] as const).map((s) => (
            <Card key={s} className={s}>
              <CardHeader>
                <CardTitle className="text-base">{s}</CardTitle>
                <CardDescription>Bề mặt nâng cấp dần</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Card dùng cho KPI, hồ sơ khách, popover.
              </CardContent>
              <CardFooter>
                <Button size="sm" variant="outline">
                  Xem
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </Section>

      {/* CRM / Chat preview */}
      <Section
        title="Component đặc thù — Hộp thư"
        desc="Bong bóng chat, KPI, dòng hội thoại — ghép từ token, sẵn cho màn Inbox."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Conversation row */}
          <Card className="overflow-hidden p-0">
            <div className="flex items-center gap-3 border-b p-3 hover:bg-accent/60">
              <Avatar className="size-10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  NA
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium">Nguyễn Văn A</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    10:02
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm text-muted-foreground">
                    Shop còn size M không ạ?
                  </p>
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-unread text-[11px] font-semibold text-primary-foreground">
                    2
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 hover:bg-accent/60">
              <Avatar className="size-10">
                <AvatarFallback className="bg-muted">TT</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium">Trần Thị B</p>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-overdue">
                    <Bell className="size-3" /> 35′
                  </span>
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  Bạn: Dạ em gửi ảnh nhé...
                </p>
              </div>
            </div>
          </Card>

          {/* Chat bubbles */}
          <Card className="flex flex-col justify-between p-4">
            <div className="space-y-2">
              <div className="flex justify-start">
                <div className="max-w-[75%] rounded-2xl rounded-bl-sm bg-chat-in px-3.5 py-2 text-sm text-chat-in-foreground">
                  Shop còn size M màu xanh không ạ?
                </div>
              </div>
              <div className="flex justify-end">
                <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-chat-out px-3.5 py-2 text-sm text-chat-out-foreground">
                  Dạ còn anh nhé, em gửi ảnh ngay 😊
                </div>
              </div>
              <div className="flex justify-end">
                <span className="text-[11px] text-muted-foreground">
                  Đã xem · 10:02
                </span>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl border bg-background p-1.5">
              <Button size="icon" variant="ghost" className="size-8">
                <Paperclip className="size-4" />
              </Button>
              <Input
                className="border-0 shadow-none focus-visible:ring-0"
                placeholder="Nhập tin nhắn..."
              />
              <Button size="icon" className="size-8">
                <Send className="size-4" />
              </Button>
            </div>
          </Card>
        </div>
      </Section>

      <Separator />
      <footer className="pb-4 text-center text-xs text-muted-foreground">
        ZaloCRM Design System · Inter + JetBrains Mono · oklch · Tailwind v4 +
        shadcn/ui
      </footer>
    </div>
  );
}
