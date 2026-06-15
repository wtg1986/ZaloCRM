"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  ACTION_LABELS,
  RESOURCE_LABELS,
  createPermissionGroup,
  deletePermissionGroup,
  getPermissionGroupDetail,
  getPermissionGroupTree,
  getPermissionMeta,
  seedDefaultGroups,
  updatePermissionGroup,
  type Grants,
  type PermGroupNode,
} from "@/lib/staff";
import { Button } from "@/components/ui/button";
import { Chip, Modal, inputCls, labelCls } from "@/components/staff/ui";

function flat(nodes: PermGroupNode[], out: PermGroupNode[] = []) {
  for (const n of nodes) {
    out.push(n);
    if (n.children?.length) flat(n.children, out);
  }
  return out;
}

export function PermissionGroupsTab() {
  const { data, isLoading, mutate } = useSWR("perm-tree", getPermissionGroupTree);
  const groups = React.useMemo(() => flat(data?.tree ?? []), [data]);
  const [editingId, setEditingId] = React.useState<string | null | undefined>(
    undefined,
  ); // undefined = đóng; null = tạo mới; string = sửa
  const [busy, setBusy] = React.useState(false);

  async function seed() {
    if (busy) return;
    setBusy(true);
    try {
      await seedDefaultGroups();
      toast.success("Đã tạo nhóm quyền mặc định");
      mutate();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không tạo được");
    } finally {
      setBusy(false);
    }
  }

  async function remove(g: PermGroupNode) {
    if (g.isSystem) {
      toast.error("Không xoá được nhóm hệ thống.");
      return;
    }
    if (!confirm(`Xoá nhóm quyền "${g.name}"?`)) return;
    try {
      await deletePermissionGroup(g.id);
      toast.success("Đã xoá");
      mutate();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không xoá được");
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Nhóm quyền gán cho nhân viên. Mỗi nhóm là 1 ma trận quyền theo chức năng.
        </p>
        <div className="flex gap-2">
          {groups.length === 0 ? (
            <Button size="sm" variant="outline" onClick={seed} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Tạo nhóm mặc định
            </Button>
          ) : null}
          <Button size="sm" onClick={() => setEditingId(null)}>
            <Plus className="size-4" /> Tạo nhóm quyền
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : groups.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Chưa có nhóm quyền nào. Bấm “Tạo nhóm mặc định” để khởi tạo bộ chuẩn.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl border">
          {groups.map((g) => (
            <li
              key={g.id}
              className="group flex items-center gap-2 border-b px-3 py-2.5 last:border-0 hover:bg-accent/40"
            >
              <ShieldCheck className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {g.name}
              </span>
              {g.isSystem ? <Chip tone="indigo">Hệ thống</Chip> : <Chip tone="slate">Tuỳ chỉnh</Chip>}
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="size-3" /> {g.memberCount}
              </span>
              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  title="Sửa quyền"
                  onClick={() => setEditingId(g.id)}
                  className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent"
                >
                  <Pencil className="size-3.5" />
                </button>
                {!g.isSystem ? (
                  <button
                    title="Xoá"
                    onClick={() => remove(g)}
                    className="grid size-7 place-items-center rounded-md text-destructive hover:bg-accent"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editingId !== undefined ? (
        <PermGroupEditor
          groupId={editingId}
          onClose={() => setEditingId(undefined)}
          onSaved={() => {
            setEditingId(undefined);
            mutate();
          }}
        />
      ) : null}
    </div>
  );
}

function PermGroupEditor({
  groupId,
  onClose,
  onSaved,
}: {
  groupId: string | null; // null = tạo mới
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: meta } = useSWR("perm-meta", getPermissionMeta);
  const { data: detail } = useSWR(
    groupId ? ["perm-detail", groupId] : null,
    () => getPermissionGroupDetail(groupId as string),
  );
  const group = detail?.group;
  const isSystem = group?.isSystem ?? false;

  const [name, setName] = React.useState("");
  const [grants, setGrants] = React.useState<Grants>({});
  const [busy, setBusy] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  // Nạp dữ liệu khi có (tạo mới: rỗng; sửa: từ detail).
  React.useEffect(() => {
    if (groupId === null) {
      setName("");
      setGrants({});
      setReady(true);
    } else if (group) {
      setName(group.name);
      setGrants(JSON.parse(JSON.stringify(group.grants ?? {})));
      setReady(true);
    }
  }, [groupId, group]);

  function toggle(resource: string, action: string) {
    setGrants((g) => {
      const next = { ...g, [resource]: { ...(g[resource] ?? {}) } };
      next[resource][action] = !next[resource][action];
      return next;
    });
  }

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      if (groupId === null) {
        await createPermissionGroup({ name: name.trim(), grants });
      } else {
        await updatePermissionGroup(groupId, {
          name: isSystem ? undefined : name.trim(),
          grants,
        });
      }
      toast.success("Đã lưu nhóm quyền");
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không lưu được");
    } finally {
      setBusy(false);
    }
  }

  const loading = !meta || (groupId !== null && !ready);

  return (
    <Modal
      wide
      title={groupId === null ? "Tạo nhóm quyền" : "Sửa nhóm quyền"}
      onClose={onClose}
    >
      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Tên nhóm quyền</label>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSystem}
            />
            {isSystem ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Nhóm hệ thống — chỉ chỉnh được quyền, không đổi tên.
              </p>
            ) : null}
          </div>

          {/* Ma trận quyền */}
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Chức năng</th>
                  {meta!.actions.map((a) => (
                    <th key={a} className="px-2 py-2 text-center font-medium">
                      {ACTION_LABELS[a] || a}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {meta!.resources.map((res) => {
                  const allowed = meta!.resourceActions[res] ?? [];
                  return (
                    <tr key={res} className="hover:bg-accent/30">
                      <td className="px-3 py-1.5 font-medium">
                        {RESOURCE_LABELS[res] || res}
                      </td>
                      {meta!.actions.map((a) => {
                        const applicable = allowed.includes(a);
                        return (
                          <td key={a} className="px-2 py-1.5 text-center">
                            {applicable ? (
                              <input
                                type="checkbox"
                                className="size-4 accent-primary"
                                checked={!!grants[res]?.[a]}
                                onChange={() => toggle(res, a)}
                              />
                            ) : (
                              <span className="text-muted-foreground/30">·</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Button className="w-full" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Lưu nhóm quyền
          </Button>
        </div>
      )}
    </Modal>
  );
}
