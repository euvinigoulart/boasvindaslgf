import { useState, useEffect, useRef, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, Trash2, Users, Calendar, Heart, CheckCircle2, RefreshCw, Instagram, Youtube, Search, Download, FileText } from 'lucide-react';
import { format, addDays, nextSunday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast, { Toaster } from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(() => {
    const saved = localStorage.getItem('lgf_selected_service_id');
    return saved ? parseInt(saved) : null;
  });
  const [name, setName] = useState(() => localStorage.getItem('lgf_user_name') || '');
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

  useEffect(() => {
    if (selectedServiceId) {
      localStorage.setItem('lgf_selected_service_id', selectedServiceId.toString());
    } else {
      localStorage.removeItem('lgf_selected_service_id');
    }
  }, [selectedServiceId]);

  useEffect(() => {
    localStorage.setItem('lgf_user_name', name);
  }, [name]);

  // Lógica para garantir que sempre haja um culto selecionado e que ele seja válido
  useEffect(() => {
    if (services.length > 0) {
      const serviceExists = services.some(s => s.id === selectedServiceId);
      if (!selectedServiceId || !serviceExists) {
        setSelectedServiceId(services[0].id);
      }
    }
  }, [services, selectedServiceId]);
  
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
  const [searchTerm, setSearchTerm] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (isIOS) {
        toast('Para instalar no iPhone/iPad:\n1. Toque no ícone de Compartilhar (quadrado com seta)\n2. Role para baixo e toque em "Adicionar à Tela de Início"', {
          duration: 6000,
          icon: '📱'
        });
      } else {
        toast('O aplicativo já está instalado ou seu navegador não suporta a instalação automática. Acesse as opções do navegador para instalar.', {
          duration: 5000,
          icon: 'ℹ️'
        });
      }
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  useEffect(() => {
    fetchData();
    fetchVerse();
    
    // Set up polling every 5 seconds for faster updates
    const interval = setInterval(() => {
      fetchData(true); // silent fetch
      fetchVerse();    // check if verse needs update (day change)
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const fetchVerse = () => {
    // Lista de 40 versículos sobre servir para rotação diária
    const dailyVerses = [
      { text: "Pois nem mesmo o Filho do homem veio para ser servido, mas para servir e dar a sua vida em resgate por muitos.", reference: "Marcos 10:45" },
      { text: "Sirvam uns aos outros mediante o amor.", reference: "Gálatas 5:13" },
      { text: "Cada um exerça o dom que recebeu para servir os outros, administrando fielmente a graça de Deus em suas múltiplas formas.", reference: "1 Pedro 4:10" },
      { text: "Tudo o que fizerem, façam de todo o coração, como para o Senhor, e não para os homens.", reference: "Colossenses 3:23" },
      { text: "Sirvam ao Senhor com alegria; apresentem-se diante dele com cânticos de júbilo.", reference: "Salmos 100:2" },
      { text: "Quem quiser ser o primeiro entre vocês deverá ser escravo de todos.", reference: "Marcos 10:44" },
      { text: "Não sejam vãos no zelo, mas fervorosos no espírito, servindo ao Senhor.", reference: "Romanos 12:11" },
      { text: "Se alguém me serve, siga-me; e, onde eu estiver, ali estará também o meu servo. Se alguém me servir, meu Pai o honrará.", reference: "João 12:26" },
      { text: "Aquele que serve a Cristo é agradável a Deus e aprovado pelos homens.", reference: "Romanos 14:18" },
      { text: "Sejam sempre dedicados à obra do Senhor, pois vocês sabem que, no Senhor, o trabalho de vocês não será inútil.", reference: "1 Coríntios 15:58" },
      { text: "Mas eu estou entre vocês como quem serve.", reference: "Lucas 22:27" },
      { text: "Sirvam de boa vontade, como se estivessem servindo ao Senhor, e não aos homens.", reference: "Efésios 6:7" },
      { text: "O maior entre vocês deverá ser servo.", reference: "Mateus 23:11" },
      { text: "Deus não se esquecerá do trabalho de vocês e do amor que demonstraram por ele, pois ajudaram o povo santo.", reference: "Hebreus 6:10" },
      { text: "Se alguém serve, faça-o com a força que Deus provê, de forma que em todas as coisas Deus seja glorificado.", reference: "1 Pedro 4:11" },
      { text: "Escolham hoje a quem irão servir... Mas, eu e a minha família serviremos ao Senhor.", reference: "Josué 24:15" },
      { text: "Aquele que é fiel no pouco, também é fiel no muito.", reference: "Lucas 16:10" },
      { text: "Não servindo apenas quando vigiados, mas como escravos de Cristo, fazendo de coração a vontade de Deus.", reference: "Efésios 6:6" },
      { text: "Assim, brilhe a luz de vocês diante dos homens, para que vejam as suas boas obras e glorifiquem ao Pai.", reference: "Mateus 5:16" },
      { text: "Sempre que o fizeram a um destes meus irmãos mais pequeninos, a mim o fizeram.", reference: "Mateus 25:40" },
      { text: "Enquanto temos oportunidade, façamos o bem a todos, especialmente aos da família da fé.", reference: "Gálatas 6:10" },
      { text: "Não nos cansemos de fazer o bem, pois no tempo próprio colheremos, se não desanimarmos.", reference: "Gálatas 6:9" },
      { text: "Somos feitura dele, criados em Cristo Jesus para as boas obras, as quais Deus preparou de antemão.", reference: "Efésios 2:10" },
      { text: "Quem é o maior: o que está à mesa ou o que serve? Mas eu estou entre vós como quem serve.", reference: "Lucas 22:27" },
      { text: "Não usem a liberdade como ocasião para a carne; antes, sirvam uns aos outros pelo amor.", reference: "Gálatas 5:13" },
      { text: "Se alguém quer ser o primeiro, será o último de todos e o servo de todos.", reference: "Marcos 9:35" },
      { text: "Ninguém pode servir a dois senhores; pois ou há de odiar um e amar o outro.", reference: "Mateus 6:24" },
      { text: "Sirvam ao Senhor com temor e alegrem-se com tremor.", reference: "Salmos 2:11" },
      { text: "Onde eu estiver, ali estará também o meu servo.", reference: "João 12:26" },
      { text: "Pois o Filho do Homem não veio para ser servido, mas para servir.", reference: "Mateus 20:28" },
      { text: "Se eu, pois, sendo Senhor e Mestre, vos lavei os pés, também vós deveis lavar os pés uns aos outros.", reference: "João 13:14" },
      { text: "Porque vos dei o exemplo, para que, como eu vos fiz, façais vós também.", reference: "João 13:15" },
      { text: "Em verdade, em verdade vos digo que o servo não é maior do que o seu senhor.", reference: "João 13:16" },
      { text: "Se sabeis estas coisas, bem-aventurados sois se as praticardes.", reference: "João 13:17" },
      { text: "Servi ao Senhor com todo o vosso coração.", reference: "1 Samuel 12:20" },
      { text: "Somente temei ao Senhor, e servi-o fielmente com todo o vosso coração.", reference: "1 Samuel 12:24" },
      { text: "Amai, e sirvas ao Senhor teu Deus com todo o teu coração e com toda a tua alma.", reference: "Deuteronômio 10:12" },
      { text: "E tudo o que fizerdes, fazei-o em nome do Senhor Jesus, dando por ele graças a Deus Pai.", reference: "Colossenses 3:17" },
      { text: "Servi uns aos outros conforme o dom que cada um recebeu.", reference: "1 Pedro 4:10" },
      { text: "Aquele que serve a Cristo nestas coisas é agradável a Deus.", reference: "Romanos 14:18" }
    ];

    // Usa o dia do ano para selecionar o versículo (muda a cada 24h)
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    
    const index = dayOfYear % dailyVerses.length;
    setVerse(dailyVerses[index]);
  };

  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxin3v_CEMXweTsVG44Fo2J7Wzu9biukv8SGVavHuoKPVJGh5_OahRMRwXTQhR_smWn/exec';

  // Improved fetch for Google Script with retry logic
  const fetchFromScript = async (action: string, payload: any = {}, retries = 2) => {
    const url = new URL(SCRIPT_URL);
    url.searchParams.append('action', action);
    url.searchParams.append('_t', Date.now().toString());
    
    Object.keys(payload).forEach(key => {
      url.searchParams.append(key, payload[key]);
    });
    
    let lastError: any;
    for (let i = 0; i <= retries; i++) {
      try {
        const res = await fetch(url.toString(), {
          method: 'GET',
          cache: 'no-cache',
          mode: 'cors',
          redirect: 'follow'
        });
        
        if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);
        
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        return json.data;
      } catch (e: any) {
        lastError = e;
        console.error(`Tentativa ${i + 1} falhou:`, e);
        if (i < retries) {
          // Espera um pouco antes de tentar novamente (backoff simples)
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }
    
    // Se chegou aqui, todas as tentativas falharam
    if (lastError && lastError.message === 'Failed to fetch') {
      throw new Error('Não foi possível conectar ao Google Script. Isso geralmente é causado por bloqueio de CORS ou o Script não estar publicado como "Qualquer pessoa".');
    }
    throw lastError || new Error('Erro desconhecido ao conectar com o servidor.');
  };

  const [isRetrying, setIsRetrying] = useState(false);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    if (silent) setIsRetrying(true);
    try {
      const servicesData = await fetchFromScript('getServices');
      const volunteersData = await fetchFromScript('getVolunteers');
      
      setServices(servicesData);
      setVolunteers(volunteersData);
      setLastUpdated(new Date());
    } catch (error: any) {
      console.error('Erro no fetchData:', error);
      if (!silent) {
        const msg = error.message || 'Erro desconhecido';
        if (msg.includes('Failed to fetch') || msg.includes('conectar ao Google Script')) {
          toast.error('Falha na conexão: Verifique se o Google Script está publicado corretamente como "Qualquer pessoa".', { duration: 6000 });
        } else {
          toast.error(`Erro: ${msg}`);
        }
      }
    } finally {
      if (!silent) setLoading(false);
      setIsRetrying(false);
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

    // Verificar nomes duplicados no mesmo culto
    const isDuplicate = volunteers.some(v => 
      v.service_id === selectedServiceId && 
      v.name.trim().toLowerCase() === name.trim().toLowerCase()
    );

    if (isDuplicate) {
      toast.error('Este nome já está inscrito para este culto');
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
    // Segurança adicional: verificar se o usuário tem permissão para excluir este ID
    if (!isAdmin && !myRegistrationIds.includes(id)) {
      toast.error('Você só pode remover sua própria inscrição.');
      return;
    }

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

  const filteredVolunteers = volunteers
    .filter(v => v.service_id === selectedServiceId)
    .filter(v => (v.name || '').toLowerCase().includes(searchTerm.toLowerCase()));

  const currentService = services.find(s => s.id === selectedServiceId);

  const exportToPDF = () => {
    if (!currentService) return;

    const doc = new jsPDF();
    const dateStr = safeFormat(currentService.date, "dd/MM/yyyy");
    const volunteersList = filteredVolunteers.map((v, i) => [i + 1, v.name || 'Voluntário', safeFormat(v.created_at, "HH:mm")]);

    // Header
    doc.setFontSize(20);
    doc.setTextColor(40);
    doc.text('Igreja LGF - Ministério de Boas Vindas', 14, 22);
    
    doc.setFontSize(14);
    doc.text(`Lista de Voluntários - Culto: ${dateStr}`, 14, 32);
    
    if (currentService.description) {
      doc.setFontSize(10);
      doc.text(`Descrição: ${currentService.description}`, 14, 38);
    }

    // Table
    autoTable(doc, {
      startY: 45,
      head: [['#', 'Nome do Voluntário', 'Horário de Inscrição']],
      body: volunteersList,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] }, // Blue-500
      styles: { fontSize: 10, cellPadding: 3 },
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")} - Página ${i} de ${pageCount}`,
        14,
        doc.internal.pageSize.getHeight() - 10
      );
    }

    doc.save(`voluntarios_lgf_${dateStr.replace(/\//g, '-')}.pdf`);
    toast.success('PDF gerado com sucesso!');
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    return name
      .trim()
      .split(/\s+/)
      .filter(n => n.length > 0)
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';
  };

  const getAvatarColor = (name: string) => {
    if (!name) return 'bg-stone-500';
    const colors = [
      'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 
      'bg-amber-500', 'bg-rose-500', 'bg-indigo-500',
      'bg-cyan-500', 'bg-teal-500'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getVolunteerCount = (serviceId: number) => {
    return volunteers.filter(v => v.service_id === serviceId).length;
  };

  return (
    <div className="min-h-screen pb-12">
      <Toaster 
        position="top-center" 
        toastOptions={{
          style: {
            background: '#1a1a1a',
            color: '#fff',
            border: '1px solid #262626',
          },
        }}
      />
      
      {/* Top Bar - Discrete Admin Access */}
      <div className="absolute top-0 left-0 w-full z-50 px-6 py-4 flex justify-between items-center">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 bg-black/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/5"
        >
          <div className={`w-1.5 h-1.5 rounded-full ${services.length > 0 ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
          <span className="text-[9px] uppercase tracking-widest font-bold text-white/60">
            {services.length > 0 ? format(lastUpdated, "HH:mm:ss") : 'Erro de Conexão'}
          </span>
          <button 
            onClick={() => fetchData()} 
            disabled={loading || isRetrying}
            className="ml-1 p-1 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
            title="Tentar reconectar"
          >
            <RefreshCw className={`w-3 h-3 text-white/40 ${isRetrying ? 'animate-spin' : ''}`} />
          </button>
        </motion.div>

        <div className="flex items-center gap-4">
          {!isAdmin && !showPasswordInput && (
            <button 
              onClick={() => setShowPasswordInput(true)}
              className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40 hover:text-white/90 transition-colors"
            >
              Admin
            </button>
          )}

          {showPasswordInput && (
            <motion.form 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onSubmit={handleAdminAuth}
              className="flex items-center gap-2 bg-black/20 backdrop-blur-md p-1 rounded-full border border-white/10"
            >
              <input 
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Senha"
                autoFocus
                className="bg-transparent text-white px-4 py-1 text-[10px] outline-none placeholder:text-white/30 w-24"
              />
              <button 
                type="submit"
                className="bg-white/90 text-stone-900 px-3 py-1 rounded-full text-[10px] font-bold hover:bg-white transition-all"
              >
                Ok
              </button>
              <button 
                type="button"
                onClick={() => setShowPasswordInput(false)}
                className="text-white/40 hover:text-white px-2 text-[10px]"
              >
                X
              </button>
            </motion.form>
          )}

          {isAdmin && (
            <div className="flex items-center gap-3 bg-blue-500/20 backdrop-blur-md px-3 py-1 rounded-full border border-blue-500/30">
              <span className="text-white text-[9px] font-bold uppercase tracking-wider">
                Modo Admin
              </span>
              <button 
                onClick={logoutAdmin}
                className="text-[9px] text-white/70 hover:text-white underline underline-offset-2 uppercase font-bold"
              >
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Hero Section */}
      <header className="relative min-h-[50vh] flex items-center justify-center bg-brand-primary text-white py-20">
        <div className="absolute inset-0">
          <img 
            src="https://i.ibb.co/32N5Cz7/5aac0e57-9616-450f-babe-14709ced85c4.jpg" 
            alt="Equipe LGF" 
            className="w-full h-full object-cover opacity-40 scale-105"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black" />
        </div>
        
        <div className="relative z-10 text-center px-4 flex flex-col items-center max-w-4xl">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center gap-6"
          >
            <div className="relative flex flex-col items-center gap-4">
              <div className="relative">
                <div className="absolute -inset-1 bg-blue-500 rounded-full blur opacity-20 animate-pulse" />
                <img 
                  src="https://i.ibb.co/PZwVw9jN/images.jpg" 
                  alt="Logo LGF"
                  className="relative w-20 h-20 md:w-24 md:h-24 rounded-full border-2 border-white/30 shadow-2xl object-cover bg-stone-900 p-1"
                />
              </div>
              <div className="flex items-center justify-center gap-3">
                <div className="h-px w-6 bg-blue-500/30" />
                <span className="text-xs md:text-sm uppercase tracking-[0.4em] font-bold text-blue-400">Igreja LGF</span>
                <div className="h-px w-6 bg-blue-500/30" />
              </div>
            </div>
            
            <div className="space-y-4">
              <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl tracking-tight leading-none">
                Ministério de <span className="italic font-light">Boas Vindas</span>
              </h1>
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm md:text-base font-medium text-white/60 uppercase tracking-[0.2em]">
                  Pr. Moisés & Pr. Pamela
                </p>
                <div className="h-px w-12 bg-blue-500/20" />
              </div>
            </div>

            <div className="h-4" />
          </motion.div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 -mt-8 relative z-20">
        {/* Versículo do Dia */}
        <AnimatePresence>
          {verse && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 bg-stone-900/80 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-xl border border-stone-800 text-center relative overflow-hidden group"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
              <div className="relative z-10">
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-stone-500 mb-3 block">Versículo do Dia</span>
                <p className="font-serif text-xl md:text-2xl text-stone-100 italic leading-relaxed mb-4">
                  "{verse.text}"
                </p>
                <div className="flex items-center justify-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-widest">
                  <div className="h-px w-4 bg-blue-500/30" />
                  {verse.reference}
                  <div className="h-px w-4 bg-blue-500/30" />
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
                  <Calendar className="w-6 h-6 text-blue-400" />
                  <h2 className="text-xl font-semibold">Novo Culto</h2>
                </div>
                <form onSubmit={handleServiceSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Data do Culto</label>
                    <input
                      type="date"
                      value={newServiceDate}
                      onChange={(e) => setNewServiceDate(e.target.value)}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Vagas Disponíveis</label>
                    <input
                      type="number"
                      value={newServiceCapacity}
                      onChange={(e) => setNewServiceCapacity(parseInt(e.target.value))}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
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
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                className="bg-stone-900 rounded-3xl p-8 shadow-xl border border-stone-800"
              >
                <div className="flex items-center gap-3 mb-6 text-stone-100">
                  <UserPlus className="w-6 h-6 text-white" />
                  <h2 className="text-xl font-semibold">Inscrever-se</h2>
                </div>
                
                <form onSubmit={handleVolunteerSubmit} className="space-y-6">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">Selecione o Culto</label>
                    <select 
                      value={selectedServiceId || ''} 
                      onChange={(e) => setSelectedServiceId(parseInt(e.target.value))}
                      className="w-full px-4 py-3 rounded-xl border border-stone-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none bg-stone-800 text-white"
                      required
                    >
                      <option value="" disabled className="bg-stone-900">Escolha uma data...</option>
                      {services.map(s => {
                        const count = getVolunteerCount(s.id);
                        return (
                          <option key={s.id} value={s.id} disabled={count >= s.capacity} className="bg-stone-900">
                            {safeFormat(s.date, "dd/MM")} - {s.description || 'Culto'} ({s.capacity - count} vagas)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">Seu Nome Completo</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: João Silva"
                      className="w-full px-4 py-3 rounded-xl border border-stone-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-stone-800 text-white"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !selectedServiceId || (currentService && currentService.volunteer_count >= currentService.capacity)}
                    className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-500 disabled:bg-stone-800 disabled:text-stone-500 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 group shadow-lg"
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
          <div className="lg:col-span-8 space-y-8 order-2 lg:row-span-2">
            {/* Service Tabs */}
            <div className="flex gap-4 overflow-x-auto pb-6 pt-2 px-1 custom-scrollbar">
              {services.map(s => {
                const count = getVolunteerCount(s.id);
                const isSelected = selectedServiceId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedServiceId(s.id)}
                    className={`flex-shrink-0 px-8 py-6 rounded-[2.5rem] border transition-all text-left min-w-[220px] relative overflow-hidden group ${
                      isSelected 
                        ? 'bg-stone-900 border-blue-500 shadow-2xl scale-[1.02] z-10' 
                        : 'bg-stone-900/40 border-stone-800 text-stone-500 hover:bg-stone-800 hover:border-stone-700'
                    }`}
                  >
                    {isSelected && (
                      <motion.div 
                        layoutId="active-tab-indicator"
                        className="absolute top-0 left-0 w-full h-1.5 bg-blue-500"
                      />
                    )}
                    <div className={`text-[10px] font-bold uppercase tracking-[0.25em] mb-1 ${isSelected ? 'text-blue-400' : 'text-stone-500'}`}>
                      {safeFormat(s.date, "MMMM", { locale: ptBR })} • {safeFormat(s.date, "EEEE", { locale: ptBR })} • {safeFormat(s.date, "dd/MM")}
                    </div>
                    <div className={`text-2xl font-serif font-bold leading-tight mb-4 ${isSelected ? 'text-white' : 'text-stone-400'}`}>
                      {s.description || 'Culto de Celebração'}
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-stone-800 rounded-full mb-6 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((count / (s.capacity || 1)) * 100, 100)}%` }}
                        className={`h-full rounded-full transition-all duration-1000 ${
                          count >= s.capacity ? 'bg-red-500' : count >= s.capacity * 0.8 ? 'bg-amber-500' : 'bg-blue-500'
                        }`}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-stone-800/50">
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${count >= s.capacity ? 'text-red-400' : 'text-blue-400'}`}>
                        {count >= s.capacity ? 'Indisponível' : 'Disponível'}
                      </div>
                      <div className={`text-xs font-bold px-3 py-1 rounded-full ${count >= s.capacity ? 'bg-red-900/40 text-red-400' : 'bg-blue-900/40 text-blue-400'}`}>
                        {count}/{s.capacity}
                      </div>
                    </div>

                    {isAdmin && (
                    <div className={`flex items-center gap-2 mt-4 pt-4 border-t border-stone-800`}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); updateCapacity(s.id, s.capacity); }}
                          className="p-2 hover:bg-stone-800 rounded-full text-stone-500 hover:text-white transition-colors"
                          title="Editar vagas"
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); removeService(s.id); }}
                          className="p-2 hover:bg-red-900/20 rounded-full text-red-400 hover:text-red-300 transition-colors"
                          title="Excluir culto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </button>
                );
              })}
              {services.length === 0 && (
                <div className="text-stone-500 italic py-8 px-4 bg-stone-900/40 rounded-3xl w-full text-center border border-dashed border-stone-800">
                  Nenhum culto agendado para os próximos dias.
                </div>
              )}
            </div>

            {/* Volunteers List */}
            <motion.div 
              key={selectedServiceId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-stone-900/80 backdrop-blur-md rounded-[3rem] p-8 md:p-12 shadow-2xl border border-stone-800 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-32 -mt-32 opacity-50" />
              
              <div className="relative z-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-stone-800 rounded-2xl">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                      <h2 className="text-3xl font-serif font-bold text-white">Voluntários Inscritos</h2>
                    </div>
                    <p className="text-stone-400 text-sm max-w-md">
                      {currentService 
                        ? `Lista de presença para o culto de ${safeFormat(currentService.date, "dd/MM")}.` 
                        : 'Selecione um culto para ver os inscritos.'}
                    </p>
                  </div>
                  
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      {isAdmin && (
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                            <input
                              type="text"
                              placeholder="Buscar voluntário..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="pl-10 pr-4 py-2 bg-stone-800/50 border border-stone-700 rounded-2xl text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all w-full md:w-64"
                            />
                          </div>
                          <button
                            onClick={exportToPDF}
                            className="flex items-center gap-2 bg-stone-800 hover:bg-stone-700 text-stone-300 px-4 py-2 rounded-2xl border border-stone-700 transition-all text-sm font-bold shadow-lg"
                            title="Exportar para PDF"
                          >
                            <Download className="w-4 h-4" />
                            <span className="hidden sm:inline">PDF</span>
                          </button>
                        </div>
                      )}
                      
                      {currentService && (
                        <div className="bg-stone-800/50 px-6 py-4 rounded-[2rem] border border-stone-800 flex items-center gap-8">
                          <div className="text-center">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Inscritos</div>
                            <div className="text-2xl font-serif font-bold text-white">{volunteers.filter(v => v.service_id === selectedServiceId).length}</div>
                          </div>
                          <div className="w-px h-8 bg-stone-700" />
                          <div className="text-center">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Disponíveis</div>
                            <div className="text-2xl font-serif font-bold text-blue-400">{currentService.capacity - volunteers.filter(v => v.service_id === selectedServiceId).length}</div>
                          </div>
                        </div>
                      )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AnimatePresence mode="popLayout">
                    {filteredVolunteers.map((v, index) => (
                      <motion.div
                        key={v.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ delay: index * 0.03 }}
                        className={`group flex items-center justify-between p-5 rounded-[2rem] border transition-all ${
                          myRegistrationIds.includes(v.id) 
                            ? 'bg-blue-900/20 border-blue-500/30' 
                            : 'bg-stone-800/30 border-stone-800 hover:bg-stone-800 hover:border-stone-700 hover:shadow-lg'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shadow-inner ${
                            myRegistrationIds.includes(v.id) 
                              ? 'bg-blue-600 text-white ring-2 ring-blue-400/30' 
                              : `${getAvatarColor(v.name)} text-white`
                          }`}>
                            {getInitials(v.name)}
                          </div>
                          <div>
                            <div className="font-bold text-stone-100 flex items-center gap-2">
                              {v.name || 'Voluntário'}
                              {myRegistrationIds.includes(v.id) && (
                                <CheckCircle2 className="w-4 h-4 text-blue-500" />
                              )}
                            </div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                              Inscrito às {safeFormat(v.created_at, "HH:mm")}
                            </div>
                          </div>
                        </div>
                        
                        {(isAdmin || myRegistrationIds.includes(v.id)) && (
                          <button
                            onClick={() => removeVolunteer(v.id)}
                            className={`p-2 rounded-full transition-all ${
                              myRegistrationIds.includes(v.id) 
                                ? 'text-red-400 bg-red-900/10 opacity-100' 
                                : 'text-stone-600 hover:text-red-400 hover:bg-red-900/30 opacity-0 group-hover:opacity-100'
                            }`}
                            title="Remover inscrição"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {filteredVolunteers.length === 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-20 text-center"
                  >
                    <div className="w-20 h-20 bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Users className="w-8 h-8 text-stone-600" />
                    </div>
                    <h3 className="text-xl font-serif font-bold text-white mb-2">Nenhum voluntário ainda</h3>
                    <p className="text-stone-400 text-sm">Seja o primeiro a se inscrever para este culto!</p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Guidelines Section */}
          <div className="lg:col-span-4 space-y-6 order-3">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-stone-900 rounded-[2.5rem] p-8 md:p-10 border border-stone-800 shadow-xl"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-blue-900/30 rounded-xl">
                  <CheckCircle2 className="w-6 h-6 text-blue-400" />
                </div>
                <h2 className="text-xl font-serif font-bold text-white">Informações para Servir</h2>
              </div>
              
              <div className="space-y-8">
                {[
                  { id: '01', text: 'Sirva sempre com excelência, postura e respeito. Seu comportamento representa Jesus.' },
                  { id: '02', text: 'Deve-se utilizar camiseta ou camisa preta, com calça comum que não seja justa ou transparente. Mulheres que optarem por usar legging devem obrigatoriamente usar camiseta longa, cobrindo o quadril e o bumbum. O padrão de vestimenta deve transmitir respeito, organização e postura, refletindo excelência no servir.' },
                  { id: '03', text: 'Esteja atento às orientações do seu líder e execute exatamente o que for direcionado.' },
                  { id: '04', text: 'Na dúvida, não tome decisões por conta própria. Pergunte antes de agir.' },
                  { id: '05', text: 'Cuide do seu corpo: beba água e se alimente bem para manter disposição.' },
                  { id: '06', text: 'Esteja preparado espiritualmente para servir com propósito e amor.' }
                ].map((item) => (
                  <div key={item.id} className="flex gap-5 group">
                    <div className="flex-shrink-0 w-10 h-10 bg-stone-800 rounded-2xl flex items-center justify-center border border-stone-700 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                      <span className="text-xs font-bold text-stone-300 group-hover:text-white">{item.id}</span>
                    </div>
                    <p className="text-sm text-stone-400 leading-relaxed group-hover:text-stone-200 transition-colors">
                      {item.text}
                    </p>
                  </div>
                ))}

                <div className="pt-10 border-t border-stone-800 flex flex-col items-center">
                  <Heart className="w-4 h-4 text-blue-500/40 mb-4" />
                  <p className="text-sm md:text-base italic text-stone-200 text-center font-serif leading-relaxed tracking-wide max-w-xs mx-auto">
                    "Servir não é apenas fazer, é fazer com intenção e coração alinhado."
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Social Media Buttons at the end of main */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-12 flex flex-col items-center gap-6"
            >
              <p className="text-xs uppercase tracking-[0.3em] font-bold text-stone-500">Acompanhe nossa igreja</p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <a 
                  href="https://www.instagram.com/lgf_lugardegentefeliz/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-[#E1306C] hover:bg-[#C13584] text-white px-8 py-4 rounded-full transition-all group shadow-2xl hover:scale-105 active:scale-95"
                >
                  <Instagram className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                  <span className="text-sm uppercase tracking-widest font-bold">Seguir no Instagram</span>
                </a>
                <a 
                  href="https://www.youtube.com/@lugardegentefeliz" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-[#FF0000] hover:bg-[#CC0000] text-white px-8 py-4 rounded-full transition-all group shadow-2xl hover:scale-105 active:scale-95"
                >
                  <Youtube className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                  <span className="text-sm uppercase tracking-widest font-bold">Inscrever no YouTube</span>
                </a>

                <button 
                  onClick={handleInstallClick}
                  className="flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full transition-all group shadow-2xl hover:scale-105 active:scale-95"
                >
                  <Download className="w-6 h-6 group-hover:bounce transition-transform" />
                  <span className="text-sm uppercase tracking-widest font-bold">Instalar Aplicativo LGF</span>
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      <footer className="mt-20 pb-12 text-center flex flex-col items-center gap-6">
        <div className="max-w-xs mx-auto w-full h-px bg-gradient-to-r from-transparent via-stone-800 to-transparent" />
        <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-stone-500">
          © {new Date().getFullYear()} Igreja LGF — Ministério de Boas Vindas
        </p>
      </footer>
    </div>
  );
}
