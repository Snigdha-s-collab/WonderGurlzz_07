import React, { useState } from 'react';

function Icon({ name, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export default function AboutUs({ setPage, currentUser, onLogout, onOpenUploadModal }) {
  const [activeStakeholderTab, setActiveStakeholderTab] = useState('patients');

  const navLinks = ['Home', 'My Uploads', 'Access QR', 'Ask MedBot', 'About Us'];

  const workflowSteps = [
    {
      step: '01',
      title: 'Patient Account Creation',
      desc: 'Patient registers and signs into their secure OnePatient account.',
      icon: 'person_add',
      status: 'Implemented',
    },
    {
      step: '02',
      title: 'Access Personal Dashboard',
      desc: 'Patients view active medication schedules, doctor authorizations, and their personal health badge ID.',
      icon: 'dashboard_customize',
      status: 'Implemented',
    },
    {
      step: '03',
      title: 'Upload Health Records',
      desc: 'Patients upload lab reports, diagnostic scans, prescriptions, and discharge summaries from any clinic.',
      icon: 'cloud_upload',
      status: 'Implemented',
    },
    {
      step: '04',
      title: 'Automated Category Indexing',
      desc: 'Documents are organized across 12 distinct medical specialties (Cardiology, Neurology, Pathology, etc.).',
      icon: 'category',
      status: 'Implemented',
    },
    {
      step: '05',
      title: 'Search, Filter & Retrieve',
      desc: 'Live autocomplete and category filters let patients locate critical medical documents in seconds.',
      icon: 'manage_search',
      status: 'Implemented',
    },
    {
      step: '06',
      title: 'Consent-Based Provider Access',
      desc: 'Authorized clinics and doctors securely inspect relevant records with patient consent and audit logging.',
      icon: 'verified_user',
      status: 'Upcoming Roadmap',
    },
  ];

  const features = [
    {
      name: 'Patient Authentication',
      desc: 'Secure identity and session management protecting sensitive patient records.',
      icon: 'lock',
      tag: 'Live Feature',
      isUpcoming: false,
    },
    {
      name: 'Unified Medical Records',
      desc: 'A single centralized repository eliminating fragmented physical and digital paper trails.',
      icon: 'folder_special',
      tag: 'Live Feature',
      isUpcoming: false,
    },
    {
      name: 'Medical Document Upload',
      desc: 'Easy multi-file browser and drag-and-drop support for PDF, JPG, PNG, and DOCX records.',
      icon: 'upload_file',
      tag: 'Live Feature',
      isUpcoming: false,
    },
    {
      name: 'Medical Category Management',
      desc: '12 specialized medical categories with patient-friendly clinical explanations.',
      icon: 'medical_information',
      tag: 'Live Feature',
      isUpcoming: false,
    },
    {
      name: 'Document Search & Filtering',
      desc: 'Real-time category dropdown with live autocomplete and instant document filtering.',
      icon: 'search',
      tag: 'Live Feature',
      isUpcoming: false,
    },
    {
      name: 'Patient Dashboard',
      desc: 'Personalized patient overview showing verified badge ID, medication regimens, and doctor consents.',
      icon: 'contact_emergency',
      tag: 'Live Feature',
      isUpcoming: false,
    },
    {
      name: 'Medical History Management',
      desc: 'Chronological timeline tracking diagnoses, clinical encounters, and historical consultations.',
      icon: 'history_edu',
      tag: 'Live Feature',
      isUpcoming: false,
    },
    {
      name: 'Access Audit Trail',
      desc: 'Immutable, tamper-evident logging recording who viewed, modified, or accessed records.',
      icon: 'receipt_long',
      tag: 'Live Feature',
      isUpcoming: false,
    },
    {
      name: 'Secure Data Management',
      desc: 'Encrypted storage safeguards patient privacy and adheres to digital health security principles.',
      icon: 'security',
      tag: 'Live Feature',
      isUpcoming: false,
    },
    {
      name: 'Patient-Controlled Sharing',
      desc: 'Fine-grained consent toggles allowing patients to revoke clinician access anytime.',
      icon: 'share_reviews',
      tag: 'Upcoming Roadmap',
      isUpcoming: true,
    },
  ];

  const stakeholderBenefits = {
    patients: {
      title: 'For Patients',
      subtitle: 'True ownership and effortless control over your lifelong health journey',
      icon: 'person',
      points: [
        'Access all past medical documents from one clean, organized platform anytime, anywhere.',
        'Maintain a continuous, lifelong medical narrative across multiple hospital visits.',
        'Eliminate the stress of lost prescriptions, misplaced lab sheets, or missing radiology films.',
        'Share targeted medical records with doctors securely when consent-based sharing is enabled.',
      ],
    },
    doctors: {
      title: 'For Doctors',
      subtitle: 'Complete clinical context for sharper, faster, and safer diagnostic decisions',
      icon: 'stethoscope',
      points: [
        'Gain access to a more comprehensive patient medical history rather than fragmented snapshots.',
        'Reduce reliance on patient memory during high-pressure or urgent clinical consultations.',
        'Support better-informed diagnoses with verified prior pathology, imaging, and allergy data.',
        'Reduce unnecessary repetition of invasive or costly investigations where clinically appropriate.',
      ],
    },
    hospitals: {
      title: 'For Hospitals & Clinics',
      subtitle: 'Seamless institutional collaboration, continuity of care, and reduced administrative friction',
      icon: 'local_hospital',
      points: [
        'Enhance inter-departmental and inter-facility coordination when treating referred patients.',
        'Maintain continuity of care during transfers, discharge handovers, and follow-ups.',
        'Reduce administrative overhead associated with searching, archiving, and retrieving paper records.',
        'Prepare institutional infrastructure for modern digital health interoperability protocols.',
      ],
    },
    healthcareSystems: {
      title: 'For Healthcare Systems',
      subtitle: 'Accelerating digital health transformation with patient-centered interoperability',
      icon: 'hub',
      points: [
        'Drive nationwide digital healthcare transformation through structured patient-held records.',
        'Encourage patient-centered healthcare by empowering citizens as active participants in care.',
        'Promote longitudinal health information continuity across public and private sectors.',
        'Pave the way for future secure interoperability standards across regional health ecosystems.',
      ],
    },
  };

  const futurePillars = [
    {
      title: '1. AI-Powered Health Insights',
      icon: 'psychology',
      badge: 'Planned Innovation',
      desc: 'Intelligent clinical summarization that transforms dense medical reports into easily understandable summaries, extracts chronological health trends, and offers clinicians non-invasive diagnostic assistance tools without ever replacing clinical human judgment.',
    },
    {
      title: '2. Interoperability with Hospitals',
      icon: 'sync_alt',
      badge: 'Architecture Planned',
      desc: 'Direct, standard-compliant pipelines connecting diagnostic labs, clinic management systems, and tertiary care hospitals. Enables frictionless, encrypted exchange of health records using standardized formats like FHIR and HL7.',
    },
    {
      title: '3. ABHA and ABDM Integration',
      icon: 'flag',
      badge: 'Future Integration Exploration',
      desc: 'Exploring future compatibility and alignment with India\'s Ayushman Bharat Digital Mission (ABDM) and Ayushman Bharat Health Account (ABHA). This will enable consent-based health data exchange within the national digital health ecosystem (identified strictly as a planned exploration, not an existing certification or partnership).',
    },
    {
      title: '4. Smart Emergency Access Protocol',
      icon: 'emergency',
      badge: 'Planned Protocol',
      desc: 'Carefully governed emergency "Break-Glass" access protocols enabling verified emergency room physicians to retrieve lifesaving blood group, allergy, and chronic condition data in critical moments, backed by mandatory audit logging and real-time alerts to the patient\'s family.',
    },
    {
      title: '5. Medication & Appointment Management',
      icon: 'notifications_active',
      badge: 'Planned Feature',
      desc: 'Automated prescription schedule tracking, smart dosage alerts, refill notifications, and integrated doctor appointment scheduling to drastically minimize medication non-adherence and follow-up gaps.',
    },
  ];

  return (
    <div className="bg-[#faf8ff] text-[#131b2e] min-h-screen flex flex-col font-sans">
      {/* ── HEADER ── */}
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
            <div className="text-white font-bold text-lg leading-tight">Hola</div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center glass-nav-card rounded-full px-6 py-2 gap-6">
            {navLinks.map((link) => (
              <button
                key={link}
                onClick={() => {
                  if (link === 'Home') setPage('landing');
                  else if (link === 'My Uploads') setPage('my-uploads');
                  else if (link === 'Access QR') setPage('access-qr');
                  else if (link === 'About Us') setPage('about-us');
                  else if (link === 'Ask MedBot') setPage('medbot');
                }}
                className={`text-sm font-medium transition-colors ${
                  link === 'About Us' ? 'text-teal-300 font-bold' : 'text-white/80 hover:text-teal-300'
                }`}
              >
                {link}
              </button>
            ))}
          </nav>

          {/* User profile & actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenUploadModal}
              className="teal-gradient-btn text-white font-bold text-xs px-4 py-2 rounded-full shadow-pill-glow flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all"
            >
              <Icon name="add" className="text-base" />
              <span>Upload Record</span>
            </button>

            <div className="hidden sm:flex flex-col items-center">
              <div className="w-8 h-8 rounded-full teal-gradient-btn flex items-center justify-center text-white text-sm">
                <Icon name="person" className="text-lg" />
              </div>
              <span className="text-[10px] font-semibold text-white/90 max-w-[80px] truncate">
                {currentUser?.name || 'User'}
              </span>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                className="p-1.5 rounded-full text-white/70 hover:text-red-300"
                title="Log Out"
              >
                <Icon name="logout" className="text-xl" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 pt-20">
        
        {/* ── 1. HERO BANNER: VISION ── */}
        <section className="hero-teal-gradient relative overflow-hidden py-20 px-4 sm:px-6 text-white text-center">
          <div className="absolute inset-0 mesh-subtle-pattern opacity-100 pointer-events-none" />
          
          <div className="relative z-10 max-w-4xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-teal-400 pulsing-dot" />
              <span className="text-teal-200 text-xs font-semibold tracking-wide uppercase">
                About OnePatient Platform
              </span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight">
              One Patient.{' '}
              <span className="bg-gradient-to-r from-teal-300 via-mint-300 to-teal-400 bg-clip-text text-transparent">
                One Unified Medical Story.
              </span>
            </h1>

            <p className="text-white/80 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              Empowering patients to seamlessly organize, secure, and access their complete lifelong healthcare history in one sovereign digital repository.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <button
                onClick={() => setPage('my-uploads')}
                className="teal-gradient-btn text-white font-bold text-sm px-7 py-3 rounded-full shadow-pill-glow hover:scale-105 active:scale-95 transition-transform inline-flex items-center gap-2"
              >
                <Icon name="folder_open" className="text-lg" />
                <span>Explore My Uploads</span>
              </button>
              <button
                onClick={() => setPage('access-qr')}
                className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-sm px-6 py-3 rounded-full backdrop-blur-md transition-colors inline-flex items-center gap-2"
              >
                <Icon name="qr_code_2" className="text-lg text-teal-300" />
                <span>View Patient ID & QR</span>
              </button>
            </div>
          </div>
        </section>

        {/* ── 2. THE PROBLEM & OUR SOLUTION ── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-teal-800 text-xs font-bold uppercase tracking-wider bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
              Healthcare Fragmentation Challenge
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#00241f] mt-3">
              Why We Are Building OnePatient
            </h2>
            <p className="text-slate-600 text-sm mt-2">
              Modern medicine is sophisticated, yet personal medical data remains fragmented across disconnected silos.
            </p>
          </div>

          <div className="w-full">
            {/* The OnePatient Solution Card (Full Width) */}
            <div className="bg-gradient-to-br from-teal-50/70 to-white rounded-3xl p-6 sm:p-8 md:p-10 border border-teal-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center mb-5">
                  <Icon name="verified" className="text-2xl" />
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-[#00241f] mb-2">The OnePatient Solution</h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6">
                  A centralized, patient-held digital health ledger unifying every document, medication, and clinical encounter into one continuous narrative.
                </p>

                <ul className="space-y-3.5">
                  {[
                    'One unified digital platform where patients securely store and access all medical records.',
                    'Standardized 12-category medical classification with patient-friendly clinical explanations.',
                    'Instant live search and autocomplete to quickly retrieve documents during doctor appointments.',
                    'Patient-governed consent framework prioritizing individual data privacy and access autonomy.',
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-slate-800">
                      <span className="w-5 h-5 rounded-full bg-teal-200 text-teal-800 flex items-center justify-center text-xs flex-shrink-0 mt-0.5 font-bold">
                        ✓
                      </span>
                      <span className="font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-teal-200 text-[11px] sm:text-xs text-teal-900 font-bold">
                Impact: A unified, lifelong medical record accessible whenever health decisions are made.
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. VISION & MISSION ── */}
        <section className="bg-[#00241f] text-white py-16 px-4 sm:px-6 relative overflow-hidden">
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              
              {/* Vision Box */}
              <div className="glass-nav-card rounded-3xl p-8 border border-teal-400/30 shadow-2xl relative overflow-hidden">
                <div className="w-12 h-12 rounded-2xl bg-teal-400/20 text-teal-300 flex items-center justify-center mb-4">
                  <Icon name="visibility" className="text-2xl" />
                </div>
                <span className="text-teal-300 text-xs font-bold uppercase tracking-widest block mb-1">
                  Our Guiding Vision
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight mb-4">
                  Democratizing Universal Access to Personal Health Information
                </h3>
                <blockquote className="border-l-4 border-teal-400 pl-4 text-white/90 italic text-sm sm:text-base leading-relaxed bg-white/5 py-3 rounded-r-xl">
                  "To create a future where every patient has better control over their medical information and can securely access their health records whenever needed."
                </blockquote>
              </div>

              {/* Mission Box */}
              <div className="space-y-4">
                <span className="text-teal-300 text-xs font-bold uppercase tracking-widest block">
                  Our Five Core Missions
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                  Driving Meaningful Change in Healthcare Delivery
                </h3>

                <div className="space-y-3 pt-2">
                  {[
                    {
                      title: 'Simplify Medical Record Management',
                      desc: 'Make archiving, categorizing, and finding medical documents as easy as using modern cloud storage.',
                      icon: 'inventory_2',
                    },
                    {
                      title: 'Improve Patient Access to Health Information',
                      desc: 'Equip patients with immediate access to their laboratory, imaging, and prescription records on any device.',
                      icon: 'phonelink_setup',
                    },
                    {
                      title: 'Reduce Fragmentation of Medical Records',
                      desc: 'Bridge disconnected healthcare providers by making the patient the rightful sovereign keeper of their data.',
                      icon: 'call_split',
                    },
                    {
                      title: 'Encourage Secure & Responsible Sharing',
                      desc: 'Safeguard patient autonomy through explicit consent, emergency break-glass protocols, and audit trails.',
                      icon: 'shield',
                    },
                    {
                      title: 'Support Better Patient-Provider Coordination',
                      desc: 'Empower clinicians with immediate, context-rich medical history for safer and more accurate care.',
                      icon: 'handshake',
                    },
                  ].map((m, idx) => (
                    <div
                      key={idx}
                      className="bg-white/5 border border-white/10 hover:border-teal-400/40 rounded-2xl p-3.5 flex items-start gap-3.5 transition-all"
                    >
                      <div className="w-8 h-8 rounded-xl bg-teal-400/20 text-teal-300 flex items-center justify-center flex-shrink-0">
                        <Icon name={m.icon} className="text-lg" />
                      </div>
                      <div>
                        <h4 className="text-white text-xs sm:text-sm font-bold">{m.title}</h4>
                        <p className="text-white/70 text-[11px] sm:text-xs mt-0.5 leading-snug">{m.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── 4. HOW ONEPATIENT WORKS (WORKFLOW DIAGRAM) ── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-teal-800 text-xs font-bold uppercase tracking-wider bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
              End-to-End User Experience
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#00241f] mt-3">
              How OnePatient Works
            </h2>
            <p className="text-slate-600 text-sm mt-2">
              A streamlined, step-by-step pathway from account onboarding to structured record retrieval and clinical collaboration.
            </p>
          </div>

          {/* Workflow Diagram Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative">
            {workflowSteps.map((s, idx) => (
              <div
                key={idx}
                className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:border-teal-300 hover:shadow-card-glass transition-all relative flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="w-8 h-8 rounded-full bg-teal-50 border border-teal-200 text-teal-800 font-mono font-bold text-xs flex items-center justify-center">
                      {s.step}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        s.status === 'Implemented'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-cyan-50 text-cyan-800 border border-cyan-200'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>

                  <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mb-4">
                    <Icon name={s.icon} className="text-2xl" />
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mb-1.5">{s.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{s.desc}</p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-teal-800 font-semibold">
                  <span>Step {idx + 1} of 6</span>
                  <Icon name="arrow_forward" className="text-sm text-teal-600" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 5. KEY PLATFORM FEATURES ── */}
        <section className="bg-slate-50 border-y border-slate-200/80 py-16 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <span className="text-teal-800 text-xs font-bold uppercase tracking-wider bg-teal-100/60 px-3 py-1 rounded-full border border-teal-200">
                System Capabilities
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#00241f] mt-3">
                Key Features of OnePatient
              </h2>
              <p className="text-slate-600 text-sm mt-2">
                Designed to deliver an intuitive healthcare management platform with clear transparency between live and roadmap features.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {features.map((f, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:border-teal-400 hover:shadow-sm transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          f.isUpcoming ? 'bg-cyan-50 text-cyan-700' : 'bg-teal-50 text-teal-700'
                        }`}
                      >
                        <Icon name={f.icon} className="text-xl" />
                      </div>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          f.isUpcoming
                            ? 'bg-cyan-50 text-cyan-800 border border-cyan-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {f.tag}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-sm text-slate-900 mb-1.5 leading-snug">
                      {f.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 6. WHY ONEPATIENT IS USEFUL (STAKEHOLDER BENEFITS) ── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <span className="text-teal-800 text-xs font-bold uppercase tracking-wider bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
              Ecosystem Value Proposition
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#00241f] mt-3">
              Why OnePatient Is Useful Across Healthcare
            </h2>
            <p className="text-slate-600 text-sm mt-2">
              Transforming patient convenience, clinical precision, hospital efficiency, and healthcare system modernization.
            </p>
          </div>

          {/* Stakeholder Category Tabs */}
          <div className="flex items-center justify-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none">
            {[
              { key: 'patients', label: 'For Patients', icon: 'person' },
              { key: 'doctors', label: 'For Doctors', icon: 'stethoscope' },
              { key: 'hospitals', label: 'Hospitals & Clinics', icon: 'local_hospital' },
              { key: 'healthcareSystems', label: 'Healthcare Systems', icon: 'hub' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveStakeholderTab(tab.key)}
                className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeStakeholderTab === tab.key
                    ? 'bg-[#00241f] text-white shadow-md'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon name={tab.icon} className="text-base" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Active Stakeholder Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-800 flex items-center justify-center flex-shrink-0">
                  <Icon name={stakeholderBenefits[activeStakeholderTab].icon} className="text-2xl" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-[#00241f]">
                    {stakeholderBenefits[activeStakeholderTab].title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500">
                    {stakeholderBenefits[activeStakeholderTab].subtitle}
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-3 py-1 rounded-full self-start sm:self-auto">
                Verified Stakeholder Benefit
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {stakeholderBenefits[activeStakeholderTab].points.map((pt, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50/70 rounded-2xl p-4 border border-slate-100 flex items-start gap-3"
                >
                  <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-xs flex-shrink-0 font-bold mt-0.5">
                    ✓
                  </span>
                  <span className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                    {pt}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-400">
                Note: Inter-hospital integration and automated laboratory deduplication represent future architecture objectives as secure integrations are certified.
              </p>
            </div>
          </div>
        </section>

        {/* ── 7. THE FUTURE OF CONNECTED HEALTHCARE ── */}
        <section className="bg-gradient-to-b from-[#00241f] via-[#0b3b34] to-[#00241f] text-white py-20 px-4 sm:px-6 relative overflow-hidden">
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <span className="text-teal-300 text-xs font-bold uppercase tracking-widest bg-white/10 px-3.5 py-1.5 rounded-full border border-white/20">
                Future Scope & Roadmap
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white mt-4 tracking-tight">
                The Future of Connected Healthcare
              </h2>
              <p className="text-teal-100/80 text-sm mt-3 leading-relaxed">
                Our vision extends beyond document storage toward a truly unified, intelligent, and interoperable health ecosystem.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {futurePillars.map((p, idx) => (
                <div
                  key={idx}
                  className="glass-nav-card rounded-3xl p-6 border border-white/10 hover:border-teal-400/50 shadow-xl transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-11 h-11 rounded-2xl bg-teal-400/20 text-teal-300 flex items-center justify-center">
                        <Icon name={p.icon} className="text-2xl" />
                      </div>
                      <span className="text-[10px] font-bold text-teal-300 bg-teal-950/60 px-2.5 py-1 rounded-full border border-teal-500/30">
                        {p.badge}
                      </span>
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-white mb-2 leading-snug">
                      {p.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-white/70 leading-relaxed">{p.desc}</p>
                  </div>

                  <div className="mt-6 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-teal-300">
                    <span>Forward-Looking Architecture</span>
                    <Icon name="trending_up" className="text-base" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 8. CALL TO ACTION / BOTTOM BANNER ── */}
        <section className="bg-white py-16 px-4 sm:px-6 border-t border-slate-200">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto">
              <Icon name="health_and_safety" className="text-3xl" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-[#00241f] tracking-tight">
              Start Building Your Unified Health Ledger Today
            </h2>
            <p className="text-slate-600 text-sm max-w-xl mx-auto leading-relaxed">
              Upload your medical records, organize prescriptions by clinical specialty, and take ownership of your health narrative.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <button
                onClick={onOpenUploadModal}
                className="teal-gradient-btn text-white font-bold text-sm px-8 py-3.5 rounded-full shadow-pill-glow hover:scale-105 active:scale-95 transition-transform inline-flex items-center gap-2"
              >
                <Icon name="cloud_upload" className="text-xl" />
                <span>+ Upload Health Record</span>
              </button>
              <button
                onClick={() => setPage('my-uploads')}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm px-6 py-3.5 rounded-full transition-colors inline-flex items-center gap-2"
              >
                <Icon name="inventory" className="text-lg" />
                <span>View My Uploads</span>
              </button>
            </div>
          </div>
        </section>

      </main>

      {/* ── FOOTER ── */}
      <footer className="bg-[#00241f] text-white/60 py-6 px-4 text-center text-xs border-t border-white/10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-white">
            <span className="font-bold text-sm">OnePatient</span>
            <span className="text-teal-400 text-xs font-mono">v1.2</span>
          </div>
          <div>
            "One Patient. One Unified Medical Story." — Digital Health Ledger Platform
          </div>
          <div className="text-white/40 text-[11px]">
            © {new Date().getFullYear()} OnePatient Health Technologies.
          </div>
        </div>
      </footer>
    </div>
  );
}

