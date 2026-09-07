import React, { useEffect, useState } from 'react';
import { Plus, Search, MoreVertical, UserPlus, CreditCard, Printer, Edit2 } from 'lucide-react';
import { Button, Input, Card, Modal } from '../components/ui';
import { studentApi } from '../lib/api';
import { Student } from '../types';
import { StudentCard } from '../components/StudentCard';

export const Students = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
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
        <Button onClick={openAddModal} className="flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Tambah Siswa
        </Button>
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
    </div>
  );
};
