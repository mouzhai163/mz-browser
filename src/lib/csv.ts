/** 去掉文本开头的 BOM（Excel 保存的 CSV、记事本保存的 JSON 常带） */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * 把 CSV 文本拆成行和字段：支持引号里的逗号、双写的引号和换行，以及 Windows 换行和开头的 BOM。
 * 字段去掉首尾空白，全空的行跳过。
 */
export function parseCsvRows(content: string): string[][] {
  const text = stripBom(content);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const endField = () => {
    row.push(field.trim());
    field = '';
  };
  const endRow = () => {
    endField();
    if (row.some((value) => value !== '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      endField();
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      endRow();
    } else {
      field += char;
    }
  }
  endRow();
  return rows;
}
