"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Check, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createAppointment, getContacts, type Contact } from "@/lib/crm";
import { ApiError } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return ((p[0][0] || "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

export function CreateAppointmentDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [picked, setPicked] = React.useState<Contact | null>(null);
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data } = useSWR(
    !picked ? ["apt-contacts", debounced] : null,
    () => getContacts({ search: debounced || undefined, limit: 20 }),
  );
  const contacts = data?.contacts ?? [];

  async function submit(form: FormData) {
    if (!picked) return;
    const date = String(form.get("date") || "");
    if (!date) return;
    setBusy(true);
    try {
      await createAppointment({
        contactId: picked.id,
        appointmentDate: date,
        appointmentTime: String(form.get("time") || "") || undefined,
        title: String(form.get("title") || "") || undefined,
        location: String(form.get("location") || "") || undefined,
        notes: String(form.get("notes") || "") || undefined,
      });
      toast.success("Đã tạo lịch hẹn");
      onCreated();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không tạo được lịch hẹn");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-xl border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Tạo lịch hẹn</h2>
          <button
            onClick={onClose}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>

        {!picked ? (
          <div className="flex flex-col overflow-hidden">
            <div className="border-b p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  placeholder="Tìm khách hàng..."
                  className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {contacts.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Không tìm thấy khách
                </p>
              ) : (
                <ul>
                  {contacts.map((c) => {
                    const name = c.crmName || c.fullName || "Khách chưa rõ tên";
                    return (
                      <li key={c.id}>
                        <button
                          onClick={() => setPicked(c)}
                          className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent/50"
                        >
                          <Avatar className="size-8">
                            {c.avatarUrl ? (
                              <AvatarImage src={c.avatarUrl} alt={name} />
                            ) : null}
                            <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                              {initials(name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {name}
                            </span>
                            {c.phone ? (
                              <span className="block truncate text-xs text-muted-foreground">
                                {c.phone}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit(new FormData(e.currentTarget));
            }}
            className="space-y-3 p-4"
          >
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2">
              <Avatar className="size-8">
                {picked.avatarUrl ? (
                  <AvatarImage src={picked.avatarUrl} alt="" />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                  {initials(picked.crmName || picked.fullName || "?")}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {picked.crmName || picked.fullName || "Khách"}
              </span>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="text-xs text-primary hover:underline"
              >
                Đổi
              </button>
            </div>
            <input
              name="title"
              placeholder="Tiêu đề (vd: Tư vấn gói A)"
              className="h-9 w-full rounded-md border bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
            <div className="flex gap-2">
              <input
                name="date"
                type="date"
                required
                className="h-9 flex-1 rounded-md border bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
              <input
                name="time"
                type="time"
                className="h-9 w-28 rounded-md border bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
            <input
              name="location"
              placeholder="Địa điểm"
              className="h-9 w-full rounded-md border bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
            <textarea
              name="notes"
              rows={2}
              placeholder="Ghi chú"
              className="w-full resize-none rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Huỷ
              </Button>
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Tạo lịch hẹn
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
