import React, { useEffect, useState, useRef } from 'react';
import { Plus, Search, MoreVertical, UserPlus, CreditCard, Printer, Edit2, FileSpreadsheet, Download, Upload, AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import { Button, Input, Card, Modal } from '../components/ui';
import { studentApi } from '../lib/api';
import { Student } from '../types';
import { StudentCard } from '../components/StudentCard';
import { parseExcelFile, validateStudentRows, downloadExcelTemplate, ParsedStudentRow } from '../lib/excel';

export const Students = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Import Excel Modal states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importedRows, setImportedRows] = useState<ParsedStudentRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    nis: '',
    name: '',
    class: '',
    parent_name: '',
    phone: '',
    photo_url: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isApiConfigured = import.meta.env.VITE_GAS_API_URL && !import.meta.env.VITE_GAS_API_URL.includes('YOUR_SCRIPT_ID');

  const fetchStudents = async (isBackground = false) => {
    if (!isApiConfigured) return;
    if (!isBackground) setLoading(true);
    try {
      const res = await studentApi.getAll();
      if (res.success) {
        // If background, we might want to merge or just replace if data is actually newer
        // For simplicity, we replace, but the delay ensures GAS has the new data
        setStudents(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch students', error);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleCreateStudent = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!formData.nis.trim() || !formData.name.trim() || !formData.class.trim()) {
      alert('Mohon lengkapi data wajib: NIS, Nama Lengkap, dan Kelas.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && editingId) {
        const res = await studentApi.update(editingId, formData);
        if (res && res.success !== false) {
          setIsModalOpen(false);
          setStudents(prev => prev.map(s => s.id === editingId ? (res.data || { ...s, ...formData }) : s));
          fetchStudents(true);
        } else {
          alert(res?.message || 'Gagal memperbarui data siswa.');
        }
      } else {
        const res = await studentApi.create({
          ...formData,
          status: 'active'
        });
        if (res && res.success !== false) {
          setIsModalOpen(false);
          setFormData({ nis: '', name: '', class: '', parent_name: '', phone: '', photo_url: '' });
          if (res.data) {
            setStudents(prev => [res.data, ...prev]);
          }
          fetchStudents(true);
        } else {
          alert(res?.message || 'Gagal menambahkan siswa.');
        }
      }
    } catch (error: any) {
      console.error('Submit student error:', error);
      alert(error.message || (isEditing ? 'Gagal memperbarui siswa' : 'Gagal menambahkan siswa'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAddModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({ nis: '', name: '', class: '', parent_name: '', phone: '', photo_url: '' });
    setIsModalOpen(true);
  };

  const openImportModal = () => {
    setImportedRows([]);
    setValidationErrors([]);
    setSelectedFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setIsImportModalOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExtensions = ['.xlsx', '.xls'];
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      alert('Format file tidak didukung. Harap unggah file Excel berformat .xlsx atau .xls.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFileName(file.name);
    setIsParsingExcel(true);
    setImportedRows([]);
    setValidationErrors([]);

    try {
      const rows = await parseExcelFile(file);
      const { validRows, errors } = validateStudentRows(rows, students);
      setImportedRows(validRows);
      setValidationErrors(errors);
    } catch (err: any) {
      console.error('Error reading excel file:', err);
      alert(err.message || 'Gagal membaca file Excel.');
      setImportedRows([]);
      setValidationErrors([err.message || 'Gagal membaca file Excel.']);
    } finally {
      setIsParsingExcel(false);
    }
  };

  const handleProcessImport = async () => {
    if (validationErrors.length > 0) {
      alert(`Impor ditolak karena terdapat ${validationErrors.length} kesalahan data / duplikat. Silakan perbaiki file Excel terlebih dahulu.`);
      return;
    }

    if (importedRows.length === 0) {
      alert('Tidak ada data siswa untuk diimpor.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = importedRows.map(r => ({
        nis: r.nis,
        name: r.name,
        class: r.class,
        parent_name: r.parent_name,
        phone: r.phone,
        photo_url: r.photo_url,
        status: 'active' as const,
      }));

      const res = await studentApi.batchCreate(payload);
      if (res && res.success !== false) {
        alert(`Berhasil mengimpor ${importedRows.length} data siswa!`);
        setIsImportModalOpen(false);
        if (Array.isArray(res.data)) {
          setStudents(prev => [...res.data, ...prev]);
        }
        fetchStudents(true);
      } else {
        alert(res?.message || 'Gagal mengimpor data siswa.');
      }
    } catch (error: any) {
      console.error('Import students error:', error);
      alert(error.message || 'Terjadi kesalahan saat mengimpor data siswa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (student: Student) => {
    setIsEditing(true);
    setEditingId(student.id);
    setFormData({
      nis: student.nis,
      name: student.name,
      class: student.class,
      parent_name: student.parent_name,
      phone: student.phone,
      photo_url: student.photo_url || '',
    });
    setIsModalOpen(true);
  };

  const filteredStudents = students.filter(s => {
    const term = searchTerm.toLowerCase();
    const name = s.name ? String(s.name).toLowerCase() : '';
    const nis = s.nis ? String(s.nis) : '';
    const className = s.class ? String(s.class).toLowerCase() : '';
    
    return name.includes(term) || nis.includes(term) || className.includes(term);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Data Siswa</h2>
          <p className="text-slate-500">Kelola informasi siswa dan akun tabungan mereka.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openImportModal} className="flex items-center gap-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            Import Excel
          </Button>
          <Button onClick={openAddModal} className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Tambah Siswa
          </Button>
        </div>
      </div>

      <Card>
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input 
              placeholder="Cari nama, NIS, atau kelas..." 
              className="pl-10 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">NIS</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nama Lengkap</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kelas</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Orang Tua</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{student.nis}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{student.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{student.class}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{student.parent_name}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        student.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {student.status === 'active' ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => { setSelectedStudent(student); setIsCardModalOpen(true); }}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Lihat Kartu Anggota"
                        >
                          <CreditCard className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => openEditModal(student)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Siswa"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    Tidak ada data siswa ditemukan
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={isEditing ? "Edit Data Siswa" : "Tambah Siswa Baru"}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Batal</Button>
            <Button onClick={handleCreateStudent} isLoading={isSubmitting}>
              {isEditing ? "Simpan Perubahan" : "Simpan Siswa"}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="NIS" 
              placeholder="Contoh: 2024001" 
              value={formData.nis}
              onChange={(e) => setFormData({...formData, nis: e.target.value})}
              required
            />
            <Input 
              label="Kelas" 
              placeholder="Contoh: 7A" 
              value={formData.class}
              onChange={(e) => setFormData({...formData, class: e.target.value})}
              required
            />
          </div>
          <Input 
            label="Nama Lengkap" 
            placeholder="Masukkan nama lengkap siswa" 
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            required
          />
          <Input 
            label="Nama Orang Tua" 
            placeholder="Nama ayah atau ibu" 
            value={formData.parent_name}
            onChange={(e) => setFormData({...formData, parent_name: e.target.value})}
            required
          />
          <Input 
            label="No. Telepon" 
            placeholder="0812xxxx" 
            value={formData.phone}
            onChange={(e) => setFormData({...formData, phone: e.target.value})}
            required
          />
          <Input 
            label="URL Foto Profil (Opsional)" 
            placeholder="https://example.com/photo.jpg" 
            value={formData.photo_url}
            onChange={(e) => setFormData({...formData, photo_url: e.target.value})}
          />
        </form>
      </Modal>

      {/* Card Modal */}
      <Modal
        isOpen={isCardModalOpen}
        onClose={() => setIsCardModalOpen(false)}
        title="Kartu Anggota Siswa"
      >
        {selectedStudent && <StudentCard student={selectedStudent} />}
      </Modal>

      {/* Import Excel Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import Data Siswa via Excel"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsImportModalOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={handleProcessImport}
              isLoading={isSubmitting}
              disabled={isParsingExcel || importedRows.length === 0 || validationErrors.length > 0}
            >
              Simpan {importedRows.length > 0 ? `(${importedRows.length} Siswa)` : ''}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Download Template Banner */}
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-emerald-900">Belum punya format Excel?</h4>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Unduh template Excel resmi untuk mempermudah pengisian data siswa. Format yang didukung: .xlsx, .xls
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={downloadExcelTemplate}
              className="shrink-0 bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-100 text-xs flex items-center gap-1.5 py-1.5 px-3"
            >
              <Download className="w-4 h-4" />
              Download Template
            </Button>
          </div>

          {/* Upload Input Area */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Pilih File Excel (.xlsx / .xls)
            </label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="hidden"
                id="excel-file-upload"
              />
              <label
                htmlFor="excel-file-upload"
                className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Browse File
              </label>
              <span className="text-sm text-slate-500 truncate max-w-xs">
                {selectedFileName || 'Belum ada file dipilih'}
              </span>
            </div>
          </div>

          {/* Parsing loading state */}
          {isParsingExcel && (
            <div className="p-6 text-center text-slate-500">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent mx-auto mb-2"></div>
              Memproses dan memvalidasi file Excel...
            </div>
          )}

          {/* Validation Error Alert Box */}
          {!isParsingExcel && validationErrors.length > 0 && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-rose-800 font-semibold text-sm">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>Ditemukan {validationErrors.length} Kesalahan Data (Import Ditolak):</span>
              </div>
              <ul className="max-h-40 overflow-y-auto space-y-1 text-xs text-rose-700 pl-7 list-disc">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Validated Rows Data Preview */}
          {!isParsingExcel && importedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {validationErrors.length === 0 ? (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Semua data valid ({importedRows.length} baris)
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-slate-600">
                      Pratinjau Data File ({importedRows.length} baris)
                    </span>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-slate-600">Baris</th>
                      <th className="px-3 py-2 font-semibold text-slate-600">NIS</th>
                      <th className="px-3 py-2 font-semibold text-slate-600">Nama Lengkap</th>
                      <th className="px-3 py-2 font-semibold text-slate-600">Kelas</th>
                      <th className="px-3 py-2 font-semibold text-slate-600">Orang Tua</th>
                      <th className="px-3 py-2 font-semibold text-slate-600">No. Telepon</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importedRows.map((row, idx) => {
                      const hasError = validationErrors.some(e => e.includes(`Baris ${row.rowNum}:`));
                      return (
                        <tr
                          key={idx}
                          className={hasError ? 'bg-rose-50 text-rose-900 font-medium' : 'hover:bg-slate-50 text-slate-700'}
                        >
                          <td className="px-3 py-2 text-slate-400 font-mono">{row.rowNum}</td>
                          <td className="px-3 py-2 font-semibold">{row.nis || '-'}</td>
                          <td className="px-3 py-2">{row.name || '-'}</td>
                          <td className="px-3 py-2">{row.class || '-'}</td>
                          <td className="px-3 py-2">{row.parent_name || '-'}</td>
                          <td className="px-3 py-2">{row.phone || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
