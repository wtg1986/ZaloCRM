"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Building2, Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  createDepartment,
  deleteDepartment,
  getDepartmentTree,
  updateDepartment,
  type DepartmentNode,
} from "@/lib/staff";
import { Button } from "@/components/ui/button";
import { Modal, inputCls, labelCls } from "@/components/staff/ui";
import { Select, SelectItem } from "@/components/ui/select";

function flat(
  nodes: DepartmentNode[],
  depth = 0,
  out: { id: string; name: string; depth: number }[] = [],
) {
  for (const n of nodes) {
    out.push({ id: n.id, name: n.name, depth });
    if (n.children?.length) flat(n.children, depth + 1, out);
  }
  return out;
}

export function DepartmentsTab() {
  const { data, isLoading, mutate } = useSWR("dept-tree", getDepartmentTree);
  const tree = data?.tree ?? [];
  const flatList = React.useMemo(() => flat(tree), [tree]);
  const [editing, setEditing] = React.useState<DepartmentNode | null>(null);
  const [creatingParent, setCreatingParent] = React.useState<
    string | null | undefined
  >(undefined); // undefined = đóng; null = tạo gốc; string = tạo con

  async function remove(d: DepartmentNode) {
    if (d.children.length) {
      toast.error("Xoá phòng ban con trước.");
      return;
    }
    if (!confirm(`Xoá phòng ban "${d.name}"?`)) return;
    try {
      await deleteDepartment(d.id);
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
          Cấu trúc phòng ban (tối đa 5 cấp). Nhân viên thuộc 1 phòng ban.
        </p>
        <Button size="sm" onClick={() => setCreatingParent(null)}>
          <Plus className="size-4" /> Thêm phòng ban
        </Button>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : tree.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Chưa có phòng ban nào.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl border">
          {tree.map((n) => (
            <DeptRow
              key={n.id}
              node={n}
              depth={0}
              onEdit={setEditing}
              onAddChild={(id) => setCreatingParent(id)}
              onDelete={remove}
            />
          ))}
        </ul>
      )}

      {creatingParent !== undefined ? (
        <DeptForm
          parentId={creatingParent}
          flatList={flatList}
          onClose={() => setCreatingParent(undefined)}
          onSaved={() => {
            setCreatingParent(undefined);
            mutate();
          }}
        />
      ) : null}
      {editing ? (
        <DeptForm
          dept={editing}
          flatList={flatList}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            mutate();
          }}
        />
      ) : null}
    </div>
  );
}

function DeptRow({
  node,
  depth,
  onEdit,
  onAddChild,
  onDelete,
}: {
  node: DepartmentNode;
  depth: number;
  onEdit: (d: DepartmentNode) => void;
  onAddChild: (id: string) => void;
  onDelete: (d: DepartmentNode) => void;
}) {
  return (
    <>
      <li className="group flex items-center gap-2 border-b px-3 py-2 last:border-0 hover:bg-accent/40">
        <span style={{ width: depth * 18 }} />
        <Building2 className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {node.name}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="size-3" /> {node.memberCount}
        </span>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <IconBtn title="Thêm phòng con" onClick={() => onAddChild(node.id)}>
            <Plus className="size-3.5" />
          </IconBtn>
          <IconBtn title="Sửa" onClick={() => onEdit(node)}>
            <Pencil className="size-3.5" />
          </IconBtn>
          <IconBtn title="Xoá" onClick={() => onDelete(node)} danger>
            <Trash2 className="size-3.5" />
          </IconBtn>
        </div>
      </li>
      {node.children.map((c) => (
        <DeptRow
          key={c.id}
          node={c}
          depth={depth + 1}
          onEdit={onEdit}
          onAddChild={onAddChild}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`grid size-7 place-items-center rounded-md hover:bg-accent ${
        danger ? "text-destructive" : "text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function DeptForm({
  dept,
  parentId,
  flatList,
  onClose,
  onSaved,
}: {
  dept?: DepartmentNode;
  parentId?: string | null;
  flatList: { id: string; name: string; depth: number }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState(dept?.name ?? "");
  const [parent, setParent] = React.useState<string>(
    dept ? (dept.parentId ?? "") : (parentId ?? ""),
  );
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      if (dept) {
        await updateDepartment(dept.id, {
          name: name.trim(),
          parentId: parent || null,
        });
      } else {
        await createDepartment({ name: name.trim(), parentId: parent || null });
      }
      toast.success("Đã lưu");
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không lưu được");
    } finally {
      setBusy(false);
    }
  }

  // Không cho chọn chính nó làm cha (đơn giản: loại nó khỏi list).
  const parentOptions = flatList.filter((d) => d.id !== dept?.id);

  return (
    <Modal title={dept ? "Sửa phòng ban" : "Thêm phòng ban"} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className={labelCls}>Tên phòng ban</label>
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className={labelCls}>Phòng ban cha</label>
          <Select className="w-full" value={parent} onValueChange={setParent}>
            <SelectItem value="">— Cấp gốc —</SelectItem>
            {parentOptions.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {" ".repeat(d.depth * 2)}
                {d.name}
              </SelectItem>
            ))}
          </Select>
        </div>
        <Button className="w-full" onClick={submit} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Lưu
        </Button>
      </div>
    </Modal>
  );
}
