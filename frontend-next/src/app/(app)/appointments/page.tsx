"use client";

import * as React from "react";
import useSWR from "swr";
import Link from "next/link";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronDown,
  Clock,
  MapPin,
  Phone,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getAppointments,
  updateAppointmentStatus,
  type Appointment,
} from "@/lib/crm";
import { ApiError } from "@/lib/api";
import { dayLabel } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateAppointmentDialog } from "@/components/appointments/create-appointment-dialog";

const STATUS_FLOW = ["scheduled", "completed", "cancelled", "no_show"];

const STATUS: Record<string, { label: string; cls: string }> = {
  scheduled: { label: "Đã hẹn", cls: "bg-info/15 text-info" },
  overdue: { label: "Quá hạn", cls: "bg-warning/15 text-warning" },
  completed: { label: "Hoàn thành", cls: "bg-success/15 text-success" },
  cancelled: { label: "Đã huỷ", cls: "bg-muted text-muted-foreground" },
  no_show: { label: "Không đến", cls: "bg-overdue/15 text-overdue" },
};

const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Tất cả" },
  { key: "scheduled", label: "Đã hẹn" },
  { key: "completed", label: "Hoàn thành" },
  { key: "cancelled", label: "Đã huỷ" },
];

function avatarOf(a: Appointment): { url: string | null; name: string } {
  const name = a.contact?.fullName || "Khách";
  const url =
    a.contact?.avatarUrl ||
    a.contact?.friends?.find((f) => f.zaloAvatarUrl)?.zaloAvatarUrl ||
    null;
  return { url, name };
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export default function AppointmentsPage() {
  const [status, setStatus] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const { data, isLoading, mutate } = useSWR(["appointments", status], () =>
    getAppointments({ status: status || undefined, limit: 100 }),
  );

  const groups = React.useMemo(() => {
    const list = data?.appointments ?? [];
    const map = new Map<string, Appointment[]>();
    for (const a of list) {
      const key = a.appointmentDate.slice(0, 10);
      (map.get(key) ?? map.set(key, []).get(key)!).push(a);
    }
    return Array.from(map.entries()).sort((x, y) => y[0].localeCompare(x[0]));
  }, [data]);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Lịch hẹn"
        description={data ? `${data.total} lịch hẹn` : "Theo dõi & nhắc lịch hẹn với khách"}
      >
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatus(f.key)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  status === f.key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Tạo lịch hẹn
          </Button>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto">
        {isLoading && !data ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <Empty />
        ) : (
          <div className="space-y-6 p-6">
            {groups.map(([date, items]) => (
              <section key={date}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {dayLabel(date)}
                </h2>
                <div className="space-y-2">
                  {items
                    .slice()
                    .sort((a, b) =>
                      (a.appointmentTime ?? "").localeCompare(
                        b.appointmentTime ?? "",
                      ),
                    )
                    .map((a) => (
                      <AppointmentCard key={a.id} a={a} onChanged={() => mutate()} />
                    ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {createOpen ? (
        <CreateAppointmentDialog
          onClose={() => setCreateOpen(false)}
          onCreated={() => mutate()}
        />
      ) : null}
    </div>
  );
}

function AppointmentCard({
  a,
  onChanged,
}: {
  a: Appointment;
  onChanged: () => void;
}) {
  const { url, name } = avatarOf(a);
  const st = STATUS[a.status] ?? { label: a.status, cls: "bg-muted text-muted-foreground" };

  async function changeStatus(s: string) {
    try {
      await updateAppointmentStatus(a.id, s);
      onChanged();
      toast.success("Đã cập nhật lịch hẹn");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không cập nhật được");
    }
  }

  const card = (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-accent/40">
      <div className="flex w-14 shrink-0 flex-col items-center">
        <Clock className="size-3.5 text-muted-foreground" />
        <span className="text-sm font-semibold tabular-nums">
          {a.appointmentTime || "--:--"}
        </span>
      </div>
      <Avatar className="size-9 shrink-0">
        {url ? <AvatarImage src={url} alt={name} /> : null}
        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {a.title || `Hẹn với ${name}`}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="truncate">{name}</span>
          {a.contact?.phone ? (
            <span className="inline-flex items-center gap-1">
              <Phone className="size-3" />
              {a.contact.phone}
            </span>
          ) : null}
          {a.location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {a.location}
            </span>
          ) : null}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className={cn(
                "inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                st.cls,
              )}
            >
              {st.label}
              <ChevronDown className="size-3" />
            </button>
          }
        />
        <DropdownMenuContent
          align="end"
          onClick={(e) => e.stopPropagation()}
        >
          {STATUS_FLOW.map((s) => (
            <DropdownMenuItem
              key={s}
              onClick={(e) => {
                e.preventDefault();
                changeStatus(s);
              }}
            >
              {STATUS[s]?.label ?? s}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  // Deep-link tới hội thoại nếu có.
  return a.conversationId ? (
    <Link href={`/inbox?c=${a.conversationId}`} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-24 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-muted">
        <CalendarDays className="size-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">Chưa có lịch hẹn</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        Lịch hẹn tạo từ hội thoại hoặc ghi chú sẽ hiển thị ở đây.
      </p>
    </div>
  );
}
