import React, { useState } from 'react';
import { supabase } from './lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  User, 
  Camera, 
  Mail, 
  Save, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Smartphone
} from 'lucide-react';

interface ProfileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
}

export default function ProfileSidebar({ isOpen, onClose, user }: ProfileSidebarProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [name, setName] = useState(user?.user_metadata?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || '');
  const [phone, setPhone] = useState(user?.user_metadata?.phone || '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase || !user) return;

    setIsUploading(true);
    setError(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = fileName;

      // Upload to 'avatars' bucket
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        if (uploadError.message.toLowerCase().includes('bucket not found')) {
          throw new Error('Bucket "avatars" não encontrado. Verifique se o ID do bucket no Supabase é exatamente "avatars" (minúsculo).');
        }
        throw uploadError;
      }

      // Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar imagem');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    
    setIsLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      const { error } = await supabase.auth.updateUser({
        data: { 
          full_name: name,
          avatar_url: avatarUrl,
          phone: phone
        }
      });
      
      if (error) throw error;
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar perfil');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
          />
          
          {/* Sidebar */}
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl z-[101] overflow-y-auto"
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-text-main uppercase tracking-tight">Meu Perfil</h2>
                <button 
                  onClick={onClose}
                  className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-text-main transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* User Avatar Display */}
              <div className="flex flex-col items-center mb-10">
                <div className="relative group">
                  <div className="w-28 h-28 rounded-3xl border-4 border-brand-primary/20 p-1 bg-white shadow-xl overflow-hidden relative">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-2xl" />
                    ) : (
                      <div className="w-full h-full bg-slate-50 flex items-center justify-center text-brand-primary rounded-2xl">
                        <User size={40} />
                      </div>
                    )}
                    
                    {/* Upload Overlay */}
                    <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer rounded-2xl">
                      {isUploading ? (
                        <Loader2 size={24} className="animate-spin" />
                      ) : (
                        <>
                          <Camera size={24} />
                          <span className="text-[10px] font-black uppercase mt-1">Alterar</span>
                        </>
                      )}
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                      />
                    </label>
                  </div>
                  
                  {isUploading && (
                    <div className="absolute -bottom-2 bg-brand-primary text-white text-[8px] font-black uppercase px-2 py-1 rounded-full shadow-lg">
                      Enviando...
                    </div>
                  )}
                </div>
                <h3 className="mt-4 text-xl font-bold text-text-main text-center">{name || 'Usuário'}</h3>
                <p className="text-slate-400 text-sm font-medium">{user?.email}</p>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest pl-2">Nome Completo</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      <User size={16} />
                    </div>
                    <input 
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-12 pl-12 pr-4 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-primary transition-all"
                      placeholder="Seu nome"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest pl-2">URL da Foto (ou use o upload acima)</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      <Camera size={16} />
                    </div>
                    <input 
                      type="url"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      className="w-full h-12 pl-12 pr-4 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-primary transition-all"
                      placeholder="https://exemplo.com/foto.jpg"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest pl-2">Telefone/Contato</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      <Smartphone size={16} />
                    </div>
                    <input 
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full h-12 pl-12 pr-4 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-primary transition-all"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-bold flex items-center gap-3">
                    <AlertCircle size={16} />
                    <p>{error}</p>
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 text-green-600 p-4 rounded-xl text-xs font-bold flex items-center gap-3">
                    <CheckCircle2 size={16} />
                    <p>Perfil atualizado com sucesso!</p>
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-14 bg-brand-primary text-white rounded-xl font-black uppercase tracking-widest shadow-lg shadow-brand-primary/20 hover:bg-brand-primary/90 transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <Save size={18} />
                      <span>Salvar Alterações</span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-12 pt-8 border-t border-slate-100 italic text-center">
                <p className="text-slate-300 text-[10px] font-medium leading-relaxed uppercase tracking-widest">
                  Sistema de Gestão Cedro<br />Transportes & Logística
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
