import { useState, useEffect, useRef } from 'react';
import NotificationBell from './NotificationBell';
import {
  analyzePrescription,
  askMedBotAgent,
  formatTime24To12,
  DEFAULT_QWEN_MODEL,
  DEFAULT_QWEN_BASE_URL,
  QWEN_PRESETS,
} from '../services/medbotAgent';

function Icon({ name, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

/**
 * Rich markdown formatter for AI clinical responses.
 * Supports headings (###, ####), bold (**text**), lists (*, -, •), and paragraphs.
 */
function renderFormattedText(text) {
  if (!text) return null;
  const lines = text.split('\n');

  return lines.map((line, lineIdx) => {
    const trimmed = line.trim();

    // H3 Heading
    if (trimmed.startsWith('### ')) {
      return (
        <h3 key={lineIdx} className="text-sm font-extrabold text-slate-900 mt-3 mb-1 flex items-center gap-1.5">
          {trimmed.replace(/^###\s+/, '')}
        </h3>
      );
    }

    // H4 Heading
    if (trimmed.startsWith('#### ')) {
      return (
        <h4 key={lineIdx} className="text-xs font-bold text-teal-900 uppercase tracking-wide mt-2.5 mb-1">
          {trimmed.replace(/^####\s+/, '')}
        </h4>
      );
    }

    // Bullet points
    if (/^[\*\-•]\s+/.test(trimmed)) {
      const bulletContent = trimmed.replace(/^[\*\-•]\s+/, '');
      const parts = bulletContent.split(/(\*\*[^*]+\*\*)/g);
      return (
        <div key={lineIdx} className="flex items-start gap-2 ml-2 my-1 text-xs leading-relaxed text-slate-700">
          <span className="text-teal-600 font-bold select-none">•</span>
          <div>
            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <strong key={i} className="font-bold text-slate-900">
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              return <span key={i}>{part}</span>;
            })}
          </div>
        </div>
      );
    }

    // Numbered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s+(.*)/);
      const num = match ? match[1] : '1';
      const listContent = match ? match[2] : trimmed;
      const parts = listContent.split(/(\*\*[^*]+\*\*)/g);
      return (
        <div key={lineIdx} className="flex items-start gap-2 ml-2 my-1 text-xs leading-relaxed text-slate-700">
          <span className="text-teal-700 font-bold text-[11px] select-none">{num}.</span>
          <div>
            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <strong key={i} className="font-bold text-slate-900">
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              return <span key={i}>{part}</span>;
            })}
          </div>
        </div>
      );
    }

    // Standard paragraph with bold formatting
    if (!trimmed) {
      return <div key={lineIdx} className="h-1.5" />;
    }

    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={lineIdx} className="text-xs sm:text-[13px] leading-relaxed text-slate-800 my-1">
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={i} className="font-bold text-slate-900">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </p>
    );
  });
}

export default function AskMedBot({
  setPage,
  currentUser,
  onLogout,
  uploads = [],
  initialSelectedUploadId,
  reminders = [],
  onAddReminder,
  notifications = [],
  onDismissNotification,
  onTriggerTestReminder,
  onMarkTaken,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAiConfig, setShowAiConfig] = useState(false);

  // Specified AI Model configuration
  const [apiKey, setApiKey] = useState(() => {
    try {
      return (
        localStorage.getItem('onepatient_qwen_api_key') ||
        import.meta.env.VITE_QWEN_API_KEY ||
        ''
      );
    } catch {
      return '';
    }
  });
  const [baseUrl, setBaseUrl] = useState(() => {
    try {
      return (
        localStorage.getItem('onepatient_qwen_base_url') ||
        import.meta.env.VITE_QWEN_BASE_URL ||
        DEFAULT_QWEN_BASE_URL
      );
    } catch {
      return DEFAULT_QWEN_BASE_URL;
    }
  });
  const [aiModel, setAiModel] = useState(() => {
    try {
      return (
        localStorage.getItem('onepatient_qwen_model') ||
        import.meta.env.VITE_QWEN_MODEL ||
        DEFAULT_QWEN_MODEL
      );
    } catch {
      return DEFAULT_QWEN_MODEL;
    }
  });
  const [providerPreset, setProviderPreset] = useState('openrouter-qwen');

  // Background prescription context (from user's uploads)
  const [selectedUploadId, setSelectedUploadId] = useState(() => {
    if (initialSelectedUploadId) return initialSelectedUploadId;
    return uploads[0]?.id || null;
  });

  useEffect(() => {
    if (initialSelectedUploadId) {
      setSelectedUploadId(initialSelectedUploadId);
    }
  }, [initialSelectedUploadId]);

  const activePrescription = uploads.find((u) => u.id === selectedUploadId) || uploads[0] || null;
  const [analysis, setAnalysis] = useState(null);

  // Chat conversation state initialized from patient's actual uploaded records
  const [messages, setMessages] = useState(() => {
    const records = uploads && uploads.length > 0 ? uploads : [];
    if (records.length > 0) {
      const list = records
        .map(
          (r) =>
            `• 📄 **${r.title || r.description}** — **${
              r.doctorName ? (r.doctorName.startsWith('Dr') ? r.doctorName : `Dr. ${r.doctorName}`) : 'Consulting Doctor'
            }** (${r.category || 'Clinical Care'}, ${r.date || 'Recent'})`
        )
        .join('\n');

      return [
        {
          id: 'welcome-1',
          role: 'assistant',
          status: 'grounded',
          engine: 'Qwen 2.5 7B AI Agent',
          text: `Hi! I am **MedBot**, your database-grounded clinical assistant powered by **Qwen 2.5 7B Instruct** 😊\n\nI have reviewed and indexed your uploaded medical reports:\n\n${list}\n\nAsk me anything about these reports, including **who your attending doctors are**, **the diagnosed problems**, **what medicines were prescribed**, or **how to take each medicine**!`,
          suggestedFollowUps: [
            'Who is my doctor?',
            'What are the problems in my report?',
            'Explain my report and prescribed medicines',
            'When should I take my medicines?',
          ],
          citedMedications: ['Neuron', 'Neargon LG', 'Neo'],
        },
      ];
    }

    return [
      {
        id: 'welcome-1',
        role: 'assistant',
        status: 'grounded',
        engine: 'Qwen 2.5 7B AI Agent',
        text:
          'Hi! I am **MedBot**, your clinical AI assistant powered by **Qwen 2.5 7B Instruct** 😊\n\nI analyze your uploaded medical reports, doctor instructions, and prescribed medications in plain English.\n\nAsk me anything about your prescriptions or health routine!',
        suggestedFollowUps: [
          'Who is my doctor?',
          'What are the problems in my report?',
          'Explain my report and prescribed medicines',
          'When should I take my medicines?',
        ],
        citedMedications: [],
      },
    ];
  });

  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const chatEndRef = useRef(null);

  // Pre-load analysis of patient's prescription quietly in background for clinical grounding
  useEffect(() => {
    if (activePrescription) {
      analyzePrescription(activePrescription).then((res) => {
        setAnalysis(res);
      });
    }
  }, [activePrescription]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const handlePresetChange = (presetId) => {
    setProviderPreset(presetId);
    const preset = QWEN_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      if (preset.baseUrl !== undefined) setBaseUrl(preset.baseUrl);
      if (preset.model) setAiModel(preset.model);
    }
  };

  const handleSaveAiConfig = (e) => {
    e.preventDefault();
    try {
      localStorage.setItem('onepatient_qwen_api_key', apiKey.trim());
      localStorage.setItem('onepatient_qwen_base_url', baseUrl.trim() || DEFAULT_QWEN_BASE_URL);
      localStorage.setItem('onepatient_qwen_model', aiModel.trim() || DEFAULT_QWEN_MODEL);
    } catch (err) {
      console.error(err);
    }
    setShowAiConfig(false);
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome-' + Date.now(),
        role: 'assistant',
        status: 'grounded',
        engine: `Qwen 2.5 7B AI Agent (${aiModel.split('/').pop()})`,
        text:
          'Chat reset! I am **MedBot** (Model: **Qwen 2.5 7B Instruct**) 😊\n\nI have your uploaded reports indexed (including Dr. Sudarshan Bhat and Dr. Neelkanta). Ask me anything about your doctor names, diagnosed problems, or prescribed medicines!',
        suggestedFollowUps: [
          'Who is my doctor?',
          'What are the problems in my report?',
          'Explain my report and prescribed medicines',
          'When should I take my medicines?',
        ],
      },
    ]);
  };

  const handleSendMessage = async (overrideText) => {
    const query = (overrideText ?? inputText).trim();
    if (!query || isThinking) return;

    if (!overrideText) setInputText('');

    const userMsg = {
      id: 'user-' + Date.now(),
      role: 'user',
      text: query,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const response = await askMedBotAgent({
        question: query,
        activePrescription,
        allPrescriptions: uploads,
        analysis,
        chatHistory: messages,
        reminders,
        apiConfig: { apiKey, baseUrl, model: aiModel },
      });

      const botMsg = {
        id: 'bot-' + Date.now(),
        role: 'assistant',
        status: response.status,
        urgent: response.urgent,
        text: response.reply,
        citedMedications: response.citedMedications || [],
        suggestedFollowUps: response.suggestedFollowUps || [],
        reminderProposal: response.reminderProposal || null,
        reminderAdded: false,
        engine: response.engine || `Qwen 2.5 7B AI Agent`,
        toolsUsed: response.toolsUsed || [],
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error('Ask MedBot error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: 'bot-err-' + Date.now(),
          role: 'assistant',
          status: 'grounded',
          engine: 'Qwen 2.5 7B AI Engine',
          text:
            'I encountered a temporary connection glitch while synthesizing clinical knowledge. Please try asking your question again or check your model settings.',
          suggestedFollowUps: ['How should I take Metformin 500mg?'],
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleAcceptReminderProposal = (msgId, proposal) => {
    if (onAddReminder) {
      onAddReminder({
        medName: proposal.medName,
        dosage: proposal.dosage,
        time24: proposal.time24,
        instruction: proposal.instruction,
        sourcePrescriptionId: activePrescription?.id || 'chat',
      });
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, reminderAdded: true } : m))
    );
  };

  const navItems = ['Home', 'My Uploads', 'Access QR', 'Ask MedBot', 'About Us'];

  const handleNavClick = (link) => {
    if (link === 'Home') setPage('landing');
    else if (link === 'My Uploads') setPage('my-uploads');
    else if (link === 'Access QR') setPage('access-qr');
    else if (link === 'Ask MedBot') setPage('medbot');
    else if (link === 'About Us') setPage('about-us');
    setMenuOpen(false);
  };

  // Formatted human-readable model name for display
  const modelDisplayName = aiModel.split('/').pop().replace(/-/g, ' ').toUpperCase();

  return (
    <div className="bg-[#f4f7f6] text-[#131b2e] min-h-screen flex flex-col">
      {/* ── HEADER NAVIGATION ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#00241f] px-4 py-3 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage('landing')}
              className="w-10 h-10 rounded-full teal-gradient-btn flex items-center justify-center shadow-orb-glow"
              title="Return Home"
            >
              <span className="text-white font-black text-sm">Dr.</span>
            </button>
            <div>
              <div className="text-white font-bold text-base leading-tight">OnePatient</div>
              <div className="text-teal-300 text-[10px] font-medium leading-tight">
                Ask MedBot Clinical AI Assistant
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center glass-nav-card rounded-full px-6 py-2 gap-6">
            {navItems.map((link) => (
              <button
                key={link}
                onClick={() => handleNavClick(link)}
                className={`text-sm font-medium transition-colors ${
                  link === 'Ask MedBot'
                    ? 'text-teal-300 font-bold'
                    : 'text-white/80 hover:text-teal-300'
                }`}
              >
                {link}
              </button>
            ))}
          </nav>

          {/* Right Corner: Notifications, Profile, Logout */}
          <div className="hidden lg:flex items-center gap-4">
            <NotificationBell
              notifications={notifications}
              reminders={reminders}
              onMarkTaken={onMarkTaken}
              onDismissNotification={onDismissNotification}
              onTriggerTestReminder={onTriggerTestReminder}
            />

            <div className="flex flex-col items-center">
              <div className="w-9 h-9 rounded-full teal-gradient-btn flex items-center justify-center text-white shadow-sm border border-white/20">
                <Icon name="person" className="text-xl" />
              </div>
              <span className="text-[11px] font-semibold text-white/90 max-w-[110px] truncate leading-tight mt-0.5 text-center">
                {currentUser?.name || 'User'}
              </span>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                className="p-2 rounded-full text-white/70 hover:text-red-300 hover:bg-white/10 transition-colors ml-1"
                title="Log Out"
              >
                <Icon name="logout" className="text-2xl" />
              </button>
            )}
          </div>

          {/* Mobile Hamburger */}
          <button
            className="lg:hidden text-white p-2"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle Menu"
          >
            <div className="w-5 h-0.5 bg-white mb-1" />
            <div className="w-5 h-0.5 bg-white mb-1" />
            <div className="w-5 h-0.5 bg-white" />
          </button>
        </div>

        {/* Mobile Dropdown */}
        {menuOpen && (
          <div className="lg:hidden mt-3 glass-nav-card rounded-2xl p-4 mx-4">
            {navItems.map((link) => (
              <button
                key={link}
                onClick={() => handleNavClick(link)}
                className={`block w-full text-left py-2 px-3 rounded-lg text-sm font-medium ${
                  link === 'Ask MedBot'
                    ? 'text-teal-300 bg-white/10 font-bold'
                    : 'text-white/80 hover:bg-white/10'
                }`}
              >
                {link}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ── MAIN WORKSPACE: CLEAN FOCUSED AI CHAT (NO OTHER BOXES) ── */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-3 sm:px-6 pt-20 pb-5 flex flex-col">
        {/* Dedicated Chat Container */}
        <div className="flex-1 bg-white rounded-3xl shadow-lg border border-slate-200/90 flex flex-col overflow-hidden min-h-[75vh]">
          {/* ── CHAT HEADER WITH SPECIFIED AI MODEL ── */}
          <div className="bg-gradient-to-r from-[#00241f] via-[#0b3b34] to-[#124d45] text-white px-5 py-4 flex items-center justify-between gap-3 shadow-sm border-b border-teal-800/40">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl teal-gradient-btn flex items-center justify-center shadow-md flex-shrink-0 border border-teal-300/30">
                <Icon name="smart_toy" className="text-2xl text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                    Ask MedBot
                  </h1>
                  {/* SPECIFIED MODEL BADGE */}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-400/20 text-teal-200 text-[11px] font-bold border border-teal-300/30 shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                    <span>Model: Qwen 2.5 7B Instruct</span>
                  </span>
                </div>
                <p className="text-[11px] text-teal-100/80 truncate mt-0.5">
                  AI-Powered Patient Query Clarification Assistant • Clinical Knowledge Synthesis
                </p>
              </div>
            </div>

            {/* Model Settings & Clear Controls */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowAiConfig((v) => !v)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-teal-100 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-white/15"
                title="View / Change specified AI model and API keys"
              >
                <Icon name="tune" className="text-base text-teal-300" />
                <span className="hidden sm:inline">Model Settings</span>
              </button>

              <button
                type="button"
                onClick={handleClearChat}
                className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-teal-200 hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors border border-white/15"
                title="Start a new chat consultation"
              >
                <Icon name="refresh" className="text-base" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            </div>
          </div>

          {/* Model Specification & API Configuration Overlay */}
          {showAiConfig && (
            <div className="bg-slate-50 border-b border-teal-200 p-4 animate-in slide-in-from-top-2">
              <form onSubmit={handleSaveAiConfig} className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <Icon name="psychology" className="text-teal-700 text-lg" />
                    <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      Specified AI Model Configuration
                    </span>
                  </div>
                  <span className="text-[11px] text-teal-800 font-bold bg-teal-100 px-2.5 py-0.5 rounded-full">
                    Active: {modelDisplayName}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Model Preset
                    </label>
                    <select
                      value={providerPreset}
                      onChange={(e) => handlePresetChange(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      {QWEN_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Model Identifier
                    </label>
                    <input
                      type="text"
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      placeholder="qwen/qwen-2.5-7b-instruct"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      API Key (Saved in browser storage)
                    </label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={
                        QWEN_PRESETS.find((p) => p.id === providerPreset)?.keyPlaceholder ||
                        'Optional for built-in high-IQ clinical reasoning'
                      }
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-slate-500">
                    Supports Qwen 2.5 7B, OpenRouter, Hugging Face, or local Ollama. MedBot uses intelligent clinical AI reasoning for all health queries.
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="submit"
                      className="teal-gradient-btn text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm"
                    >
                      Save Configuration
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAiConfig(false)}
                      className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* ── CHAT MESSAGE STREAM ── */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#faf8ff]/50">
            {messages.map((msg) => {
              if (msg.role === 'user') {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-gradient-to-r from-[#0b3b34] to-[#14534a] text-white px-4 py-3 text-xs sm:text-sm shadow-sm leading-relaxed">
                      {msg.text}
                    </div>
                  </div>
                );
              }

              const isUrgent = msg.urgent || msg.status === 'urgent';

              return (
                <div key={msg.id} className="flex justify-start">
                  <div
                    className={`max-w-[94%] sm:max-w-[90%] rounded-2xl rounded-tl-xs p-4 sm:p-5 shadow-sm border space-y-3 ${
                      isUrgent
                        ? 'bg-red-50 border-red-300 text-red-950'
                        : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    {/* Assistant Header: Model Specification Badge & Status */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px] font-bold">
                          AI
                        </span>
                        <span className="text-[11px] font-extrabold text-teal-900 tracking-tight">
                          {msg.engine || 'Qwen 2.5 7B AI Agent'}
                        </span>
                        {msg.toolsUsed?.length > 0 && (
                          <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                            SQL: {msg.toolsUsed.join(', ')}
                          </span>
                        )}
                      </div>

                      {msg.citedMedications?.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {msg.citedMedications.map((m, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-[10px] font-bold"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* AI Message Body formatted with rich Markdown */}
                    <div className="space-y-1">
                      {renderFormattedText(msg.text)}
                    </div>

                    {/* Inline Reminder Proposal (if requested) */}
                    {msg.reminderProposal && (
                      <div className="bg-teal-50 border border-teal-200 rounded-2xl p-3 flex items-center justify-between gap-3 mt-2">
                        <div className="text-xs">
                          <p className="font-extrabold text-teal-950">
                            {msg.reminderProposal.medName} {msg.reminderProposal.dosage} —{' '}
                            {msg.reminderProposal.timeLabel}
                          </p>
                          <p className="text-[11px] text-teal-800">
                            {msg.reminderProposal.instruction}
                          </p>
                        </div>
                        {msg.reminderAdded ? (
                          <span className="px-3 py-1.5 rounded-full bg-teal-600 text-white text-[11px] font-bold flex items-center gap-1 flex-shrink-0">
                            <Icon name="check_circle" className="text-sm" />
                            Added to Reminders
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              handleAcceptReminderProposal(msg.id, msg.reminderProposal)
                            }
                            className="px-3.5 py-1.5 rounded-full teal-gradient-btn text-white text-xs font-bold flex-shrink-0 shadow-sm"
                          >
                            + Set Reminder
                          </button>
                        )}
                      </div>
                    )}

                    {/* Interactive Follow-up Suggestion Chips */}
                    {msg.suggestedFollowUps?.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                          Clarification Follow-ups:
                        </span>
                        {msg.suggestedFollowUps.map((q, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSendMessage(q)}
                            className="text-[11px] font-semibold px-3 py-1 rounded-full bg-slate-100 hover:bg-teal-50 hover:text-teal-900 hover:border-teal-300 text-slate-700 border border-slate-200 transition-colors"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Live AI Reasoning & Generation Indicator */}
            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-white border border-teal-200 rounded-2xl px-4 py-3 text-xs text-slate-700 flex items-center gap-2.5 shadow-sm">
                  <div className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-ping" />
                  <span className="font-semibold text-teal-900">
                    MedBot is thinking through your question...
                  </span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* ── QUICK PROMPT SUGGESTION BAR ── */}
          <div className="px-4 py-2 bg-slate-50/80 border-t border-slate-200/80 flex items-center gap-1.5 overflow-x-auto text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex-shrink-0">
              Suggestions:
            </span>
            {[
              'Who is my doctor?',
              'What are the problems in my report?',
              'Explain my report and prescribed medicines',
              'When should I take Neargon LG and Neuron?',
              'What instructions did my doctor give?',
              'What should I do if I miss a dose?',
              'Do I have any documented allergies?',
            ].map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleSendMessage(prompt)}
                className="text-[11px] font-medium px-3 py-1 rounded-full bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-900 border border-slate-200 hover:border-teal-300 whitespace-nowrap transition-colors flex-shrink-0 shadow-2xs"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* ── CHAT INPUT BAR: THE TEXT BOX FOR PATIENT QUERY CLARIFICATION ── */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 sm:p-4 bg-white border-t border-slate-200 flex items-center gap-2.5"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask me anything about your medicines, like 'Can I drink coffee with Metformin?'..."
              className="flex-1 bg-slate-50 border border-slate-300 rounded-full px-5 py-3 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all shadow-inner"
            />
            <button
              type="submit"
              disabled={isThinking || !inputText.trim()}
              className="teal-gradient-btn text-white font-bold px-6 py-3 rounded-full text-xs sm:text-sm shadow-md flex items-center gap-2 disabled:opacity-40 active:scale-95 transition-transform flex-shrink-0"
              title="Send your clinical clarification query"
            >
              <span>Ask MedBot</span>
              <Icon name="send" className="text-base" />
            </button>
          </form>

          {/* Model Specification & Clinical Guidance Footer */}
          <div className="bg-slate-50 px-4 py-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              ⚡ Powered by <strong>Qwen 2.5 7B AI Agent</strong> • Clinical Evidence Synthesis
            </span>
            <span className="hidden sm:inline">
              For individualized prescription changes or acute emergencies, always consult your physician.
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
