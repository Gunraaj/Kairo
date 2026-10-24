import React, { useState, useRef } from 'react';
import { Modal } from './Modal';
import {
  BreakdownPlan,
  ProposedModule,
  ProposedTask,
  DocumentAnalysisInput,
  analyzeDocumentWithAi,
  parseOutlineOffline,
  SAMPLE_TEMPLATES,
  calculatePacing,
} from '../utils/documentBreakdown';
import { PresetCategory, SLICE_PRESETS } from '../utils/slicePresets';
import { Project } from '../types';

interface DocumentBreakdownModalProps {
  onClose: () => void;
  onImportPlan: (plan: {
    projectName: string;
    targetProjectId?: string;
    tasks: Array<{
      name: string;
      targetRounds: number;
      subTasks: Array<{ id: string; name: string; completed: boolean }>;
    }>;
  }) => void;
  existingProjects?: Project[];
  defaultProjectId?: string | null;
}

export const DocumentBreakdownModal: React.FC<DocumentBreakdownModalProps> = ({
  onClose,
  onImportPlan,
  existingProjects = [],
  defaultProjectId = null,
}) => {
  // Step state: 'input' | 'staging'
  const [step, setStep] = useState<'input' | 'staging'>('input');
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text');
  
  // Input fields
  const [rawText, setRawText] = useState('');
  const [selectedFile, setSelectedFile] = useState<{
    file: File;
    name: string;
    size: string;
    mimeType: string;
    base64?: string;
    extractedText?: string;
  } | null>(null);
  const [archetype, setArchetype] = useState<PresetCategory>('study');
  const [targetDeadline, setTargetDeadline] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Staging / Plan state
  const [plan, setPlan] = useState<BreakdownPlan | null>(null);
  const [projectName, setProjectName] = useState('');
  const [targetProjectId, setTargetProjectId] = useState<string | 'new'>(
    defaultProjectId || 'new'
  );
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [expandedTaskSubs, setExpandedTaskSubs] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeStr = file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
      : `${Math.round(file.size / 1024)} KB`;

    const mimeType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'text/plain');

    if (mimeType.includes('pdf')) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data:application/pdf;base64, prefix for Gemini inline_data
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        setSelectedFile({
          file,
          name: file.name,
          size: sizeStr,
          mimeType: 'application/pdf',
          base64,
        });
      };
      reader.readAsDataURL(file);
    } else {
      // Text or markdown file
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        setSelectedFile({
          file,
          name: file.name,
          size: sizeStr,
          mimeType: 'text/plain',
          extractedText: text,
        });
      };
      reader.readAsText(file);
    }
  };

  // Run analysis (AI or Offline outline parser)
  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const analysisInput: DocumentAnalysisInput = {
        archetype,
        deadline: targetDeadline || undefined,
      };

      if (inputMode === 'file' && selectedFile) {
        analysisInput.fileName = selectedFile.name;
        if (selectedFile.base64) {
          analysisInput.fileBase64 = selectedFile.base64;
          analysisInput.mimeType = selectedFile.mimeType;
        } else if (selectedFile.extractedText) {
          analysisInput.text = selectedFile.extractedText;
        }
      } else {
        analysisInput.text = rawText.trim();
        if (!analysisInput.text) {
          throw new Error('Please paste an outline, topic list, or syllabus text first.');
        }
      }

      const generatedPlan = await analyzeDocumentWithAi(analysisInput);
      setPlan(generatedPlan);
      setProjectName(generatedPlan.projectName);
      // Auto expand first module
      if (generatedPlan.modules.length > 0) {
        setExpandedModules(new Set([generatedPlan.modules[0].id]));
      }
      setStep('staging');
    } catch (err: any) {
      setAnalysisError(err?.message || 'Failed to analyze document. Please check format.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Load a starter sample template
  const loadSample = (sampleId: string) => {
    const sample = SAMPLE_TEMPLATES.find(s => s.id === sampleId);
    if (!sample) return;
    setRawText(sample.content);
    setArchetype(sample.archetype);
    setInputMode('text');
  };

  // Toggle module expansion
  const toggleModuleExpand = (moduleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  // Toggle task subtasks expansion
  const toggleSubtasksExpand = (taskId: string) => {
    setExpandedTaskSubs(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  // Toggle selection of a task
  const toggleTaskSelection = (moduleId: string, taskId: string) => {
    if (!plan) return;
    const updatedModules = plan.modules.map(mod => {
      if (mod.id !== moduleId) return mod;
      return {
        ...mod,
        tasks: mod.tasks.map(t => (t.id === taskId ? { ...t, selected: !t.selected } : t)),
      };
    });
    recalculatePlan(updatedModules);
  };

  // Toggle all tasks in a module
  const toggleModuleAllTasks = (moduleId: string) => {
    if (!plan) return;
    const targetMod = plan.modules.find(m => m.id === moduleId);
    if (!targetMod) return;
    const allSelected = targetMod.tasks.every(t => t.selected);

    const updatedModules = plan.modules.map(mod => {
      if (mod.id !== moduleId) return mod;
      return {
        ...mod,
        tasks: mod.tasks.map(t => ({ ...t, selected: !allSelected })),
      };
    });
    recalculatePlan(updatedModules);
  };

  // Adjust Pomodoro round estimate for a task
  const updateTaskRounds = (moduleId: string, taskId: string, delta: number) => {
    if (!plan) return;
    const updatedModules = plan.modules.map(mod => {
      if (mod.id !== moduleId) return mod;
      return {
        ...mod,
        tasks: mod.tasks.map(t => {
          if (t.id !== taskId) return t;
          const nextRounds = Math.max(1, Math.min(8, t.targetRounds + delta));
          return { ...t, targetRounds: nextRounds };
        }),
      };
    });
    recalculatePlan(updatedModules);
  };

  // Recalculate totals and pacing when tasks change
  const recalculatePlan = (updatedModules: ProposedModule[]) => {
    if (!plan) return;
    const selectedTasks = updatedModules.flatMap(m => m.tasks.filter(t => t.selected));
    const totalRounds = selectedTasks.reduce((acc, t) => acc + t.targetRounds, 0);
    const pacing = calculatePacing(totalRounds, plan.targetDeadline);

    setPlan({
      ...plan,
      modules: updatedModules,
      totalRounds,
      totalMinutes: totalRounds * 25,
      daysRemaining: pacing.daysRemaining,
      roundsPerDay: pacing.roundsPerDay,
    });
  };

  // Commit and import plan into Kairo
  const handleCommitImport = () => {
    if (!plan) return;
    const selectedTasks = plan.modules.flatMap(m => m.tasks.filter(t => t.selected));
    if (selectedTasks.length === 0) {
      alert('Please select at least one task to import.');
      return;
    }

    const tasksToImport = selectedTasks.map(t => ({
      name: t.name,
      targetRounds: t.targetRounds,
      subTasks: t.subTasks.map(st => ({
        id: `st-${Math.random().toString(36).slice(2, 9)}`,
        name: st.name,
        completed: false,
      })),
    }));

    onImportPlan({
      projectName: projectName.trim() || plan.projectName || 'Imported Curriculum',
      targetProjectId: targetProjectId === 'new' ? undefined : targetProjectId,
      tasks: tasksToImport,
    });

    onClose();
  };

  // Selected totals
  const allProposedTasks = plan?.modules.flatMap(m => m.tasks) || [];
  const selectedCount = allProposedTasks.filter(t => t.selected).length;

  return (
    <Modal titleId="kairo-doc-breakdown-title" onClose={onClose} className="k-doc-breakdown-modal">
      <div className="k-doc-modal-container">
        {/* Header */}
        <div className="k-doc-modal-head">
          <div className="k-doc-head-title">
            <span className="k-doc-head-icon" aria-hidden="true">📄</span>
            <div>
              <h2 id="kairo-doc-breakdown-title" className="k-doc-title">
                {step === 'input' ? 'Document & Syllabus Breakdown' : 'Curriculum Review & Staging'}
              </h2>
              <p className="k-doc-subtitle">
                {step === 'input'
                  ? 'Ground your Pomodoro plan in actual course syllabi, lecture notes, or project specs.'
                  : 'Review cognitive load, tune Pomodoro rounds, and check deadline pacing.'}
              </p>
            </div>
          </div>
          <button className="k-doc-close-btn" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        {/* STEP 1: INPUT INGESTION */}
        {step === 'input' && (
          <div className="k-doc-input-view">
            {/* Mode Switcher */}
            <div className="k-doc-tab-row">
              <button
                type="button"
                className={`k-doc-tab-btn ${inputMode === 'text' ? 'active' : ''}`}
                onClick={() => setInputMode('text')}
              >
                ✏️ Paste Topic Outline / Syllabus
              </button>
              <button
                type="button"
                className={`k-doc-tab-btn ${inputMode === 'file' ? 'active' : ''}`}
                onClick={() => setInputMode('file')}
              >
                📎 Upload File (.pdf, .txt, .md)
              </button>
            </div>

            {/* Archetype Selector */}
            <div className="k-doc-field-group">
              <label className="k-doc-label">Productivity Archetype</label>
              <div className="k-doc-archetype-pills">
                {(['study', 'learning', 'working', 'writing'] as PresetCategory[]).map(cat => {
                  const preset = SLICE_PRESETS[cat];
                  const isActive = archetype === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      className={`k-doc-archetype-pill ${isActive ? 'active' : ''}`}
                      onClick={() => setArchetype(cat)}
                    >
                      <span className="k-pill-emoji">{preset.emoji}</span>
                      <div className="k-pill-text">
                        <b>{preset.name}</b>
                        <small>{cat === 'study' ? 'Active Recall & Exams' : cat === 'learning' ? 'Feynman & Sandbox' : cat === 'working' ? 'Spec & TDD Sprint' : 'Zero-Draft & Edits'}</small>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target Deadline Date (Optional) */}
            <div className="k-doc-field-group">
              <label className="k-doc-label">
                <span>Target Exam / Completion Deadline</span>
                <small>(Optional - computes daily Pomodoro pace)</small>
              </label>
              <input
                type="date"
                className="k-doc-date-input"
                value={targetDeadline}
                onChange={e => setTargetDeadline(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Mode Content: Text Area */}
            {inputMode === 'text' && (
              <div className="k-doc-field-group">
                <div className="k-doc-label-row">
                  <label className="k-doc-label">Syllabus Outline or Topic List</label>
                  <div className="k-doc-templates-row">
                    <span className="k-templates-caption">Sample Starters:</span>
                    <button type="button" onClick={() => loadSample('calculus')} className="k-template-btn">
                      🎓 Calculus
                    </button>
                    <button type="button" onClick={() => loadSample('prd')} className="k-template-btn">
                      💼 Eng PRD
                    </button>
                    <button type="button" onClick={() => loadSample('language')} className="k-template-btn">
                      📚 Japanese N4
                    </button>
                  </div>
                </div>
                <textarea
                  className="k-doc-textarea"
                  rows={8}
                  placeholder={`Paste course syllabus, lecture schedule, or markdown outline here...\nExample:\n## Unit 1: Foundations\n- Topic A (review notes)\n- Topic B practice problem set\n## Unit 2: Advanced Application\n- Topic C deep derivation`}
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                />
              </div>
            )}

            {/* Mode Content: File Upload */}
            {inputMode === 'file' && (
              <div className="k-doc-field-group">
                <label className="k-doc-label">Upload Document (PDF, Markdown, or Plain Text)</label>
                <div
                  className="k-doc-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.[0]) {
                      const f = e.dataTransfer.files[0];
                      const dt = new DataTransfer();
                      dt.items.add(f);
                      if (fileInputRef.current) {
                        fileInputRef.current.files = dt.files;
                        handleFileChange({ target: fileInputRef.current } as any);
                      }
                    }
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md,.markdown,.csv,.json"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  {selectedFile ? (
                    <div className="k-dropzone-selected">
                      <span className="k-dropzone-icon">📄</span>
                      <div className="k-dropzone-meta">
                        <b>{selectedFile.name}</b>
                        <span>{selectedFile.size} · {selectedFile.mimeType}</span>
                      </div>
                      <button
                        type="button"
                        className="k-dropzone-clear"
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedFile(null);
                        }}
                      >
                        ✕ Remove
                      </button>
                    </div>
                  ) : (
                    <div className="k-dropzone-prompt">
                      <span className="k-dropzone-icon">📎</span>
                      <b>Click to browse or drop course PDF / text file</b>
                      <span>Supports syllabi PDFs, course outlines, and markdown notes</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {analysisError && (
              <div className="k-doc-clarification-card">
                <div className="k-doc-clarification-head">
                  <span className="k-doc-clarification-icon">💡</span>
                  <b>More Context Needed to Avoid Generic Guessing</b>
                </div>
                <p className="k-doc-clarification-msg">{analysisError}</p>
                <div className="k-doc-clarification-guide">
                  <span>To create a truly grounded, pedagogical Pomodoro plan:</span>
                  <ul>
                    <li>List 3–5 specific topics or chapters (e.g. <em>"1. Limits & Continuity, 2. Derivative Rules, 3. Chain Rule"</em>).</li>
                    <li>Or switch to <b>Upload Document</b> to drop your syllabus PDF, lecture notes, or markdown outline.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="k-doc-action-bar">
              <button type="button" className="k-doc-cancel-btn" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="k-doc-analyze-btn"
                onClick={handleAnalyze}
                disabled={isAnalyzing || (inputMode === 'text' && !rawText.trim()) || (inputMode === 'file' && !selectedFile)}
              >
                {isAnalyzing ? (
                  <>
                    <span className="k-doc-spinner" aria-hidden="true" />
                    <span>Analyzing Structure & Cognitive Load...</span>
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span>Analyze & Stage Plan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: STAGING & INTERACTIVE REVIEW */}
        {step === 'staging' && plan && (
          <div className="k-doc-staging-view">
            {/* Meta & Project Destination */}
            <div className="k-staging-meta-card">
              <div className="k-meta-row">
                <div className="k-project-rename-wrap">
                  <label className="k-staging-field-label">Project Name</label>
                  <input
                    type="text"
                    className="k-staging-title-input"
                    value={projectName}
                    onChange={e => setProjectName(e.target.value)}
                    maxLength={80}
                  />
                </div>
                <div className="k-project-dest-wrap">
                  <label className="k-staging-field-label">Destination</label>
                  <select
                    className="k-staging-dest-select"
                    value={targetProjectId}
                    onChange={e => setTargetProjectId(e.target.value)}
                  >
                    <option value="new">+ Create as New Project</option>
                    {existingProjects.map(p => (
                      <option key={p.id} value={p.id}>
                        Append to: {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pacing & Scope Stats Strip */}
              <div className="k-staging-stats-strip">
                <div className="k-stat-badge">
                  <span className="k-stat-val">{selectedCount}</span>
                  <span className="k-stat-lbl">Topics Selected</span>
                </div>
                <div className="k-stat-badge">
                  <span className="k-stat-val">{plan.totalRounds}</span>
                  <span className="k-stat-lbl">Rounds ({(plan.totalMinutes / 60).toFixed(1)} hrs)</span>
                </div>
                {plan.daysRemaining && plan.roundsPerDay ? (
                  <div className="k-stat-badge highlight">
                    <span className="k-stat-val">~{plan.roundsPerDay} rds/day</span>
                    <span className="k-stat-lbl">{plan.daysRemaining} days until deadline</span>
                  </div>
                ) : (
                  <div className="k-stat-badge">
                    <span className="k-stat-val">{plan.modules.length}</span>
                    <span className="k-stat-lbl">Curriculum Modules</span>
                  </div>
                )}
              </div>
            </div>

            {/* Module Accordions */}
            <div className="k-staging-modules-scroll">
              {plan.modules.map(module => {
                const isExpanded = expandedModules.has(module.id);
                const allSelected = module.tasks.every(t => t.selected);
                const someSelected = module.tasks.some(t => t.selected);
                const moduleRounds = module.tasks.filter(t => t.selected).reduce((acc, t) => acc + t.targetRounds, 0);

                return (
                  <div key={module.id} className="k-staging-module-card">
                    <div className="k-module-head" onClick={() => toggleModuleExpand(module.id)}>
                      <div className="k-module-title-wrap">
                        <span className="k-module-chevron">{isExpanded ? '▼' : '▶'}</span>
                        <b className="k-module-name">{module.name}</b>
                        <span className="k-module-badge">{moduleRounds} rounds</span>
                      </div>
                      <div className="k-module-actions" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          className="k-module-select-all-btn"
                          onClick={() => toggleModuleAllTasks(module.id)}
                        >
                          {allSelected ? 'Uncheck All' : 'Check All'}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="k-module-tasks-list">
                        {module.tasks.map(task => {
                          const isSubExpanded = expandedTaskSubs.has(task.id);
                          return (
                            <div
                              key={task.id}
                              className={`k-staging-task-card ${task.selected ? 'is-selected' : 'is-unselected'}`}
                            >
                              <div className="k-task-main-row">
                                <label className="k-task-checkbox-label">
                                  <input
                                    type="checkbox"
                                    checked={task.selected}
                                    onChange={() => toggleTaskSelection(module.id, task.id)}
                                  />
                                  <span className="k-task-text">{task.name}</span>
                                </label>

                                <div className="k-task-controls">
                                  {/* Difficulty pill */}
                                  <span className={`k-diff-badge ${task.difficulty}`}>
                                    {task.difficulty === 'intensive'
                                      ? '🟣 Deep'
                                      : task.difficulty === 'light'
                                      ? '🟢 Light'
                                      : '🟡 Standard'}
                                  </span>

                                  {/* Round Stepper */}
                                  <div className="k-round-stepper">
                                    <button
                                      type="button"
                                      onClick={() => updateTaskRounds(module.id, task.id, -1)}
                                      disabled={task.targetRounds <= 1}
                                      title="Decrease round target"
                                    >
                                      -
                                    </button>
                                    <span className="k-rounds-val">{task.targetRounds} rds</span>
                                    <button
                                      type="button"
                                      onClick={() => updateTaskRounds(module.id, task.id, 1)}
                                      disabled={task.targetRounds >= 8}
                                      title="Increase round target"
                                    >
                                      +
                                    </button>
                                  </div>

                                  {/* Subtasks toggle */}
                                  {task.subTasks.length > 0 && (
                                    <button
                                      type="button"
                                      className={`k-task-sub-toggle ${isSubExpanded ? 'active' : ''}`}
                                      onClick={() => toggleSubtasksExpand(task.id)}
                                      title="View micro-subtasks"
                                    >
                                      {task.subTasks.length} steps {isSubExpanded ? '▴' : '▾'}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Nested subtasks */}
                              {isSubExpanded && task.subTasks.length > 0 && (
                                <div className="k-staging-subtasks-tray">
                                  {task.subTasks.map((st, idx) => (
                                    <div key={st.id} className="k-staging-subtask-item">
                                      <span className="k-subtask-bullet">↳</span>
                                      <span className="k-subtask-name">{st.name}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="k-doc-action-bar">
              <button
                type="button"
                className="k-doc-cancel-btn"
                onClick={() => setStep('input')}
              >
                ← Back to Edit Source
              </button>
              <button
                type="button"
                className="k-doc-analyze-btn"
                onClick={handleCommitImport}
                disabled={selectedCount === 0}
              >
                <span>🚀 Import into Kairo ({selectedCount} tasks · {plan.totalRounds} rounds)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
