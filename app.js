/* IEBT Partner Success — kanban de parceiros (vanilla JS, offline-first) */
(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Domínio
  // ---------------------------------------------------------------------------
  const STAGES = [
    { id: 'lead',       name: 'Partner Lead', hint: 'Parceiros em prospecção e qualificação' },
    { id: 'onboarding', name: 'Onboarding',   hint: 'Contrato assinado, em implantação' },
    { id: 'active',     name: 'Active',       hint: 'Parceria ativa gerando valor' },
    { id: 'churn',      name: 'Churn',        hint: 'Parceiros que encerraram a parceria' },
    { id: 'lost',       name: 'Lost',         hint: 'Leads que não avançaram' },
  ];
  const STAGE = Object.fromEntries(STAGES.map((s) => [s.id, s]));

  const TYPES = ['Corporação', 'Startup', 'Universidade / ICT', 'Investidor', 'Governo', 'Hub / Aceleradora'];

  const REASONS = {
    churn: ['Baixo engajamento', 'Não percebeu valor', 'Restrição de orçamento', 'Mudança de estratégia', 'Troca de sponsor', 'Migrou para concorrente', 'Outro'],
    lost:  ['Sem fit com o programa', 'Timing / prioridade', 'Orçamento', 'Sem resposta', 'Escolheu outra solução', 'Outro'],
  };

  const STORAGE_KEY = 'iebt-ps:v1';
  const THEME_KEY = 'iebt-ps:theme';

  // ---------------------------------------------------------------------------
  // Utilitários
  // ---------------------------------------------------------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const pad = (n) => String(n).padStart(2, '0');
  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => isoDate(new Date());
  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDate(d); };
  const daysAgoTs = (n) => Date.now() - n * 864e5;

  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const brlShort = (v) => {
    if (v >= 1e6) return `R$ ${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
    if (v >= 1e3) return `R$ ${(v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
    return brl.format(v);
  };
  const pct = (v) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  const fmtDate = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  };
  const fmtDateTime = (ts) => new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const parseMoney = (raw) => {
    if (raw == null) return 0;
    let s = String(raw).replace(/[^\d.,-]/g, '');
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
  };

  const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  const AVATAR_COLORS = ['#1d5bd8', '#7a3fc4', '#0f7f6b', '#b4480f', '#a8306b', '#3c5a99', '#5b6b14'];
  const avatarColor = (name) => {
    let h = 0;
    for (const ch of name || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  };

  const healthLevel = (h) => (h >= 70 ? 'good' : h >= 40 ? 'warn' : 'bad');
  const HEALTH_LABEL = { good: 'Saudável', warn: 'Atenção', bad: 'Em risco' };
  const HEALTH_ICON = {
    good: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>',
    warn: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 7v6m0 4h.01"/></svg>',
    bad:  '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 19V5m0 14-5-5m5 5 5-5"/></svg>',
  };

  const dueState = (p) => {
    if (!p.nextActionDate || p.stage === 'lost' || p.stage === 'churn') return null;
    const t = today();
    if (p.nextActionDate < t) return 'overdue';
    if (p.nextActionDate === t) return 'today';
    return 'future';
  };

  // ---------------------------------------------------------------------------
  // Dados de exemplo (fictícios)
  // ---------------------------------------------------------------------------
  function sampleData() {
    const owners = ['Ana Ribeiro', 'Bruno Costa', 'Carla Mendes', 'Diego Santos'];
    const rows = [
      ['lead', 'Energia Sul S.A.', 'Corporação', 0, 0, 'Diagnóstico de inovação', 2, ['Open Innovation', 'Energia'], 'Mariana Lopes'],
      ['lead', 'AgroData Labs', 'Startup', 1, 0, 'Enviar proposta de programa', -1, ['AgTech'], 'Rafael Nunes'],
      ['lead', 'Universidade Federal do Vale', 'Universidade / ICT', 2, 0, 'Reunião com NIT', 6, ['P&D', 'Academia'], 'Profa. Helena Dias'],
      ['lead', 'Logix Transportes', 'Corporação', 3, 0, 'Apresentar cases do setor', 9, ['Logística'], 'Paulo Freitas'],
      ['onboarding', 'Banco Horizonte', 'Corporação', 0, 45000, 'Kickoff do desafio de inovação', 0, ['Fintech', 'Open Innovation'], 'Juliana Prado', 80],
      ['onboarding', 'HealthTech Vita', 'Startup', 1, 6500, 'Configurar acesso à plataforma', 3, ['Saúde'], 'Lucas Teixeira', 65],
      ['onboarding', 'Fundo Semente BR', 'Investidor', 3, 12000, 'Alinhar tese de investimento', -2, ['Venture Capital'], 'Camila Rocha', 55],
      ['active', 'Siderúrgica Atlântica', 'Corporação', 0, 85000, 'QBR trimestral', 12, ['Indústria 4.0'], 'Roberto Alves', 88],
      ['active', 'Prefeitura de Nova Esperança', 'Governo', 2, 30000, 'Relatório de impacto', -3, ['GovTech', 'Smart Cities'], 'Sec. Fernanda Melo', 52],
      ['active', 'Varejo Mais', 'Corporação', 1, 52000, 'Demo day com startups', 5, ['Varejo'], 'Thiago Martins', 76],
      ['active', 'Cooperativa Agrovale', 'Corporação', 3, 38000, 'Revisar KPIs do programa', 1, ['AgTech'], 'Sandra Kuhn', 34],
      ['active', 'Hub Criativo SC', 'Hub / Aceleradora', 2, 9000, 'Co-organizar evento', 20, ['Ecossistema'], 'Gabriel Souza', 91],
      ['churn', 'Seguradora Pacífico', 'Corporação', 1, 40000, '', null, ['Insurtech'], 'Marcos Lima', 25, 'Troca de sponsor'],
      ['churn', 'EduPlay', 'Startup', 0, 4000, '', null, ['EdTech'], 'Aline Castro', 30, 'Restrição de orçamento'],
      ['lost', 'Mineração Serra Alta', 'Corporação', 3, 0, '', null, ['Mineração'], 'Ricardo Pires', 0, 'Timing / prioridade'],
      ['lost', 'Construtech Base', 'Startup', 2, 0, '', null, ['Construção'], 'Vanessa Rios', 0, 'Sem resposta'],
    ];
    const order = {};
    return rows.map(([stage, name, type, o, value, next, nextIn, tags, contact, health = 70, reason = ''], i) => {
      order[stage] = (order[stage] ?? -1) + 1;
      const created = daysAgoTs(90 - i * 4);
      const history = [{ at: created, type: 'create', text: 'Parceiro cadastrado' }];
      if (stage !== 'lead') {
        const to = stage === 'lost' ? 'lost' : 'onboarding';
        history.push({ at: created + 864e5 * 10, type: 'stage', from: 'lead', to, text: stage === 'lost' ? reason : '' });
      }
      if (stage === 'active' || stage === 'churn') history.push({ at: created + 864e5 * 30, type: 'stage', from: 'onboarding', to: 'active' });
      if (stage === 'churn') history.push({ at: created + 864e5 * 60, type: 'stage', from: 'active', to: 'churn', text: reason });
      return {
        id: uid(), name, type, stage, owner: owners[o], value, health,
        nextAction: next, nextActionDate: nextIn == null ? '' : addDays(nextIn),
        contactName: contact, contactEmail: '', contactPhone: '',
        tags, reason, order: order[stage],
        createdAt: created, updatedAt: Date.now(), history,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Estado
  // ---------------------------------------------------------------------------
  const state = {
    partners: [],
    view: 'board',
    filters: { q: '', owner: '', type: '', overdue: false },
    editingId: null,
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.partners)) { state.partners = data.partners; return; }
      }
    } catch (_) { /* storage indisponível */ }
    state.partners = sampleData();
  }

  let saveWarned = false;
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, partners: state.partners }));
    } catch (_) {
      if (!saveWarned) { toast('Não foi possível salvar neste navegador. Exporte seus dados.'); saveWarned = true; }
    }
  }

  const byId = (id) => state.partners.find((p) => p.id === id);
  const inStage = (stage) => state.partners.filter((p) => p.stage === stage).sort((a, b) => a.order - b.order);

  function matchesFilters(p) {
    const f = state.filters;
    if (f.owner && p.owner !== f.owner) return false;
    if (f.type && p.type !== f.type) return false;
    if (f.overdue && dueState(p) !== 'overdue') return false;
    if (f.q) {
      const hay = [p.name, p.owner, p.contactName, p.contactEmail, p.type, p.nextAction, ...(p.tags || [])].join(' ').toLowerCase();
      if (!f.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  }
  const hasFilters = () => { const f = state.filters; return !!(f.q || f.owner || f.type || f.overdue); };

  // Move um parceiro para (stage, posição entre os visíveis)
  function movePartner(id, toStage, visibleIndex, meta = {}) {
    const p = byId(id);
    if (!p) return;
    const from = p.stage;
    const target = inStage(toStage).filter((x) => x.id !== id);
    const visible = target.filter(matchesFilters);
    let insertAt = target.length;
    if (visibleIndex != null && visibleIndex < visible.length) insertAt = target.indexOf(visible[visibleIndex]);
    target.splice(insertAt, 0, p);
    target.forEach((x, i) => { x.order = i; });
    if (from !== toStage) {
      p.stage = toStage;
      if (toStage === 'churn' || toStage === 'lost') p.reason = meta.reason || p.reason || '';
      else p.reason = '';
      p.history.push({ at: Date.now(), type: 'stage', from, to: toStage, text: [meta.reason, meta.note].filter(Boolean).join(' — ') });
      inStage(from).forEach((x, i) => { x.order = i; });
    }
    p.updatedAt = Date.now();
    save();
  }

  // ---------------------------------------------------------------------------
  // Render — Kanban
  // ---------------------------------------------------------------------------
  const board = $('#board');
  const stageTabs = $('#stageTabs');

  function cardHTML(p) {
    const due = dueState(p);
    const lvl = healthLevel(p.health);
    const showHealth = p.stage !== 'lost' && p.stage !== 'churn';
    const tags = (p.tags || []).slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
    const dueLabel = due === 'overdue' ? 'Atrasada · ' : due === 'today' ? 'Hoje · ' : '';
    return `
      <article class="card" tabindex="0" data-id="${p.id}"
        aria-label="${esc(p.name)}. ${esc(p.type)}. ${showHealth ? `Health ${p.health}, ${HEALTH_LABEL[lvl]}.` : ''} ${due === 'overdue' ? 'Ação atrasada.' : ''}"
        aria-describedby="kbdHint">
        <div class="card-top">
          <h3 class="card-name">${esc(p.name)}</h3>
          <button class="icon-btn card-more" data-move="${p.id}" aria-label="Mover ${esc(p.name)} de etapa">
            <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>
          </button>
        </div>
        <p class="card-sub">${esc(p.type)}${p.contactName ? ` · ${esc(p.contactName)}` : ''}</p>
        ${tags ? `<div class="card-tags">${tags}</div>` : ''}
        ${p.nextAction && showHealth ? `
          <div class="card-next ${due === 'overdue' ? 'is-overdue' : due === 'today' ? 'is-today' : ''}">
            <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2.5"/></svg>
            <span>${dueLabel}${p.nextActionDate ? `${fmtDate(p.nextActionDate)} · ` : ''}${esc(p.nextAction)}</span>
          </div>` : ''}
        <div class="card-foot">
          ${showHealth ? `<span class="health ${lvl}" title="Health score: ${HEALTH_LABEL[lvl]}">${HEALTH_ICON[lvl]}${p.health}</span>` : ''}
          ${!showHealth && p.reason ? `<span class="card-reason">${esc(p.reason)}</span>` : ''}
          ${p.value ? `<span class="card-value">${brlShort(p.value)}/mês</span>` : ''}
          ${p.owner ? `<span class="avatar" style="background:${avatarColor(p.owner)}" title="${esc(p.owner)}" aria-label="Responsável: ${esc(p.owner)}">${esc(initials(p.owner))}</span>` : ''}
        </div>
      </article>`;
  }

  function renderBoard() {
    const html = STAGES.map((s) => {
      const all = inStage(s.id);
      const items = all.filter(matchesFilters);
      const total = items.reduce((sum, p) => sum + (p.value || 0), 0);
      const countLabel = hasFilters() && items.length !== all.length ? `${items.length}/${all.length}` : items.length;
      return `
        <section class="column" data-stage="${s.id}" style="--stage: var(--st-${s.id})" aria-labelledby="col-${s.id}">
          <header class="col-head">
            <div class="col-title">
              <span class="dot" aria-hidden="true"></span>
              <h2 id="col-${s.id}">${s.name}</h2>
              <span class="col-count" aria-label="${items.length} parceiros">${countLabel}</span>
              <button class="icon-btn col-add" data-add="${s.id}" aria-label="Adicionar parceiro em ${s.name}">
                <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
              </button>
            </div>
            <p class="col-meta">${total ? `<b>${brlShort(total)}</b>/mês · ` : ''}${s.hint}</p>
          </header>
          <div class="col-body" data-drop="${s.id}">
            ${items.length ? items.map(cardHTML).join('') : `
              <div class="col-empty">
                ${hasFilters() ? 'Nenhum parceiro com estes filtros.' : 'Arraste um card para cá'}
                ${!hasFilters() && (s.id === 'lead') ? '<br><button class="link-btn" data-add="lead">+ Adicionar lead</button>' : ''}
              </div>`}
          </div>
        </section>`;
    }).join('');
    const scroll = board.scrollLeft;
    const colScroll = Object.fromEntries($$('.col-body', board).map((el) => [el.dataset.drop, el.scrollTop]));
    board.innerHTML = html + '<p id="kbdHint" class="sr-only">Enter abre detalhes. Shift mais setas move entre etapas.</p>';
    board.scrollLeft = scroll;
    $$('.col-body', board).forEach((el) => { el.scrollTop = colScroll[el.dataset.drop] || 0; });

    stageTabs.innerHTML = STAGES.map((s, i) => {
      const n = inStage(s.id).filter(matchesFilters).length;
      return `<button class="stage-tab" data-tab="${i}" style="--stage: var(--st-${s.id})">
        <span class="dot" aria-hidden="true"></span>${s.name} <span class="n">${n}</span></button>`;
    }).join('');
    syncActiveTab();
  }

  function syncActiveTab() {
    const col = board.querySelector('.column');
    if (!col) return;
    const step = col.getBoundingClientRect().width + 10;
    const idx = Math.min(STAGES.length - 1, Math.round(board.scrollLeft / step));
    $$('.stage-tab', stageTabs).forEach((t, i) => {
      t.setAttribute('aria-current', String(i === idx));
      if (i === idx) t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }
  board.addEventListener('scroll', () => requestAnimationFrame(syncActiveTab), { passive: true });
  stageTabs.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (!t) return;
    const col = board.querySelectorAll('.column')[Number(t.dataset.tab)];
    board.scrollTo({ left: col.offsetLeft - 14, behavior: 'smooth' });
  });

  // ---------------------------------------------------------------------------
  // Render — Indicadores
  // ---------------------------------------------------------------------------
  function bars(rows, { max, fmt = (v) => v, tip }) {
    const m = max ?? Math.max(1, ...rows.map((r) => r.value));
    return `<div class="bars">${rows.map((r) => `
      <div class="bar-row" tabindex="0" ${tip ? `data-tip="${esc(tip(r))}"` : ''} aria-label="${esc(r.label)}: ${esc(fmt(r.value))}" ${r.color ? `style="--stage:${r.color}"` : ''}>
        <span class="bar-label">${r.icon || (r.color && !r.single ? '<span class="dot" aria-hidden="true"></span>' : '')}<span>${esc(r.label)}</span></span>
        <div class="bar-track" aria-hidden="true"><div class="bar-fill" style="width:${(r.value / m) * 100}%"></div></div>
        <span class="bar-val">${esc(fmt(r.value))}</span>
      </div>`).join('')}</div>`;
  }

  function renderDashboard() {
    const ps = state.partners.filter(matchesFilters);
    const by = (s) => ps.filter((p) => p.stage === s);
    const sum = (arr) => arr.reduce((a, p) => a + (p.value || 0), 0);
    const active = by('active'), onb = by('onboarding'), lead = by('lead'), churn = by('churn'), lost = by('lost');
    const converted = onb.length + active.length + churn.length;
    const decided = converted + lost.length;
    const churnBase = active.length + churn.length;
    const avgHealth = active.length ? Math.round(active.reduce((a, p) => a + p.health, 0) / active.length) : null;
    const overdue = ps.filter((p) => dueState(p) === 'overdue');

    const kpis = [
      ['Parceiros ativos', active.length, `${onb.length} em onboarding`],
      ['Receita recorrente ativa', brlShort(sum(active)), 'por mês'],
      ['Pipeline (lead + onboarding)', brlShort(sum(lead) + sum(onb)), `${lead.length + onb.length} parceiros`],
      ['Taxa de churn', churnBase ? pct(churn.length / churnBase) : '—', `${churn.length} de ${churnBase} parceiros convertidos`],
      ['Conversão de leads', decided ? pct(converted / decided) : '—', `${converted} convertidos · ${lost.length} perdidos`],
      ['Health médio (ativos)', avgHealth ?? '—', avgHealth == null ? 'sem ativos' : HEALTH_LABEL[healthLevel(avgHealth)]],
    ];

    const stageRows = STAGES.map((s) => ({ label: s.name, value: by(s.id).length, color: `var(--st-${s.id})`, money: sum(by(s.id)) }));

    const healthRows = ['good', 'warn', 'bad'].map((l) => ({
      label: HEALTH_LABEL[l], value: [...active, ...onb].filter((p) => healthLevel(p.health) === l).length,
      color: `var(--${l})`, icon: `<span class="health ${l}" style="padding:2px">${HEALTH_ICON[l]}</span>`,
    }));

    const reasonCount = {};
    [...churn, ...lost].forEach((p) => { const r = p.reason || 'Não informado'; reasonCount[r] = (reasonCount[r] || 0) + 1; });
    const reasonRows = Object.entries(reasonCount).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value, color: 'var(--brand-500)', single: true }));

    const ownerCount = {};
    [...lead, ...onb, ...active].forEach((p) => { const o = p.owner || 'Sem responsável'; ownerCount[o] = (ownerCount[o] || 0) + 1; });
    const ownerRows = Object.entries(ownerCount).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, color: 'var(--brand-500)', single: true }));

    const upcoming = ps.filter((p) => p.nextAction && dueState(p) && p.nextActionDate)
      .sort((a, b) => a.nextActionDate.localeCompare(b.nextActionDate)).slice(0, 7);

    $('#dashboard').innerHTML = `
      <div class="dash-head">
        <h1>Indicadores de Partner Success</h1>
        <p>${hasFilters() ? 'Considerando os filtros ativos.' : 'Visão geral da carteira de parceiros.'} ${overdue.length ? `<strong style="color:var(--bad)">${overdue.length} ação(ões) atrasada(s).</strong>` : ''}</p>
      </div>
      <div class="kpis">${kpis.map(([l, v, s]) => `
        <div class="kpi"><div class="kpi-label">${l}</div><div class="kpi-value">${esc(v)}</div><div class="kpi-sub">${esc(s)}</div></div>`).join('')}
      </div>
      <div class="panels">
        <section class="panel">
          <h2>Parceiros por etapa</h2>
          <p class="panel-sub">Quantidade de parceiros em cada etapa do funil</p>
          ${bars(stageRows, { tip: (r) => `${r.value} parceiros · ${brl.format(r.money)}/mês` })}
        </section>
        <section class="panel">
          <h2>Saúde da carteira</h2>
          <p class="panel-sub">Parceiros em onboarding e ativos por faixa de health score</p>
          ${bars(healthRows, {})}
        </section>
        <section class="panel">
          <h2>Próximas ações</h2>
          <p class="panel-sub">Atrasadas primeiro</p>
          ${upcoming.length ? `<ul class="list">${upcoming.map((p) => {
            const d = dueState(p);
            return `<li style="--stage: var(--st-${p.stage})">
              <span class="dot" aria-hidden="true" title="${STAGE[p.stage].name}"></span>
              <div class="grow"><button class="linkish" data-open="${p.id}"><strong>${esc(p.name)}</strong><small>${esc(p.nextAction)}</small></button></div>
              <span class="health ${d === 'overdue' ? 'bad' : d === 'today' ? 'warn' : 'good'}">${d === 'overdue' ? 'Atrasada' : d === 'today' ? 'Hoje' : ''} ${fmtDate(p.nextActionDate)}</span>
            </li>`;
          }).join('')}</ul>` : '<p class="empty-note">Nenhuma ação agendada.</p>'}
        </section>
        <section class="panel">
          <h2>Motivos de churn e perda</h2>
          <p class="panel-sub">Onde a parceria não avançou ou foi encerrada</p>
          ${reasonRows.length ? bars(reasonRows, {}) : '<p class="empty-note">Sem churn ou perdas registradas. 🎉</p>'}
        </section>
        <section class="panel">
          <h2>Carteira por responsável</h2>
          <p class="panel-sub">Parceiros em lead, onboarding e ativos</p>
          ${ownerRows.length ? bars(ownerRows, {}) : '<p class="empty-note">Sem parceiros em andamento.</p>'}
        </section>
      </div>`;
  }

  function render() {
    if (state.view === 'board') renderBoard(); else renderDashboard();
    $('#fClear').hidden = !hasFilters();
  }

  function refreshFilterOptions() {
    const owners = [...new Set(state.partners.map((p) => p.owner).filter(Boolean))].sort();
    const sel = $('#fOwner');
    const cur = sel.value;
    sel.innerHTML = '<option value="">Todos os responsáveis</option>' + owners.map((o) => `<option>${esc(o)}</option>`).join('');
    sel.value = owners.includes(cur) ? cur : '';
    state.filters.owner = sel.value;
    $('#ownerList').innerHTML = owners.map((o) => `<option value="${esc(o)}">`).join('');
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------
  function setView(v) {
    state.view = v;
    $('#boardView').hidden = v !== 'board';
    $('#dashboardView').hidden = v !== 'dashboard';
    document.body.classList.toggle('view-dashboard', v === 'dashboard');
    $$('.view-btn').forEach((b) => {
      const on = b.dataset.view === v;
      b.classList.toggle('is-active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    try { history.replaceState(null, '', v === 'board' ? '#kanban' : '#indicadores'); } catch (_) { /* file:// */ }
    render();
  }
  $$('.view-btn').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));

  // ---------------------------------------------------------------------------
  // Filtros
  // ---------------------------------------------------------------------------
  let searchT;
  $('#search').addEventListener('input', (e) => {
    clearTimeout(searchT);
    searchT = setTimeout(() => { state.filters.q = e.target.value.trim(); render(); }, 120);
  });
  $('#fOwner').addEventListener('change', (e) => { state.filters.owner = e.target.value; render(); });
  $('#fType').innerHTML = '<option value="">Todos os tipos</option>' + TYPES.map((t) => `<option>${t}</option>`).join('');
  $('#fType').addEventListener('change', (e) => { state.filters.type = e.target.value; render(); });
  $('#fOverdue').addEventListener('click', (e) => {
    state.filters.overdue = !state.filters.overdue;
    e.currentTarget.setAttribute('aria-pressed', String(state.filters.overdue));
    render();
  });
  $('#fClear').addEventListener('click', () => {
    state.filters = { q: '', owner: '', type: '', overdue: false };
    $('#search').value = ''; $('#fOwner').value = ''; $('#fType').value = '';
    $('#fOverdue').setAttribute('aria-pressed', 'false');
    render();
  });

  // ---------------------------------------------------------------------------
  // Toast com desfazer
  // ---------------------------------------------------------------------------
  let toastT;
  function toast(msg, undo) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button">Desfazer</button>' : ''}`;
    el.hidden = false;
    if (undo) el.querySelector('button').onclick = () => { undo(); el.hidden = true; };
    clearTimeout(toastT);
    toastT = setTimeout(() => { el.hidden = true; }, undo ? 6000 : 3200);
  }
  const snapshot = () => JSON.stringify(state.partners);
  const restore = (snap) => { state.partners = JSON.parse(snap); save(); refreshFilterOptions(); render(); };

  // ---------------------------------------------------------------------------
  // Diálogo de motivo (Churn / Lost)
  // ---------------------------------------------------------------------------
  const reasonDialog = $('#reasonDialog');
  function askReason(p, stage) {
    return new Promise((resolve) => {
      $('#rdTitle').textContent = `Mover para ${STAGE[stage].name}`;
      $('#rdText').textContent = stage === 'churn'
        ? `Por que ${p.name} encerrou a parceria? O motivo alimenta os indicadores de churn.`
        : `Por que ${p.name} não avançou? O motivo ajuda a qualificar melhor os próximos leads.`;
      $('#rdReason').innerHTML = '<option value="" disabled selected>Selecione um motivo</option>' + REASONS[stage].map((r) => `<option>${r}</option>`).join('');
      $('#rdNote').value = '';
      reasonDialog.returnValue = '';
      reasonDialog.showModal();
      reasonDialog.addEventListener('close', function onClose() {
        reasonDialog.removeEventListener('close', onClose);
        if (reasonDialog.returnValue === 'ok') resolve({ reason: $('#rdReason').value, note: $('#rdNote').value.trim() });
        else resolve(null);
      });
    });
  }

  async function requestMove(id, toStage, index) {
    const p = byId(id);
    if (!p) return;
    const from = p.stage;
    let meta = {};
    if (from !== toStage && (toStage === 'churn' || toStage === 'lost')) {
      meta = await askReason(p, toStage);
      if (!meta) { render(); return; }
    }
    const snap = snapshot();
    movePartner(id, toStage, index, meta);
    render();
    if (from !== toStage) {
      toast(`${p.name} movido para ${STAGE[toStage].name}`, () => restore(snap));
      if (toStage === 'onboarding' && !p.nextAction) setTimeout(() => toast('Dica: agende o kickoff na próxima ação do parceiro.'), 6200);
    }
  }

  // ---------------------------------------------------------------------------
  // Diálogo "Mover para" (alternativa acessível ao arrastar)
  // ---------------------------------------------------------------------------
  const moveDialog = $('#moveDialog');
  function openMove(id) {
    const p = byId(id);
    $('#mdText').textContent = p.name;
    $('#moveOptions').innerHTML = STAGES.map((s) => `
      <button type="button" data-to="${s.id}" style="--stage: var(--st-${s.id})" ${s.id === p.stage ? 'aria-current="true" disabled' : ''}>
        <span class="dot" aria-hidden="true"></span>${s.name}${s.id === p.stage ? '<small>Etapa atual</small>' : ''}
      </button>`).join('') + `
      <button type="button" data-edit="${p.id}"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>Abrir detalhes</button>`;
    moveDialog.showModal();
  }
  $('#moveOptions').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const id = byId(state.editingMoveId) ? state.editingMoveId : null;
    moveDialog.close();
    if (b.dataset.edit) openPartner(b.dataset.edit);
    else if (b.dataset.to && id) requestMove(id, b.dataset.to);
  });

  // ---------------------------------------------------------------------------
  // Diálogo do parceiro
  // ---------------------------------------------------------------------------
  const dlg = $('#partnerDialog');
  const form = $('#partnerForm');
  $('#pStage').innerHTML = STAGES.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
  $('#pType').innerHTML = TYPES.map((t) => `<option>${t}</option>`).join('');

  function syncReasonField() {
    const st = $('#pStage').value;
    const show = st === 'churn' || st === 'lost';
    $('#reasonField').hidden = !show;
    if (show) {
      const cur = $('#pReason').value || (byId(state.editingId)?.reason ?? '');
      $('#reasonKind').textContent = st === 'churn' ? 'do churn' : 'da perda';
      $('#pReason').innerHTML = '<option value="">Selecione</option>' + REASONS[st].map((r) => `<option>${r}</option>`).join('');
      $('#pReason').value = REASONS[st].includes(cur) ? cur : '';
    }
  }
  $('#pStage').addEventListener('change', syncReasonField);
  $('#pHealth').addEventListener('input', (e) => {
    $('#pHealthOut').textContent = `${e.target.value} · ${HEALTH_LABEL[healthLevel(+e.target.value)]}`;
  });

  function openPartner(id, presetStage) {
    const p = id ? byId(id) : null;
    state.editingId = p ? p.id : null;
    form.reset();
    $('#pName').removeAttribute('aria-invalid');
    $('#pNameErr').hidden = true;
    $('#pdTitle').textContent = p ? p.name : 'Novo parceiro';
    const v = p || { stage: presetStage || 'lead', type: TYPES[0], health: 70, owner: state.filters.owner || '' };
    form.name.value = v.name || '';
    form.stage.value = v.stage;
    form.type.value = v.type;
    form.owner.value = v.owner || '';
    form.value.value = v.value ? String(v.value).replace('.', ',') : '';
    form.health.value = v.health ?? 70;
    $('#pHealthOut').textContent = `${form.health.value} · ${HEALTH_LABEL[healthLevel(+form.health.value)]}`;
    form.nextAction.value = v.nextAction || '';
    form.nextActionDate.value = v.nextActionDate || '';
    form.contactName.value = v.contactName || '';
    form.contactEmail.value = v.contactEmail || '';
    form.contactPhone.value = v.contactPhone || '';
    form.tags.value = (v.tags || []).join(', ');
    $('#pReason').value = '';
    syncReasonField();
    $('#activitySection').hidden = !p;
    $('#dangerZone').hidden = !p;
    if (p) renderTimeline(p);
    dlg.showModal();
    if (!p) setTimeout(() => $('#pName').focus(), 50);
  }

  function renderTimeline(p) {
    $('#timeline').innerHTML = [...p.history].reverse().map((h) => {
      let text = '';
      if (h.type === 'stage') text = `Movido de <b>${STAGE[h.from]?.name ?? h.from}</b> para <b>${STAGE[h.to]?.name ?? h.to}</b>${h.text ? `<br>${esc(h.text)}` : ''}`;
      else if (h.type === 'note') text = esc(h.text);
      else text = esc(h.text || 'Atualização');
      const color = h.type === 'stage' ? `--stage: var(--st-${h.to})` : h.type === 'note' ? '--stage: var(--brand-500)' : '';
      return `<li style="${color}"><time datetime="${new Date(h.at).toISOString()}">${fmtDateTime(h.at)}</time><p>${text}</p></li>`;
    }).join('');
  }

  $('#addNoteBtn').addEventListener('click', () => {
    const p = byId(state.editingId);
    const txt = $('#pNote').value.trim();
    if (!p || !txt) { $('#pNote').focus(); return; }
    p.history.push({ at: Date.now(), type: 'note', text: txt });
    p.updatedAt = Date.now();
    $('#pNote').value = '';
    save();
    renderTimeline(p);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    if (!name) {
      $('#pName').setAttribute('aria-invalid', 'true');
      $('#pNameErr').hidden = false;
      $('#pName').focus();
      return;
    }
    const data = {
      name,
      type: form.type.value,
      owner: form.owner.value.trim(),
      value: parseMoney(form.value.value),
      health: Number(form.health.value),
      nextAction: form.nextAction.value.trim(),
      nextActionDate: form.nextActionDate.value,
      contactName: form.contactName.value.trim(),
      contactEmail: form.contactEmail.value.trim(),
      contactPhone: form.contactPhone.value.trim(),
      tags: form.tags.value.split(',').map((t) => t.trim()).filter(Boolean),
    };
    const stage = form.stage.value;
    const reason = $('#pReason').value;
    const snap = snapshot();
    let p = byId(state.editingId);
    if (p) {
      Object.assign(p, data, { updatedAt: Date.now() });
      if (p.stage !== stage) movePartner(p.id, stage, null, { reason });
      else if (stage === 'churn' || stage === 'lost') p.reason = reason;
      save();
      dlg.close();
      toast('Alterações salvas', () => restore(snap));
    } else {
      p = {
        id: uid(), ...data, stage, reason: (stage === 'churn' || stage === 'lost') ? reason : '',
        order: -1, createdAt: Date.now(), updatedAt: Date.now(),
        history: [{ at: Date.now(), type: 'create', text: `Parceiro cadastrado em ${STAGE[stage].name}` }],
      };
      state.partners.push(p);
      inStage(stage).forEach((x, i) => { x.order = i; }); // novo card no topo
      save();
      dlg.close();
      toast(`${p.name} adicionado em ${STAGE[stage].name}`, () => restore(snap));
    }
    refreshFilterOptions();
    render();
  });

  $('#deleteBtn').addEventListener('click', () => {
    const p = byId(state.editingId);
    if (!p) return;
    const snap = snapshot();
    state.partners = state.partners.filter((x) => x.id !== p.id);
    save();
    dlg.close();
    refreshFilterOptions();
    render();
    toast(`${p.name} excluído`, () => restore(snap));
  });

  $$('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  // fechar ao clicar no backdrop
  [dlg, moveDialog].forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

  // ---------------------------------------------------------------------------
  // Ações gerais (adicionar, abrir, mover)
  // ---------------------------------------------------------------------------
  $('#addBtn').addEventListener('click', () => openPartner(null));
  $('#fab').addEventListener('click', () => {
    // no mobile, adiciona na etapa que está visível
    const cur = $$('.stage-tab', stageTabs).findIndex((t) => t.getAttribute('aria-current') === 'true');
    openPartner(null, STAGES[Math.max(0, cur)].id);
  });

  let suppressClick = false;
  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) { openPartner(null, add.dataset.add); return; }
    const mv = e.target.closest('[data-move]');
    if (mv) { state.editingMoveId = mv.dataset.move; openMove(mv.dataset.move); return; }
    const op = e.target.closest('[data-open]');
    if (op) { openPartner(op.dataset.open); return; }
    const card = e.target.closest('.card');
    if (card && !suppressClick) openPartner(card.dataset.id);
  });

  board.addEventListener('keydown', (e) => {
    const card = e.target.closest('.card');
    if (!card || e.target !== card) return;
    const p = byId(card.dataset.id);
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPartner(p.id); return; }
    const cards = $$('.card', card.parentElement);
    const i = cards.indexOf(card);
    if (e.shiftKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      const si = STAGES.findIndex((s) => s.id === p.stage) + (e.key === 'ArrowRight' ? 1 : -1);
      if (si < 0 || si >= STAGES.length) return;
      requestMove(p.id, STAGES[si].id, 0).then(() => board.querySelector(`.card[data-id="${p.id}"]`)?.focus());
    } else if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const ni = i + (e.key === 'ArrowDown' ? 1 : -1);
      if (ni < 0 || ni >= cards.length) return;
      movePartner(p.id, p.stage, ni);
      render();
      board.querySelector(`.card[data-id="${p.id}"]`)?.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      cards[i + (e.key === 'ArrowDown' ? 1 : -1)]?.focus();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const cols = $$('.column', board);
      const ci = cols.indexOf(card.closest('.column')) + (e.key === 'ArrowRight' ? 1 : -1);
      cols[ci]?.querySelector('.card')?.focus();
    }
  });

  // ---------------------------------------------------------------------------
  // Drag & drop com Pointer Events (mouse, touch com long-press, caneta)
  // ---------------------------------------------------------------------------
  const drag = { pending: null, active: false };

  board.addEventListener('pointerdown', (e) => {
    const card = e.target.closest('.card');
    if (!card || e.target.closest('button') || e.button > 0) return;
    const rect = card.getBoundingClientRect();
    drag.pending = {
      card, id: card.dataset.id, pointerId: e.pointerId, type: e.pointerType,
      sx: e.clientX, sy: e.clientY, ox: e.clientX - rect.left, oy: e.clientY - rect.top, w: rect.width, h: rect.height,
      timer: null,
    };
    if (e.pointerType !== 'mouse') {
      drag.pending.timer = setTimeout(() => startDrag(drag.pending.sx, drag.pending.sy), 280);
    }
  });

  document.addEventListener('pointermove', (e) => {
    const pd = drag.pending;
    if (!pd || e.pointerId !== pd.pointerId) return;
    if (!drag.active) {
      const dist = Math.hypot(e.clientX - pd.sx, e.clientY - pd.sy);
      if (pd.type === 'mouse' && dist > 5) startDrag(e.clientX, e.clientY);
      else if (pd.type !== 'mouse' && dist > 10) cancelPending(); // usuário está rolando
      return;
    }
    moveDrag(e.clientX, e.clientY);
  });

  document.addEventListener('pointerup', (e) => {
    if (!drag.pending || e.pointerId !== drag.pending.pointerId) return;
    if (drag.active) endDrag(true); else cancelPending();
  });
  document.addEventListener('pointercancel', () => { if (drag.active) endDrag(false); else cancelPending(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drag.active) endDrag(false); });
  // impede rolagem nativa enquanto arrasta no touch
  document.addEventListener('touchmove', (e) => { if (drag.active) e.preventDefault(); }, { passive: false });
  board.addEventListener('contextmenu', (e) => { if (e.target.closest('.card')) e.preventDefault(); });

  function cancelPending() {
    if (drag.pending?.timer) clearTimeout(drag.pending.timer);
    drag.pending = null;
  }

  function startDrag(x, y) {
    const pd = drag.pending;
    if (!pd || drag.active) return;
    drag.active = true;
    if (navigator.vibrate && pd.type !== 'mouse') navigator.vibrate(12);
    const ghost = pd.card.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.removeAttribute('tabindex');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.width = `${pd.w}px`;
    document.body.appendChild(ghost);
    drag.ghost = ghost;
    drag.placeholder = document.createElement('div');
    drag.placeholder.className = 'drop-placeholder';
    drag.placeholder.style.height = `${pd.h}px`;
    pd.card.classList.add('is-dragging');
    pd.card.after(drag.placeholder);
    pd.card.style.display = 'none';
    document.body.classList.add('is-dragging');
    board.style.scrollSnapType = 'none';
    drag.x = x; drag.y = y;
    moveDrag(x, y);
    drag.raf = requestAnimationFrame(autoScroll);
  }

  function moveDrag(x, y) {
    drag.x = x; drag.y = y;
    const pd = drag.pending;
    drag.ghost.style.transform = `translate(${x - pd.ox}px, ${y - pd.oy}px) rotate(2deg)`;
    const el = document.elementFromPoint(x, y);
    const col = el?.closest('.column');
    $$('.column.is-over', board).forEach((c) => c !== col && c.classList.remove('is-over'));
    if (!col) return;
    col.classList.add('is-over');
    const body = col.querySelector('.col-body');
    const empty = body.querySelector('.col-empty');
    if (empty) empty.hidden = true;
    const cards = $$('.card:not(.is-dragging)', body);
    const before = cards.find((c) => { const r = c.getBoundingClientRect(); return y < r.top + r.height / 2; });
    if (before) { if (drag.placeholder.nextSibling !== before) body.insertBefore(drag.placeholder, before); }
    else if (body.lastElementChild !== drag.placeholder) body.appendChild(drag.placeholder);
    drag.placeholder.style.setProperty('--stage', `var(--st-${col.dataset.stage})`);
  }

  function autoScroll() {
    if (!drag.active) return;
    const br = board.getBoundingClientRect();
    const edge = 56, speed = 14;
    const dir = drag.x < br.left + edge ? -1 : drag.x > br.right - edge ? 1 : 0;
    if (window.innerWidth <= 760) {
      // mobile: pula uma coluna por vez após segurar na borda
      const now = performance.now();
      if (!dir) drag.edgeSince = 0;
      else if (!drag.edgeSince) drag.edgeSince = now;
      else if (now - drag.edgeSince > 450) {
        const step = board.querySelector('.column').getBoundingClientRect().width + 10;
        board.scrollTo({ left: Math.round(board.scrollLeft / step + dir) * step, behavior: 'smooth' });
        drag.edgeSince = now + 350; // espera a animação antes do próximo salto
      }
    } else if (dir) board.scrollLeft += dir * speed;
    const col = document.elementFromPoint(drag.x, drag.y)?.closest('.column');
    const body = col?.querySelector('.col-body');
    if (body) {
      const r = body.getBoundingClientRect();
      if (drag.y < r.top + 40) body.scrollTop -= 10;
      else if (drag.y > r.bottom - 40) body.scrollTop += 10;
    }
    moveDrag(drag.x, drag.y);
    drag.raf = requestAnimationFrame(autoScroll);
  }

  function endDrag(commit) {
    const pd = drag.pending;
    cancelAnimationFrame(drag.raf);
    drag.active = false;
    drag.ghost?.remove();
    document.body.classList.remove('is-dragging');
    board.style.scrollSnapType = '';
    $$('.column.is-over', board).forEach((c) => c.classList.remove('is-over'));
    const ph = drag.placeholder;
    const body = ph?.parentElement;
    let target = null, index = null;
    if (commit && body?.dataset.drop) {
      target = body.dataset.drop;
      index = $$('.card:not(.is-dragging), .drop-placeholder', body).indexOf(ph);
    }
    drag.pending = null;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 50);
    if (target) requestMove(pd.id, target, index); else render();
  }

  // ---------------------------------------------------------------------------
  // Menu, tema, import/export
  // ---------------------------------------------------------------------------
  const menuBtn = $('#menuBtn'), appMenu = $('#appMenu');
  const toggleMenu = (open) => {
    appMenu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    if (open) appMenu.querySelector('button').focus();
  };
  menuBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(appMenu.hidden); });
  document.addEventListener('click', (e) => { if (!appMenu.hidden && !e.target.closest('#appMenu')) toggleMenu(false); });
  appMenu.addEventListener('keydown', (e) => {
    const items = $$('button', appMenu);
    const i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { toggleMenu(false); menuBtn.focus(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  });

  function download(name, content, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function applyTheme(t) {
    if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  }
  try { applyTheme(localStorage.getItem(THEME_KEY)); } catch (_) { /* noop */ }

  appMenu.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    toggleMenu(false);
    if (action === 'theme') {
      const dark = document.documentElement.dataset.theme
        ? document.documentElement.dataset.theme === 'dark'
        : matchMedia('(prefers-color-scheme: dark)').matches;
      const next = dark ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (_) { /* noop */ }
    } else if (action === 'export') {
      download(`partner-success-${today()}.json`, JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), partners: state.partners }, null, 2), 'application/json');
    } else if (action === 'csv') {
      const cols = ['Nome', 'Etapa', 'Tipo', 'Responsável', 'Valor mensal', 'Health', 'Próxima ação', 'Data', 'Contato', 'E-mail', 'Telefone', 'Tags', 'Motivo'];
      const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const lines = state.partners.map((p) => [p.name, STAGE[p.stage].name, p.type, p.owner, p.value, p.health, p.nextAction, p.nextActionDate, p.contactName, p.contactEmail, p.contactPhone, (p.tags || []).join('; '), p.reason].map(q).join(';'));
      download(`partner-success-${today()}.csv`, '﻿' + [cols.map(q).join(';'), ...lines].join('\n'), 'text/csv');
    } else if (action === 'import') {
      $('#importFile').click();
    } else if (action === 'reset') {
      if (!confirm('Substituir todos os dados atuais pelos dados de exemplo?')) return;
      const snap = snapshot();
      state.partners = sampleData();
      save(); refreshFilterOptions(); render();
      toast('Dados de exemplo restaurados', () => restore(snap));
    }
  });

  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const list = Array.isArray(data) ? data : data.partners;
      if (!Array.isArray(list)) throw new Error('formato');
      const clean = list.filter((p) => p && p.name && STAGE[p.stage]).map((p, i) => ({
        id: p.id || uid(), name: String(p.name), stage: p.stage, type: p.type || TYPES[0], owner: p.owner || '',
        value: Number(p.value) || 0, health: Number.isFinite(+p.health) ? +p.health : 70,
        nextAction: p.nextAction || '', nextActionDate: p.nextActionDate || '',
        contactName: p.contactName || '', contactEmail: p.contactEmail || '', contactPhone: p.contactPhone || '',
        tags: Array.isArray(p.tags) ? p.tags : [], reason: p.reason || '', order: Number.isFinite(+p.order) ? +p.order : i,
        createdAt: p.createdAt || Date.now(), updatedAt: Date.now(), history: Array.isArray(p.history) ? p.history : [],
      }));
      const snap = snapshot();
      state.partners = clean;
      save(); refreshFilterOptions(); render();
      toast(`${clean.length} parceiros importados`, () => restore(snap));
    } catch (_) {
      toast('Arquivo inválido. Use um JSON exportado por este sistema.');
    }
  });

  // ---------------------------------------------------------------------------
  // PWA
  // ---------------------------------------------------------------------------
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    $('#installBtn').hidden = false;
  });
  $('#installBtn').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $('#installBtn').hidden = true;
  });
  window.addEventListener('appinstalled', () => { $('#installBtn').hidden = true; toast('App instalado!'); });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  // Sincroniza entre abas
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) { load(); refreshFilterOptions(); render(); }
  });

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  load();
  save();
  refreshFilterOptions();
  setView(location.hash === '#indicadores' ? 'dashboard' : 'board');
})();
