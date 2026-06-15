"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  createContact,
  updateContact,
  deleteContact,
  getStatuses,
  type Contact,
  type ContactInput,
} from "@/lib/crm";
import { getUsers } from "@/lib/team";
import { Button } from "@/components/ui/button";
import { Modal, inputCls, labelCls } from "@/components/staff/ui";
import { Select, SelectItem } from "@/components/ui/select";

export function ContactFormDialog({
  contact,
  onClose,
  onSaved,
}: {
  contact?: Contact | null; // null/undefined = tạo mới
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!contact;
  const { data: statusData } = useSWR("statuses", getStatuses);
  const { data: userData } = useSWR("team-users", getUsers);
  const statuses = statusData?.statuses ?? [];
  const users = (userData?.users ?? []).filter((u) => u.isActive);

  const [form, setForm] = React.useState<ContactInput>({
    crmName: contact?.crmName || contact?.fullName || "",
    phone: contact?.phone || "",
    source: contact?.source || "",
    statusId: contact?.statusId || "",
    assignedUserId: contact?.assignedUser?.id || "",
  });
  const [busy, setBusy] = React.useState(false);

  function set<K extends keyof ContactInput>(k: K, v: ContactInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    if (busy) return;
    if (!form.crmName?.trim() && !form.phone?.trim()) {
      toast.error("Cần ít nhất tên hoặc số điện thoại");
      return;
    }
    setBusy(true);
    try {
      const payload: ContactInput = {
        ...form,
        statusId: form.statusId || null,
        assignedUserId: form.assignedUserId || null,
      };
      if (isEdit) await updateContact(contact!.id, payload);
      else await createContact(payload);
      toast.success(isEdit ? "Đã lưu" : "Đã thêm khách hàng");
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không lưu được");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!isEdit || busy) return;
    if (!confirm(`Xoá khách hàng "${contact!.crmName || contact!.fullName}"?`)) return;
    setBusy(true);
    try {
      await deleteContact(contact!.id);
      toast.success("Đã xoá khách hàng");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không xoá được");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={isEdit ? "Sửa khách hàng" : "Thêm khách hàng"} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Tên khách</label>
            <input
              className={inputCls}
              value={form.crmName ?? ""}
              onChange={(e) => set("crmName", e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className={labelCls}>Số điện thoại</label>
            <input
              className={inputCls}
              value={form.phone ?? ""}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Email</label>
            <input
              className={inputCls}
              type="email"
              value={form.email ?? ""}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Nguồn</label>
            <input
              className={inputCls}
              value={form.source ?? ""}
              onChange={(e) => set("source", e.target.value)}
              placeholder="vd: Facebook, Giới thiệu…"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Giai đoạn</label>
            <Select
              className="w-full"
              value={form.statusId ?? ""}
              onValueChange={(v) => set("statusId", v)}
            >
              <SelectItem value="">— Chưa phân loại —</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </Select>
          </div>
          <div>
            <label className={labelCls}>Phụ trách</label>
            <Select
              className="w-full"
              value={form.assignedUserId ?? ""}
              onValueChange={(v) => set("assignedUserId", v)}
            >
              <SelectItem value="">— Chưa gán —</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.fullName || u.email}
                </SelectItem>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Công ty</label>
            <input
              className={inputCls}
              value={form.company ?? ""}
              onChange={(e) => set("company", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Địa chỉ</label>
            <input
              className={inputCls}
              value={form.address ?? ""}
              onChange={(e) => set("address", e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Ghi chú</label>
          <textarea
            className={`${inputCls} h-auto min-h-16 resize-none py-2`}
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 border-t pt-3">
          <Button className="flex-1" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {isEdit ? "Lưu thay đổi" : "Thêm khách hàng"}
          </Button>
          {isEdit ? (
            <Button
              variant="outline"
              className="text-destructive"
              onClick={remove}
              disabled={busy}
            >
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
