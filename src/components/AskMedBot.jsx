import { useState, useEffect, useRef } from 'react';
import NotificationBell from './NotificationBell';
import { supabase } from '../lib/supabaseClient';
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
 * Helper to parse and render text with interactive blue citation links.
 * When citations such as "(Page 1, Source: Document upload-1794585403207)" or "(Page 1, Source: upload-1794585403207)"
 * appear, they are rendered as clickable blue links that open the source document modal with the finding underlined.
 */
function renderTextWithCitations(rawText, lineContext, onOpenCitation) {
  if (!rawText) return null;

  // Split strictly on valid document citation patterns (never on generic sentences containing the word "document")
  const citationSplitRegex = /(\[(?:Document|Doc)?\s*:?\s*upload-\d+[^\]]*\]|\((?:Document|Doc)?\s*:?\s*upload-\d+[^)]*\)|Document\s+upload-\d+(?:,\s*Page\s*\d+)?)/gi;

  const segments = rawText.split(citationSplitRegex);

  return segments.map((segment, segIdx) => {
    // Check if this segment contains a real document identifier upload-
    const uploadMatch = segment.match(/upload-\d+/i);
    const docId = uploadMatch ? uploadMatch[0] : null;

    if (docId) {
      const pageMatch = segment.match(/Page\s*(\d+)/i);
      const pageNumber = pageMatch ? pageMatch[1] : '1';

      // Clean snippet for underline highlight in modal
      const cleanSnippet = (lineContext || '')
        .replace(/^[\*\-•\d\.]+\s*/, '')
        .replace(/(\[[^\]]*\]|\([^)]*\))/g, '')
        .replace(/\*\*/g, '')
        .trim();

      const displayLabel = segment.replace(/^[\[\(]|[\]\)]$/g, '').trim();

      return (
        <button
          key={segIdx}
          type="button"
          onClick={() => {
            if (onOpenCitation) {
              onOpenCitation({
                docId,
                pageNumber,
                snippet: cleanSnippet || segment,
                citationText: segment,
              });
            }
          }}
          className="text-blue-600 hover:text-blue-800 underline decoration-blue-500 font-bold inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors cursor-pointer text-xs"
          title={`Click to open source document (${docId})`}
        >
          <span className="material-symbols-outlined text-[13px] text-blue-600 select-none">
            visibility
          </span>
          <span>[{displayLabel}]</span>
        </button>
      );
    }

    const boldParts = segment.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={`${segIdx}-${i}`} className="font-bold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={`${segIdx}-${i}`}>{part}</span>;
    });
  });
}

/**
 * Rich markdown formatter for AI clinical responses.
 * Supports headings (###, ####), bold (**text**), lists (*, -, •), and paragraphs.
 * Seamlessly integrates clickable citation links.
 */
function renderFormattedText(text, onOpenCitation) {
  if (!text) return null;
  const lines = text.split('\n');

  return lines.map((line, lineIdx) => {
    const trimmed = line.trim();

    // H3 Heading
    if (trimmed.startsWith('### ')) {
      const headingContent = trimmed.replace(/^###\s+/, '');
      return (
        <h3 key={lineIdx} className="text-sm font-extrabold text-slate-900 mt-3 mb-1 flex items-center gap-1.5">
          {renderTextWithCitations(headingContent, headingContent, onOpenCitation)}
        </h3>
      );
    }

    // H4 Heading
    if (trimmed.startsWith('#### ')) {
      const headingContent = trimmed.replace(/^####\s+/, '');
      return (
        <h4 key={lineIdx} className="text-xs font-bold text-teal-900 uppercase tracking-wide mt-2.5 mb-1">
          {renderTextWithCitations(headingContent, headingContent, onOpenCitation)}
        </h4>
      );
    }

    // Bullet points
    if (/^[\*\-•]\s+/.test(trimmed)) {
      const bulletContent = trimmed.replace(/^[\*\-•]\s+/, '');
      return (
        <div key={lineIdx} className="flex items-start gap-2 ml-2 my-1 text-xs leading-relaxed text-slate-700">
          <span className="text-teal-600 font-bold select-none">•</span>
          <div className="flex-1 flex-wrap">
            {renderTextWithCitations(bulletContent, bulletContent, onOpenCitation)}
          </div>
        </div>
      );
    }

    // Numbered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s+(.*)/);
      const num = match ? match[1] : '1';
      const listContent = match ? match[2] : trimmed;
      return (
        <div key={lineIdx} className="flex items-start gap-2 ml-2 my-1 text-xs leading-relaxed text-slate-700">
          <span className="text-teal-700 font-bold text-[11px] select-none">{num}.</span>
          <div className="flex-1 flex-wrap">
            {renderTextWithCitations(listContent, listContent, onOpenCitation)}
          </div>
        </div>
      );
    }

    // Standard paragraph with bold formatting & citations
    if (!trimmed) {
      return <div key={lineIdx} className="h-1.5" />;
    }

    return (
      <p key={lineIdx} className="text-xs sm:text-[13px] leading-relaxed text-slate-800 my-1">
        {renderTextWithCitations(line, line, onOpenCitation)}
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

  // Citation document viewer modal state
  const [activeCitation, setActiveCitation] = useState(null);
  const [citationRecord, setCitationRecord] = useState(null);

  useEffect(() => {
    if (!activeCitation?.docId) {
      setCitationRecord(null);
      return;
    }
    const found = uploads.find(
      (u) =>
        u.id === activeCitation.docId ||
        (activeCitation.docId &&
          u.id &&
          (u.id.includes(activeCitation.docId) || activeCitation.docId.includes(u.id)))
    );
    if (found) {
      setCitationRecord(found);
    } else {
      supabase
        .from('medical_records')
        .select('*')
        .eq('id', activeCitation.docId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setCitationRecord({
              id: data.id,
              patientId: data.patient_id,
              title: data.title,
              description: data.description,
              doctorName: data.doctor_name,
              category: data.category,
              date: data.date,
              status: data.status,
              files: data.files || [],
              ocrData: data.ocr_data,
            });
          }
        });
    }
  }, [activeCitation, uploads]);

  // Chat conversation state initialized cleanly without messy document list
  const [messages, setMessages] = useState(() => {
    return [
      {
        id: 'welcome-1',
        role: 'assistant',
        status: 'grounded',
        engine: 'AI Agent',
        text:
          'Hi! I am **MedBot**, your clinical AI assistant powered by **Gemini RAG (Retrieval-Augmented Generation)** 😊\n\nI answer questions strictly grounded in your actual uploaded medical documents and prescriptions in plain English.\n\nAsk me anything about your diagnosed problems, doctor findings, or prescribed medicines!',
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
        engine: 'AI Agent',
        text:
          'Chat reset! I am **MedBot**, your clinical AI assistant powered by **Gemini RAG (Retrieval-Augmented Generation)** 😊\n\nI answer questions strictly grounded in your actual uploaded medical documents and prescriptions in plain English.\n\nAsk me anything about your doctor names, diagnosed problems, or prescribed medicines!',
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
        currentUser,
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

  const navItems = ['Home', 'My Uploads', 'Current Medication', 'Access QR', 'Ask MedBot', 'About Us'];

  const handleNavClick = (link) => {
    if (link === 'Home') setPage('landing');
    else if (link === 'My Uploads') setPage('my-uploads');
    else if (link === 'Current Medication') setPage('current-medication');
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
            <div className="text-white font-bold text-lg leading-tight">OnePatient</div>
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

          </div>

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
                          AI Agent
                        </span>
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

                    {/* AI Message Body formatted with rich Markdown & clickable blue citation links */}
                    <div className="space-y-1">
                      {renderFormattedText(msg.text, (cit) => setActiveCitation(cit))}
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

      {/* ── CITED DOCUMENT VERIFICATION MODAL ── */}
      {activeCitation && (() => {
        const resolvedCitationRecord =
          citationRecord ||
          uploads.find(
            (u) =>
              u.id === activeCitation?.docId ||
              (activeCitation?.docId &&
                u.id &&
                (u.id.includes(activeCitation.docId) || activeCitation.docId.includes(u.id)))
          ) ||
          activePrescription;

        const citationFiles =
          resolvedCitationRecord?.files && resolvedCitationRecord.files.length > 0
            ? resolvedCitationRecord.files
            : [];

        const currentCitationFile = citationFiles[0] || {
          name: 'Prescription Document',
          url: '/uploads/prescription-default.jpeg',
          dataUrl: '/uploads/prescription-default.jpeg',
        };

        const citationFileSource =
          currentCitationFile.dataUrl || currentCitationFile.url || '/uploads/prescription-default.jpeg';

        const isCitationPdf =
          currentCitationFile.type === 'application/pdf' ||
          (typeof currentCitationFile.name === 'string' &&
            currentCitationFile.name.toLowerCase().endsWith('.pdf')) ||
          (typeof citationFileSource === 'string' &&
            citationFileSource.startsWith('data:application/pdf'));

        return (
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
            onClick={() => setActiveCitation(null)}
          >
            <div
              className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-5 sm:p-6 my-auto relative border border-slate-200 max-h-[94vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Navigation Bar with Return Arrow */}
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => setActiveCitation(null)}
                  className="px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md flex items-center gap-2 transition-all group"
                  title="Return to MedBot Chat"
                >
                  <Icon
                    name="arrow_back"
                    className="text-base text-teal-300 group-hover:-translate-x-1 transition-transform"
                  />
                  <span>Return to MedBot Chat</span>
                </button>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-900 text-xs font-bold flex items-center gap-1.5">
                    <Icon name="description" className="text-sm text-teal-700" />
                    <span>Document: {activeCitation.docId}</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold">
                    Page {activeCitation.pageNumber || 1}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveCitation(null)}
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
                  title="Close Document View"
                >
                  <Icon name="close" className="text-lg" />
                </button>
              </div>

              {/* Cited Finding Spotlight with Prominent Underline */}
              <div className="mt-3 bg-gradient-to-r from-amber-50 to-orange-50/70 border border-amber-200 rounded-2xl p-3.5 shadow-2xs">
                <div className="flex items-center gap-2 text-amber-900 text-[11px] font-extrabold uppercase tracking-wider mb-1">
                  <Icon name="verified" className="text-amber-700 text-base" />
                  <span>Cited Source Finding from this Document:</span>
                </div>
                <div className="bg-white/95 rounded-xl p-3 border border-amber-200/80 shadow-2xs">
                  <span className="text-sm sm:text-base font-extrabold text-slate-950 underline decoration-blue-600 decoration-3 underline-offset-4 bg-amber-200/60 px-2.5 py-1 rounded inline-block">
                    {activeCitation.snippet}
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-amber-900/80 font-medium flex items-center gap-2">
                  <Icon name="info" className="text-xs text-amber-700" />
                  <span>
                    Referenced in <strong>{resolvedCitationRecord?.title || 'Prescription Document'}</strong>
                    {resolvedCitationRecord?.doctorName ? ` by ${resolvedCitationRecord.doctorName}` : ''} • Page {activeCitation.pageNumber || 1}
                  </span>
                </div>
              </div>

              {/* Centered Document View (Image / PDF) */}
              <div className="mt-3 flex-1 overflow-auto bg-slate-100/90 rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-center border border-slate-200 min-h-[46vh]">
                {isCitationPdf ? (
                  <iframe
                    src={citationFileSource}
                    title="Cited Medical Document"
                    className="w-full h-[56vh] rounded-xl shadow-md bg-white border border-slate-200"
                  />
                ) : (
                  <div className="relative max-w-full flex flex-col items-center">
                    <img
                      src={citationFileSource}
                      alt="Source Medical Document"
                      className="max-h-[56vh] max-w-full w-auto object-contain rounded-xl shadow-md bg-white border border-slate-200 p-2"
                    />
                  </div>
                )}
              </div>

              {/* Bottom Return Footer */}
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-1">
                <span className="flex items-center gap-1">
                  <Icon name="verified_user" className="text-teal-700 text-sm" />
                  <span>Authentic Uploaded Record • Stored in Database</span>
                </span>
                <button
                  type="button"
                  onClick={() => setActiveCitation(null)}
                  className="text-teal-800 hover:text-teal-950 font-bold underline cursor-pointer text-xs flex items-center gap-1"
                >
                  <Icon name="arrow_back" className="text-xs" />
                  <span>Back to MedBot</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
