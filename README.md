# IEBT Partner Success

Sistema de gestão de **Partner Success** da [IEBT Innovation](https://www.iebtinnovation.com), com visão **kanban** (no estilo Trello/Asana), **responsivo** para celular e instalável como **PWA** (funciona offline).

## Etapas do funil

| Etapa | Significado |
|---|---|
| **Partner Lead** | Parceiros em prospecção e qualificação |
| **Onboarding** | Contrato assinado, em implantação |
| **Active** | Parceria ativa gerando valor |
| **Churn** | Parceiros que encerraram a parceria (motivo obrigatório) |
| **Lost** | Leads que não avançaram (motivo obrigatório) |

## Funcionalidades

- **Kanban com arrastar e soltar**: mouse no desktop; no celular, **toque longo** no card para arrastar (segurar na borda pula para a coluna ao lado).
- **Alternativas ao arrastar**: botão `…` em cada card ("Mover para…") e teclado (`Shift + ←/→` muda de etapa, `Shift + ↑/↓` reordena, `Enter` abre).
- **Card do parceiro**: tipo, contato, tags, health score (ícone + rótulo, nunca só cor), valor mensal, responsável e próxima ação com alerta de **atrasada** / **hoje**.
- **Ficha completa** com histórico automático de mudanças de etapa e registro de notas.
- **Motivo de Churn/Lost** solicitado ao mover, alimentando os indicadores.
- **Filtros**: busca, responsável, tipo e "Ações atrasadas".
- **Indicadores**: parceiros ativos, receita recorrente, pipeline, taxa de churn, conversão de leads, health médio, saúde da carteira, próximas ações, motivos de churn/perda e carteira por responsável.
- **Desfazer** em toda ação (mover, editar, excluir, importar).
- **Exportar/Importar JSON** e **exportar CSV** (abre no Excel).
- Tema **claro/escuro** (segue o sistema, com alternância manual).
- **PWA**: instalável, offline-first (service worker) e atalho para Indicadores.

## UX mobile

- Colunas em tela cheia com *scroll-snap* e abas de etapa com contagem no topo.
- Navegação inferior (Kanban / Indicadores) e botão flutuante "+" que cria o parceiro na etapa visível.
- Ficha do parceiro e diálogos como *bottom sheets*; alvos de toque ≥ 40px; respeita `safe-area` e `prefers-reduced-motion`.

## Como rodar

Não há build. Sirva a pasta com qualquer servidor estático:

```bash
python3 -m http.server 8080
# abra http://localhost:8080
```

Para instalar como app, publique em HTTPS (GitHub Pages, Vercel, Netlify…) e use "Instalar app" / "Adicionar à tela inicial".

## Dados

Os dados ficam no `localStorage` do navegador (vêm pré-carregados com **parceiros fictícios** de exemplo — use o menu `⋮ › Restaurar dados de exemplo` ou importe seu JSON). Para uso em equipe, o próximo passo é conectar um backend (ex.: Supabase/Firebase) substituindo as funções `load()`/`save()` em `app.js`.

## Identidade visual

Segue a identidade do site da IEBT: header branco com a marca "iebt innovation", botões em pílula com degradê laranja e roxo/índigo como cor de apoio. As cores ficam em tokens CSS no topo de `styles.css` (`--orange`, `--grad-cta`, `--brand-*`). As cores das etapas foram validadas para daltonismo (protanopia/deuteranopia/tritanopia).

## Estrutura

```
index.html            # marcação e diálogos
styles.css            # design tokens, layout responsivo, tema escuro
app.js                # estado, kanban, drag & drop, indicadores, PWA
sw.js                 # service worker (cache offline)
manifest.webmanifest  # manifesto PWA
icons/                # ícones do app
```
