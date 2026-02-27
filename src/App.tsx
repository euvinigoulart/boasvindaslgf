import { useState, useEffect, useRef, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, Trash2, Users, Calendar, Heart, CheckCircle2, RefreshCw } from 'lucide-react';
import { format, addDays, nextSunday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast, { Toaster } from 'react-hot-toast';

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

  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetchData();
    setupWebSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const setupWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'VOLUNTEER_ADDED') {
        setVolunteers((prev) => {
          if (prev.find(v => v.id === data.payload.id)) return prev;
          return [data.payload, ...prev];
        });
        toast.success(`${data.payload.name} entrou na lista!`, { icon: '🙌' });
      } else if (data.type === 'VOLUNTEER_REMOVED') {
        setVolunteers((prev) => prev.filter((v) => v.id !== data.payload.id));
      } else if (data.type === 'SERVICE_ADDED') {
        setServices((prev) => {
          if (prev.find(s => s.id === data.payload.id)) return prev;
          return [...prev, data.payload].sort((a, b) => a.date.localeCompare(b.date));
        });
      } else if (data.type === 'SERVICE_UPDATED') {
        setServices((prev) => prev.map(s => 
          s.id === data.payload.id 
            ? { ...s, capacity: data.payload.capacity } 
            : s
        ));
      } else if (data.type === 'SERVICE_REMOVED') {
        setServices((prev) => prev.filter((s) => s.id !== data.payload.id));
        if (selectedServiceId === data.payload.id) setSelectedServiceId(null);
      }
    };

    socket.onclose = () => {
      setTimeout(setupWebSocket, 3000);
    };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const servicesRes = await fetch('/api/services');
      if (!servicesRes.ok) throw new Error(`Falha ao carregar cultos: ${servicesRes.status}`);
      const servicesData = await servicesRes.json();
      
      const volunteersRes = await fetch('/api/volunteers');
      if (!volunteersRes.ok) throw new Error(`Falha ao carregar voluntários: ${volunteersRes.status}`);
      const volunteersData = await volunteersRes.json();
      
      setServices(servicesData);
      setVolunteers(volunteersData);
      
      if (servicesData.length > 0 && !selectedServiceId) {
        setSelectedServiceId(servicesData[0].id);
      }
    } catch (error: any) {
      console.error('Erro no fetchData:', error);
      toast.error(error.message || 'Erro de conexão com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleVolunteerSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedServiceId) return;

    const service = services.find(s => s.id === selectedServiceId);
    if (service && service.volunteer_count >= service.capacity) {
      toast.error('Vagas esgotadas para este culto');
      return;
    }

    try {
      const response = await fetch('/api/volunteers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, service_id: selectedServiceId }),
      });

      if (response.ok) {
        setName('');
        toast.success('Inscrição realizada!');
      } else {
        const err = await response.json();
        toast.error(err.error || 'Erro ao realizar inscrição');
      }
    } catch (error) {
      toast.error('Erro de conexão');
    }
  };

  const handleServiceSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newServiceDate || !newServiceCapacity) return;

    try {
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          date: newServiceDate, 
          capacity: newServiceCapacity,
          description: newServiceDesc
        }),
      });

      if (response.ok) {
        setNewServiceDate('');
        setNewServiceCapacity(10);
        setNewServiceDesc('');
        toast.success('Culto adicionado!');
      } else {
        const err = await response.json();
        toast.error(err.error || 'Erro ao adicionar culto');
      }
    } catch (error) {
      toast.error('Erro de conexão');
    }
  };

  const removeVolunteer = async (id: any) => {
    console.log('Attempting to remove volunteer:', id);
    if (!window.confirm('Deseja realmente remover este nome da lista?')) return;
    try {
      const response = await fetch(`/api/volunteers/${id}`, { method: 'DELETE' });
      if (response.ok) {
        toast.success('Removido com sucesso');
      } else {
        const err = await response.json();
        toast.error(err.error || 'Erro ao remover');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Erro de conexão ao tentar remover');
    }
  };

  const removeService = async (id: number) => {
    if (!window.confirm('Remover este culto e todos os seus voluntários?')) return;
    try {
      const response = await fetch(`/api/services/${id}`, { method: 'DELETE' });
      if (response.ok) {
        toast.success('Culto removido');
      } else {
        const err = await response.json();
        toast.error(err.error || 'Erro ao remover culto');
      }
    } catch (error) {
      console.error('Service delete error:', error);
      toast.error('Erro de conexão ao tentar remover culto');
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
      const response = await fetch(`/api/services/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capacity }),
      });
      if (response.ok) toast.success('Vagas atualizadas');
    } catch (error) {
      toast.error('Erro de conexão');
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
            src="https://i.ibb.co/Kz34GxBk/Whats-App-Image-2026-02-27-at-12-14-59.jpg" 
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
            <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-400">Sincronizado em tempo real</span>
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Forms */}
          <div className="lg:col-span-4 space-y-6">
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
                  <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20">
                    Criar Culto
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
                    disabled={!selectedServiceId || (currentService && currentService.volunteer_count >= currentService.capacity)}
                    className="w-full bg-stone-900 text-white py-4 rounded-xl font-semibold hover:bg-stone-800 disabled:bg-stone-200 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 group shadow-lg"
                  >
                    Confirmar Presença
                    <Heart className="w-4 h-4 group-hover:fill-white transition-all" />
                  </button>
                </form>
              </motion.div>
            )}
          </div>

          {/* Right Column: List */}
          <div className="lg:col-span-8 space-y-6">
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
                      {currentService ? `Voluntários (${filteredVolunteers.length}) - ${safeFormat(currentService.date, "dd/MM")}` : 'Selecione um Culto'}
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
                          </div>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
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
