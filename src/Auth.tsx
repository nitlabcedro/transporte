import React, { useState } from 'react';
import { supabase } from './lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Loader2, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

interface AuthProps {
  onSuccess?: () => void;
}

export default function Auth({ onSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (onSuccess) onSuccess();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            },
          },
        });
        if (error) throw error;
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro inesperado');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center py-10 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 overflow-hidden border border-border"
      >
        <div className="p-8 md:p-12">
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary mb-4">
              <User size={32} />
            </div>
            <h2 className="text-3xl font-black text-text-main text-center">
              {isLogin ? 'Bem-vindo de volta' : 'Criar conta'}
            </h2>
            <p className="text-text-muted font-medium text-center mt-2">
              {isLogin ? 'Acesse o sistema Cedro para gerenciar suas extrações' : 'Comece a extrair dados de seus PDFs agora'}
            </p>
          </div>

          {success ? (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-8"
            >
              <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={48} />
              </div>
              <h3 className="text-xl font-bold text-text-main mb-2">E-mail de confirmação enviado!</h3>
              <p className="text-text-muted mb-8">Por favor, verifique sua caixa de entrada para confirmar o seu cadastro.</p>
              <button 
                onClick={() => { setIsLogin(true); setSuccess(false); }}
                className="w-full py-4 bg-brand-primary text-white rounded-2xl font-black uppercase tracking-widest hover:bg-brand-primary/90 transition-all"
              >
                Voltar para o Login
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <AnimatePresence mode="wait">
                {!isLogin && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    key="name-field"
                    className="space-y-2"
                  >
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest pl-2">Nome Completo</label>
                    <div className="relative">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">
                        <User size={18} />
                      </div>
                      <input 
                        type="text"
                        required
                        placeholder="Seu nome"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full h-14 pl-14 pr-6 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand-primary transition-all"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest pl-2">E-mail</label>
                <div className="relative">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Mail size={18} />
                  </div>
                  <input 
                    type="email"
                    required
                    placeholder="exemplo@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-14 pl-14 pr-6 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand-primary transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest pl-2">Senha</label>
                <div className="relative">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock size={18} />
                  </div>
                  <input 
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-14 pl-14 pr-6 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand-primary transition-all"
                  />
                </div>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl text-xs font-bold flex items-center gap-3"
                >
                  <AlertCircle size={16} className="shrink-0" />
                  <p>{error}</p>
                </motion.div>
              )}

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full h-16 bg-brand-primary text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-brand-primary/20 hover:bg-brand-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 mt-4"
              >
                {isLoading ? (
                  <Loader2 size={24} className="animate-spin" />
                ) : (
                  <>
                    <span>{isLogin ? 'Entrar' : 'Cadastrar'}</span>
                    <ArrowRight size={20} />
                  </>
                )}
              </button>

              <div className="text-center mt-8">
                <p className="text-text-muted font-medium text-sm">
                  {isLogin ? 'Não tem uma conta?' : 'Já possui uma conta?'}
                  {' '}
                  <button 
                    type="button"
                    onClick={() => { setIsLogin(!isLogin); setError(null); }}
                    className="text-brand-primary font-black hover:underline"
                  >
                    {isLogin ? 'Cadastre-se' : 'Faça login'}
                  </button>
                </p>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
