// Làm đẹp tên tag khi HIỂN THỊ — gắn emoji ý nghĩa theo từ khoá.
// Tag đồng bộ từ Zalo (managed_by=zalo_sync) hay có tiền tố chấm màu "🔵 ..." và
// bị sync ghi đè → không sửa được trong DB. Nên xử lý ở tầng hiển thị (bền vững).
// LƯU Ý: chỉ dùng để HIỂN THỊ — khi gửi/gán tag vẫn dùng tên gốc (raw) để khớp.

const RULES: [RegExp, string][] = [
  [/kh[áa]ch\s*h[àa]ng/i, "🛒"],
  [/c[ôo]ng\s*vi[ệe]c/i, "💼"],
  [/gia\s*[đd][ìi]nh/i, "🏠"],
  [/b[ạa]n\s*b[èe]/i, "🤝"],
  [/tr[ảa]\s*l[ờo]i\s*sau/i, "⏰"],
  [/[đd][ồo]ng\s*nghi[ệe]p/i, "🧑‍💼"],
  [/vip|ti[ềe]m\s*n[ăa]ng|quan\s*tr[ọo]ng/i, "⭐"],
  [/spam|r[áa]c|ch[ặa]n/i, "🚫"],
  [/n[óo]ng|hot/i, "🔥"],
  [/ngu[ộo]i|l[ạa]nh/i, "❄️"],
];

// Chấm màu Zalo ở đầu tên (🔴🔵🟠🟡🟢🟣🟤⚫⚪).
const LEADING_DOT =
  /^[\u{1F534}\u{1F535}\u{1F7E0}\u{1F7E1}\u{1F7E2}\u{1F7E3}\u{1F7E4}\u{26AB}\u{26AA}]\s*/u;

/** Tên tag để HIỂN THỊ: bỏ chấm màu + gắn emoji ý nghĩa nếu nhận diện được. */
export function prettyTagName(name: string): string {
  const base = name.replace(LEADING_DOT, "").trim();
  for (const [re, emo] of RULES) {
    if (re.test(base)) return `${emo} ${base}`;
  }
  // Không nhận diện được → giữ nguyên (kể cả chấm màu) để không mất thông tin.
  return name;
}
