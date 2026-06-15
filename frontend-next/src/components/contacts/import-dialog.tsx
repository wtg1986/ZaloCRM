"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { createContact } from "@/lib/crm";
import { Button } from "@/components/ui/button";
import { Modal, labelCls } from "@/components/staff/ui";

interface Row {
  crmName: string;
  phone: string;
  email: string;
  source: string;
}

// Parser CSV đơn giản (hỗ trợ ô có dấu ngoặc kép + dấu phẩy bên trong).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      cur.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      cur.push(field);
      field = "";
      if (cur.some((c) => c.trim())) rows.push(cur);
      cur = [];
    } else field += ch;
  }
  if (field || cur.length) {
    cur.push(field);
    if (cur.some((c) => c.trim())) rows.push(cur);
  }
  return rows;
}

const HEADER_HINT = /(t[êe]n|name|sđt|phone|đi[ệe]n tho[ạa]i|email|ngu[ồo]n)/i;

export function ImportDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const cells = parseCsv(String(reader.result || ""));
      if (!cells.length) {
        toast.error("File rỗng hoặc không đọc được");
        return;
      }
      // Bỏ dòng tiêu đề nếu nhận diện được.
      const start = cells[0].join(" ").match(HEADER_HINT) ? 1 : 0;
      const parsed: Row[] = cells.slice(start).map((c) => ({
        crmName: (c[0] || "").trim(),
        phone: (c[1] || "").trim(),
        email: (c[2] || "").trim(),
        source: (c[3] || "").trim() || "Import CSV",
      }));
      const valid = parsed.filter((r) => r.crmName || r.phone);
      setRows(valid);
      if (valid.length === 0) toast.error("Không có dòng hợp lệ (cần tên hoặc SĐT)");
    };
    reader.readAsText(file);
  }

  async function importAll() {
    if (busy || rows.length === 0) return;
    setBusy(true);
    setProgress(0);
    let ok = 0;
    let fail = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        await createContact({
          crmName: r.crmName || undefined,
          phone: r.phone || undefined,
          email: r.email || undefined,
          source: r.source,
        });
        ok++;
      } catch {
        fail++;
      }
      setProgress(i + 1);
    }
    setBusy(false);
    toast.success(`Nhập xong: ${ok} thành công${fail ? `, ${fail} lỗi` : ""}`);
    onDone();
    onClose();
  }

  return (
    <Modal title="Nhập khách hàng từ CSV" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          File CSV cột theo thứ tự: <b>Tên, SĐT, Email, Nguồn</b>. Dòng tiêu đề (nếu có) sẽ tự bỏ qua.
        </p>
        <div>
          <label className={labelCls}>Chọn file .csv</label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
            disabled={busy}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-sm"
          />
        </div>

        {rows.length > 0 ? (
          <div className="rounded-lg border">
            <div className="border-b bg-muted/40 px-3 py-1.5 text-xs font-medium">
              Xem trước — {rows.length} khách
            </div>
            <ul className="max-h-48 divide-y overflow-y-auto text-sm">
              {rows.slice(0, 50).map((r, i) => (
                <li key={i} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {r.crmName || "(không tên)"}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {r.phone || "—"}
                  </span>
                </li>
              ))}
              {rows.length > 50 ? (
                <li className="px-3 py-1.5 text-xs text-muted-foreground">
                  …và {rows.length - 50} dòng nữa
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        <Button
          className="w-full"
          onClick={importAll}
          disabled={busy || rows.length === 0}
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Đang nhập {progress}/{rows.length}
            </>
          ) : (
            <>
              <Upload className="size-4" /> Nhập {rows.length} khách
            </>
          )}
        </Button>
      </div>
    </Modal>
  );
}
