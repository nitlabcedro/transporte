@@ -142,19 +142,25 @@ export default function App() {
  const [isImporting, setIsImporting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [supabaseError, setSupabaseError] = useState(false);
  const [configError, setConfigError] = useState(false);
  const [dbStatus, setDbStatus] = useState<'connected' | 'error' | 'disconnected'>('disconnected');

  // Fetch data on mount
  useEffect(() => {
    if (!supabase) {
      setConfigError(true);
    }
    checkConnection();
    fetchFromSupabase();
  }, []);

  const checkConnection = async () => {
    if (!supabase) {
      setDbStatus('disconnected');
      setConfigError(true);
      return;
    }
    setConfigError(false);
    try {
      const { error } = await supabase.from('extracted_data').select('id').limit(1);
      if (error) {
@@ -1148,13 +1154,12 @@ export default function App() {
      <header className="border-b border-border bg-white sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-primary rounded-xl flex items-center justify-center text-white shadow-lg">
               <FileSpreadsheet size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-brand-primary">Laboratório Cedro</h1>
              <p className="text-[10px] text-brand-accent font-bold uppercase tracking-[0.2em]">Extração de Laudos e Peças</p>
            </div>
            <img 
              src="https://raw.githubusercontent.com/nitlabcedro/assets/refs/heads/main/Ativo%206.png" 
              alt="Laboratório Cedro Logo" 
              className="h-12 object-contain"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="flex items-center gap-6">
@@ -1203,10 +1208,13 @@ export default function App() {
                  <span className="text-[10px] font-black text-red-500 uppercase tracking-widest leading-none">Erro na Nuvem</span>
                </button>
              ) : (
                <div className="hidden lg:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 mr-2">
                <button 
                  onClick={() => setConfigError(true)}
                  className="hidden lg:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 mr-2 hover:bg-slate-100 transition-colors"
                >
                  <Cloud size={14} className="text-slate-400" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Offline</span>
                </div>
                </button>
              )}

              <div className="w-10 h-10 rounded-full border-2 border-brand-primary p-0.5 bg-white">
@@ -1226,6 +1234,44 @@ export default function App() {
      <main className="max-w-7xl mx-auto px-8 py-12">
        {/* Subtle Database Alert */}
        <AnimatePresence>
          {configError && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-8"
            >
              <div className="p-6 bg-orange-50 border-2 border-orange-100 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
                    <Cloud size={24} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-black text-orange-700 uppercase tracking-widest text-xs">Variáveis de Ambiente Ausentes</h3>
                    <p className="text-[11px] text-orange-600 font-bold opacity-80">As chaves do Supabase não foram encontradas. No Netlify, adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      const msg = `Para funcionar no Netlify:\n1. Vá em Site Settings > Environment variables\n2. Adicione:\n   VITE_SUPABASE_URL: Seu URL\n   VITE_SUPABASE_ANON_KEY: Sua chave anon`;
                      alert(msg);
                    }}
                    className="bg-orange-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black hover:bg-orange-700 transition-all uppercase tracking-widest"
                  >
                    COMO CONFIGURAR
                  </button>
                  <button 
                    onClick={() => setConfigError(false)}
                    className="bg-white text-orange-600 border border-orange-200 px-5 py-2.5 rounded-xl text-[10px] font-black hover:bg-orange-50 transition-all uppercase tracking-widest"
                  >
                    OCULTAR
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {supabaseError && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
@@ -1317,10 +1363,7 @@ NOTIFY pgrst, 'reload schema';`;
              className="space-y-12"
            >
              <div className="flex flex-col gap-3 text-center max-w-3xl mx-auto">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-brand-primary uppercase tracking-[0.3em] mx-auto bg-green-50 px-4 py-2 rounded-full border border-green-100">
                  <span className="w-2 h-2 rounded-full bg-brand-primary" />
                  Módulo de Inteligência
                </div>

                <h2 className="text-4xl font-black text-text-main">Converta PDF para Excel agora mesmo</h2>
                <p className="text-text-muted text-lg font-medium opacity-80 leading-relaxed italic">
                  Arraste seus documentos para extração imediata de peças, quantidades e valores no formato oficial Cedro.
@@ -1451,9 +1494,6 @@ NOTIFY pgrst, 'reload schema';`;
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 text-xs font-black text-brand-primary uppercase tracking-[0.2em] bg-green-50 px-3 py-1 rounded border border-green-100">
                    <Activity size={14} /> Inteligência de Dados Cedro
                  </div>
                  <h2 className="text-4xl font-black text-text-main">Gestão Estratégica</h2>
                </div>
                <div className="flex gap-4">
@@ -1878,22 +1918,25 @@ NOTIFY pgrst, 'reload schema';`;
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-8 py-16 border-t border-border flex flex-col md:flex-row justify-between items-center gap-10">
        <div className="flex flex-col items-center md:items-start gap-4">
          <div className="flex items-center gap-3 text-[11px] font-black text-brand-primary uppercase tracking-[0.3em]">
            <div className="w-2.5 h-2.5 rounded-full bg-brand-accent animate-pulse shadow-lg shadow-brand-accent/50" />
            Integridade Cedro Confirmada
      {/* Clean Modern Footer */}
      <footer className="max-w-7xl mx-auto px-8 py-12 mt-20 border-t border-slate-100">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-4">
            <img 
              src="https://raw.githubusercontent.com/nitlabcedro/assets/refs/heads/main/Ativo%206.png" 
              alt="Laboratório Cedro Logo" 
              className="h-10 object-contain grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-500"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="flex flex-col gap-1 text-center md:text-right">
            <div className="flex items-center justify-center md:justify-end gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
              <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em]">Integridade Cedro Confirmada</span>
            </div>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-loose">Laboratório Cedro Nit • 2026</p>
          </div>
          <p className="text-[11px] font-bold text-text-muted opacity-40 uppercase tracking-widest">
            Laboratório Cedro Engine Pro • Licença Ativa
          </p>
        </div>
        
        <div className="bg-brand-primary text-white px-8 py-4 rounded-2xl shadow-xl shadow-brand-primary/10">
           <p className="text-[10px] font-black uppercase tracking-widest text-center">
             Gerado em {new Date().toLocaleDateString('pt-BR')} • Relatório Oficial
           </p>
        </div>
      </footer>
    </div>
