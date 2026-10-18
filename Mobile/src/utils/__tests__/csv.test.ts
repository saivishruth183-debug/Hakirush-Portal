import { escapeCsvCell, neutralizeFormula, objectsToCsv, toCsv, UTF8_BOM } from '@/utils/csv';

describe('csv', () => {
  it('quotes fields with comma, quote, CR or LF and doubles quotes (RFC 4180)', () => {
    expect(escapeCsvCell('plain')).toBe('plain');
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvCell('a\r\nb')).toBe('"a\r\nb"');
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
    expect(escapeCsvCell(12.5)).toBe('12.5');
    expect(escapeCsvCell(-3)).toBe('-3'); // real numbers are not formulas
  });

  it('neutralises spreadsheet formula injection', () => {
    expect(neutralizeFormula('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(escapeCsvCell('+1-555')).toBe("'+1-555");
    expect(escapeCsvCell('-2+3')).toBe("'-2+3");
    expect(escapeCsvCell('@cmd')).toBe("'@cmd");
    expect(escapeCsvCell('\t=1')).toBe("'\t=1");
    expect(escapeCsvCell('=HYPERLINK("http://x","y")')).toBe('"\'=HYPERLINK(""http://x"",""y"")"');
    expect(escapeCsvCell('safe=value')).toBe('safe=value');
  });

  it('builds a document with BOM and CRLF line endings', () => {
    const csv = toCsv(['Name', 'Amount'], [['Asha', 100], ['=evil', '₹1,000']]);
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    expect(csv).toBe(`${UTF8_BOM}Name,Amount\r\nAsha,100\r\n'=evil,"₹1,000"\r\n`);
    expect(toCsv(['a'], [], { bom: false })).toBe('a\r\n');
  });

  it('objectsToCsv maps columns', () => {
    const out = objectsToCsv([{ n: 'X', d: 2 }], [
      { header: 'Name', value: (r) => r.n },
      { header: 'Days', value: (r) => r.d },
    ], { bom: false });
    expect(out).toBe('Name,Days\r\nX,2\r\n');
  });
});
