import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/tauri', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(), save: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('../../api', () => ({ createAccount: vi.fn() }));
vi.mock('../../../../proxy-center/src/api', () => ({ createProxy: vi.fn() }));

import { parseCsvRows } from '@/lib/csv';
import { convertToCSV, parseCSVContent as parseAccounts } from '../import-export';
import { parseCSVContent as parseProxies } from '../../../../proxy-center/src/utils/import-export';

// ProxyExportService::export_proxies_to_csv 的转义规则
const rustEscape = (value: string) => (!value ? '' : /[,\n"]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const proxyCsv = (rows: string[][]) =>
  'name,host,port,type,username,password\n' + rows.map((row) => row.map(rustEscape).join(',')).join('\n') + '\n';

describe('parseCsvRows', () => {
  it('keeps commas, quotes and line breaks inside quoted fields', () => {
    expect(parseCsvRows('a,"b, c","say ""hi""","two\nlines"\n')).toEqual([['a', 'b, c', 'say "hi"', 'two\nlines']]);
  });

  it('handles Windows line endings, a BOM and blank lines', () => {
    expect(parseCsvRows('﻿x,y\r\n\r\n1,2\r\n')).toEqual([
      ['x', 'y'],
      ['1', '2'],
    ]);
  });
});

describe('proxy CSV round trip', () => {
  it('reads back what the app exports', () => {
    const parsed = parseProxies(
      proxyCsv([
        ['US 1', '1.2.3.4', '1080', 'socks5', 'user', 'p@ss'],
        ['line\nbreak, comma', 'h.example', '8080', 'http', '', 'with "quote"'],
      ]).replace(/\n(?=[^\n]*$)/, '\r\n')
    );
    expect(parsed).toHaveLength(2);
    expect(parsed[1]).toMatchObject({ name: 'line\nbreak, comma', host: 'h.example', port: '8080', password: 'with "quote"', valid: true });
  });
});

describe('account CSV round trip', () => {
  it('reads back what the app exports, including accounts without a password', () => {
    const csv = convertToCSV([
      { platform: 'https://www.google.com/', account: 'a@x.com', password: 'pw,1', remark: 'note "q"' },
      { platform: 'https://x.com/', account: 'b', password: '', remark: 'multi\nline' },
    ] as never);
    const parsed = parseAccounts(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ platform: 'https://www.google.com/', password: 'pw,1', remark: 'note "q"', valid: true });
    expect(parsed[1]).toMatchObject({ account: 'b', password: '', remark: 'multi\nline', valid: true });
  });
});
