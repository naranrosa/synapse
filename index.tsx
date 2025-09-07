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
    const defaultDateTime = `${initialDate.getFullYear()}-${String(initialDate.getMonth() + 1).padStart(2, '0')}-${String(initialDate.getDate()).padStart(2, '0')}T10:00`;
    const mainSurgeonId = loggedInUser.id || '';
    return {
        patient_name: '', main_surgeon_id: mainSurgeonId, participating_ids: [] as string[], date_time: defaultDateTime,
        hospital_id: hospitals[0]?.id || 0, insurance_id: insurancePlans[0]?.id || 0, auth_status: 'Pendente' as const,
        surgery_status: 'Agendada' as const, fees: { [mainSurgeonId]: 0 }, notes: '',
        pre_op_xray_path: undefined, post_op_xray_path: undefined,
        terceiro_auxiliar_cost: 1000,
        instrumentador_cost: 500,
        anestesista_cost: 2500,
        hospital_uti_cost: 8000,
        material_cost: 7000,
    };
  }, [initialDate, loggedInUser, hospitals, insurancePlans]);

  const [formData, setFormData] = useState(createInitialState());
  const [files, setFiles] = useState<{ preOp?: File, postOp?: File }>({});

  useEffect(() => {
    if (isOpen) {
        if (surgeryToEdit) {
            setFormData({
                ...createInitialState(),
                ...surgeryToEdit,
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
            <h3>{surgeryToEdit ? 'Editar Cirurgia' : 'Nova Cirurgia'}</h3>
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
                <div className="form-group"><label htmlFor="date_time">Data e Hora</label><input type="datetime-local" id="date_time" name="date_time" value={formData.date_time} onChange={handleChange} /></div>
                <div className="form-group"><label htmlFor="hospital_id">Hospital</label><select id="hospital_id" name="hospital_id" value={formData.hospital_id} onChange={handleChange}>{hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
                <div className="form-group"><label htmlFor="insurance_id">Convênio / Particular</label><select id="insurance_id" name="insurance_id" value={formData.insurance_id} onChange={handleChange}>{insurancePlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                <div className="form-group"><label htmlFor="auth_status">Status de Liberação</label><select id="auth_status" name="auth_status" value={formData.auth_status} onChange={handleChange}><option>Pendente</option><option>Liberado</option><option>Recusado</option></select></div>
                <div className="form-group"><label htmlFor="surgery_status">Status da Cirurgia</label><select id="surgery_status" name="surgery_status" value={formData.surgery_status} onChange={handleChange}><option>Agendada</option><option>Realizada</option><option>Cancelada</option></select></div>
            </div></div>

            {/* --- Seção: Financeiro (Layout Corrigido) --- */}
            <div className="form-section"><h4>Financeiro</h4><div className="form-grid">
              <div className="form-group full-width"><label>Distribuição de Honorários</label><div className="fee-distribution">{doctorsForFees.map(doc => (<div key={doc.id} className="fee-item"><label htmlFor={`fee-${doc.id}`}>{doc.name}</label><input type="number" id={`fee-${doc.id}`} value={formData.fees[String(doc.id)] === 0 ? '' : (formData.fees[String(doc.id)] ?? '')} onChange={(e) => handleFeeChange(doc.id, e.target.value)} placeholder="0,00"/></div>))}</div></div>

              <div className="form-group"><label htmlFor="terceiro_auxiliar_cost">3º Auxiliar</label><input type="number" id="terceiro_auxiliar_cost" name="terceiro_auxiliar_cost" value={formData.terceiro_auxiliar_cost} onChange={handleChange} placeholder="0,00" /></div>
              <div className="form-group"><label htmlFor="instrumentador_cost">Instrumentador</label><input type="number" id="instrumentador_cost" name="instrumentador_cost" value={formData.instrumentador_cost} onChange={handleChange} placeholder="0,00" /></div>
              <div className="form-group"><label htmlFor="anestesista_cost">Anestesista</label><input type="number" id="anestesista_cost" name="anestesista_cost" value={formData.anestesista_cost} onChange={handleChange} placeholder="0,00" /></div>
              <div className="form-group"><label htmlFor="hospital_uti_cost">Despesa Hospitalar + UTI</label><input type="number" id="hospital_uti_cost" name="hospital_uti_cost" value={formData.hospital_uti_cost} onChange={handleChange} placeholder="0,00" /></div>

              <div className="form-group full-width"><label htmlFor="material_cost">Prótese</label><input type="number" id="material_cost" name="material_cost" value={formData.material_cost} onChange={handleChange} placeholder="0,00" /></div>

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
              <div className="form-group full-width"><label htmlFor="notes">Notas</label><textarea id="notes" name="notes" value={formData.notes} onChange={handleChange}></textarea></div>
            </div></div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="btn btn-primary">Salvar</button></div>
        </form>
      </div>
    </div>
  );
};
