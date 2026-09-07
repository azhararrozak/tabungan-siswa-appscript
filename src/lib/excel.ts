import * as XLSX from 'xlsx';
import { Student } from '../types';

export interface ParsedStudentRow {
  rowNum: number; // 1-based row number in Excel (accounting for header)
  nis: string;
  name: string;
  class: string;
  parent_name: string;
  phone: string;
  photo_url: string;
}

export interface ValidationResult {
  validRows: ParsedStudentRow[];
  errors: string[];
}

/**
 * Normalizes header string to standard property key
 */
function normalizeHeaderKey(key: string): string {
  const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  if (['nis'].includes(cleanKey)) return 'nis';
  if (['nama', 'namalengkap', 'name'].includes(cleanKey)) return 'name';
  if (['kelas', 'class'].includes(cleanKey)) return 'class';
  if (['orangtua', 'namaorangtua', 'parentname', 'orangtuaayahibu'].includes(cleanKey)) return 'parent_name';
  if (['notelepon', 'noteleponhp', 'nohp', 'hp', 'phone', 'telepon'].includes(cleanKey)) return 'phone';
  if (['fotourl', 'urlfoto', 'photourl'].includes(cleanKey)) return 'photo_url';

  return cleanKey;
}

/**
 * Reads an Excel file buffer or Blob and parses student rows.
 */
export async function parseExcelFile(file: File): Promise<ParsedStudentRow[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('File Excel tidak memiliki sheet yang dapat dibaca.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

  if (!jsonData || jsonData.length === 0) {
    throw new Error('File Excel kosong atau tidak memiliki data.');
  }

  const rows: ParsedStudentRow[] = jsonData.map((rawRow, index) => {
    const rowNum = index + 2; // Row 1 is header
    const normalizedRow: Record<string, string> = {};

    Object.keys(rawRow).forEach(key => {
      const normKey = normalizeHeaderKey(key);
      normalizedRow[normKey] = String(rawRow[key] ?? '').trim();
    });

    return {
      rowNum,
      nis: normalizedRow.nis || '',
      name: normalizedRow.name || '',
      class: normalizedRow.class || '',
      parent_name: normalizedRow.parent_name || '',
      phone: normalizedRow.phone || '',
      photo_url: normalizedRow.photo_url || '',
    };
  });

  return rows;
}

/**
 * Validates parsed rows against mandatory rules and existing student data.
 */
export function validateStudentRows(
  rows: ParsedStudentRow[],
  existingStudents: Student[]
): ValidationResult {
  const errors: string[] = [];
  const existingNisSet = new Set(existingStudents.map(s => String(s.nis).trim()));
  const seenExcelNisMap = new Map<string, number>();

  rows.forEach((row) => {
    const rowPrefix = `Baris ${row.rowNum}:`;

    // Mandatory fields check
    if (!row.nis) {
      errors.push(`${rowPrefix} NIS wajib diisi.`);
    }
    if (!row.name) {
      errors.push(`${rowPrefix} Nama Lengkap wajib diisi.`);
    }
    if (!row.class) {
      errors.push(`${rowPrefix} Kelas wajib diisi.`);
    }

    if (row.nis) {
      // Check duplicate in existing DB
      if (existingNisSet.has(row.nis)) {
        errors.push(`${rowPrefix} NIS '${row.nis}' sudah terdaftar di database.`);
      }

      // Check duplicate within Excel file
      if (seenExcelNisMap.has(row.nis)) {
        const prevRow = seenExcelNisMap.get(row.nis);
        errors.push(`${rowPrefix} NIS '${row.nis}' duplikat dengan Baris ${prevRow} dalam file Excel.`);
      } else {
        seenExcelNisMap.set(row.nis, row.rowNum);
      }
    }
  });

  return {
    validRows: rows,
    errors,
  };
}

/**
 * Generates and downloads an Excel template for importing students.
 */
export function downloadExcelTemplate(): void {
  const headers = [
    {
      'NIS': '2024001',
      'Nama Lengkap': 'Ahmad Fauzi',
      'Kelas': '7A',
      'Nama Orang Tua': 'Budi Santoso',
      'No. Telepon': '081234567890',
      'Foto URL': 'https://example.com/photo.jpg',
    },
    {
      'NIS': '2024002',
      'Nama Lengkap': 'Siti Aminah',
      'Kelas': '7A',
      'Nama Orang Tua': 'Rahmat Hidayat',
      'No. Telepon': '089876543210',
      'Foto URL': '',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(headers);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 15 }, // NIS
    { wch: 25 }, // Nama Lengkap
    { wch: 10 }, // Kelas
    { wch: 25 }, // Nama Orang Tua
    { wch: 18 }, // No. Telepon
    { wch: 30 }, // Foto URL
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Siswa');

  XLSX.writeFile(workbook, 'Template_Import_Siswa.xlsx');
}
