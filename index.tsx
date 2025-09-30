import React, { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import Chart from 'chart.js/auto';
import { supabase } from './supabaseClient'; // Importa o cliente Supabase que você criou

// --- TIPOS DE DADOS (ALINHADOS COM O BANCO DE DADOS) --- //
// A estrutura aqui deve corresponder exatamente às colunas das suas tabelas no Supabase.

interface Doctor {
  id: string; // Corresponde a um UUID
  name: string;
  email: string;
  color: string;
  is_admin?: boolean;
}

interface Hospital {
  id: number; // Corresponde a um bigserial (auto-incremento)
  name: string;
}

interface InsurancePlan {
  id: number; // Corresponde a um bigserial
  name: string;
}

interface Surgery {
  id: number; // Corresponde a um bigserial
  patient_name: string;
  main_surgeon_id: string; // Chave estrangeira para o UUID de um Doctor
  participating_ids: string[]; // Um array de UUIDs de Doctors
  date_time: string | null; // Corresponde a um timestamp, agora pode ser nulo
  hospital_id: number; // Chave estrangeira para o ID de um Hospital
  insurance_id: number; // Chave estrangeira para o ID de um InsurancePlan
  auth_status: 'Pendente' | 'Liberado' | 'Recusado';
  surgery_status: 'Solicitada' | 'Agendada' | 'Realizada' | 'Cancelada';
  fees: Record<string, number>; // Corresponde ao tipo JSONB
  material_cost: number; // Corresponde ao tipo numeric
  notes: string;
  pre_op_xray_path?: string; // Armazena o caminho do arquivo no Supabase Storage
  post_op_xray_path?: string; // Armazena o caminho do arquivo no Supabase Storage
}

// --- CONTEXTO DE NOTIFICAÇÕES (TOAST) --- //
// Este sistema permite exibir mensagens de feedback em qualquer lugar da aplicação.

type ToastType = 'success' | 'error';
interface ToastMessage {
    id: number;
    message: string;
    type: ToastType;
}
interface ToastContextType {
    addToast: (message: string, type: ToastType) => void;
}

// Cria o Contexto que ficará disponível para os componentes filhos
const ToastContext = createContext<ToastContextType | null>(null);

// Cria um "hook" customizado para facilitar o uso do contexto. Em vez de importar
// e usar o useContext(ToastContext) toda vez, usamos apenas useToast().
export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast deve ser usado dentro de um ToastProvider');
    }
    return context;
};

// Cria o componente "Provider" que gerencia o estado das notificações.
// Ele vai "envelopar" toda a nossa aplicação.
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    // Função para adicionar uma nova notificação. Ela se auto-remove após 5 segundos.
    const addToast = (message: string, type: ToastType) => {
        const id = Date.now();
        setToasts(prevToasts => [...prevToasts, { id, message, type }]);
        setTimeout(() => {
            setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
        }, 5000);
    };

    // Função para remover uma notificação ao clicar no botão 'x'
    const removeToast = (id: number) => {
        setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
    };

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            {/* O container onde as notificações serão renderizadas no DOM */}
            <div className="toast-container">
                {toasts.map(toast => (
                    <div key={toast.id} className={`toast toast-${toast.type}`}>
                        <span className="material-symbols-outlined">
                            {toast.type === 'success' ? 'check_circle' : 'error'}
                        </span>
                        <span>{toast.message}</span>
                        <button onClick={() => removeToast(toast.id)}>&times;</button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

// --- FUNÇÃO AUXILIAR (HELPER) --- //
// Uma função simples para encontrar um objeto de doutor em uma lista a partir de um ID.
// Será usada em vários componentes para exibir nomes de médicos, cores, etc.
const getUserById = (id: string | number, users: Doctor[]) => {
    // Compara os IDs como strings para evitar problemas de tipo (UUID vs number)
    return users.find(d => String(d.id) === String(id));
};


// --- COMPONENTES DA APLICAÇÃO --- //

/**
 * Componente: Tela de Login (LoginView)
 * Responsabilidade: Capturar email/senha e autenticar com o Supabase.
 */
const LoginView: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Tenta fazer o login usando o serviço de autenticação do Supabase
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            setError('Email ou senha inválidos.');
        }
        // Se o login for bem-sucedido, não precisamos fazer nada aqui.
        // O componente principal 'App' vai detectar a mudança de autenticação e trocar a tela.

        setLoading(false);
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <div className="login-logo">
                    <span className="material-symbols-outlined">health_and_safety</span>
                </div>
                <h2>Bem-vindo</h2>
                <p>Entre com seu email e senha.</p>
                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            placeholder="exemplo@med.com"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Senha</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                        />
                    </div>
                    {error && <p className="login-error">{error}</p>}
                    <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                        {loading ? 'Entrando...' : 'Entrar'}
                    </button>
                </form>
            </div>
        </div>
    );
};

/**
 * Componente: Cabeçalho da Aplicação (AppHeader)
 * Responsabilidade: Exibir a navegação principal, busca e menu do usuário.
 */
const AppHeader: React.FC<{
  currentView: string;
  onNavigate: (view: 'dashboard' | 'agenda' | 'solicitacoes' | 'relatorios' | 'cadastros' | 'admin') => void;
  loggedInUser: Doctor;
  onLogout: () => void;
  searchQuery: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}> = ({ currentView, onNavigate, loggedInUser, onLogout, searchQuery, onSearchChange, theme, onToggleTheme }) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Efeito para fechar o menu do usuário ao clicar fora dele, melhorando a usabilidade.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
            setIsUserMenuOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
        document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <header className="app-header">
      <h1><span className="material-symbols-outlined">health_and_safety</span> Agenda Cirúrgica</h1>
      <nav>
        <a href="#dashboard" className={currentView === 'dashboard' ? 'active' : ''} onClick={() => onNavigate('dashboard')}>Dashboard</a>
        <a href="#agenda" className={currentView === 'agenda' ? 'active' : ''} onClick={() => onNavigate('agenda')}>Agenda</a>
        <a href="#solicitacoes" className={currentView === 'solicitacoes' ? 'active' : ''} onClick={() => onNavigate('solicitacoes')}>Solicitações</a>
        <a href="#relatorios" className={currentView === 'relatorios' ? 'active' : ''} onClick={() => onNavigate('relatorios')}>Relatórios</a>
        <a href="#cadastros" className={currentView === 'cadastros' ? 'active' : ''} onClick={() => onNavigate('cadastros')}>Cadastros</a>
        {loggedInUser.is_admin && (
           <a href="#admin" className={currentView === 'admin' ? 'active' : ''} onClick={() => onNavigate('admin')}>Administradores</a>
        )}
      </nav>
      <div className="header-actions">
        <div className="header-search">
            <span className="material-symbols-outlined search-icon">search</span>
            <input
                type="search"
                placeholder="Buscar paciente..."
                value={searchQuery}
                onChange={onSearchChange}
            />
        </div>
        <div className="user-info" ref={userMenuRef}>
            <button className="user-avatar-btn" onClick={() => setIsUserMenuOpen(p => !p)} aria-label="Menu do usuário">
                {loggedInUser.name.charAt(0)}
            </button>
            {isUserMenuOpen && (
                <div className="user-menu">
                    <div className="user-menu-header">
                        <span>{loggedInUser.name}</span>
                        <small>{loggedInUser.is_admin ? 'Administrador' : 'Médico'}</small>
                    </div>
                    <button onClick={onToggleTheme}>
                        <span className="material-symbols-outlined">{theme === 'light' ? 'dark_mode' : 'light_mode'}</span>
                        {theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
                    </button>
                    <div className="divider"></div>
                    <button onClick={onLogout}>
                        <span className="material-symbols-outlined">logout</span>
                        Sair
                    </button>
                </div>
            )}
        </div>
      </div>
    </header>
  );
};

/**
 * Componente: Modal de Cirurgia (Adicionar/Editar)
 */
const SurgeryModal: React.FC<{
  isOpen: boolean; onClose: () => void;
  onSave: (data: Omit<Surgery, 'id'>, files: { preOp?: File, postOp?: File }) => void;
  hospitals: Hospital[]; insurancePlans: InsurancePlan[]; surgeryToEdit: Surgery | null;
  initialDate: Date; loggedInUser: Doctor; users: Doctor[];
}> = ({ isOpen, onClose, onSave, hospitals, insurancePlans, surgeryToEdit, initialDate, loggedInUser, users }) => {

  const createInitialState = useCallback(() => {
    // --- ALTERAÇÃO: A data inicial é nula por padrão, para novas solicitações ---
    const defaultDateTime = surgeryToEdit?.date_time ? new Date(surgeryToEdit.date_time).toISOString().slice(0, 16) : null;
    const mainSurgeonId = loggedInUser.id || '';
    return {
        patient_name: '', main_surgeon_id: mainSurgeonId, participating_ids: [] as string[], date_time: defaultDateTime,
        hospital_id: hospitals[0]?.id || 0, insurance_id: insurancePlans[0]?.id || 0, auth_status: 'Pendente' as const,
        surgery_status: 'Solicitada' as const, fees: { [mainSurgeonId]: 0 }, notes: '',
        pre_op_xray_path: undefined, post_op_xray_path: undefined,
        terceiro_auxiliar_cost: 0,
        instrumentador_cost: 400,
        anestesista_cost: 0,
        hospital_uti_cost: 0,
        material_cost: 0,
    };
  }, [loggedInUser, hospitals, insurancePlans, surgeryToEdit]);


  const [formData, setFormData] = useState(createInitialState());
  const [files, setFiles] = useState<{ preOp?: File, postOp?: File }>({});

  useEffect(() => {
    if (isOpen) {
        if (surgeryToEdit) {
            setFormData({
                ...createInitialState(),
                ...surgeryToEdit,
                date_time: surgeryToEdit.date_time ? new Date(surgeryToEdit.date_time).toISOString().slice(0, 16) : null,
                fees: surgeryToEdit.fees || {},
                participating_ids: surgeryToEdit.participating_ids || []
            });
        } else {
            setFormData(createInitialState());
        }
        setFiles({});
    }
  }, [surgeryToEdit, isOpen, createInitialState]);


  useEffect(() => {
    const allDoctorIds = [formData.main_surgeon_id, ...(formData.participating_ids || [])];
    const uniqueDoctorIds = [...new Set(allDoctorIds)].filter(Boolean);
    setFormData(prev => {
        const newFees: Record<string, number> = {};
        for (const id of uniqueDoctorIds) { newFees[String(id)] = prev.fees[String(id)] || 0; }
        return { ...prev, fees: newFees };
    });
  }, [formData.main_surgeon_id, formData.participating_ids]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const isNumeric = ['material_cost', 'hospital_id', 'insurance_id', 'terceiro_auxiliar_cost', 'instrumentador_cost', 'anestesista_cost', 'hospital_uti_cost'].includes(name);
    setFormData(prev => ({ ...prev, [name]: isNumeric ? Number(value) || 0 : value }));
  };

  const handleFeeChange = (doctorId: string, value: string) => {
    setFormData(prev => ({ ...prev, fees: { ...prev.fees, [String(doctorId)]: parseFloat(value) || 0 }}));
  };

  const handleCheckboxChange = (doctorId: string) => {
    setFormData(prev => ({ ...prev, participating_ids: (prev.participating_ids || []).includes(doctorId)
            ? (prev.participating_ids || []).filter(id => id !== doctorId)
            : [...(prev.participating_ids || []), doctorId]
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, files: inputFiles } = e.target;
    if (inputFiles && inputFiles[0]) {
      const file = inputFiles[0];
      if (name === 'pre_op_xray_path') setFiles(f => ({ ...f, preOp: file }));
      if (name === 'post_op_xray_path') setFiles(f => ({ ...f, postOp: file }));
    }
  };

  const getPublicUrl = (path: string | undefined) => {
      if (!path) return '';
      const { data } = supabase.storage.from('xrays').getPublicUrl(path);
      return data.publicUrl;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patient_name.trim()) { alert('O nome do paciente é obrigatório.'); return; }
    // --- ALTERAÇÃO: Validação para exigir data apenas se o status for 'Agendada' ---
    if (formData.surgery_status === 'Agendada' && !formData.date_time) {
        addToast('Para agendar uma cirurgia, a data e hora são obrigatórias.', 'error');
        return;
    }
    onSave(formData, files);
  };

  const otherDoctors = users.filter(d => d.id !== formData.main_surgeon_id);
  const totalFees = useMemo(() => Object.values(formData.fees || {}).reduce((sum, fee) => sum + fee, 0), [formData.fees]);

  const totalCost = useMemo(() => {
      const fees = totalFees || 0;
      const prosthesis = formData.material_cost || 0;
      const thirdAssistant = formData.terceiro_auxiliar_cost || 0;
      const scrubNurse = formData.instrumentador_cost || 0;
      const anaesthetist = formData.anestesista_cost || 0;
      const hospital = formData.hospital_uti_cost || 0;
      return fees + prosthesis + thirdAssistant + scrubNurse + anaesthetist + hospital;
  }, [
      totalFees,
      formData.material_cost,
      formData.terceiro_auxiliar_cost,
      formData.instrumentador_cost,
      formData.anestesista_cost,
      formData.hospital_uti_cost
  ]);

  const doctorsForFees = useMemo(() => {
    const ids = new Set([formData.main_surgeon_id, ...(formData.participating_ids || [])]);
    return users.filter(u => ids.has(u.id));
  }, [formData.main_surgeon_id, formData.participating_ids, users]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h3>{surgeryToEdit ? 'Editar Cirurgia' : 'Nova Solicitação'}</h3>
            <button type="button" className="close-btn" onClick={onClose} aria-label="Fechar">&times;</button>
          </div>
          <div className="modal-body">
            {/* --- Seção: Detalhes do Paciente e Equipe --- */}
            <div className="form-section"><h4>Detalhes do Paciente e Equipe</h4><div className="form-grid">
              <div className="form-group full-width"><label htmlFor="patient_name">Paciente</label><input type="text" id="patient_name" name="patient_name" value={formData.patient_name} onChange={handleChange} required /></div>
              <div className="form-group"><label htmlFor="main_surgeon_id">Cirurgião Principal</label><select id="main_surgeon_id" name="main_surgeon_id" value={formData.main_surgeon_id} onChange={handleChange}>{users.map(doc => <option key={doc.id} value={doc.id}>{doc.name}</option>)}</select></div>
              <div className="form-group"><label>Médicos Participantes</label><div className="checkbox-container">{otherDoctors.map(doc => (<label key={doc.id}><input type="checkbox" checked={(formData.participating_ids || []).includes(doc.id)} onChange={() => handleCheckboxChange(doc.id)} />{doc.name}</label>))}</div></div>
            </div></div>

            {/* --- Seção: Agendamento e Status --- */}
            <div className="form-section"><h4>Agendamento e Status</h4><div className="form-grid">
                <div className="form-group"><label htmlFor="date_time">Data e Hora (para agendamento)</label><input type="datetime-local" id="date_time" name="date_time" value={formData.date_time || ''} onChange={handleChange} /></div>
                <div className="form-group"><label htmlFor="hospital_id">Hospital</label><select id="hospital_id" name="hospital_id" value={formData.hospital_id} onChange={handleChange}>{hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
                <div className="form-group"><label htmlFor="insurance_id">Convênio / Particular</label><select id="insurance_id" name="insurance_id" value={formData.insurance_id} onChange={handleChange}>{insurancePlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                <div className="form-group"><label htmlFor="auth_status">Status de Liberação</label><select id="auth_status" name="auth_status" value={formData.auth_status} onChange={handleChange}><option>Pendente</option><option>Liberado</option><option>Recusado</option></select></div>
                <div className="form-group"><label htmlFor="surgery_status">Status do Processo</label><select id="surgery_status" name="surgery_status" value={formData.surgery_status} onChange={handleChange}><option>Solicitada</option><option>Agendada</option><option>Realizada</option><option>Cancelada</option></select></div>
            </div></div>

            {/* --- Seção: Financeiro (Layout Corrigido) --- */}
            <div className="form-section"><h4>Financeiro</h4><div className="form-grid">
              <div className="form-group full-width"><label>Distribuição de Honorários</label><div className="fee-distribution">{doctorsForFees.map(doc => (<div key={doc.id} className="fee-item"><label htmlFor={`fee-${doc.id}`}>{doc.name}</label><input type="number" id={`fee-${doc.id}`} value={formData.fees[String(doc.id)] === 0 ? '' : (formData.fees[String(doc.id)] ?? '')} onChange={(e) => handleFeeChange(doc.id, e.target.value)} placeholder="0,00"/></div>))}</div></div>

              <div className="form-group"><label htmlFor="terceiro_auxiliar_cost">3º Auxiliar</label><input type="number" id="terceiro_auxiliar_cost" name="terceiro_auxiliar_cost" value={formData.terceiro_auxiliar_cost === 0 ? '' : formData.terceiro_auxiliar_cost} onChange={handleChange} placeholder="0,00" /></div>
              <div className="form-group"><label htmlFor="instrumentador_cost">Instrumentador</label><input type="number" id="instrumentador_cost" name="instrumentador_cost" value={formData.instrumentador_cost === 0 ? '' : formData.instrumentador_cost} onChange={handleChange} placeholder="0,00" /></div>
              <div className="form-group"><label htmlFor="anestesista_cost">Anestesista</label><input type="number" id="anestesista_cost" name="anestesista_cost" value={formData.anestesista_cost === 0 ? '' : formData.anestesista_cost} onChange={handleChange} placeholder="0,00" /></div>
              <div className="form-group"><label htmlFor="hospital_uti_cost">Despesa Hospitalar + UTI</label><input type="number" id="hospital_uti_cost" name="hospital_uti_cost" value={formData.hospital_uti_cost === 0 ? '' : formData.hospital_uti_cost} onChange={handleChange} placeholder="0,00" /></div>

              <div className="form-group full-width"><label htmlFor="material_cost">Prótese</label><input type="number" id="material_cost" name="material_cost" value={formData.material_cost === 0 ? '' : formData.material_cost} onChange={handleChange} placeholder="0,00" /></div>

              <div className="form-group full-width" style={{ textAlign: 'right', marginTop: '1rem' }}><label>Valor Total da Cirurgia</label><input type="text" className="total-cost-input" value={totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} readOnly /></div>
            </div></div>
            {/* --- Fim da Seção Financeiro --- */}

            {/* --- Seção: Anexos e Notas --- */}
            <div className="form-section"><h4>Anexos e Notas</h4><div className="form-grid">
              <div className="form-group full-width"><label htmlFor="pre_op_xray_path">Raio-X Pré-cirúrgico</label>
                {formData.pre_op_xray_path ? (<div className="file-display"><a href={getPublicUrl(formData.pre_op_xray_path)} target="_blank" rel="noopener noreferrer">{formData.pre_op_xray_path.split('/').pop()}</a><button type="button" className="btn-remove-file" onClick={() => setFormData(p => ({...p, pre_op_xray_path: undefined}))}>&times;</button></div>) : (<input type="file" id="pre_op_xray_path" name="pre_op_xray_path" onChange={handleFileChange} accept="image/*,.pdf" />)}
              </div>
              <div className="form-group full-width"><label htmlFor="post_op_xray_path">Raio-X Pós-cirúrgico</label>
                {formData.post_op_xray_path ? (<div className="file-display"><a href={getPublicUrl(formData.post_op_xray_path)} target="_blank" rel="noopener noreferrer">{formData.post_op_xray_path.split('/').pop()}</a><button type="button" className="btn-remove-file" onClick={() => setFormData(p => ({...p, post_op_xray_path: undefined}))}>&times;</button></div>) : (<input type="file" id="post_op_xray_path" name="post_op_xray_path" onChange={handleFileChange} accept="image/*,.pdf" />)}
              </div>
              <div className="form-group full-width"><label htmlFor="notes">Notas (procedimento, detalhes, etc)</label><textarea id="notes" name="notes" value={formData.notes} onChange={handleChange}></textarea></div>
            </div></div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="btn btn-primary">Salvar</button></div>
        </form>
      </div>
    </div>
  );
};


/**
 * Componente: Tela de Cadastros (SettingsView)
 * Responsabilidade: Permitir o gerenciamento (CRUD) de hospitais e convênios.
 */
const SettingsView: React.FC<{
    hospitals: Hospital[];
    onAddHospital: (name: string) => Promise<void>;
    onDeleteHospital: (id: number) => Promise<void>;
    insurancePlans: InsurancePlan[];
    onAddPlan: (name: string) => Promise<void>;
    onDeletePlan: (id: number) => Promise<void>;
}> = ({ hospitals, onAddHospital, onDeleteHospital, insurancePlans, onAddPlan, onDeletePlan }) => {
    const [newHospital, setNewHospital] = useState('');
    const [newPlan, setNewPlan] = useState('');

    // Handler para o botão de adicionar hospital
    const handleAddHospital = async () => {
        if (newHospital.trim()) {
            await onAddHospital(newHospital.trim());
            setNewHospital('');
        }
    };

    // Handler para o botão de adicionar convênio
    const handleAddPlan = async () => {
        if (newPlan.trim()) {
            await onAddPlan(newPlan.trim());
            setNewPlan('');
        }
    };

    return (
        <div className="settings-container">
            <h2>Cadastros Gerais</h2>
            <div className="report-details-grid">
                {/* Coluna de Hospitais */}
                <div>
                    <h3>Hospitais</h3>
                    <div className="add-item-form">
                        <input
                            type="text"
                            value={newHospital}
                            onChange={e => setNewHospital(e.target.value)}
                            placeholder="Nome do novo hospital"
                        />
                        <button className="btn btn-primary" onClick={handleAddHospital}>Adicionar</button>
                    </div>
                    <div className="list-container">
                        {hospitals.map(h => (
                            <div key={h.id} className="list-item">
                                <span>{h.name}</span>
                                <button className="btn btn-danger" onClick={() => onDeleteHospital(h.id)}>Excluir</button>
                            </div>
                        ))}
                    </div>
                </div>
                {/* Coluna de Convênios */}
                <div>
                    <h3>Convênios</h3>
                    <div className="add-item-form">
                        <input
                            type="text"
                            value={newPlan}
                            onChange={e => setNewPlan(e.target.value)}
                            placeholder="Nome do novo convênio"
                        />
                        <button className="btn btn-primary" onClick={handleAddPlan}>Adicionar</button>
                    </div>
                     <div className="list-container">
                        {insurancePlans.map(p => (
                            <div key={p.id} className="list-item">
                                <span>{p.name}</span>
                                <button className="btn btn-danger" onClick={() => onDeletePlan(p.id)}>Excluir</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * Componente: Painel de Filtros Avançados
 * Responsabilidade: Fornecer uma interface para filtros detalhados na agenda.
 */
const AdvancedFiltersPanel: React.FC<{
    isOpen: boolean; onClose: () => void; currentFilters: any;
    onApplyFilters: (filters: any) => void;
    hospitals: Hospital[]; insurancePlans: InsurancePlan[];
}> = ({ isOpen, onClose, currentFilters, onApplyFilters, hospitals, insurancePlans }) => {
    const [filters, setFilters] = useState(currentFilters);
    useEffect(() => { setFilters(currentFilters); }, [currentFilters]);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters((prev: any) => ({ ...prev, [name]: value }));
    };

    const handleApply = () => { onApplyFilters(filters); onClose(); };

    const handleReset = () => {
        const resetFilters = { auth_status: 'all', surgery_status: 'all', hospital_id: 'all', insurance_id: 'all' };
        setFilters(resetFilters);
        onApplyFilters(resetFilters);
        onClose();
    };

    return (
        <>
            <div className={`filters-panel-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}></div>
            <div className={`filters-panel ${isOpen ? 'open' : ''}`}>
                <div className="filters-panel-header"><h3>Filtros Avançados</h3><button className="close-btn" onClick={onClose} aria-label="Fechar">&times;</button></div>
                <div className="filters-panel-body">
                    <div className="form-group"><label htmlFor="auth_status_filter">Status da Autorização</label><select id="auth_status_filter" name="auth_status" value={filters.auth_status} onChange={handleChange}><option value="all">Todos</option><option value="Pendente">Pendente</option><option value="Liberado">Liberado</option><option value="Recusado">Recusado</option></select></div>
                    <div className="form-group"><label htmlFor="surgery_status_filter">Status da Cirurgia</label><select id="surgery_status_filter" name="surgery_status" value={filters.surgery_status} onChange={handleChange}><option value="all">Todos</option><option value="Solicitada">Solicitada</option><option value="Agendada">Agendada</option><option value="Realizada">Realizada</option><option value="Cancelada">Cancelada</option></select></div>
                    <div className="form-group"><label htmlFor="hospital_id_filter">Hospital</label><select id="hospital_id_filter" name="hospital_id" value={filters.hospital_id} onChange={handleChange}><option value="all">Todos</option>{hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
                    <div className="form-group"><label htmlFor="insurance_id_filter">Convênio</label><select id="insurance_id_filter" name="insurance_id" value={filters.insurance_id} onChange={handleChange}><option value="all">Todos</option>{insurancePlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                </div>
                <div className="filters-panel-footer"><button className="btn btn-secondary" onClick={handleReset}>Limpar Filtros</button><button className="btn btn-primary" onClick={handleApply}>Aplicar</button></div>
            </div>
        </>
    );
};

/**
 * Componente: Visão de Calendário / Agenda
 * Responsabilidade: Exibir as cirurgias em um calendário mensal ou semanal.
 */
const CalendarView: React.FC<{
    surgeries: Surgery[]; onDayClick: (date: Date) => void; onSurgeryClick: (surgery: Surgery) => void;
    onSurgeryDrop: (surgeryId: number, newDate: Date) => void; users: Doctor[];
    hospitals: Hospital[]; insurancePlans: InsurancePlan[];
}> = ({ surgeries, onDayClick, onSurgeryClick, onSurgeryDrop, users, hospitals, insurancePlans }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [doctorFilter, setDoctorFilter] = useState<string | 'all'>('all');
    const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
    const [dragOverDate, setDragOverDate] = useState<string | null>(null);
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
    const [advancedFilters, setAdvancedFilters] = useState({ auth_status: 'all', surgery_status: 'all', hospital_id: 'all', insurance_id: 'all' });

    const handlePrev = () => setCurrentDate(d => new Date(d.getFullYear(), viewMode === 'month' ? d.getMonth() - 1 : d.getMonth(), viewMode === 'month' ? 1 : d.getDate() - 7));
    const handleNext = () => setCurrentDate(d => new Date(d.getFullYear(), viewMode === 'month' ? d.getMonth() + 1 : d.getMonth(), viewMode === 'month' ? 1 : d.getDate() + 7));

    const { calendarGrid, weekGrid } = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const monthGrid: (Date | null)[] = Array(firstDayOfMonth).fill(null);
        for (let i = 1; i <= daysInMonth; i++) monthGrid.push(new Date(year, month, i));

        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        const newWeekGrid: Date[] = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(startOfWeek);
            day.setDate(day.getDate() + i);
            newWeekGrid.push(day);
        }
        return { calendarGrid: monthGrid, weekGrid: newWeekGrid };
    }, [currentDate, viewMode]);

    const filteredSurgeries = useMemo(() => {
        return surgeries.filter(s => {
            if (!['Agendada', 'Realizada'].includes(s.surgery_status)) return false;
            if (doctorFilter !== 'all' && s.main_surgeon_id !== doctorFilter && !(s.participating_ids || []).includes(String(doctorFilter))) return false;
            if (advancedFilters.auth_status !== 'all' && s.auth_status !== advancedFilters.auth_status) return false;
            if (advancedFilters.surgery_status !== 'all' && s.surgery_status !== advancedFilters.surgery_status) return false;
            if (advancedFilters.hospital_id !== 'all' && String(s.hospital_id) !== advancedFilters.hospital_id) return false;
            if (advancedFilters.insurance_id !== 'all' && String(s.insurance_id) !== advancedFilters.insurance_id) return false;
            return true;
        });
    }, [surgeries, doctorFilter, advancedFilters]);

    const getAuthStatusIcon = (status: Surgery['auth_status']) => ({'Liberado': 'verified', 'Recusado': 'gpp_bad'}[status] || 'hourglass_top');

    const getSurgeryTooltip = (s: Surgery) => {
        const mainSurgeon = getUserById(s.main_surgeon_id, users)?.name || 'N/A';
        const participants = (s.participating_ids || []).map(id => getUserById(id, users)?.name).filter(Boolean).join(', ');
        const hospital = hospitals.find(h => h.id === s.hospital_id)?.name || 'N/A';
        const insurance = insurancePlans.find(p => p.id === s.insurance_id)?.name || 'N/A';
        const dateTime = s.date_time ? new Date(s.date_time).toLocaleString('pt-BR') : 'A definir';
        return `Paciente: ${s.patient_name}\nData: ${dateTime}\nHospital: ${hospital}\nConvênio: ${insurance}\nCirurgião: ${mainSurgeon}\n${participants ? `Equipe: ${participants}\n` : ''}Status: ${s.surgery_status}`;
    };

    const onDragStart = (e: React.DragEvent, surgeryId: number) => e.dataTransfer.setData("surgeryId", String(surgeryId));
    const onDragOver = (e: React.DragEvent) => e.preventDefault();
    const onDrop = (e: React.DragEvent, date: Date) => {
        e.preventDefault();
        const surgeryId = e.dataTransfer.getData("surgeryId");
        if(surgeryId && date) onSurgeryDrop(Number(surgeryId), date);
        setDragOverDate(null);
    };

    const displayedGrid = viewMode === 'month' ? calendarGrid : weekGrid;
    const gridClass = viewMode === 'month' ? 'calendar-grid' : 'calendar-grid-week';
    const today = new Date(); today.setHours(0,0,0,0);
    const activeFilters = Object.entries(advancedFilters).filter(([, value]) => value !== 'all');

    return (
      <div className="calendar-view-container">
        <div className="calendar-toolbar">
            <div className="calendar-nav"><button className="btn btn-primary" onClick={handlePrev}>&lt;</button><h2>{currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</h2><button className="btn btn-primary" onClick={handleNext}>&gt;</button></div>
            <div className="calendar-view-controls"><div className="view-switcher"><button className={viewMode === 'month' ? 'active' : ''} onClick={() => setViewMode('month')}>Mês</button><button className={viewMode === 'week' ? 'active' : ''} onClick={() => setViewMode('week')}>Semana</button></div><select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)}><option value="all">Todos os Médicos</option>{users.map(doc => <option key={doc.id} value={doc.id}>{doc.name}</option>)}</select><button className="btn btn-secondary" onClick={() => setIsFilterPanelOpen(true)}><span className="material-symbols-outlined">filter_list</span> Filtros</button></div>
        </div>

        {activeFilters.length > 0 && (
            <div className="applied-filters-container">{activeFilters.map(([key, value]) => {
                    let label = '';
                    if (key === 'hospital_id') label = hospitals.find(h => String(h.id) === value)?.name || '';
                    else if (key === 'insurance_id') label = insurancePlans.find(p => String(p.id) === value)?.name || '';
                    else label = String(value);
                    return (<div key={key} className="filter-tag"><span>{label}</span><button onClick={() => setAdvancedFilters(f => ({...f, [key]: 'all'}))}>&times;</button></div>);
            })}</div>
        )}

        <div className={gridClass}>
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => <div key={day} className="calendar-header">{day}</div>)}
            {displayedGrid.map((date, index) => {
                const daySurgeries = date ? filteredSurgeries.filter(s => s.date_time && new Date(s.date_time).toDateString() === date.toDateString()) : [];
                const dateString = date ? date.toISOString().split('T')[0] : '';
                return (
                    <div key={index} className={`calendar-day ${!date ? 'other-month' : ''} ${date && date.getTime() === today.getTime() ? 'today' : ''} ${dateString === dragOverDate ? 'drag-over' : ''}`} onClick={() => date && onDayClick(date)} onDragOver={onDragOver} onDrop={(e) => date && onDrop(e, date)} onDragEnter={() => date && setDragOverDate(date.toISOString().split('T')[0])} onDragLeave={() => setDragOverDate(null)}>
                        {date && <span className="day-number">{date.getDate()}</span>}
                        {daySurgeries.sort((a,b) => new Date(a.date_time!).getTime() - new Date(b.date_time!).getTime()).map(s => {
                            const doctor = getUserById(s.main_surgeon_id, users);
                            return (
                                <div key={s.id} draggable onDragStart={(e) => onDragStart(e, s.id)} className="surgery-item" style={{ '--doctor-color': doctor?.color } as React.CSSProperties} onClick={(e) => { e.stopPropagation(); onSurgeryClick(s); }} title={getSurgeryTooltip(s)}>
                                    <div className="surgery-item-header"><span className="surgery-time">{s.date_time ? new Date(s.date_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit'}) : ''}</span><span className={`material-symbols-outlined auth-status-icon status-${s.auth_status.toLowerCase()}`}>{getAuthStatusIcon(s.auth_status)}</span></div>
                                    <div className="surgery-item-body"><span className="surgery-patient">{s.patient_name}</span><span className="surgery-hospital">{hospitals.find(h => h.id === s.hospital_id)?.name || 'N/A'}</span></div>
                                </div>
                            );
                        })}
                    </div>
                );
            })}
        </div>
        <AdvancedFiltersPanel isOpen={isFilterPanelOpen} onClose={() => setIsFilterPanelOpen(false)} currentFilters={advancedFilters} onApplyFilters={setAdvancedFilters} hospitals={hospitals} insurancePlans={insurancePlans} />
      </div>
    );
};

/**
 * Componente: Visão de Relatórios
 */
const ReportsView: React.FC<{ surgeries: Surgery[]; hospitals: Hospital[]; insurancePlans: InsurancePlan[]; users: Doctor[]; theme: 'light' | 'dark'; }> = ({ surgeries, hospitals, users, theme }) => {
    const [filters, setFilters] = useState({ startDate: '', endDate: '', doctorId: 'all' as 'all' | string });
    const revenueByDoctorCanvas = useRef<HTMLCanvasElement>(null);
    const surgeriesByHospitalCanvas = useRef<HTMLCanvasElement>(null);
    const revenueChartRef = useRef<Chart | null>(null);
    const hospitalChartRef = useRef<Chart | null>(null);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const filteredSurgeries = useMemo(() => {
        return surgeries.filter(s => {
            if (!s.date_time) return false;
            const surgeryDate = new Date(s.date_time);
            if (filters.startDate && surgeryDate < new Date(filters.startDate)) return false;
            if (filters.endDate) {
                 const endDate = new Date(filters.endDate);
                 endDate.setHours(23, 59, 59, 999);
                 if(surgeryDate > endDate) return false;
            }
            if (filters.doctorId !== 'all' && s.main_surgeon_id !== filters.doctorId && !(s.participating_ids || []).includes(filters.doctorId)) return false;
            return true;
        });
    }, [surgeries, filters]);

    const reports = useMemo(() => {
        const realized = filteredSurgeries.filter(s => s.surgery_status === 'Realizada');
        const totalRevenue = realized.reduce((acc, s) => acc + Object.values(s.fees || {}).reduce((sum, fee) => sum + fee, 0), 0);
        const revenueByDoctor = realized.reduce<Record<string, number>>((acc, s) => {
            for (const doctorId in s.fees) {
                const doctorName = getUserById(doctorId, users)?.name || 'Desconhecido';
                acc[doctorName] = (acc[doctorName] || 0) + (s.fees[doctorId] || 0);
            } return acc;
        }, {});
        const hospitalMap = new Map(hospitals.map(h => [h.id, h.name]));
        const surgeriesByHospital = filteredSurgeries.reduce<Record<string, number>>((acc, s) => {
            const hospitalName = hospitalMap.get(s.hospital_id) || 'Desconhecido';
            acc[hospitalName] = (acc[hospitalName] || 0) + 1;
            return acc;
        }, {});
        return { totalRevenue, revenueByDoctor, surgeriesByHospital, totalSurgeries: filteredSurgeries.length, realizedSurgeriesCount: realized.length };
    }, [filteredSurgeries, hospitals, users]);

    useEffect(() => {
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color');
        const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color');

        if (revenueByDoctorCanvas.current) {
            if (revenueChartRef.current) revenueChartRef.current.destroy();
            const sortedRevenue = Object.entries(reports.revenueByDoctor).sort(([,a],[,b]) => b-a);
            revenueChartRef.current = new Chart(revenueByDoctorCanvas.current, {
                type: 'bar', data: { labels: sortedRevenue.map(([name]) => name), datasets: [{ label: 'Faturamento', data: sortedRevenue.map(([,value]) => value), backgroundColor: 'rgba(59, 130, 246, 0.5)', borderColor: 'rgba(59, 130, 246, 1)', borderWidth: 1 }] },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { color: textColor }, grid: { color: gridColor } }, x: { ticks: { color: textColor }, grid: { color: 'transparent' } } }, plugins: { legend: { display: false } } }
            });
        }
        if (surgeriesByHospitalCanvas.current) {
            if (hospitalChartRef.current) hospitalChartRef.current.destroy();
            const sortedHospitals = Object.entries(reports.surgeriesByHospital).sort(([,a],[,b]) => b-a);
            hospitalChartRef.current = new Chart(surgeriesByHospitalCanvas.current, {
                type: 'pie', data: { labels: sortedHospitals.map(([name]) => name), datasets: [{ label: 'Cirurgias', data: sortedHospitals.map(([,value]) => value), backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#64748b'] }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { color: textColor } } } }
            });
        }
        return () => { revenueChartRef.current?.destroy(); hospitalChartRef.current?.destroy(); }
    }, [reports, theme]);

    return (
        <div className="reports-container">
            <div className="reports-header"><h2>Relatórios</h2></div>
            <div className="reports-filters">
                <div className="form-group"><label>Data de Início</label><input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} /></div>
                <div className="form-group"><label>Data de Fim</label><input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} /></div>
                <div className="form-group"><label>Médico</label><select name="doctorId" value={filters.doctorId} onChange={handleFilterChange}><option value="all">Todos</option>{users.map(doc => <option key={doc.id} value={doc.id}>{doc.name}</option>)}</select></div>
            </div>
            <div className="report-grid">
                <div className="report-card"><div className="report-card-header"><h4>Faturamento Total</h4><span className="material-symbols-outlined">payments</span></div><p>{reports.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
                <div className="report-card"><div className="report-card-header"><h4>Total de Cirurgias</h4><span className="material-symbols-outlined">summarize</span></div><p>{reports.totalSurgeries}</p></div>
                <div className="report-card"><div className="report-card-header"><h4>Cirurgias Realizadas</h4><span className="material-symbols-outlined">check_circle</span></div><p>{reports.realizedSurgeriesCount}</p></div>
            </div>
            <div className="report-details-grid">
                <div className="report-details-card"><h3>Faturamento por Médico</h3><div className="chart-container"><canvas ref={revenueByDoctorCanvas}></canvas></div></div>
                <div className="report-details-card"><h3>Cirurgias por Hospital</h3><div className="chart-container"><canvas ref={surgeriesByHospitalCanvas}></canvas></div></div>
            </div>
        </div>
    );
};

/**
 * Componente Auxiliar: Passo do Fluxo de Trabalho (WorkflowStep)
 */
const WorkflowStep: React.FC<{ icon: string; label: string; isCompleted: boolean; isActive: boolean; isFirst?: boolean; isLast?: boolean; }> = ({ icon, label, isCompleted, isActive, isFirst = false, isLast = false }) => {
    return (
        <div className={`workflow-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}>
            {!isFirst && <div className="line"></div>}
            <div className="step-content"><div className="icon"><span className="material-symbols-outlined">{isCompleted ? 'check' : icon}</span></div><div className="label">{label}</div></div>
            {!isLast && <div className="line"></div>}
        </div>
    );
};



/**
 * Componente: Visão de Dashboard
 */
const DashboardView: React.FC<{
    surgeries: Surgery[];
    users: Doctor[];
    hospitals: Hospital[];
    onViewDetails: (surgery: Surgery) => void;
    onUpdateStatus: (surgeryId: number, status: 'Realizada' | 'Cancelada') => void;
    // --- ALTERAÇÃO: Nova prop para navegar com filtro ---
    onNavigateWithFilter: (view: 'solicitacoes', filters: any) => void;
}> = ({ surgeries, users, hospitals, onViewDetails, onUpdateStatus, onNavigateWithFilter }) => {

    const { surgeriesToday, pendingAuthCount, monthRevenue } = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        const todayString = today.toDateString();

        const todaysSurgeries = surgeries
            .filter(s => s.date_time && new Date(s.date_time).toDateString() === todayString)
            .sort((a, b) => new Date(a.date_time!).getTime() - new Date(b.date_time!).getTime());

        // --- ALTERAÇÃO: Lógica corrigida para contar apenas autorizações pendentes ---
        const pending = surgeries.filter(s => s.auth_status === 'Pendente').length;

        const revenue = surgeries
            .filter(s => {
                if (!s.date_time) return false;
                const sDate = new Date(s.date_time);
                return s.surgery_status === 'Realizada' &&
                       sDate.getMonth() === currentMonth &&
                       sDate.getFullYear() === currentYear;
            })
            .reduce((total, s) => {
                const surgeryTotalFees = Object.values(s.fees || {}).reduce((sum, fee) => sum + fee, 0);
                return total + surgeryTotalFees;
            }, 0);

        return { surgeriesToday: todaysSurgeries, pendingAuthCount: pending, monthRevenue: revenue };
    }, [surgeries]);

    return (
        <div className="dashboard-view">
            <div className="dashboard-cards">
                <div className="dashboard-card">
                    <div className="dashboard-card-header"><h4>Cirurgias Hoje</h4><span className="material-symbols-outlined">today</span></div>
                    <p>{surgeriesToday.length}</p>
                </div>
                {/* --- ALTERAÇÃO: Adicionado onClick e classe 'clickable' --- */}
                <div className="dashboard-card clickable" onClick={() => onNavigateWithFilter('solicitacoes', { auth_status: 'Pendente' })}>
                    <div className="dashboard-card-header"><h4>Autorizações Pendentes</h4><span className="material-symbols-outlined">pending_actions</span></div>
                    <p>{pendingAuthCount}</p>
                </div>
                <div className="dashboard-card">
                    <div className="dashboard-card-header"><h4>Faturamento do Mês</h4><span className="material-symbols-outlined">payments</span></div>
                    <p>{monthRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
            </div>

            <div className="workflow-container">
                <h2>Fluxo de Trabalho do Dia</h2>
                {surgeriesToday.length > 0 ? (
                    surgeriesToday.map(s => {
                        const doctor = getUserById(s.main_surgeon_id, users);
                        const hospital = hospitals.find(h => h.id === s.hospital_id);

                        const isScheduled = true;
                        const isAuthorized = s.auth_status === 'Liberado';
                        const isPerformed = s.surgery_status === 'Realizada';
                        const isPostOpDone = !!s.post_op_xray_path;

                        let activeStep = 'Agendada';
                        if (isScheduled && !isAuthorized) activeStep = 'Liberado';
                        else if (isAuthorized && !isPerformed) activeStep = 'Realizada';
                        else if (isPerformed && !isPostOpDone) activeStep = 'Pós-op';

                        if (s.surgery_status === 'Cancelada') {
                             return (
                                <div key={s.id} className="workflow-card cancelled">
                                    <div className="workflow-info">
                                         <div className="workflow-time">{s.date_time ? new Date(s.date_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}) : ''}</div>
                                         <h3>{s.patient_name}</h3>
                                         <p>{doctor?.name} &bull; {hospital?.name}</p>
                                    </div>
                                    <div className="cancelled-status"><span className="material-symbols-outlined">cancel</span><span>Cancelada</span></div>
                                </div>
                            );
                        }

                        return (
                            <div key={s.id} className="workflow-card">
                                <div className="workflow-info">
                                    <div className="workflow-time" style={{'--doctor-color': doctor?.color} as React.CSSProperties}>
                                        {s.date_time ? new Date(s.date_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}) : ''}
                                    </div>
                                    <h3>{s.patient_name}</h3>
                                    <p>{doctor?.name} &bull; {hospital?.name}</p>
                                    <div className="workflow-actions">
                                        {s.surgery_status !== 'Realizada' && s.surgery_status !== 'Cancelada' && (
                                            <>
                                                <button className="btn btn-primary" onClick={() => onUpdateStatus(s.id, 'Realizada')}>Marcar como Realizada</button>
                                                <button className="btn btn-danger" onClick={() => onUpdateStatus(s.id, 'Cancelada')}>Cancelar</button>
                                            </>
                                        )}
                                        <button className="btn btn-secondary" onClick={() => onViewDetails(s)}>Ver Detalhes</button>
                                    </div>
                                </div>
                                <div className="workflow-steps">
                                    <WorkflowStep icon="event" label="Agendada" isCompleted={isScheduled} isActive={activeStep === 'Agendada'} isFirst />
                                    <WorkflowStep icon="verified_user" label="Liberado" isCompleted={isAuthorized} isActive={activeStep === 'Liberado'} />
                                    <WorkflowStep icon="health_and_safety" label="Realizada" isCompleted={isPerformed} isActive={activeStep === 'Realizada'} />
                                    <WorkflowStep icon="radiology" label="Pós-op" isCompleted={isPostOpDone} isActive={activeStep === 'Pós-op'} isLast />
                                </div>
                            </div>
                        )
                    })
                ) : (
                     <div className="no-surgeries-workflow">
                        <span className="material-symbols-outlined">event_available</span>
                        <p>Nenhuma cirurgia agendada para hoje.</p>
                        <p>Aproveite o dia ou adicione uma nova solicitação.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

/**
 * Componente: Visão de Solicitações
 */
const RequestsView: React.FC<{
  surgeries: Surgery[];
  users: Doctor[];
  insurancePlans: InsurancePlan[];
  onSurgeryClick: (surgery: Surgery) => void;
  // --- ALTERAÇÃO: Recebe os filtros iniciais do Dashboard ---
  initialFilters: any | null;
}> = ({ surgeries, users, insurancePlans, onSurgeryClick, initialFilters }) => {
  const [authFilter, setAuthFilter] = useState(initialFilters?.auth_status || 'all');

  // --- ALTERAÇÃO: Sincroniza o filtro se o usuário navegar pelo Dashboard ---
  useEffect(() => {
    setAuthFilter(initialFilters?.auth_status || 'all');
  }, [initialFilters]);

  const filteredSurgeries = useMemo(() => {
    return surgeries.filter(s => {
      if (s.surgery_status !== 'Solicitada' && s.surgery_status !== 'Agendada') return false;
      if (authFilter !== 'all' && s.auth_status !== authFilter) return false;
      return true;
    });
  }, [surgeries, authFilter]);

  return (
    <div className="requests-container">
      <div className="requests-header">
        <h2>Solicitações e Pendências</h2>
        <p>Cirurgias aguardando liberação ou agendamento. Clique em uma solicitação para atualizar.</p>
      </div>

      <div className="add-item-form">
        <label>Filtrar por Status de Liberação:</label>
        <select value={authFilter} onChange={(e) => setAuthFilter(e.target.value)}>
            <option value="all">Todas</option>
            <option value="Pendente">Apenas Pendentes</option>
            <option value="Liberado">Apenas Liberadas</option>
            <option value="Recusado">Apenas Recusadas</option>
        </select>
      </div>

      <div className="requests-list">
        {filteredSurgeries.length > 0 ? (
          filteredSurgeries.map(s => {
            const surgeon = getUserById(s.main_surgeon_id, users);
            const plan = insurancePlans.find(p => p.id === s.insurance_id);
            return (
              <div key={s.id} className="request-card" onClick={() => onSurgeryClick(s)}>
                <div className="request-card-header">
                  <h3>{s.patient_name}</h3>
                  <div className={`status-tag status-${s.auth_status.toLowerCase()}`}>
                    <span className="material-symbols-outlined">
                      {s.auth_status === 'Liberado' ? 'verified' : s.auth_status === 'Recusado' ? 'gpp_bad' : 'hourglass_top'}
                    </span>
                    {s.auth_status}
                  </div>
                </div>
                <div className="request-card-body">
                  <p><strong>Cirurgião:</strong> {surgeon?.name || 'N/A'}</p>
                  <p><strong>Convênio:</strong> {plan?.name || 'N/A'}</p>
                   {s.surgery_status === 'Agendada' && s.date_time && (
                     <p><strong>Agendado:</strong> {new Date(s.date_time).toLocaleString('pt-BR')}</p>
                   )}
                  {s.notes && <p><strong>Procedimento:</strong> {s.notes}</p>}
                </div>
                <div className="request-card-footer">
                  Clique para editar, agendar ou alterar status
                </div>
              </div>
            );
          })
        ) : (
          <div className="no-surgeries-workflow">
            <span className="material-symbols-outlined">file_copy</span>
            <p>Nenhuma solicitação encontrada com os filtros atuais.</p>
            <p>Clique no botão '+' para adicionar uma nova solicitação.</p>
          </div>
        )}
      </div>
    </div>
  );
};


/**
 * Componente: Visão de Administração de Usuários
 */
const AdminView: React.FC<{
  users: Doctor[];
  loggedInUser: Doctor;
  addToast: (msg: string, type: ToastType) => void;
  onUsersChange: () => void;
}> = ({ users, loggedInUser, addToast, onUsersChange }) => {
  const [editingUser, setEditingUser] = useState<Doctor | null>(null);
  const [formState, setFormState] = useState({ name: '', email: '', password: '', is_admin: false });

  useEffect(() => {
    if (editingUser) {
      setFormState({
        name: editingUser.name,
        email: editingUser.email,
        password: '',
        is_admin: !!editingUser.is_admin
      });
    } else {
      setFormState({ name: '', email: '', password: '', is_admin: false });
    }
  }, [editingUser]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormState(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name.trim() || !formState.email.trim()) {
      addToast('Nome e Email são obrigatórios.', 'error');
      return;
    }

    try {
        if (editingUser) {
            const { error } = await supabase.from('doctors')
              .update({
                  name: formState.name,
                  email: formState.email,
                  is_admin: formState.is_admin
              })
              .eq('id', editingUser.id);
            if (error) throw error;
            addToast('Usuário atualizado com sucesso!', 'success');
        } else {
            if (!formState.password) {
              addToast('A senha é obrigatória para novos usuários.', 'error');
              return;
            }
            const { data: authData, error: authError } = await supabase.auth.signUp({
              email: formState.email,
              password: formState.password
            });
            if (authError) throw authError;
            if (!authData.user) throw new Error("Não foi possível criar o usuário na autenticação.");

            const { error: profileError } = await supabase.from('doctors').insert({
              id: authData.user.id,
              name: formState.name,
              email: formState.email,
              is_admin: formState.is_admin,
              color: `hsl(${Math.random() * 360}, 70%, 50%)`
            });

            if (profileError) {
                await supabase.auth.admin.deleteUser(authData.user.id);
                throw profileError;
            }
            addToast('Usuário adicionado com sucesso!', 'success');
        }
        setEditingUser(null);
        onUsersChange();
    } catch (error: any) {
        addToast(`Erro: ${error.message}`, 'error');
    }
  };

  const handleDelete = async (userId: string) => {
      if (userId === loggedInUser.id) {
          addToast("Você não pode excluir sua própria conta.", 'error');
          return;
      }
      if (window.confirm('Tem certeza de que deseja excluir este perfil de usuário? A exclusão é permanente.')) {
        try {
            const { error } = await supabase.from('doctors').delete().eq('id', userId);
            if(error) throw error;
            addToast('Perfil de usuário excluído com sucesso!', 'success');
            onUsersChange();
        } catch(error: any) {
            addToast(`Erro ao excluir o perfil: ${error.message}`, 'error');
        }
      }
  };

  const cancelEdit = () => setEditingUser(null);

  return (
    <div className="admin-container">
      <h2>Gerenciar Usuários</h2>
      <div className="admin-form-card">
          <h3>{editingUser ? 'Editar Usuário' : 'Adicionar Novo Usuário'}</h3>
          <form onSubmit={handleSubmit} className="admin-form">
              <div className="form-group">
                <label htmlFor="name_admin">Nome</label>
                <input type="text" id="name_admin" name="name" value={formState.name} onChange={handleInputChange} required />
              </div>
               <div className="form-group">
                <label htmlFor="email_admin">Email</label>
                <input type="email" id="email_admin" name="email" value={formState.email} onChange={handleInputChange} required />
              </div>
              <div className="form-group">
                <label htmlFor="password_admin">Senha</label>
                <input type="password" id="password_admin" name="password" value={formState.password} onChange={handleInputChange} placeholder={editingUser ? "Deixe em branco para não alterar" : "Senha obrigatória"} />
              </div>
              <div className="form-group-checkbox">
                <label><input type="checkbox" name="is_admin" checked={formState.is_admin} onChange={handleInputChange} />É Administrador?</label>
              </div>
              <div className="admin-form-actions">
                  <button type="submit" className="btn btn-primary">{editingUser ? 'Salvar Alterações' : 'Adicionar Usuário'}</button>
                  {editingUser && <button type="button" className="btn btn-secondary" onClick={cancelEdit}>Cancelar</button>}
              </div>
          </form>
      </div>
      <div className="user-list">
        <h3>Usuários Atuais</h3>
        {users.map(user => (
          <div key={user.id} className="list-item">
            <span>{user.name} ({user.email}) {user.is_admin && <strong>(Admin)</strong>}</span>
            <div className="list-item-actions">
              <button className="btn btn-secondary" onClick={() => setEditingUser(user)}>Editar</button>
              <button className="btn btn-danger" onClick={() => handleDelete(user.id)} disabled={user.id === loggedInUser.id}>Excluir</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Componente: Painel de Detalhes do Dia
 */
const DayDetailPanel: React.FC<{ isOpen: boolean; onClose: () => void; selectedDate: Date | null; surgeriesForDay: Surgery[]; onSurgeryClick: (surgery: Surgery) => void; onAddNewSurgery: (date: Date) => void; users: Doctor[]; }> = ({ isOpen, onClose, selectedDate, surgeriesForDay, onSurgeryClick, onAddNewSurgery, users }) => {
    if (!selectedDate) return null;
    return (
        <>
            <div className={`day-detail-panel-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}></div>
            <div className={`day-detail-panel ${isOpen ? 'open' : ''}`}>
                <div className="day-detail-header"><h3>{selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</h3><button className="close-btn" onClick={onClose} aria-label="Fechar">&times;</button></div>
                <div className="day-detail-body">
                    {surgeriesForDay.length > 0 ? (
                        surgeriesForDay.sort((a,b) => new Date(a.date_time!).getTime() - new Date(b.date_time!).getTime()).map(s => {
                            const doctor = getUserById(s.main_surgeon_id, users);
                            const time = s.date_time ? new Date(s.date_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit'}) : '';
                            return (<div key={s.id} className="surgery-item" onClick={() => onSurgeryClick(s)} style={{'--doctor-color': doctor?.color} as React.CSSProperties}>
                                <div className="surgery-item-content"><span className="surgery-time">{time}</span><span className="surgery-patient">{s.patient_name}</span></div>
                            </div>);
                        })
                    ) : ( <div className="no-surgeries"><span className="material-symbols-outlined">event_busy</span><p>Nenhuma cirurgia neste dia.</p></div> )}
                </div>
                <div className="day-detail-footer"><button className="btn btn-primary btn-full" onClick={() => onAddNewSurgery(selectedDate)}>Adicionar Cirurgia</button></div>
            </div>
        </>
    );
};

/**
 * =================================================================================
 * COMPONENTE PRINCIPAL (APP)
 * Orquestra todos os estados, dados e componentes da aplicação.
 * =================================================================================
 */
const App = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [currentView, setCurrentView] = useState<'dashboard' | 'agenda' | 'solicitacoes' | 'relatorios' | 'cadastros' | 'admin'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [surgeryToEdit, setSurgeryToEdit] = useState<Surgery | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState(new Date());
  const [isDayPanelOpen, setIsDayPanelOpen] = useState(false);
  const [selectedDateForPanel, setSelectedDateForPanel] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // --- ALTERAÇÃO: Novo estado para controlar filtros entre componentes ---
  const [initialFilters, setInitialFilters] = useState<any | null>(null);

  const [users, setUsers] = useState<Doctor[]>([]);
  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [insurancePlans, setInsurancePlans] = useState<InsurancePlan[]>([]);

  const [loggedInUser, setLoggedInUser] = useState<Doctor | null>(null);
  const [appLoading, setAppLoading] = useState(true);

  const { addToast } = useToast();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

useEffect(() => {
  let isMounted = true;

  const loadProfile = async (session: any) => {
    try {
      if (session?.user) {
        const { data: profile, error } = await supabase
          .from('doctors')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (error || !profile) {
          console.warn("Perfil não encontrado, forçando logout.");
          await supabase.auth.signOut();
          if (isMounted) setLoggedInUser(null);
        } else {
          if (isMounted) setLoggedInUser(profile);
        }
      } else {
        if (isMounted) setLoggedInUser(null);
      }
    } catch (err) {
      console.error("Erro ao carregar perfil:", err);
      if (isMounted) setLoggedInUser(null);
    } finally {
      if (isMounted) setAppLoading(false);
    }
  };

  supabase.auth.getSession().then(({ data }) => loadProfile(data.session));

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      loadProfile(session);
    }
  );

  return () => {
    isMounted = false;
    subscription.unsubscribe();
  };
}, []);


  useEffect(() => {
    if (loggedInUser) {
        const fetchData = async () => {
            try {
                const [doctorsRes, hospitalsRes, plansRes, surgeriesRes] = await Promise.all([
                    supabase.from('doctors').select('*'),
                    supabase.from('hospitals').select('*'),
                    supabase.from('insurance_plans').select('*'),
                    supabase.from('surgeries').select('*')
                ]);

                if (doctorsRes.error) throw doctorsRes.error; setUsers(doctorsRes.data || []);
                if (hospitalsRes.error) throw hospitalsRes.error; setHospitals(hospitalsRes.data || []);
                if (plansRes.error) throw plansRes.error; setInsurancePlans(plansRes.data || []);
                if (surgeriesRes.error) throw surgeriesRes.error; setSurgeries(surgeriesRes.data || []);

            } catch (error: any) { addToast(`Erro ao carregar dados: ${error.message}`, 'error'); }
        };
        fetchData();
    }
  }, [loggedInUser, addToast]);

  useEffect(() => {
    const channel = supabase.channel('public:surgeries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'surgeries' }, payload => {
        if (payload.eventType === 'INSERT') setSurgeries(current => [...current, payload.new as Surgery]);
        if (payload.eventType === 'UPDATE') setSurgeries(current => current.map(s => s.id === payload.new.id ? payload.new as Surgery : s));
        if (payload.eventType === 'DELETE') setSurgeries(current => current.filter(s => s.id !== (payload.old as any).id));
      }).subscribe();

    return () => { supabase.removeChannel(channel); }
  }, []);


  // === FUNÇÕES DE MANIPULAÇÃO DE DADOS (CRUD) ===
  const handleLogout = async () => {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.error("Erro ao sair:", err);
  } finally {
    setLoggedInUser(null);
    setUsers([]);
    setSurgeries([]);
    setHospitals([]);
    setInsurancePlans([]);
    setCurrentView('dashboard');
  }
};


  const handleSaveSurgery = async (formData: any, files: { preOp?: File, postOp?: File }) => {
    if (!loggedInUser) {
        addToast('Erro: Usuário não autenticado.', 'error');
        return;
    }

    try {
        const sanitizeFilename = (name: string) => {
            return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9.\-_]/g, '_').replace(/\s+/g, '_');
        };

        let pre_op_xray_path = formData.pre_op_xray_path;
        let post_op_xray_path = formData.post_op_xray_path;

        if (files.preOp && files.preOp instanceof File) {
            const sanitizedName = sanitizeFilename(files.preOp.name);
            const filePath = `${loggedInUser.id}/${Date.now()}-${sanitizedName}`;
            const { error: uploadError } = await supabase.storage.from('xrays').upload(filePath, files.preOp);
            if (uploadError) throw uploadError;
            pre_op_xray_path = filePath;
        }

        if (files.postOp && files.postOp instanceof File) {
            const sanitizedName = sanitizeFilename(files.postOp.name);
            const filePath = `${loggedInUser.id}/${Date.now()}-${sanitizedName}`;
            const { error: uploadError } = await supabase.storage.from('xrays').upload(filePath, files.postOp);
            if (uploadError) throw uploadError;
            post_op_xray_path = filePath;
        }

        // --- ALTERAÇÃO: Garante que a data seja nula se não for fornecida ---
        const dateTimeUTC = formData.date_time ? new Date(formData.date_time).toISOString() : null;

        const dataToSave: Omit<Surgery, 'id'> = {
            patient_name: formData.patient_name,
            main_surgeon_id: formData.main_surgeon_id,
            participating_ids: formData.participating_ids || [],
            date_time: dateTimeUTC,
            hospital_id: formData.hospital_id,
            insurance_id: formData.insurance_id,
            auth_status: formData.auth_status,
            surgery_status: formData.surgery_status,
            fees: formData.fees || {},
            material_cost: formData.material_cost || 0,
            notes: formData.notes || '',
            pre_op_xray_path: pre_op_xray_path,
            post_op_xray_path: post_op_xray_path,
        };

        const idToUpsert = surgeryToEdit ? { id: surgeryToEdit.id } : {};
        const { error: dbError } = await supabase.from('surgeries').upsert({ ...dataToSave, ...idToUpsert });

        if (dbError) throw dbError;

        addToast(surgeryToEdit ? 'Cirurgia atualizada com sucesso!' : 'Solicitação salva com sucesso!', 'success');
        setIsModalOpen(false);
        setSurgeryToEdit(null);

    } catch (error: any) {
        let errorMessage = error.message;
        if (error.message.includes('Storage')) {
            errorMessage = `Falha no upload do arquivo: ${error.message}`;
        }
        addToast(`Erro ao salvar: ${errorMessage}`, 'error');
    }
  };

  const handleAddHospital = async (name: string) => {
      const { data, error } = await supabase.from('hospitals').insert({ name }).select().single();
      if(error) addToast(`Erro ao adicionar hospital: ${error.message}`, 'error');
      else { setHospitals(prev => [...prev, data]); addToast('Hospital adicionado com sucesso!', 'success'); }
  };
  const handleDeleteHospital = async (id: number) => {
      const { error } = await supabase.from('hospitals').delete().match({ id });
      if(error) addToast(`Erro ao excluir hospital: ${error.message}`, 'error');
      else { setHospitals(prev => prev.filter(h => h.id !== id)); addToast('Hospital excluído com sucesso!', 'success'); }
  };
  const handleAddPlan = async (name: string) => {
      const { data, error } = await supabase.from('insurance_plans').insert({ name }).select().single();
      if(error) addToast(`Erro ao adicionar convênio: ${error.message}`, 'error');
      else { setInsurancePlans(prev => [...prev, data]); addToast('Convênio adicionado com sucesso!', 'success'); }
  };
  const handleDeletePlan = async (id: number) => {
      const { error } = await supabase.from('insurance_plans').delete().match({ id });
      if(error) addToast(`Erro ao excluir convênio: ${error.message}`, 'error');
      else { setInsurancePlans(prev => prev.filter(p => p.id !== id)); addToast('Convênio excluído com sucesso!', 'success'); }
  };

  const handleUpdateSurgeryStatus = async (surgeryId: number, status: 'Realizada' | 'Cancelada') => {
    const { error } = await supabase.from('surgeries').update({ surgery_status: status }).eq('id', surgeryId);
    if (error) addToast(`Erro ao atualizar status: ${error.message}`, 'error');
    else addToast('Status da cirurgia atualizado com sucesso!', 'success');
  };

  const handleSurgeryDrop = async (surgeryId: number, newDate: Date) => {
    const surgeryToMove = surgeries.find(s => s.id === surgeryId);
    if (!surgeryToMove || !surgeryToMove.date_time) return;
    const oldDateTime = new Date(surgeryToMove.date_time);
    const newDateTime = new Date(newDate);
    newDateTime.setHours(oldDateTime.getHours(), oldDateTime.getMinutes(), oldDateTime.getSeconds());
    const newDateTimeUTC = newDateTime.toISOString();

    const { error } = await supabase.from('surgeries').update({ date_time: newDateTimeUTC }).eq('id', surgeryId);
    if (error) addToast(`Erro ao reagendar cirurgia: ${error.message}`, 'error');
    else addToast('Cirurgia reagendada com sucesso!', 'success');
  };

  const handleUsersChange = useCallback(async () => {
    const { data, error } = await supabase.from('doctors').select('*');
    if (error) addToast(`Erro ao recarregar usuários: ${error.message}`, 'error');
    else setUsers(data || []);
  }, [addToast]);

  // === FUNÇÕES DE MANIPULAÇÃO DA UI ===
  const handleDayClick = (date: Date) => { setSelectedDateForPanel(date); setIsDayPanelOpen(true); };
  const handleAddNewSurgery = (date: Date) => { setSurgeryToEdit(null); setModalInitialDate(date); setIsModalOpen(true); setIsDayPanelOpen(false); };
  const handleSurgeryClick = (surgery: Surgery) => { setSurgeryToEdit(surgery); setIsModalOpen(true); setIsDayPanelOpen(false); };
  const handleSearchResultClick = (surgery: Surgery) => { handleSurgeryClick(surgery); setSearchQuery(''); };

  // --- ALTERAÇÃO: Nova função para navegar com um filtro pré-definido ---
  const handleNavigateWithFilter = (view: any, filters: any) => {
      setInitialFilters(filters);
      setCurrentView(view);
  };
  // --- ALTERAÇÃO: Reseta o filtro ao navegar normalmente pelo menu ---
  const handleNavigate = (view: any) => {
      setInitialFilters(null);
      setCurrentView(view);
  }

  const searchedSurgeries = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return surgeries.filter(s => s.patient_name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery, surgeries]);

  const surgeriesForSelectedDay = useMemo(() => {
      if (!selectedDateForPanel) return [];
      const panelDateStr = selectedDateForPanel.toDateString();
      return surgeries.filter(s => s.date_time && new Date(s.date_time).toDateString() === panelDateStr);
  }, [surgeries, selectedDateForPanel]);

  if (appLoading) {
     return (
        <div className="loading-fullscreen">
            <div className="logo-container">
                <span className="material-symbols-outlined">health_and_safety</span>
            </div>
            <h2>Carregando agenda...</h2>
        </div>
    );
}
  if (!loggedInUser) {
    return <LoginView />;
  }

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard': return <DashboardView surgeries={surgeries} users={users} hospitals={hospitals} onViewDetails={handleSurgeryClick} onUpdateStatus={handleUpdateSurgeryStatus} onNavigateWithFilter={handleNavigateWithFilter} />;
      case 'agenda': return <CalendarView surgeries={surgeries} onDayClick={handleDayClick} onSurgeryClick={handleSurgeryClick} onSurgeryDrop={handleSurgeryDrop} users={users} hospitals={hospitals} insurancePlans={insurancePlans} />;
      case 'solicitacoes': return <RequestsView surgeries={surgeries} users={users} insurancePlans={insurancePlans} onSurgeryClick={handleSurgeryClick} initialFilters={initialFilters} />;
      case 'relatorios': return <ReportsView surgeries={surgeries} hospitals={hospitals} insurancePlans={insurancePlans} users={users} theme={theme} />;
      case 'cadastros': return <SettingsView hospitals={hospitals} onAddHospital={handleAddHospital} onDeleteHospital={handleDeleteHospital} insurancePlans={insurancePlans} onAddPlan={handleAddPlan} onDeletePlan={handleDeletePlan} />;
      case 'admin': return loggedInUser.is_admin ? <AdminView users={users} loggedInUser={loggedInUser} addToast={addToast} onUsersChange={handleUsersChange} /> : null;
      default: return <h2>Selecione uma visão no menu superior.</h2>;
    }
  };

  return (
    <div className="app-container" data-theme={theme}>
      <AppHeader
        currentView={currentView} onNavigate={handleNavigate} loggedInUser={loggedInUser} onLogout={handleLogout}
        searchQuery={searchQuery} onSearchChange={e => setSearchQuery(e.target.value)} theme={theme}
        onToggleTheme={() => setTheme(p => p === 'light' ? 'dark' : 'light')}
      />
      {searchedSurgeries.length > 0 && (
          <div className="search-results"><ul>{searchedSurgeries.map(surgery => (
              <li key={surgery.id} onClick={() => handleSearchResultClick(surgery)}>
                  <div className="result-patient">{surgery.patient_name}</div>
                  <div className="result-details">{getUserById(surgery.main_surgeon_id, users)?.name} - {surgery.date_time ? new Date(surgery.date_time).toLocaleDateString('pt-BR') : 'A agendar'}</div>
              </li>))}</ul>
          </div>
      )}
      <main className="main-content">{renderContent()}</main>
      <button className="fab" onClick={() => handleAddNewSurgery(new Date())} aria-label="Adicionar nova solicitação"><span className="material-symbols-outlined">add</span></button>

      <SurgeryModal
        isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveSurgery}
        hospitals={hospitals} insurancePlans={insurancePlans} surgeryToEdit={surgeryToEdit}
        initialDate={modalInitialDate} loggedInUser={loggedInUser} users={users}
      />
      <DayDetailPanel
        isOpen={isDayPanelOpen} onClose={() => setIsDayPanelOpen(false)} selectedDate={selectedDateForPanel}
        surgeriesForDay={surgeriesForSelectedDay} onSurgeryClick={handleSurgeryClick}
        onAddNewSurgery={handleAddNewSurgery} users={users}
      />
    </div>
  );
};

// --- PONTO DE ENTRADA E RENDERIZAÇÃO FINAL NA DOM ---
const AppWrapper = () => (
  <ToastProvider>
    <App />
  </ToastProvider>
);

const container = document.getElementById('root');

if (container) {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <AppWrapper />
      </React.StrictMode>
    );
} else {
    console.error('Falha ao encontrar o elemento root. A aplicação não pôde ser montada.');
}
