import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Lock, User as UserIcon } from 'lucide-react';
import { Button, Input, Card } from '../components/ui';
import { authApi } from '../lib/api';

export const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    try {
      const res = await authApi.login({ username: trimmedUsername, password: trimmedPassword });
      if (res.success) {
        localStorage.setItem('user', JSON.stringify(res.data.user));
        localStorage.setItem('token', res.data.token);
        navigate('/');
      } else {
        setError(res.message || 'Username atau password salah');
      }
    } catch (err: any) {
      setError('Terjadi kesalahan koneksi ke server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-emerald-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex bg-white/10 p-4 rounded-2xl backdrop-blur-md mb-4">
            <Wallet className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">TabunganSiswa</h1>
          <p className="text-emerald-100 mt-2">Sistem Manajemen Tabungan Sekolah</p>
        </div>

        <Card className="p-8 shadow-2xl border-none">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  placeholder="Username / NIS"
                  className="pl-10 h-12"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type="password"
                  placeholder="Password"
                  className="pl-10 h-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100">
                {error}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-12 text-lg font-semibold"
              isLoading={loading}
            >
              Masuk ke Dashboard
            </Button>
            
            <div className="text-center">
              <p className="text-xs text-slate-400">
                Siswa: Gunakan NIS sebagai username & password
              </p>
            </div>
          </form>
        </Card>

        <p className="text-center text-emerald-100 mt-8 text-sm">
          &copy; 2024 TabunganSiswa. All rights reserved.
        </p>
      </div>
    </div>
  );
};
