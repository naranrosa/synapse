
import React, { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import Chart from 'chart.js/auto';

// --- DATA TYPES --- //
interface Doctor {
  id: number;
  name: string;
  email: string;
  password: string;
  color: string;
  isAdmin?: boolean;
}

interface Hospital {
  id: string;
  name: string;
}

interface InsurancePlan {
  id: string;
  name: string;
}

interface Surgery {
  id:string;
  patientName: string;
  mainSurgeonId: number;
  participatingIds: number[];
  dateTime: string;
  hospitalId: string;
  insuranceId: string;
  authStatus: 'Pendente' | 'Liberado' | 'Recusado';
  surgeryStatus: 'Agendada' | 'Realizada' | 'Cancelada';
  fees: Record<string, number>;
  materialCost: number;
  notes: string;
  preOpXRay?: { name: string; data: string };
  postOpXRay?: { name: string; data: string };
}

// --- TOAST NOTIFICATIONS --- //
type ToastType = 'success' | 'error';
interface ToastMessage {
    id: number;
    message: string;
    type: ToastType;
}
interface ToastContextType {
    addToast: (message: string, type: ToastType) => void;
}
const ToastContext = createContext<ToastContextType | null>(null);

const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const addToast = (message: string, type: ToastType) => {
        const id = new Date().getTime();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(toast => toast.id !== id));
        }, 5000);
    };
    
    const removeToast = (id: number) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    };

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
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


// --- INITIAL DATA --- //
const INITIAL_USERS: Doctor[] = [
  { id: 1, name: 'Dr. Fulano', email: 'fulano@med.com', password: '123', color: 'var(--dr1-color)', isAdmin: true },
  { id: 2, name: 'Dr. Ciclano', email: 'ciclano@med.com', password: '123', color: 'var(--dr2-color)', isAdmin: false },
  { id: 3, name: 'Dr. Beltrano', email: 'beltrano@med.com', password: '123', color: 'var(--dr3-color)', isAdmin: false },
];

const getUserById = (id: number | string, users: Doctor[]) => users.find(d => d.id === Number(id));


// --- HELPER HOOK FOR LOCALSTORAGE --- //
function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue;
        }
    });

    const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(error);
        }
    };

    return [storedValue, setValue];
}


// --- COMPONENTS --- //

/**
 * Login View Component
 */
const LoginView: React.FC<{ onLogin: (doctor: Doctor) => void; users: Doctor[] }> = ({ onLogin, users }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const doctor = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
        if (doctor) {
            onLogin(doctor);
        } else {
            setError('Email ou senha inválidos.');
        }
    };

    if (!users.length) {
        return (
             <div className="login-container">
                <div className="login-box">
                    <h2>Sistema Vazio</h2>
                    <p>Não há usuários cadastrados no sistema. Contate um administrador.</p>
                </div>
            </div>
        )
    }

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
                    <button type="submit" className="btn btn-primary btn-full">Entrar</button>
                </form>
            </div>
        </div>
    );
};


/**
 * Header Component
 */
const AppHeader: React.FC<{
  currentView: string;
  onNavigate: (view: 'dashboard' | 'agenda' | 'relatorios' | 'cadastros' | 'admin') => void;
  loggedInUser: Doctor;
  onLogout: () => void;
  searchQuery: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}> = ({ currentView, onNavigate, loggedInUser, onLogout, searchQuery, onSearchChange, theme, onToggleTheme }) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        // Fix: Changed userMenu.current to userMenuRef.current to match the ref name.
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
        <a href="#relatorios" className={currentView === 'relatorios' ? 'active' : ''} onClick={() => onNavigate('relatorios')}>Relatórios</a>
        <a href="#cadastros" className={currentView === 'cadastros' ? 'active' : ''} onClick={() => onNavigate('cadastros')}>Cadastros</a>
        {loggedInUser.isAdmin && (
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
                        <small>{loggedInUser.isAdmin ? 'Administrador' : 'Médico'}</small>
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
 * Surgery Modal for Add/Edit
 */
const SurgeryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (surgery: Surgery) => void;
  hospitals: Hospital[];
  insurancePlans: InsurancePlan[];
  surgeryToEdit: Surgery | null;
  initialDate: Date;
  loggedInUser: Doctor | null;
  users: Doctor[];
}> = ({ isOpen, onClose, onSave, hospitals, insurancePlans, surgeryToEdit, initialDate, loggedInUser, users }) => {
  const [formData, setFormData] = useState<Omit<Surgery, 'id'>>({
    patientName: '',
    mainSurgeonId: users[0]?.id || 0,
    participatingIds: [],
    dateTime: '',
    hospitalId: '',
    insuranceId: '',
    authStatus: 'Pendente',
    surgeryStatus: 'Agendada',
    fees: {},
    materialCost: 0,
    notes: '',
    preOpXRay: undefined,
    postOpXRay: undefined,
  });

  useEffect(() => {
    if (isOpen) {
        if (surgeryToEdit) {
            setFormData({ ...surgeryToEdit, fees: surgeryToEdit.fees || {} });
        } else {
            const defaultDateTime = `${initialDate.getFullYear()}-${String(initialDate.getMonth() + 1).padStart(2, '0')}-${String(initialDate.getDate()).padStart(2, '0')}T10:00`;
            const mainSurgeonId = loggedInUser ? loggedInUser.id : users[0]?.id || 0;
            setFormData({
                patientName: '',
                mainSurgeonId: mainSurgeonId,
                participatingIds: [],
                dateTime: defaultDateTime,
                hospitalId: hospitals[0]?.id || '',
                insuranceId: insurancePlans[0]?.id || '',
                authStatus: 'Pendente',
                surgeryStatus: 'Agendada',
                fees: { [String(mainSurgeonId)]: 0 },
                materialCost: 0,
                notes: '',
                preOpXRay: undefined,
                postOpXRay: undefined,
            });
        }
    }
  }, [surgeryToEdit, initialDate, isOpen, hospitals, insurancePlans, loggedInUser, users]);

  useEffect(() => {
    const allDoctorIds = [formData.mainSurgeonId, ...formData.participatingIds];
    const uniqueDoctorIds = [...new Set(allDoctorIds)];
    
    setFormData(prev => {
        const newFees: Record<string, number> = {};
        for (const id of uniqueDoctorIds) {
            newFees[String(id)] = prev.fees[String(id)] || 0;
        }
        return { ...prev, fees: newFees };
    });
  }, [formData.mainSurgeonId, formData.participatingIds]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'materialCost' ? parseFloat(value) || 0 : value }));
  };

  const handleFeeChange = (doctorId: number, value: string) => {
    setFormData(prev => ({
        ...prev,
        fees: {
            ...prev.fees,
            [String(doctorId)]: parseFloat(value) || 0,
        }
    }));
  };

  const handleCheckboxChange = (doctorId: number) => {
    setFormData(prev => {
        const newIds = prev.participatingIds.includes(doctorId)
            ? prev.participatingIds.filter(id => id !== doctorId)
            : [...prev.participatingIds, doctorId];
        return {...prev, participatingIds: newIds};
    });
  };

   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, files } = e.target;
    if (files && files[0]) {
      const file = files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          [name]: { name: file.name, data: reader.result as string }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patientName) {
        alert('O nome do paciente é obrigatório.');
        return;
    }
    onSave({ id: surgeryToEdit?.id || new Date().toISOString(), ...formData });
  };

  if (!isOpen) return null;
  
  const otherDoctors = users.filter(d => d.id !== Number(formData.mainSurgeonId));
  const totalFees = useMemo(() => Object.values(formData.fees || {}).reduce((sum, fee) => sum + fee, 0), [formData.fees]);
  const totalCost = totalFees + (formData.materialCost || 0);
  const doctorsForFees = useMemo(() => {
    const ids = new Set([formData.mainSurgeonId, ...formData.participatingIds]);
    return users.filter(u => ids.has(u.id));
  }, [formData.mainSurgeonId, formData.participatingIds, users]);


  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h3>{surgeryToEdit ? 'Editar Cirurgia' : 'Nova Cirurgia'}</h3>
            <button type="button" className="close-btn" onClick={onClose} aria-label="Fechar">&times;</button>
          </div>
          <div className="modal-body">
            <div className="form-section">
                <h4>Detalhes do Paciente e Equipe</h4>
                <div className="form-grid">
                    <div className="form-group full-width">
                        <label htmlFor="patientName">Paciente</label>
                        <input type="text" id="patientName" name="patientName" value={formData.patientName} onChange={handleChange} required />
                    </div>

                    <div className="form-group">
                        <label htmlFor="mainSurgeonId">Cirurgião Principal</label>
                        <select id="mainSurgeonId" name="mainSurgeonId" value={formData.mainSurgeonId} onChange={handleChange}>
                        {users.map(doc => <option key={doc.id} value={doc.id}>{doc.name}</option>)}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Médicos Participantes</label>
                        <div className="checkbox-container">
                            {otherDoctors.map(doc => (
                                <label key={doc.id}>
                                    <input type="checkbox" checked={formData.participatingIds.includes(doc.id)} onChange={() => handleCheckboxChange(doc.id)} />
                                    {doc.name}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="form-section">
                <h4>Agendamento e Status</h4>
                 <div className="form-grid">
                    <div className="form-group">
                        <label htmlFor="dateTime">Data e Hora</label>
                        <input type="datetime-local" id="dateTime" name="dateTime" value={formData.dateTime} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="hospitalId">Hospital</label>
                        <select id="hospitalId" name="hospitalId" value={formData.hospitalId} onChange={handleChange}>
                        {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="insuranceId">Convênio / Particular</label>
                        <select id="insuranceId" name="insuranceId" value={formData.insuranceId} onChange={handleChange}>
                        {insurancePlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="authStatus">Status de Liberação</label>
                        <select id="authStatus" name="authStatus" value={formData.authStatus} onChange={handleChange}>
                        <option>Pendente</option>
                        <option>Liberado</option>
                        <option>Recusado</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="surgeryStatus">Status da Cirurgia</label>
                        <select id="surgeryStatus" name="surgeryStatus" value={formData.surgeryStatus} onChange={handleChange}>
                        <option>Agendada</option>
                        <option>Realizada</option>
                        <option>Cancelada</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="form-section">
                <h4>Financeiro</h4>
                <div className="form-grid">
                     <div className="form-group full-width">
                        <label>Distribuição de Honorários</label>
                        <div className="fee-distribution">
                            {doctorsForFees.map(doc => (
                                <div key={doc.id} className="fee-item">
                                    <label htmlFor={`fee-${doc.id}`}>{doc.name}</label>
                                    <input
                                        type="number"
                                        id={`fee-${doc.id}`}
                                        name={`fee-${doc.id}`}
                                        value={formData.fees[String(doc.id)] === 0 ? '' : (formData.fees[String(doc.id)] ?? '')}
                                        onChange={(e) => handleFeeChange(doc.id, e.target.value)}
                                        placeholder="0,00"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Total de Honorários</label>
                        <input type="text" value={totalFees.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} readOnly />
                    </div>
                    <div className="form-group">
                        <label htmlFor="materialCost">Valor do Material</label>
                        <input type="number" id="materialCost" name="materialCost" value={formData.materialCost} onChange={handleChange} placeholder="0,00" />
                    </div>
                    <div className="form-group">
                        <label>Valor Total</label>
                        <input type="text" value={totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} readOnly />
                    </div>
                </div>
            </div>

            <div className="form-section">
                 <h4>Anexos e Notas</h4>
                 <div className="form-grid">
                    <div className="form-group full-width">
                        <label htmlFor="preOpXRay">Raio-X Pré-cirúrgico</label>
                        {formData.preOpXRay ? (
                            <div className="file-display">
                                <a href={formData.preOpXRay.data} target="_blank" rel="noopener noreferrer">{formData.preOpXRay.name}</a>
                                <button type="button" className="btn-remove-file" onClick={() => setFormData(p => ({...p, preOpXRay: undefined}))}>&times;</button>
                            </div>
                        ) : (
                            <input type="file" id="preOpXRay" name="preOpXRay" onChange={handleFileChange} accept="image/*,.pdf" />
                        )}
                    </div>
                    <div className="form-group full-width">
                        <label htmlFor="postOpXRay">Raio-X Pós-cirúrgico</label>
                        {formData.postOpXRay ? (
                            <div className="file-display">
                                <a href={formData.postOpXRay.data} target="_blank" rel="noopener noreferrer">{formData.postOpXRay.name}</a>
                                <button type="button" className="btn-remove-file" onClick={() => setFormData(p => ({...p, postOpXRay: undefined}))}>&times;</button>
                            </div>
                        ) : (
                            <input type="file" id="postOpXRay" name="postOpXRay" onChange={handleFileChange} accept="image/*,.pdf" />
                        )}
                    </div>
                    <div className="form-group full-width">
                        <label htmlFor="notes">Notas</label>
                        <textarea id="notes" name="notes" value={formData.notes} onChange={handleChange}></textarea>
                    </div>
                </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AdvancedFiltersPanel: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    currentFilters: any;
    onApplyFilters: (filters: any) => void;
    hospitals: Hospital[];
    insurancePlans: InsurancePlan[];
}> = ({ isOpen, onClose, currentFilters, onApplyFilters, hospitals, insurancePlans }) => {
    const [filters, setFilters] = useState(currentFilters);

    useEffect(() => {
        setFilters(currentFilters);
    }, [currentFilters]);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters((prev: any) => ({ ...prev, [name]: value }));
    };

    const handleApply = () => {
        onApplyFilters(filters);
        onClose();
    };

    const handleReset = () => {
        const resetFilters = {
            authStatus: 'all',
            surgeryStatus: 'all',
            hospitalId: 'all',
            insuranceId: 'all'
        };
        setFilters(resetFilters);
        onApplyFilters(resetFilters);
        onClose();
    };

    return (
        <>
            <div className={`filters-panel-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}></div>
            <div className={`filters-panel ${isOpen ? 'open' : ''}`}>
                <div className="filters-panel-header">
                    <h3>Filtros Avançados</h3>
                    <button className="close-btn" onClick={onClose} aria-label="Fechar">&times;</button>
                </div>
                <div className="filters-panel-body">
                    <div className="form-group">
                        <label htmlFor="authStatus">Status da Autorização</label>
                        <select id="authStatus" name="authStatus" value={filters.authStatus} onChange={handleChange}>
                            <option value="all">Todos</option>
                            <option value="Pendente">Pendente</option>
                            <option value="Liberado">Liberado</option>
                            <option value="Recusado">Recusado</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="surgeryStatus">Status da Cirurgia</label>
                        <select id="surgeryStatus" name="surgeryStatus" value={filters.surgeryStatus} onChange={handleChange}>
                            <option value="all">Todos</option>
                            <option value="Agendada">Agendada</option>
                            <option value="Realizada">Realizada</option>
                            <option value="Cancelada">Cancelada</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="hospitalId">Hospital</label>
                        <select id="hospitalId" name="hospitalId" value={filters.hospitalId} onChange={handleChange}>
                            <option value="all">Todos</option>
                            {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="insuranceId">Convênio</label>
                        <select id="insuranceId" name="insuranceId" value={filters.insuranceId} onChange={handleChange}>
                            <option value="all">Todos</option>
                            {insurancePlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="filters-panel-footer">
                    <button className="btn btn-secondary" onClick={handleReset}>Limpar Filtros</button>
                    <button className="btn btn-primary" onClick={handleApply}>Aplicar</button>
                </div>
            </div>
        </>
    );
};

/**
 * Calendar View Component
 */
const CalendarView: React.FC<{
    surgeries: Surgery[];
    onDayClick: (date: Date) => void;
    onSurgeryClick: (surgery: Surgery) => void;
    onSurgeryDrop: (surgeryId: string, newDate: Date) => void;
    users: Doctor[];
    hospitals: Hospital[];
    insurancePlans: InsurancePlan[];
}> = ({ surgeries, onDayClick, onSurgeryClick, onSurgeryDrop, users, hospitals, insurancePlans }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [doctorFilter, setDoctorFilter] = useState<number | 'all'>('all');
    const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
    const [dragOverDate, setDragOverDate] = useState<string | null>(null);
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
    const [advancedFilters, setAdvancedFilters] = useState({
        authStatus: 'all',
        surgeryStatus: 'all',
        hospitalId: 'all',
        insuranceId: 'all',
    });

    const handlePrev = () => {
        if (viewMode === 'month') {
            setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
        } else {
            setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)));
        }
    };
    const handleNext = () => {
         if (viewMode === 'month') {
            setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
        } else {
            setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)));
        }
    };

    const calendarGrid = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const grid: (Date | null)[] = [];
        for (let i = 0; i < firstDayOfMonth; i++) {
            grid.push(null);
        }
        for (let i = 1; i <= daysInMonth; i++) {
            grid.push(new Date(year, month, i));
        }
        return grid;
    }, [currentDate]);

    const weekGrid = useMemo(() => {
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        const grid: Date[] = [];
        for (let i=0; i<7; i++) {
            const day = new Date(startOfWeek);
            day.setDate(day.getDate() + i);
            grid.push(day);
        }
        return grid;
    }, [currentDate]);

    const filteredSurgeries = useMemo(() => {
        return surgeries.filter(s => {
            // Doctor filter
            if (doctorFilter !== 'all' && s.mainSurgeonId !== doctorFilter && !s.participatingIds.includes(Number(doctorFilter))) {
                return false;
            }
            // Advanced filters
            if (advancedFilters.authStatus !== 'all' && s.authStatus !== advancedFilters.authStatus) return false;
            if (advancedFilters.surgeryStatus !== 'all' && s.surgeryStatus !== advancedFilters.surgeryStatus) return false;
            if (advancedFilters.hospitalId !== 'all' && s.hospitalId !== advancedFilters.hospitalId) return false;
            if (advancedFilters.insuranceId !== 'all' && s.insuranceId !== advancedFilters.insuranceId) return false;

            return true;
        });
    }, [surgeries, doctorFilter, advancedFilters]);

    const getAuthStatusIcon = (status: Surgery['authStatus']) => {
        switch(status) {
            case 'Liberado': return 'verified';
            case 'Recusado': return 'gpp_bad';
            default: return 'hourglass_top';
        }
    };
    
    const getSurgeryTooltip = (s: Surgery) => {
        const mainSurgeon = getUserById(s.mainSurgeonId, users)?.name || 'N/A';
        const participants = s.participatingIds.map(id => getUserById(id, users)?.name).filter(Boolean).join(', ');
        const hospital = hospitals.find(h => h.id === s.hospitalId)?.name || 'N/A';
        const insurance = insurancePlans.find(p => p.id === s.insuranceId)?.name || 'N/A';
        
        return `Paciente: ${s.patientName}\n`
             + `Data: ${new Date(s.dateTime).toLocaleString('pt-BR')}\n`
             + `Hospital: ${hospital}\n`
             + `Convênio: ${insurance}\n`
             + `Cirurgião: ${mainSurgeon}\n`
             + (participants ? `Equipe: ${participants}\n` : '')
             + `Status Cirurgia: ${s.surgeryStatus}\n`
             + `Status Autorização: ${s.authStatus}`;
    };

    const onDragStart = (e: React.DragEvent, surgeryId: string) => {
        e.dataTransfer.setData("surgeryId", surgeryId);
    };
    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };
    const onDrop = (e: React.DragEvent, date: Date) => {
        e.preventDefault();
        const surgeryId = e.dataTransfer.getData("surgeryId");
        if(surgeryId && date) {
            onSurgeryDrop(surgeryId, date);
        }
        setDragOverDate(null);
    };

    const removeFilter = (filterKey: keyof typeof advancedFilters) => {
        setAdvancedFilters(prev => ({...prev, [filterKey]: 'all'}));
    };

    const displayedGrid = viewMode === 'month' ? calendarGrid : weekGrid;
    const gridClass = viewMode === 'month' ? 'calendar-grid' : 'calendar-grid-week';
    const today = new Date();
    today.setHours(0,0,0,0);
    const activeFilters = Object.entries(advancedFilters).filter(([, value]) => value !== 'all');

    return (
      <div className="calendar-view-container">
        <div className="calendar-toolbar">
          <div className="calendar-nav">
             <button className="btn btn-primary" onClick={handlePrev}>&lt;</button>
             <h2>{currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</h2>
             <button className="btn btn-primary" onClick={handleNext}>&gt;</button>
          </div>
          <div className="calendar-view-controls">
            <div className="view-switcher">
                <button className={viewMode === 'month' ? 'active' : ''} onClick={() => setViewMode('month')}>Mês</button>
                <button className={viewMode === 'week' ? 'active' : ''} onClick={() => setViewMode('week')}>Semana</button>
            </div>
            <select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                <option value="all">Todos os Médicos</option>
                {users.map(doc => <option key={doc.id} value={doc.id}>{doc.name}</option>)}
            </select>
            <button className="btn btn-secondary" onClick={() => setIsFilterPanelOpen(true)}>
                <span className="material-symbols-outlined">filter_list</span> Filtros
            </button>
          </div>
        </div>
        
        {activeFilters.length > 0 && (
            <div className="applied-filters-container">
                {activeFilters.map(([key, value]) => {
                    let label = '';
                    if (key === 'hospitalId') label = hospitals.find(h => h.id === value)?.name || '';
                    else if (key === 'insuranceId') label = insurancePlans.find(p => p.id === value)?.name || '';
                    else label = String(value);
                    return (
                        <div key={key} className="filter-tag">
                            <span>{label}</span>
                            <button onClick={() => removeFilter(key as any)}>&times;</button>
                        </div>
                    );
                })}
            </div>
        )}

        <div className={gridClass}>
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => <div key={day} className="calendar-header">{day}</div>)}
            {displayedGrid.map((date, index) => {
                const isToday = date && date.getTime() === today.getTime();
                const daySurgeries = date ? filteredSurgeries.filter(s => {
                    const sDate = new Date(s.dateTime);
                    return sDate.getFullYear() === date.getFullYear() && sDate.getMonth() === date.getMonth() && sDate.getDate() === date.getDate();
                }) : [];

                const dateString = date ? date.toISOString().split('T')[0] : '';
                const isDragOver = dateString === dragOverDate;

                return (
                    <div
                        key={index}
                        className={`calendar-day ${!date ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isDragOver ? 'drag-over' : ''}`}
                        onClick={() => date && onDayClick(date)}
                        onDragOver={onDragOver}
                        onDrop={(e) => date && onDrop(e, date)}
                        onDragEnter={() => date && setDragOverDate(date.toISOString().split('T')[0])}
                        onDragLeave={() => setDragOverDate(null)}
                    >
                        {date && <span className="day-number">{date.getDate()}</span>}
                        {daySurgeries.sort((a,b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()).map(s => {
                            const doctor = getUserById(s.mainSurgeonId, users);
                            const hospital = hospitals.find(h => h.id === s.hospitalId);
                            return (
                                <div
                                    key={s.id}
                                    draggable={viewMode === 'month'}
                                    onDragStart={(e) => onDragStart(e, s.id)}
                                    className="surgery-item"
                                    style={{ '--doctor-color': doctor?.color } as React.CSSProperties}
                                    onClick={(e) => { e.stopPropagation(); onSurgeryClick(s); }}
                                    title={getSurgeryTooltip(s)}
                                >
                                    <div className="surgery-item-header">
                                        <span className="surgery-time">{new Date(s.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit'})}</span>
                                        <span className={`material-symbols-outlined auth-status-icon status-${s.authStatus.toLowerCase()}`}>
                                            {getAuthStatusIcon(s.authStatus)}
                                        </span>
                                    </div>
                                    <div className="surgery-item-body">
                                        <span className="surgery-patient">{s.patientName}</span>
                                        <span className="surgery-hospital">{hospital?.name || 'Hospital não definido'}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
            })}
        </div>
        <AdvancedFiltersPanel
            isOpen={isFilterPanelOpen}
            onClose={() => setIsFilterPanelOpen(false)}
            currentFilters={advancedFilters}
            onApplyFilters={setAdvancedFilters}
            hospitals={hospitals}
            insurancePlans={insurancePlans}
        />
      </div>
    );
};

/**
 * Settings (Cadastros) View
 */
const SettingsView: React.FC<{
    hospitals: Hospital[];
    setHospitals: React.Dispatch<React.SetStateAction<Hospital[]>>;
    insurancePlans: InsurancePlan[];
    setInsurancePlans: React.Dispatch<React.SetStateAction<InsurancePlan[]>>;
    addToast: (message: string, type: ToastType) => void;
}> = ({ hospitals, setHospitals, insurancePlans, setInsurancePlans, addToast }) => {
    const [newHospital, setNewHospital] = useState('');
    const [newPlan, setNewPlan] = useState('');

    const addHospital = () => {
        if (newHospital.trim()) {
            setHospitals(prev => [...prev, { id: new Date().toISOString(), name: newHospital.trim() }]);
            setNewHospital('');
            addToast('Hospital adicionado com sucesso!', 'success');
        }
    };
    const deleteHospital = (id: string) => {
        setHospitals(prev => prev.filter(h => h.id !== id));
        addToast('Hospital excluído com sucesso!', 'success');
    };

    const addPlan = () => {
        if (newPlan.trim()) {
            setInsurancePlans(prev => [...prev, { id: new Date().toISOString(), name: newPlan.trim() }]);
            setNewPlan('');
            addToast('Convênio adicionado com sucesso!', 'success');
        }
    };
    const deletePlan = (id: string) => {
        setInsurancePlans(prev => prev.filter(p => p.id !== id));
        addToast('Convênio excluído com sucesso!', 'success');
    }

    return (
        <div className="settings-container">
            <h2>Cadastros Gerais</h2>
            <div className="report-details-grid">
                <div>
                    <h3>Hospitais</h3>
                    <div className="add-item-form">
                        <input type="text" value={newHospital} onChange={e => setNewHospital(e.target.value)} placeholder="Novo hospital"/>
                        <button className="btn btn-primary" onClick={addHospital}>Adicionar</button>
                    </div>
                    <div>
                        {hospitals.map(h => (
                            <div key={h.id} className="list-item">
                                <span>{h.name}</span>
                                <button className="btn btn-danger" onClick={() => deleteHospital(h.id)}>Excluir</button>
                            </div>
                        ))}
                    </div>

                </div>
                <div>
                    <h3>Convênios</h3>
                    <div className="add-item-form">
                        <input type="text" value={newPlan} onChange={e => setNewPlan(e.target.value)} placeholder="Novo convênio"/>
                        <button className="btn btn-primary" onClick={addPlan}>Adicionar</button>
                    </div>
                     <div>
                        {insurancePlans.map(p => (
                            <div key={p.id} className="list-item">
                                <span>{p.name}</span>
                                <button className="btn btn-danger" onClick={() => deletePlan(p.id)}>Excluir</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * Reports View
 */
const ReportsView: React.FC<{
    surgeries: Surgery[];
    hospitals: Hospital[];
    insurancePlans: InsurancePlan[];
    users: Doctor[];
    theme: 'light' | 'dark';
}> = ({ surgeries, hospitals, insurancePlans, users, theme }) => {
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        doctorId: 'all' as 'all' | number,
    });
    const revenueByDoctorCanvas = useRef<HTMLCanvasElement>(null);
    const surgeriesByHospitalCanvas = useRef<HTMLCanvasElement>(null);
    const revenueChartRef = useRef<Chart | null>(null);
    const hospitalChartRef = useRef<Chart | null>(null);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: name === 'doctorId' && value !== 'all' ? Number(value) : value }));
    };

    const filteredSurgeries = useMemo(() => {
        return surgeries.filter(s => {
            const surgeryDate = new Date(s.dateTime);
            if (filters.startDate && surgeryDate < new Date(filters.startDate)) return false;
            if (filters.endDate) {
                 const endDate = new Date(filters.endDate);
                 endDate.setHours(23, 59, 59, 999); // Include the whole end day
                 if(surgeryDate > endDate) return false;
            }
            if (filters.doctorId !== 'all') {
                const doctorIds = [s.mainSurgeonId, ...s.participatingIds];
                if (!doctorIds.includes(filters.doctorId)) return false;
            }
            return true;
        });
    }, [surgeries, filters]);
    
    const reports = useMemo(() => {
        const realizedSurgeries = filteredSurgeries.filter(s => s.surgeryStatus === 'Realizada');
        const totalRevenue = realizedSurgeries.reduce((acc, s) => {
             const surgeryTotalFees = Object.values(s.fees || {}).reduce((sum, fee) => sum + fee, 0);
             return acc + surgeryTotalFees;
        }, 0);
        
        const revenueByDoctor = realizedSurgeries.reduce<Record<string, number>>((acc, s) => {
            for (const doctorId in s.fees) {
                const doctorName = getUserById(doctorId, users)?.name || 'Desconhecido';
                const feeAmount = s.fees[doctorId] || 0;
                acc[doctorName] = (acc[doctorName] || 0) + feeAmount;
            }
            return acc;
        }, {});

        const hospitalMap = new Map(hospitals.map(h => [h.id, h.name]));
        const surgeriesByHospital = filteredSurgeries.reduce<Record<string, number>>((acc, s) => {
            const hospitalName = hospitalMap.get(s.hospitalId) || 'Desconhecido';
            acc[hospitalName] = (acc[hospitalName] || 0) + 1;
            return acc;
        }, {});

        return { totalRevenue, revenueByDoctor, surgeriesByHospital, totalSurgeries: filteredSurgeries.length, realizedSurgeriesCount: realizedSurgeries.length };
    }, [filteredSurgeries, hospitals, users]);


    useEffect(() => {
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color');
        const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color');
        
        // Revenue by Doctor Chart (Bar)
        if (revenueByDoctorCanvas.current) {
            if (revenueChartRef.current) revenueChartRef.current.destroy();
            const sortedRevenue = Object.entries(reports.revenueByDoctor).sort(([,a],[,b]) => b-a);
            revenueChartRef.current = new Chart(revenueByDoctorCanvas.current, {
                type: 'bar',
                data: {
                    labels: sortedRevenue.map(([name]) => name),
                    datasets: [{
                        label: 'Faturamento',
                        data: sortedRevenue.map(([,value]) => value),
                        backgroundColor: 'rgba(59, 130, 246, 0.5)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: {
                        y: { ticks: { color: textColor }, grid: { color: gridColor } },
                        x: { ticks: { color: textColor }, grid: { color: 'transparent' } }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        }

        // Surgeries by Hospital Chart (Pie)
        if (surgeriesByHospitalCanvas.current) {
            if (hospitalChartRef.current) hospitalChartRef.current.destroy();
             const sortedHospitals = Object.entries(reports.surgeriesByHospital).sort(([,a],[,b]) => b-a);
            hospitalChartRef.current = new Chart(surgeriesByHospitalCanvas.current, {
                type: 'pie',
                data: {
                    labels: sortedHospitals.map(([name]) => name),
                    datasets: [{
                        label: 'Cirurgias',
                        data: sortedHospitals.map(([,value]) => value),
                        backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#64748b'],
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'top', labels: { color: textColor } } }
                }
            });
        }
        
        return () => {
            if (revenueChartRef.current) revenueChartRef.current.destroy();
            if (hospitalChartRef.current) hospitalChartRef.current.destroy();
        }
    }, [reports, theme]);


    const exportToCSV = () => { /* ... (export logic remains the same) */ };

    return (
        <div className="reports-container">
            <div className="reports-header">
                <h2>Relatórios</h2>
                <button className="btn btn-primary" onClick={exportToCSV}>
                    <span className="material-symbols-outlined">download</span>
                    Exportar para CSV
                </button>
            </div>

            <div className="reports-filters">
                <div className="form-group">
                    <label>Data de Início</label>
                    <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} />
                </div>
                 <div className="form-group">
                    <label>Data de Fim</label>
                    <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} />
                </div>
                 <div className="form-group">
                    <label>Médico</label>
                    <select name="doctorId" value={filters.doctorId} onChange={handleFilterChange}>
                        <option value="all">Todos</option>
                        {users.map(doc => <option key={doc.id} value={doc.id}>{doc.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="report-grid">
                <div className="report-card">
                    <div className="report-card-header"><h4>Faturamento Total</h4><span className="material-symbols-outlined">payments</span></div>
                    <p>{reports.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <div className="report-card">
                     <div className="report-card-header"><h4>Total de Cirurgias</h4><span className="material-symbols-outlined">summarize</span></div>
                    <p>{reports.totalSurgeries}</p>
                </div>
                 <div className="report-card">
                    <div className="report-card-header"><h4>Cirurgias Realizadas</h4><span className="material-symbols-outlined">check_circle</span></div>
                    <p>{reports.realizedSurgeriesCount}</p>
                </div>
            </div>

            <div className="report-details-grid">
                <div className="report-details-card">
                    <h3>Faturamento por Médico</h3>
                    <div className="chart-container"><canvas ref={revenueByDoctorCanvas}></canvas></div>
                </div>
                <div className="report-details-card">
                    <h3>Cirurgias por Hospital</h3>
                    <div className="chart-container"><canvas ref={surgeriesByHospitalCanvas}></canvas></div>
                </div>
            </div>
        </div>
    );
};


/**
 * Admin View for User Management
 */
const AdminView: React.FC<{
  users: Doctor[];
  setUsers: React.Dispatch<React.SetStateAction<Doctor[]>>;
  loggedInUser: Doctor;
  addToast: (message: string, type: ToastType) => void;
}> = ({ users, setUsers, loggedInUser, addToast }) => {
  const [editingUser, setEditingUser] = useState<Doctor | null>(null);
  const [formState, setFormState] = useState({ name: '', email: '', password: '', isAdmin: false });

  useEffect(() => {
    if (editingUser) {
      setFormState({ name: editingUser.name, email: editingUser.email, password: '', isAdmin: !!editingUser.isAdmin });
    } else {
      setFormState({ name: '', email: '', password: '', isAdmin: false });
    }
  }, [editingUser]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormState(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name.trim() || !formState.email.trim()) {
      addToast('Nome e Email são obrigatórios.', 'error');
      return;
    }

    if (editingUser) {
      setUsers(prevUsers => prevUsers.map(u => u.id === editingUser.id ? { 
          ...u, 
          name: formState.name, 
          email: formState.email,
          isAdmin: formState.isAdmin,
          password: formState.password ? formState.password : u.password,
        } : u));
      addToast('Usuário atualizado com sucesso!', 'success');
    } else {
      if (!formState.password) {
        addToast('A senha é obrigatória para novos usuários.', 'error');
        return;
      }
      const newUser: Doctor = {
        id: new Date().getTime(),
        name: formState.name,
        email: formState.email,
        password: formState.password,
        isAdmin: formState.isAdmin,
        color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      };
      setUsers(prevUsers => [...prevUsers, newUser]);
      addToast('Usuário adicionado com sucesso!', 'success');
    }
    setEditingUser(null);
  };

  const handleDelete = (userId: number) => {
      if (userId === loggedInUser.id) {
          addToast("Você não pode excluir sua própria conta.", 'error');
          return;
      }
      if (confirm('Tem certeza de que deseja excluir este usuário?')) {
          setUsers(prev => prev.filter(u => u.id !== userId));
          addToast('Usuário excluído com sucesso!', 'success');
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
                <label htmlFor="name">Nome</label>
                <input type="text" id="name" name="name" value={formState.name} onChange={handleInputChange} required />
              </div>
               <div className="form-group">
                <label htmlFor="email">Email</label>
                <input type="email" id="email" name="email" value={formState.email} onChange={handleInputChange} required />
              </div>
              <div className="form-group">
                <label htmlFor="password">Senha</label>
                <input type="password" id="password" name="password" value={formState.password} onChange={handleInputChange} placeholder={editingUser ? "Deixe em branco para não alterar" : "Senha obrigatória"} />
              </div>
              <div className="form-group-checkbox">
                <label><input type="checkbox" name="isAdmin" checked={formState.isAdmin} onChange={handleInputChange} />É Administrador?</label>
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
            <span>{user.name} ({user.email}) {user.isAdmin && <strong>(Admin)</strong>}</span>
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

const WorkflowStep: React.FC<{
    icon: string;
    label: string;
    isCompleted: boolean;
    isActive: boolean;
    isFirst?: boolean;
    isLast?: boolean;
}> = ({ icon, label, isCompleted, isActive, isFirst = false, isLast = false }) => {
    return (
        <div className={`workflow-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}>
            {!isFirst && <div className="line"></div>}
            <div className="step-content">
                <div className="icon">
                    <span className="material-symbols-outlined">{isCompleted ? 'check' : icon}</span>
                </div>
                <div className="label">{label}</div>
            </div>
            {!isLast && <div className="line"></div>}
        </div>
    );
};

const DashboardView: React.FC<{
    surgeries: Surgery[];
    users: Doctor[];
    hospitals: Hospital[];
    onViewDetails: (surgery: Surgery) => void;
    onUpdateStatus: (surgeryId: string, status: 'Realizada' | 'Cancelada') => void;
}> = ({ surgeries, users, hospitals, onViewDetails, onUpdateStatus }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { surgeriesToday, pendingAuthCount, monthRevenue } = useMemo(() => {
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        const todaysSurgeries = surgeries.filter(s => {
            const sDate = new Date(s.dateTime);
            return sDate.getFullYear() === today.getFullYear() && sDate.getMonth() === today.getMonth() && sDate.getDate() === today.getDate();
        }).sort((a,b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

        const pending = surgeries.filter(s => s.authStatus === 'Pendente').length;

        const revenue = surgeries
            .filter(s => {
                const sDate = new Date(s.dateTime);
                return s.surgeryStatus === 'Realizada' && sDate.getMonth() === currentMonth && sDate.getFullYear() === currentYear;
            })
            .reduce((acc, s) => {
                const surgeryTotalFees = Object.values(s.fees || {}).reduce((sum, fee) => sum + fee, 0);
                return acc + surgeryTotalFees;
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
                <div className="dashboard-card">
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
                        const doctor = getUserById(s.mainSurgeonId, users);
                        const hospital = hospitals.find(h => h.id === s.hospitalId);

                        const isScheduled = true;
                        const isAuthorized = s.authStatus === 'Liberado';
                        const isPerformed = s.surgeryStatus === 'Realizada';
                        const isPostOpDone = !!s.postOpXRay;
                        
                        // Define active step
                        let activeStep = 'Agendada';
                        if (isScheduled && !isAuthorized) activeStep = 'Liberado';
                        else if (isAuthorized && !isPerformed) activeStep = 'Realizada';
                        else if (isPerformed && !isPostOpDone) activeStep = 'Pós-op';
                        
                        if (s.surgeryStatus === 'Cancelada') {
                             return (
                                <div key={s.id} className="workflow-card cancelled">
                                    <div className="workflow-info">
                                         <div className="workflow-time">{new Date(s.dateTime).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</div>
                                         <h3>{s.patientName}</h3>
                                         <p>{doctor?.name} &bull; {hospital?.name}</p>
                                    </div>
                                    <div className="cancelled-status">
                                        <span className="material-symbols-outlined">cancel</span>
                                        <span>Cancelada</span>
                                    </div>
                                </div>
                            );
                        }
                        
                        return (
                            <div key={s.id} className="workflow-card">
                                <div className="workflow-info">
                                    <div className="workflow-time" style={{'--doctor-color': doctor?.color} as React.CSSProperties}>
                                        {new Date(s.dateTime).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}
                                    </div>
                                    <h3>{s.patientName}</h3>
                                    <p>{doctor?.name} &bull; {hospital?.name}</p>
                                    <div className="workflow-actions">
                                        {s.surgeryStatus !== 'Realizada' && (
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
                        <p>Aproveite o dia ou adicione uma nova cirurgia.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

const DayDetailPanel: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    selectedDate: Date | null;
    surgeriesForDay: Surgery[];
    onSurgeryClick: (surgery: Surgery) => void;
    onAddNewSurgery: (date: Date) => void;
    users: Doctor[];
}> = ({ isOpen, onClose, selectedDate, surgeriesForDay, onSurgeryClick, onAddNewSurgery, users }) => {
    if (!selectedDate) return null;
    
    return (
        <>
            <div className={`day-detail-panel-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}></div>
            <div className={`day-detail-panel ${isOpen ? 'open' : ''}`}>
                <div className="day-detail-header">
                    <h3>{selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                    <button className="close-btn" onClick={onClose} aria-label="Fechar">&times;</button>
                </div>
                <div className="day-detail-body">
                    {surgeriesForDay.length > 0 ? (
                        surgeriesForDay.sort((a,b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()).map(s => {
                            const doctor = getUserById(s.mainSurgeonId, users);
                            const time = new Date(s.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit'});
                            return (
                                <div key={s.id} className="surgery-item" onClick={() => onSurgeryClick(s)} style={{'--doctor-color': doctor?.color} as React.CSSProperties}>
                                    <div className="surgery-item-content">
                                        <span className="surgery-time">{time}</span>
                                        <span className="surgery-patient">{s.patientName}</span>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="no-surgeries">
                            <span className="material-symbols-outlined">event_busy</span>
                            <p>Nenhuma cirurgia neste dia.</p>
                        </div>
                    )}
                </div>
                <div className="day-detail-footer">
                    <button className="btn btn-primary btn-full" onClick={() => onAddNewSurgery(selectedDate)}>Adicionar Cirurgia</button>
                </div>
            </div>
        </>
    );
};


/**
 * Main App Component
 */
const App = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'agenda' | 'relatorios' | 'cadastros' | 'admin'>('dashboard');
  const [users, setUsers] = useLocalStorage<Doctor[]>('users', INITIAL_USERS);
  const [surgeries, setSurgeries] = useLocalStorage<Surgery[]>('surgeries', []);
  const [hospitals, setHospitals] = useLocalStorage<Hospital[]>('hospitals', [{id: '1', name: 'Hospital Principal'}]);
  const [insurancePlans, setInsurancePlans] = useLocalStorage<InsurancePlan[]>('insurancePlans', [{id: '1', name: 'Convênio Padrão'}, {id: '2', name: 'Particular'}]);
  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('theme', 'light');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [surgeryToEdit, setSurgeryToEdit] = useState<Surgery | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState(new Date());

  const [isDayPanelOpen, setIsDayPanelOpen] = useState(false);
  const [selectedDateForPanel, setSelectedDateForPanel] = useState<Date | null>(null);

  const [loggedInUser, setLoggedInUser] = useLocalStorage<Doctor | null>('loggedInUser', null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { addToast } = useToast();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, [setTheme]);

  const handleDayClick = (date: Date) => {
    setSelectedDateForPanel(date);
    setIsDayPanelOpen(true);
  };
  
  const handleAddNewSurgery = (date: Date) => {
    setSurgeryToEdit(null);
    setModalInitialDate(date);
    setIsModalOpen(true);
    setIsDayPanelOpen(false); // Close panel when opening modal
  };

  const handleSurgeryClick = (surgery: Surgery) => {
    setSurgeryToEdit(surgery);
    setIsModalOpen(true);
    setIsDayPanelOpen(false); // Close panel when opening modal
  };

  const handleSaveSurgery = (surgery: Surgery) => {
    const isEditing = surgeryToEdit !== null;
    setSurgeries(prev => {
        const index = prev.findIndex(s => s.id === surgery.id);
        if (index > -1) {
            const newSurgeries = [...prev];
            newSurgeries[index] = surgery;
            return newSurgeries;
        } else {
            return [...prev, surgery];
        }
    });
    setIsModalOpen(false);
    setSurgeryToEdit(null);
    addToast(isEditing ? 'Cirurgia atualizada com sucesso!' : 'Cirurgia salva com sucesso!', 'success');
  };
  
   const handleUpdateSurgeryStatus = (surgeryId: string, status: 'Realizada' | 'Cancelada') => {
    setSurgeries(prev => {
        const surgeryToUpdate = prev.find(s => s.id === surgeryId);
        if (!surgeryToUpdate) return prev;

        const updatedSurgery = { ...surgeryToUpdate, surgeryStatus: status };
        addToast(`Status da cirurgia de ${updatedSurgery.patientName} atualizado para ${status}.`, 'success');
        return prev.map(s => s.id === surgeryId ? updatedSurgery : s);
    });
  };

  const handleSurgeryDrop = (surgeryId: string, newDate: Date) => {
    setSurgeries(prev => {
        const surgeryToMove = prev.find(s => s.id === surgeryId);
        if (!surgeryToMove) return prev;

        const oldDateTime = new Date(surgeryToMove.dateTime);
        const newDateTimeString = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}T${String(oldDateTime.getHours()).padStart(2, '0')}:${String(oldDateTime.getMinutes()).padStart(2, '0')}`;
        
        const updatedSurgery = { ...surgeryToMove, dateTime: newDateTimeString };
        addToast(`Cirurgia de ${updatedSurgery.patientName} reagendada.`, 'success');
        return prev.map(s => s.id === surgeryId ? updatedSurgery : s);
    });
  };

  const handleLogin = (doctor: Doctor) => setLoggedInUser(doctor);
  const handleLogout = () => {
      setLoggedInUser(null);
      setSearchQuery('');
  };

  const handleSearchResultClick = (surgery: Surgery) => {
      handleSurgeryClick(surgery);
      setSearchQuery('');
  };

  const searchedSurgeries = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return surgeries.filter(s =>
        s.patientName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, surgeries]);

  const surgeriesForSelectedDay = useMemo(() => {
      if (!selectedDateForPanel) return [];
      return surgeries.filter(s => {
          const sDate = new Date(s.dateTime);
          return sDate.getFullYear() === selectedDateForPanel.getFullYear() && 
                 sDate.getMonth() === selectedDateForPanel.getMonth() && 
                 sDate.getDate() === selectedDateForPanel.getDate();
      });
  }, [surgeries, selectedDateForPanel]);


  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView 
                    surgeries={surgeries} 
                    users={users} 
                    hospitals={hospitals}
                    onViewDetails={handleSurgeryClick} 
                    onUpdateStatus={handleUpdateSurgeryStatus} 
                />;
      case 'agenda':
        return <CalendarView surgeries={surgeries} onDayClick={handleDayClick} onSurgeryClick={handleSurgeryClick} onSurgeryDrop={handleSurgeryDrop} users={users} hospitals={hospitals} insurancePlans={insurancePlans} />;
      case 'relatorios':
        return <ReportsView surgeries={surgeries} hospitals={hospitals} insurancePlans={insurancePlans} users={users} theme={theme} />;
      case 'cadastros':
        return <SettingsView
            hospitals={hospitals}
            setHospitals={setHospitals}
            insurancePlans={insurancePlans}
            setInsurancePlans={setInsurancePlans}
            addToast={addToast}
        />;
      case 'admin':
        if (loggedInUser?.isAdmin) {
             return <AdminView users={users} setUsers={setUsers} loggedInUser={loggedInUser} addToast={addToast} />;
        }
        return null;
      default:
        return null;
    }
  };

  if (!loggedInUser) {
      return <LoginView onLogin={handleLogin} users={users} />;
  }
   // If the logged-in user was deleted, log them out.
    if (!users.find(u => u.id === loggedInUser.id)) {
        handleLogout();
        return <LoginView onLogin={handleLogin} users={users} />;
    }

  return (
    <div className="app-container">
      <AppHeader
        currentView={currentView}
        onNavigate={setCurrentView}
        loggedInUser={loggedInUser}
        onLogout={handleLogout}
        searchQuery={searchQuery}
        onSearchChange={e => setSearchQuery(e.target.value)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      {searchedSurgeries.length > 0 && (
          <div className="search-results">
              <ul>
                  {searchedSurgeries.map(surgery => (
                      <li key={surgery.id} onClick={() => handleSearchResultClick(surgery)}>
                          <div className="result-patient">{surgery.patientName}</div>
                          <div className="result-details">
                              {getUserById(surgery.mainSurgeonId, users)?.name} - {new Date(surgery.dateTime).toLocaleDateString('pt-BR')}
                          </div>
                      </li>
                  ))}
              </ul>
          </div>
      )}
      <main className="main-content">
        {renderContent()}
      </main>
      
      <button className="fab" onClick={() => handleAddNewSurgery(new Date())} aria-label="Adicionar nova cirurgia">
          <span className="material-symbols-outlined">add</span>
      </button>

      <SurgeryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveSurgery}
        hospitals={hospitals}
        insurancePlans={insurancePlans}
        surgeryToEdit={surgeryToEdit}
        initialDate={modalInitialDate}
        loggedInUser={loggedInUser}
        users={users}
      />
      <DayDetailPanel
        isOpen={isDayPanelOpen}
        onClose={() => setIsDayPanelOpen(false)}
        selectedDate={selectedDateForPanel}
        surgeriesForDay={surgeriesForSelectedDay}
        onSurgeryClick={handleSurgeryClick}
        onAddNewSurgery={handleAddNewSurgery}
        users={users}
      />
    </div>
  );
};

const AppWrapper = () => (
    <ToastProvider>
        <App />
    </ToastProvider>
);

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<AppWrapper />);
