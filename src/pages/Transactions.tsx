import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Search, 
  Filter,
  Download,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw
} from 'lucide-react';
import { Button, Input, Card, Modal, cn } from '../components/ui';
import { transactionApi, studentApi } from '../lib/api';
import { Transaction, Student } from '../types';
import { format, isValid } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

export const Transactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'deposit' | 'withdraw'>('deposit');
  
  // Form state
  const [formData, setFormData] = useState({
    student_id: '',
    amount: '',
    method: 'Tunai',
    note: '',
    status: 'pending' as 'pending' | 'completed',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const isApiConfigured = import.meta.env.VITE_GAS_API_URL && !import.meta.env.VITE_GAS_API_URL.includes('YOUR_SCRIPT_ID');

  const fetchData = async (isBackground = false) => {
    if (!isApiConfigured) {
      setLoading(false);
      return;
    }
    if (!isBackground) setLoading(true);
    try {
      const [transRes, stuRes] = await Promise.all([
        transactionApi.getAll(),
        studentApi.getAll()
      ]);
      

      if (transRes.success && Array.isArray(transRes.data)) {
        let data = transRes.data.map((t: any) => ({
          ...t,
          id: String(t.id || t.ID || t.Id || ''),
          student_id: String(t.student_id || t.StudentId || t.studentId || t.NIS || t.nis || ''),
          amount: Number(t.amount || t.Amount || 0),
          type: String(t.type || t.Type || 'deposit').toLowerCase(),
          status: String(t.status || t.Status || 'pending').toLowerCase(),
          date: String(t.date || t.Date || t.timestamp || t.Timestamp || new Date().toISOString()),
          method: String(t.method || t.Method || 'Tunai'),
          note: String(t.note || t.Note || ''),
          created_by: String(t.created_by || t.CreatedBy || t.createdBy || '')
        }));
        
        if (user?.role === 'student' && user.student_id) {
          data = data.filter((t: Transaction) => t.student_id === user.student_id);
        }
        setTransactions(data.reverse());
      }
      
      if (stuRes.success && Array.isArray(stuRes.data)) {
        const normalizedStudents = stuRes.data.map((s: any) => ({
          ...s,
          id: String(s.id || s.ID || s.Id || s.nis || s.NIS || ''),
          name: String(s.name || s.Name || 'Tanpa Nama'),
          nis: String(s.nis || s.NIS || ''),
          class: String(s.class || s.Class || s.Kelas || s.kelas || '')
        }));
        setStudents(normalizedStudents);
      }
    } catch (error) {
      console.error('Failed to fetch transactions', error);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const location = useLocation();
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    if (location.state?.filter) {
      setFilterStatus(location.state.filter);
    }
    fetchData();

    // Auto-refresh every 30 seconds
    const intervalId = setInterval(() => {
      fetchData(true); // true for background fetch
    }, 30000);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  const handleFilterChange = (status: string) => {
    setFilterStatus(status);
    // Clear location state if we manually change filter
    if (location.state?.filter) {
      navigate(location.pathname, { replace: true });
    }
  };

  useEffect(() => {
    if (formData.student_id) {
      transactionApi.getBalance(formData.student_id).then(res => {
        if (res.success) setCurrentBalance(res.data.balance);
      });
    } else {
      setCurrentBalance(null);
    }
  }, [formData.student_id]);

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        student_id: formData.student_id,
        amount: Number(formData.amount),
        method: formData.method,
        note: formData.note,
      };

      // Ensure status is lowercase for frontend consistency, backend handles normalization
      const statusToSend = formData.status === 'pending' ? 'pending' : 'completed';

      const res = modalType === 'deposit' 
        ? await transactionApi.deposit({ ...payload, status: statusToSend })
        : await transactionApi.withdraw(payload);

      if (res.success) {
        setIsModalOpen(false);
        setFormData({ 
          student_id: '', 
          amount: '', 
          method: 'Tunai', 
          note: '',
          status: 'pending'
        });
        
        // Delay the fetch to avoid stale data from GAS
        setTimeout(() => {
          fetchData(true);
        }, 3000);
      } else {
        alert(res.message || 'Transaksi gagal');
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Gagal memproses transaksi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleApprove = async (id: string) => {
    console.log('Approving transaction:', id);
    if (!id) {
      alert('ID Transaksi tidak valid');
      return;
    }
    
    // Removed native confirm for debugging/iframe compatibility
    // if (!confirm('Setujui transaksi ini? Saldo siswa akan bertambah.')) return;
    console.log('Proceeding with approval for:', id);
    
    setActionLoading(id);
    try {
      console.log('Calling transactionApi.approve...');
      const res = await transactionApi.approve(id);
      console.log('Approve response:', res);
      
      if (res.success) {
        await fetchData(true);
        alert('Transaksi berhasil disetujui');
      } else {
        alert(res.message || 'Gagal menyetujui transaksi');
      }
    } catch (error) {
      console.error('Approve error:', error);
      alert('Terjadi kesalahan koneksi');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    console.log('Rejecting transaction:', id);
    if (!id) {
      alert('ID Transaksi tidak valid');
      return;
    }
    
    // Removed native confirm for debugging/iframe compatibility
    // if (!confirm('Tolak transaksi ini? Transaksi akan dibatalkan.')) return;
    console.log('Proceeding with rejection for:', id);
    
    setActionLoading(id);
    try {
      console.log('Calling transactionApi.reject...');
      const res = await transactionApi.reject(id);
      console.log('Reject response:', res);

      if (res.success) {
        await fetchData(true);
        alert('Transaksi berhasil ditolak');
      } else {
        alert(res.message || 'Gagal menolak transaksi');
      }
    } catch (error) {
      console.error('Reject error:', error);
      alert('Terjadi kesalahan koneksi');
    } finally {
      setActionLoading(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const [searchQuery, setSearchQuery] = useState('');

  const filteredTransactions = transactions.filter(tx => {
    try {
      const matchesStatus = filterStatus === 'all' || tx.status === filterStatus;
      
      // Search logic
      const student = students.find(s => s.id === tx.student_id);
      const studentName = student && student.name ? String(student.name).toLowerCase() : '';
      const studentNis = student && student.nis ? String(student.nis) : '';
      const txStudentId = tx.student_id ? String(tx.student_id).toLowerCase() : '';
      
      const query = searchQuery ? String(searchQuery).toLowerCase() : '';
      
      const matchesSearch = !query || 
                            studentName.includes(query) || 
                            studentNis.includes(query) ||
                            txStudentId.includes(query);
      
      return matchesStatus && matchesSearch;
    } catch (e) {
      console.warn('Error filtering transaction:', tx, e);
      return false;
    }
  });

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Transaksi Tabungan</h2>
          <p className="text-slate-500">Catat setoran dan penarikan tabungan siswa.</p>
        </div>
        {user?.role === 'admin' && (
          <div className="flex gap-3">
            <Button 
              variant="success" 
              onClick={() => { setModalType('deposit'); setIsModalOpen(true); }}
              className="flex items-center gap-2"
            >
              <ArrowUpRight className="w-5 h-5" />
              Setoran
            </Button>
            <Button 
              variant="danger" 
              onClick={() => { setModalType('withdraw'); setIsModalOpen(true); }}
              className="flex items-center gap-2"
            >
              <ArrowDownRight className="w-5 h-5" />
              Penarikan
            </Button>
          </div>
        )}
      </div>

      {/* Warning for GAS Deployment */}
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start gap-3">
        <div className="bg-amber-100 p-2 rounded-full shrink-0">
          <Clock className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-amber-900">Penting: Update Script Backend</h4>
          <p className="text-xs text-amber-700 mt-1">
            Jika status transaksi masih muncul "Hijau" (Completed) padahal seharusnya "Pending", mohon <strong>Redeploy</strong> Google Apps Script Anda.
            <br/>
            Buka Editor Script &gt; Deploy &gt; New Deployment &gt; Select type: Web app &gt; Deploy.
          </p>
        </div>
      </div>

      <Card>
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input 
              placeholder="Cari nama atau NIS..." 
              className="pl-10 bg-white" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-500 shrink-0">Status:</span>
              <div className="flex gap-1">
                <Button 
                  variant={filterStatus === 'all' ? 'primary' : 'outline'} 
                  size="sm" 
                  onClick={() => handleFilterChange('all')}
                >
                  Semua
                </Button>
                <Button 
                  variant={filterStatus === 'pending' ? 'primary' : 'outline'} 
                  size="sm" 
                  onClick={() => handleFilterChange('pending')}
                >
                  Pending
                </Button>
                <Button 
                  variant={filterStatus === 'completed' ? 'primary' : 'outline'} 
                  size="sm" 
                  onClick={() => handleFilterChange('completed')}
                >
                  Berhasil
                </Button>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => fetchData()} className="flex items-center gap-2">
                  <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Segarkan
              </Button>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Download className="w-4 h-4" /> Export
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tanggal</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nama Siswa</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipe</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Jumlah</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                {user?.role === 'admin' && <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Aksi</th>}
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
              ) : filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => {
                  const student = students.find(s => s.id === tx.student_id);
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {tx.date && isValid(new Date(tx.date)) 
                          ? format(new Date(tx.date), 'dd/MM/yyyy HH:mm') 
                          : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {student ? student.name : tx.student_id}
                        {tx.created_by && (
                          <p className="text-[10px] text-slate-400 font-normal">Oleh: {tx.created_by}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        tx.type === 'deposit' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {tx.type === 'deposit' ? 'Setoran' : 'Penarikan'}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-sm font-bold ${
                      tx.status === 'pending' ? 'text-amber-600' :
                      tx.type === 'deposit' ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {tx.type === 'deposit' ? '+' : '-'} {formatCurrency(tx.amount)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        tx.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 
                        tx.status === 'pending' ? 'bg-amber-100 text-amber-800' : 
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {tx.status === 'completed' ? <CheckCircle className="w-3 h-3" /> : 
                         tx.status === 'pending' ? <Clock className="w-3 h-3" /> : null}
                        {tx.status === 'completed' ? 'Berhasil' : 
                         tx.status === 'pending' ? 'Menunggu' : tx.status}
                      </span>
                    </td>
                    {user?.role === 'admin' && (
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {tx.status === 'pending' && (
                          <div className="flex gap-2">
                            <button 
                              type="button"
                              onClick={() => handleApprove(tx.id)}
                              disabled={actionLoading === tx.id}
                              className={`p-1 text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors ${actionLoading === tx.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title="Setujui"
                            >
                              {actionLoading === tx.id ? (
                                <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <CheckCircle className="w-5 h-5" />
                              )}
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleReject(tx.id)}
                              disabled={actionLoading === tx.id}
                              className={`p-1 text-red-600 hover:bg-red-50 rounded-full transition-colors ${actionLoading === tx.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title="Tolak"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    Belum ada transaksi tercatat
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
        title={modalType === 'deposit' ? 'Form Setoran Tabungan' : 'Form Penarikan Tabungan'}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Batal</Button>
            <Button 
              variant={modalType === 'deposit' ? 'success' : 'danger'} 
              onClick={handleTransaction} 
              isLoading={isSubmitting}
            >
              Proses {modalType === 'deposit' ? 'Setoran' : 'Penarikan'}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Pilih Siswa</label>
            <select 
              className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              value={formData.student_id}
              onChange={(e) => setFormData({...formData, student_id: e.target.value})}
              required
            >
              <option value="">-- Pilih Siswa --</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.nis} - {s.name} ({s.class})</option>
              ))}
            </select>
          </div>

          {currentBalance !== null && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center">
              <span className="text-xs font-medium text-slate-500 uppercase">Saldo Saat Ini:</span>
              <span className="text-sm font-bold text-slate-900">{formatCurrency(currentBalance)}</span>
            </div>
          )}

          <Input 
            label="Jumlah (IDR)" 
            type="number"
            placeholder="Masukkan nominal" 
            value={formData.amount}
            onChange={(e) => setFormData({...formData, amount: e.target.value})}
            required
          />

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Metode Pembayaran</label>
            <select 
              className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              value={formData.method}
              onChange={(e) => setFormData({...formData, method: e.target.value})}
            >
              <option value="Tunai">Tunai</option>
              <option value="Transfer">Transfer Bank</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </div>

          {modalType === 'deposit' && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Status Awal</label>
              <select 
                className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value as any})}
              >
                <option value="pending">Menunggu Persetujuan (Pending)</option>
                <option value="completed">Langsung Berhasil (Selesai)</option>
              </select>
              <p className="text-[10px] text-slate-400 italic">Pilih 'Pending' jika uang fisik belum diterima atau perlu verifikasi lanjut.</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Catatan (Opsional)</label>
            <textarea 
              className="flex min-h-[80px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              placeholder="Keterangan tambahan..."
              value={formData.note}
              onChange={(e) => setFormData({...formData, note: e.target.value})}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
