import { useState, useEffect, useRef, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, Trash2, Users, Calendar, Heart, CheckCircle2, RefreshCw } from 'lucide-react';
import { format, addDays, nextSunday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast, { Toaster } from 'react-hot-toast';
import { GoogleGenAI } from "@google/genai";

interface Service {
  id: number;
  date: string;
  capacity: number;
  description: string;
  volunteer_count: number;
}

interface Volunteer {
  id: number;
  name: string;
  service_id: number;
  created_at: string;
}

export default function App() {
  const [services, setServices] = useState<Service[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myRegistrationIds, setMyRegistrationIds] = useState<number[]>(() => {
    const saved = localStorage.getItem('lgf_my_registrations');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('lgf_my_registrations', JSON.stringify(myRegistrationIds));
  }, [myRegistrationIds]);
  
  const handleAdminAuth = (e: FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'jesuseocaminho') {
      setIsAdmin(true);
      setShowPasswordInput(false);
      setAdminPassword('');
      toast.success('Acesso concedido');
    } else {
      toast.error('Senha incorreta');
    }
  };

  const logoutAdmin = () => {
    setIsAdmin(false);
    setShowPasswordInput(false);
  };
  
  // Admin form states
  const [newServiceDate, setNewServiceDate] = useState('');
  const [newServiceCapacity, setNewServiceCapacity] = useState(10);
  const [newServiceDesc, setNewServiceDesc] = useState('');

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const [verse, setVerse] = useState<{ text: string; reference: string } | null>(null);

  useEffect(() => {
    fetchData();
    fetchVerse();
    
    // Set up polling every 5 seconds for faster updates
    const interval = setInterval(() => {
      fetchData(true); // silent fetch
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const fetchVerse = async () => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error(AIzaSyAxlZX4sD09Osex92itbzrcFqPwRY989fg);
      
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Qual é o versículo do dia de hoje (data atual) no site bibliaonline.com.br? Pesquise no Google para obter o versículo exato de hoje. Retorne APENAS um JSON com os campos 'text' (o texto do versículo) e 'reference' (livro, capítulo e versículo).",
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
        }
      });
      
      const jsonStr = response.text || '{}';
      const data = JSON.parse(jsonStr);
      
      if (data.text && data.reference) {
        setVerse({
          text: data.text,
          reference: data.reference
        });
      } else {
        throw new Error('Formato de resposta inválido');
      }
    } catch (e) {
      console.error('Erro ao buscar versículo:', e);
      // Fallback caso a API falhe
      setVerse({
        text: "Lâmpada para os meus pés é tua palavra, e luz para o meu caminho.",
        reference: "Salmos 119:105"
      });
    }
  };

  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxin3v_CEMXweTsVG44Fo2J7Wzu9biukv8SGVavHuoKPVJGh5_OahRMRwXTQhR_smWn/exec';

  const callScript = async (action: string, payload: any = {}) => {
    try {
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', // Google Script requires no-cors or specific handling for simple POST
        body: JSON.stringify({ action, ...payload }),
      });
      // Note: with no-cors we can't read the response, but for Google Script 
      // it's often better to use a different approach for GET.
      // Let's use a more robust fetch for Google Script:
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  // Improved fetch for Google Script (Handling the redirect)
  const fetchFromScript = async (action: string, payload: any = {}) => {
    const url = new URL(SCRIPT_URL);
    // For GET actions, we use query params because POST with CORS is tricky on Google Script
    if (action.startsWith('get')) {
      url.searchParams.append('action', action);
      url.searchParams.append('_t', Date.now().toString()); // Evita cache
      if (payload.service_id) url.searchParams.append('service_id', payload.service_id);
      
      const res = await fetch(url.toString());
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      return json.data;
    } else {
      // For POST (mutations)
      const res = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action, ...payload }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      return json.data;
    }
  };

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const servicesData = await fetchFromScript('getServices');
      const volunteersData = await fetchFromScript('getVolunteers');
      
      setServices(servicesData);
      setVolunteers(volunteersData);
      setLastUpdated(new Date());
      
      if (servicesData.length > 0 && !selectedServiceId) {
        setSelectedServiceId(servicesData[0].id);
      }
    } catch (error: any) {
      console.error('Erro no fetchData:', error);
      if (!silent) toast.error('Erro ao conectar com a planilha. Verifique se o Script está publicado como "Qualquer pessoa".');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleVolunteerSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedServiceId || isSubmitting) return;

    const service = services.find(s => s.id === selectedServiceId);
    if (service && service.volunteer_count >= service.capacity) {
      toast.error('Vagas esgotadas para este culto');
      return;
    }

    setIsSubmitting(true);
    try {
      const newVolunteer = await fetchFromScript('addVolunteer', { name, service_id: selectedServiceId });
      setVolunteers(prev => [newVolunteer, ...prev]);
      setMyRegistrationIds(prev => [...prev, newVolunteer.id]);
      setName('');
      toast.success('Inscrição realizada!');
    } catch (error) {
      toast.error('Erro ao realizar inscrição');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleServiceSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newServiceDate || !newServiceCapacity || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const newService = await fetchFromScript('addService', { 
        date: newServiceDate, 
        capacity: newServiceCapacity,
        description: newServiceDesc
      });
      setServices(prev => [...prev, newService].sort((a, b) => a.date.localeCompare(b.date)));
      setNewServiceDate('');
      setNewServiceCapacity(10);
      setNewServiceDesc('');
      toast.success('Culto adicionado!');
    } catch (error) {
      toast.error('Erro ao adicionar culto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeVolunteer = async (id: any) => {
    if (!window.confirm('Deseja realmente remover este nome da lista?')) return;
    try {
      await fetchFromScript('deleteVolunteer', { id });
      setVolunteers(prev => prev.filter(v => v.id !== id));
      setMyRegistrationIds(prev => prev.filter(regId => regId !== id));
      toast.success('Removido com sucesso');
    } catch (error) {
      toast.error('Erro ao remover');
    }
  };

  const removeService = async (id: number) => {
    if (!window.confirm('Remover este culto e todos os seus voluntários?')) return;
    try {
      await fetchFromScript('deleteService', { id });
      setServices(prev => prev.filter(s => s.id !== id));
      setVolunteers(prev => prev.filter(v => v.service_id !== id));
      toast.success('Culto removido');
    } catch (error) {
      toast.error('Erro ao remover culto');
    }
  };

  const updateCapacity = async (id: number, currentCapacity: number) => {
    const newCap = prompt('Nova quantidade de vagas:', currentCapacity.toString());
    if (newCap === null) return;
    const capacity = parseInt(newCap);
    if (isNaN(capacity) || capacity < 1) {
      toast.error('Valor inválido');
      return;
    }
    try {
      await fetchFromScript('updateServiceCapacity', { id, capacity });
      setServices(prev => prev.map(s => s.id === id ? { ...s, capacity } : s));
      toast.success('Vagas atualizadas');
    } catch (error) {
      toast.error('Erro ao atualizar');
    }
  };

  const safeFormat = (dateStr: string | undefined, formatStr: string, options?: any) => {
    if (!dateStr) return 'Data inválida';
    try {
      // Try to handle both ISO strings and YYYY-MM-DD
      const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00');
      if (isNaN(date.getTime())) return 'Data inválida';
      return format(date, formatStr, options);
    } catch (e) {
      return 'Data inválida';
    }
  };

  const filteredVolunteers = volunteers.filter(v => v.service_id === selectedServiceId);
  const currentService = services.find(s => s.id === selectedServiceId);

  const getVolunteerCount = (serviceId: number) => {
    return volunteers.filter(v => v.service_id === serviceId).length;
  };

  return (
    <div className="min-h-screen pb-12">
      <Toaster position="top-center" />
      
      {/* Hero Section */}
      <header className="relative h-[30vh] flex items-center justify-center overflow-hidden bg-stone-900 text-white">
        <div className="absolute inset-0">
          <img 
            src="https://i.ibb.co/32N5Cz7/5aac0e57-9616-450f-babe-14709ced85c4.jpg" 
            alt="Equipe LGF" 
            className="w-full h-full object-cover opacity-50"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-stone-900/40 via-stone-900/20 to-stone-900" />
        </div>
        <div className="relative z-10 text-center px-4 flex flex-col items-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-center gap-4 mb-2"
          >
            <img 
              src="https://i.ibb.co/PZwVw9jN/images.jpg" 
              alt="Logo LGF"
              className="w-12 h-12 md:w-16 md:h-16 rounded-full border-2 border-white/50 shadow-lg object-cover bg-white"
            />
            <h1 className="font-serif text-5xl md:text-6xl">
              Boas Vindas LGF
            </h1>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 bg-emerald-500/20 backdrop-blur-sm px-3 py-1 rounded-full border border-emerald-500/30 mb-4"
          >
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-400">
              Sincronizado: {format(lastUpdated, "HH:mm:ss")}
            </span>
          </motion.div>

          <div className="flex flex-col items-center justify-center gap-4">
            {!isAdmin && !showPasswordInput && (
              <button 
                onClick={() => setShowPasswordInput(true)}
                className="text-xs uppercase tracking-widest px-4 py-2 rounded-full border border-white/30 text-white hover:bg-white hover:text-stone-900 transition-all"
              >
                Acesso Admin
              </button>
            )}

            {showPasswordInput && (
              <motion.form 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleAdminAuth}
                className="flex items-center gap-2 bg-white/10 backdrop-blur-md p-1 rounded-full border border-white/20"
              >
                <input 
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Senha"
                  autoFocus
                  className="bg-transparent text-white px-4 py-1 text-sm outline-none placeholder:text-white/50 w-32"
                />
                <button 
                  type="submit"
                  className="bg-white text-stone-900 px-4 py-1 rounded-full text-xs font-bold hover:bg-stone-200 transition-all"
                >
                  Entrar
                </button>
                <button 
                  type="button"
                  onClick={() => setShowPasswordInput(false)}
                  className="text-white/70 hover:text-white px-2 text-xs"
                >
                  X
                </button>
              </motion.form>
            )}

            {isAdmin && (
              <div className="flex items-center gap-3">
                <span className="bg-emerald-500 text-white text-[10px] font-bold uppercase px-3 py-1 rounded-full shadow-lg shadow-emerald-500/20">
                  Modo Admin Ativo
                </span>
                <button 
                  onClick={logoutAdmin}
                  className="text-xs text-white/70 hover:text-white underline underline-offset-4"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 -mt-8 relative z-20">
        {/* Versículo do Dia */}
        <AnimatePresence>
          {verse && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 bg-white/80 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-xl border border-stone-100 text-center relative overflow-hidden group"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
              <div className="relative z-10">
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-stone-400 mb-3 block">Versículo do Dia</span>
                <p className="font-serif text-xl md:text-2xl text-stone-800 italic leading-relaxed mb-4">
                  "{verse.text}"
                </p>
                <div className="flex items-center justify-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-widest">
                  <div className="h-px w-4 bg-emerald-200" />
                  {verse.reference}
                  <div className="h-px w-4 bg-emerald-200" />
                </div>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                <Heart className="w-32 h-32" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Forms */}
          <div className="lg:col-span-4 space-y-6 order-1">
            {isAdmin ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-stone-900 text-white rounded-3xl p-8 shadow-2xl border border-stone-800"
              >
                <div className="flex items-center gap-3 mb-6">
                  <Calendar className="w-6 h-6 text-emerald-400" />
                  <h2 className="text-xl font-semibold">Novo Culto</h2>
                </div>
                <form onSubmit={handleServiceSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Data do Culto</label>
                    <input
                      type="date"
                      value={newServiceDate}
                      onChange={(e) => setNewServiceDate(e.target.value)}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Vagas Disponíveis</label>
                    <input
                      type="number"
                      value={newServiceCapacity}
                      onChange={(e) => setNewServiceCapacity(parseInt(e.target.value))}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                      min="1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Descrição (Opcional)</label>
                    <input
                      type="text"
                      value={newServiceDesc}
                      onChange={(e) => setNewServiceDesc(e.target.value)}
                      placeholder="Ex: Culto da Família"
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      'Criar Culto'
                    )}
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-3xl p-8 shadow-xl border border-stone-100"
              >
                <div className="flex items-center gap-3 mb-6 text-stone-800">
                  <UserPlus className="w-6 h-6 text-stone-900" />
                  <h2 className="text-xl font-semibold">Inscrever-se</h2>
                </div>
                
                <form onSubmit={handleVolunteerSubmit} className="space-y-6">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">Selecione o Culto</label>
                    <select 
                      value={selectedServiceId || ''} 
                      onChange={(e) => setSelectedServiceId(parseInt(e.target.value))}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none transition-all appearance-none bg-stone-50"
                      required
                    >
                      <option value="" disabled>Escolha uma data...</option>
                      {services.map(s => {
                        const count = getVolunteerCount(s.id);
                        return (
                          <option key={s.id} value={s.id} disabled={count >= s.capacity}>
                            {safeFormat(s.date, "dd/MM")} - {s.description || 'Culto'} ({s.capacity - count} vagas)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">Seu Nome Completo</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: João Silva"
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !selectedServiceId || (currentService && currentService.volunteer_count >= currentService.capacity)}
                    className="w-full bg-stone-900 text-white py-4 rounded-xl font-semibold hover:bg-stone-800 disabled:bg-stone-200 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 group shadow-lg"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        Confirmar Presença
                        <Heart className="w-4 h-4 group-hover:fill-white transition-all" />
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}
          </div>

          {/* Right Column: List */}
          <div className="lg:col-span-8 space-y-6 order-2 lg:row-span-2">
            {/* Service Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {services.map(s => {
                const count = getVolunteerCount(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedServiceId(s.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedServiceId(s.id); }}
                    role="button"
                    tabIndex={0}
                    className={`flex-shrink-0 px-6 py-4 rounded-2xl border transition-all text-left min-w-[160px] cursor-pointer outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-2 ${selectedServiceId === s.id ? 'bg-white border-stone-900 shadow-md' : 'bg-stone-100 border-transparent text-stone-500 hover:bg-stone-200'}`}
                  >
                    <div className="text-xs font-bold uppercase tracking-tighter mb-1">
                      {safeFormat(s.date, "EEEE", { locale: ptBR })}
                    </div>
                    <div className="text-lg font-serif font-bold text-stone-900">
                      {safeFormat(s.date, "dd 'de' MMM", { locale: ptBR })}
                    </div>
                    {s.description && (
                      <div className="text-[10px] font-bold uppercase text-stone-500 mt-1 truncate">
                        {s.description}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] font-bold uppercase opacity-60">Vagas</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${count >= s.capacity ? 'text-red-500' : 'text-emerald-600'}`}>
                          {count}/{s.capacity}
                        </span>
                        {isAdmin && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); updateCapacity(s.id, s.capacity); }}
                            className="p-1 hover:bg-stone-200 rounded text-stone-400 hover:text-stone-900 transition-colors"
                            title="Editar vagas"
                          >
                            <Calendar className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-100">
                        <button 
                          onClick={(e) => { e.stopPropagation(); removeService(s.id); }}
                          className="text-[10px] text-red-400 hover:text-red-600 uppercase font-bold"
                        >
                          Excluir Culto
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {services.length === 0 && (
                <div className="text-stone-400 italic py-4">Nenhum culto agendado.</div>
              )}
            </div>

            {/* Volunteers List */}
            <motion.div 
              key={selectedServiceId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl shadow-xl border border-stone-100 overflow-hidden"
            >
                <div className="flex items-center justify-between p-8 border-b border-stone-50 bg-stone-50/50">
                  <div className="flex items-center gap-3">
                    <Users className="w-6 h-6 text-stone-800" />
                    <h2 className="text-xl font-semibold text-stone-800">
                      {currentService ? `Voluntários: ${filteredVolunteers.length} - ${currentService.description || 'Culto'} e ${safeFormat(currentService.date, "dd/MM")}` : 'Selecione um Culto'}
                    </h2>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={fetchData}
                      className="p-2 text-stone-400 hover:text-stone-900 transition-colors"
                      title="Atualizar lista"
                    >
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    {currentService && (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 bg-stone-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-stone-900 transition-all duration-500" 
                            style={{ width: `${(getVolunteerCount(currentService.id) / currentService.capacity) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-stone-500">
                          {Math.round((getVolunteerCount(currentService.id) / currentService.capacity) * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>

              <div className="divide-y divide-stone-50 pb-32">
                {loading ? (
                  <div className="p-12 text-center text-stone-400">Carregando...</div>
                ) : !selectedServiceId ? (
                  <div className="p-12 text-center text-stone-400">Escolha uma data acima para ver a lista.</div>
                ) : filteredVolunteers.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-stone-500 font-medium">Ninguém inscrito para esta data.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-stone-50">
                    <AnimatePresence initial={false}>
                      {filteredVolunteers.map((volunteer, index) => (
                        <motion.li
                          key={volunteer.id}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="group p-6 hover:bg-stone-50 transition-colors flex items-center justify-between"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 bg-stone-100 rounded-full flex items-center justify-center text-stone-500 text-xs font-bold">
                              {index + 1}
                            </div>
                            <div>
                              <h3 className="font-medium text-stone-900">{volunteer.name}</h3>
                              <p className="text-[10px] text-stone-400 uppercase font-bold">
                                {safeFormat(volunteer.created_at, "HH:mm 'em' dd/MM")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {(isAdmin || myRegistrationIds.includes(volunteer.id)) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeVolunteer(volunteer.id);
                                }}
                                className={`p-2 md:p-3 rounded-xl transition-all flex items-center gap-2 border ${
                                  isAdmin 
                                    ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100' 
                                    : 'bg-stone-50 text-stone-400 border-stone-100 hover:text-red-500 hover:bg-red-50 hover:border-red-100'
                                }`}
                                title="Remover da lista"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span className="text-[10px] font-bold uppercase">
                                  {isAdmin ? 'Excluir' : 'Remover'}
                                </span>
                              </button>
                            )}
                          </div>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
              </div>
            </motion.div>
          </div>

          {/* Guidelines Section (End on mobile, Left col on desktop) */}
          <div className="lg:col-span-4 space-y-6 order-3">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-stone-50 rounded-3xl p-8 border border-stone-200"
            >
              <div className="flex items-center gap-3 mb-6">
                <CheckCircle2 className="w-6 h-6 text-stone-900" />
                <h2 className="text-xl font-semibold text-stone-900">Informações para Servir</h2>
              </div>
              
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm border border-stone-100">
                    <span className="text-xs font-bold">01</span>
                  </div>
                  <p className="text-sm text-stone-600 leading-relaxed">
                    Sirva sempre com <strong className="text-stone-900">excelência, postura e respeito</strong>. Seu comportamento representa <strong className="text-stone-900">Jesus</strong>.
                  </p>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm border border-stone-100">
                    <span className="text-xs font-bold">02</span>
                  </div>
                  <p className="text-sm text-stone-600 leading-relaxed">
                    Deve-se utilizar <strong className="text-stone-900">camiseta ou camisa preta</strong>, com calça comum que não seja justa ou transparente. Mulheres que optarem por usar legging devem obrigatoriamente usar camiseta longa, cobrindo o quadril e o bumbum. O padrão de vestimenta deve transmitir respeito, organização e postura, refletindo excelência no servir.
                  </p>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm border border-stone-100">
                    <span className="text-xs font-bold">03</span>
                  </div>
                  <p className="text-sm text-stone-600 leading-relaxed">
                    Esteja sempre atento às <strong className="text-stone-900">orientações do seu líder</strong> e execute exatamente o que for direcionado.
                  </p>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm border border-stone-100">
                    <span className="text-xs font-bold">04</span>
                  </div>
                  <p className="text-sm text-stone-600 leading-relaxed">
                    Na dúvida, <strong className="text-stone-900">não tome decisões por conta própria</strong>. Pergunte antes de agir.
                  </p>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm border border-stone-100">
                    <span className="text-xs font-bold">05</span>
                  </div>
                  <p className="text-sm text-stone-600 leading-relaxed">
                    <strong className="text-stone-900">Cuide do seu corpo</strong>: beba água e se alimente bem para manter disposição e foco.
                  </p>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm border border-stone-100">
                    <span className="text-xs font-bold">06</span>
                  </div>
                  <p className="text-sm text-stone-600 leading-relaxed">
                    E acima de tudo, <strong className="text-stone-900">carregue uma palavra</strong> — esteja preparado espiritualmente e emocionalmente para servir com propósito.
                  </p>
                </div>

                <div className="pt-4 border-t border-stone-200">
                  <p className="text-xs italic text-stone-500 text-center">
                    "Servir não é apenas fazer, é fazer com intenção, responsabilidade e coração alinhado."
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      <footer className="mt-20 text-center text-stone-400 text-xs uppercase tracking-widest font-bold">
        <p>© {new Date().getFullYear()} Igreja LGF — Ministério de Boas Vindas</p>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 10px; width: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f5f5f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #c1c1ba; border-radius: 10px; border: 2px solid #f5f5f0; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #a1a19a; }
        
        /* Ensure the list is always visible and doesn't hide items */
        .volunteers-list-container {
          min-height: 200px;
        }
      `}</style>
    </div>
  );
}
