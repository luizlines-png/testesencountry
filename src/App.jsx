import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Store, Wallet, ClipboardList, Plus, Trash2, ArrowLeft, AlertCircle,
  Ticket, Package, PackageX, ShoppingCart, Minus, X, RefreshCw,
  ChevronDown, ChevronUp, LogIn, LogOut, Menu, Clock, TrendingUp, Download,
  Users, UserRound, Baby, Undo2, Check, Archive, RotateCcw
} from "lucide-react";
import {
  assinarAlteracoes, bancoCentralConfigurado, criarVenda, excluirBarraca as excluirBarracaRegistro, excluirProduto, excluirVenda, excluirVendaBarraca,
  gerenciarUsuarios, obterPerfil, registrarVendaBarraca, salvarBarraca as salvarBarracaRegistro, salvarProduto,
  storageGet, supabase, listarEntradas, registrarEntrada, excluirEntrada,
  listarHistoricos, arquivarEResetarEvento, restaurarEvento,
} from "./lib/supabase";
import { credenciaisIniciais, entrarLocal, listarUsuarios, obterSessaoLocal, removerUsuario, sairLocal, salvarUsuario } from "./lib/authLocal";
import { exportarRelatorioExcel } from "./lib/relatorioExcel";
import { statusEstoque } from "./lib/regras";
import "./App.css";

const NOTES = [2, 4, 6, 10, 20, 50];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function formatMoney(v) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}
const K_BARRACAS = "festa-barracas";
const K_CAIXA = "festa-caixa-transacoes";
const vendasKey = (id) => `festa-vendas-${id}`;
const produtosKey = (id) => `festa-produtos-${id}`;

function useConexao() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const conectar = () => setOnline(true);
    const desconectar = () => setOnline(false);
    window.addEventListener("online", conectar);
    window.addEventListener("offline", desconectar);
    return () => {
      window.removeEventListener("online", conectar);
      window.removeEventListener("offline", desconectar);
    };
  }, []);
  return online;
}

function useSincronizacao(ativa) {
  const [status, setStatus] = useState(supabase ? "conectando" : "local");
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    if (!ativa) return undefined;
    return assinarAlteracoes(
      ["barracas", "produtos", "vendas", "entradas"],
      () => setVersao((atual) => atual + 1),
      setStatus
    );
  }, [ativa]);
  useEffect(() => {
    if (!ativa) return undefined;
    const atualizar = () => setVersao((atual) => atual + 1);
    const aoVoltar = () => { if (document.visibilityState === "visible") atualizar(); };
    window.addEventListener("online", atualizar);
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      window.removeEventListener("online", atualizar);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [ativa]);
  useEffect(() => {
    if (!ativa || !["degradado", "offline"].includes(status)) return undefined;
    const intervalo = window.setInterval(() => setVersao((atual) => atual + 1), 15000);
    return () => window.clearInterval(intervalo);
  }, [ativa, status]);
  return { status, versao };
}

function EstadoConexao({ online, sincronizacao }) {
  if (sincronizacao === "local") return <div className="connection-banner connection-local">Modo local de demonstração</div>;
  if (!online) return <div className="connection-banner connection-offline"><AlertCircle size={15} /> Sem internet. Não registre vendas até a conexão voltar.</div>;
  if (["degradado", "offline"].includes(sincronizacao)) return <div className="connection-banner connection-warning"><RefreshCw size={15} /> Reconectando a atualização em tempo real…</div>;
  if (sincronizacao === "conectando") return <div className="connection-banner"><RefreshCw size={15} /> Conectando ao evento…</div>;
  return null;
}

function ToastSucesso({ mensagem }) {
  if (!mensagem) return null;
  return <div className="success-toast" role="status" aria-live="polite">{mensagem}</div>;
}

function Ticket_({ children, accent = "gold", className = "" }) {
  return (
    <div className={`ticket ticket-${accent} ${className}`}>
      <div className="ticket-notch ticket-notch-l" />
      <div className="ticket-notch ticket-notch-r" />
      {children}
    </div>
  );
}

function TopBar({ title, subtitle, onBack, icon }) {
  return (
    <div className="topbar">
      {onBack && (
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
      )}
      <div className="topbar-brand" aria-hidden="true">
        <img src="/logo-ieq-vila-helena.png" alt="" />
      </div>
      <div className="topbar-icon">{icon}</div>
      <div className="topbar-text">
        <span className="topbar-crumb">Encountry / Operação</span>
        <h1>{title}</h1>
        <span>{subtitle}</span>
      </div>
    </div>
  );
}
function SectionLabel({ children }) {
  return <div className="section-label">{children}</div>;
}
function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.key} className={`tab-btn ${active === t.key ? "active" : ""}`} onClick={() => onChange(t.key)}>
          {t.icon}{t.label}
        </button>
      ))}
    </div>
  );
}

function Navbar({ screen, onNavigate, perfil, onLogout }) {
  const [aberto, setAberto] = useState(false);
  const podeCaixa = !perfil || ["admin", "caixa"].includes(perfil.papel);
  const podeBarraca = !perfil || ["admin", "barraca"].includes(perfil.papel);
  const podePainel = !perfil || perfil.papel === "admin";
  const podePortaria = !perfil || ["admin", "portaria"].includes(perfil.papel);
  const navegar = (destino) => { onNavigate(destino); setAberto(false); };

  return (
    <header className="site-navbar">
      <button className="nav-brand" onClick={() => navegar("home")} aria-label="Ir para a página inicial">
        <img src="/logo-ieq-vila-helena.png" alt="IEQ Vila Helena" />
        <span>Encountry</span>
      </button>
      <button className="nav-toggle" onClick={() => setAberto(!aberto)} aria-expanded={aberto} aria-label="Abrir menu">
        {aberto ? <X size={20} /> : <Menu size={20} />}
      </button>
      <nav className={`nav-links ${aberto ? "open" : ""}`}>
        <button className={screen === "home" ? "active" : ""} onClick={() => navegar("home")}>Início</button>
        {podeCaixa && <button className={screen === "caixa" ? "active" : ""} onClick={() => navegar("caixa")}>Caixa</button>}
        {podeBarraca && <button className={screen.startsWith("barraca") ? "active" : ""} onClick={() => navegar("barraca_select")}>Barracas</button>}
        {podePortaria && <button className={screen === "portaria" ? "active" : ""} onClick={() => navegar("portaria")}>Portaria</button>}
        {podePainel && <button className={screen === "painel" ? "active" : ""} onClick={() => navegar("painel")}>Painel</button>}
        {podePainel && <button className={screen === "dashboard" ? "active" : ""} onClick={() => navegar("dashboard")}>Dashboard</button>}
        {podePainel && <button className={screen === "acessos" ? "active" : ""} onClick={() => navegar("acessos")}>Acessos</button>}
        {podePainel && <button className={screen === "historico" ? "active" : ""} onClick={() => navegar("historico")}>Histórico</button>}
      </nav>
      {perfil && <button className="nav-logout" onClick={onLogout}><LogOut size={17} /> Sair da conta</button>}
    </header>
  );
}

function MobileNav({ screen, onNavigate, perfil }) {
  const itens = perfil?.papel === "admin"
    ? [
      { key: "dashboard", label: "Resumo", icon: <ClipboardList size={19} /> },
      { key: "caixa", label: "Caixa", icon: <Wallet size={19} /> },
      { key: "portaria", label: "Portaria", icon: <Users size={19} /> },
      { key: "barraca_select", label: "Barracas", icon: <Store size={19} /> },
      { key: "acessos", label: "Acessos", icon: <ClipboardList size={19} /> },
    ]
    : perfil?.papel === "caixa"
      ? [
        { key: "home", label: "Início", icon: <Ticket size={19} /> },
        { key: "caixa", label: "Caixa", icon: <Wallet size={19} /> },
      ]
      : perfil?.papel === "portaria"
        ? [{ key: "portaria", label: "Portaria", icon: <Users size={19} /> }]
      : [
        { key: "home", label: "Início", icon: <Ticket size={19} /> },
        { key: "barraca_select", label: "Barraca", icon: <Store size={19} /> },
      ];
  return <nav className="mobile-bottom-nav">{itens.map((item) => <button key={item.key} className={screen === item.key || (item.key === "barraca_select" && screen === "barraca_vendas") ? "active" : ""} onClick={() => onNavigate(item.key)}>{item.icon}<span>{item.label}</span></button>)}</nav>;
}

/* ---------------- PORTARIA ---------------- */

function TelaPortaria({ onBack, refreshSignal, online, perfil }) {
  const [vinculo, setVinculo] = useState("visitante");
  const [entradas, setEntradas] = useState([]);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const operacaoEmCurso = useRef(false);

  const carregar = useCallback(async () => {
    try {
      setEntradas((await listarEntradas()) || []);
    } catch (error) {
      setErro(`Não foi possível atualizar a contagem: ${error.message}`);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar, refreshSignal]);
  useEffect(() => {
    const atualizar = () => carregar();
    window.addEventListener("encountry-entradas", atualizar);
    window.addEventListener("storage", atualizar);
    return () => {
      window.removeEventListener("encountry-entradas", atualizar);
      window.removeEventListener("storage", atualizar);
    };
  }, [carregar]);
  useEffect(() => {
    if (!confirmacao) return undefined;
    const timer = window.setTimeout(() => setConfirmacao(""), 1600);
    return () => window.clearTimeout(timer);
  }, [confirmacao]);

  async function contar(faixa) {
    if (operacaoEmCurso.current || !online) return;
    operacaoEmCurso.current = true;
    setSaving(true); setErro("");
    const nova = {
      id: uid(), faixa, vinculo, hora: Date.now(),
      operadorId: perfil?.id || null,
      operadorNome: perfil?.nome || perfil?.papel || "Operador",
    };
    try {
      const salva = await registrarEntrada(nova);
      setEntradas((atuais) => [...atuais, salva]);
      setConfirmacao(`${faixa === "adulto" ? "Adulto" : "Criança"} · ${vinculo === "visitante" ? "Visitante" : "Membro"}`);
    } catch (error) {
      setErro(`A entrada não foi registrada: ${error.message}`);
    } finally {
      operacaoEmCurso.current = false;
      setSaving(false);
    }
  }

  async function desfazer() {
    if (operacaoEmCurso.current || !online || !entradas.length) return;
    const minhaUltima = [...entradas].reverse().find((item) =>
      !supabase || !item.operadorId || item.operadorId === perfil?.id
    );
    if (!minhaUltima) { setErro("Você ainda não fez nenhum lançamento para desfazer."); return; }
    operacaoEmCurso.current = true;
    setSaving(true); setErro("");
    try {
      await excluirEntrada(minhaUltima.id);
      setEntradas((atuais) => atuais.filter((item) => item.id !== minhaUltima.id));
      setConfirmacao("Último lançamento desfeito");
    } catch (error) {
      setErro(`Não foi possível desfazer: ${error.message}`);
    } finally {
      operacaoEmCurso.current = false;
      setSaving(false);
    }
  }

  const contarPor = (faixa, tipoVinculo) => entradas.filter((item) =>
    (!faixa || item.faixa === faixa) && (!tipoVinculo || item.vinculo === tipoVinculo)
  ).length;
  const ultimas = [...entradas].reverse().slice(0, 6);

  return (
    <div className="tela portaria-tela">
      <TopBar title="Portaria" subtitle="Contagem de pessoas" onBack={onBack} icon={<Users size={20} />} />
      <div className="entry-total" aria-live="polite">
        <span>Pessoas na festa</span>
        <strong>{entradas.length}</strong>
        <small>{contarPor("adulto")} adultos · {contarPor("crianca")} crianças</small>
      </div>

      <SectionLabel>1. Quem está chegando?</SectionLabel>
      <div className="entry-segment" role="group" aria-label="Tipo de pessoa">
        <button className={vinculo === "visitante" ? "active" : ""} onClick={() => setVinculo("visitante")}><Users size={20} /> Visitante {vinculo === "visitante" && <Check size={17} />}</button>
        <button className={vinculo === "membro" ? "active" : ""} onClick={() => setVinculo("membro")}><UserRound size={20} /> Membro {vinculo === "membro" && <Check size={17} />}</button>
      </div>

      <SectionLabel>2. Toque para contar</SectionLabel>
      <div className="entry-actions">
        <button className="entry-button entry-adult" disabled={saving || !online} onClick={() => contar("adulto")}><UserRound size={38} /><strong>Adulto</strong><span>+1 {vinculo}</span></button>
        <button className="entry-button entry-child" disabled={saving || !online} onClick={() => contar("crianca")}><Baby size={38} /><strong>Criança</strong><span>+1 {vinculo}</span></button>
      </div>
      <button className="entry-undo" disabled={saving || !online || !entradas.length} onClick={desfazer}><Undo2 size={17} /> Desfazer meu último lançamento</button>
      {confirmacao && <div className="entry-confirm"><Check size={18} /> {confirmacao}</div>}
      {erro && <div className="err-msg"><AlertCircle size={14} /> {erro}</div>}

      <SectionLabel>Resumo do público</SectionLabel>
      <div className="entry-breakdown">
        <div><span>Visitantes adultos</span><strong>{contarPor("adulto", "visitante")}</strong></div>
        <div><span>Visitantes crianças</span><strong>{contarPor("crianca", "visitante")}</strong></div>
        <div><span>Membros adultos</span><strong>{contarPor("adulto", "membro")}</strong></div>
        <div><span>Membros crianças</span><strong>{contarPor("crianca", "membro")}</strong></div>
      </div>

      <SectionLabel>Últimos registros</SectionLabel>
      <div className="entry-history">
        {!ultimas.length && <div className="hist-empty">A contagem ainda não começou.</div>}
        {ultimas.map((item) => <div key={item.id}><span className={`entry-dot ${item.faixa}`} /> <strong>{item.faixa === "adulto" ? "Adulto" : "Criança"}</strong><span>{item.vinculo === "visitante" ? "Visitante" : "Membro"}</span><small>{new Date(item.hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small></div>)}
      </div>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <img src="/logo-ieq-vila-helena.png" alt="IEQ Vila Helena" />
      <div>
        <strong>IEQ Vila Helena</strong>
        <span>Encountry · Gestão de caixa e barracas</span>
      </div>
    </footer>
  );
}

function BillPad({ onAdd, disabled = false }) {
  return (
    <div className="bill-pad">
      {NOTES.map((n) => (
        <button key={n} className="bill" disabled={disabled} onClick={() => onAdd(n)}>
          <span className="bill-val">R$ {n}</span>
          <span className="bill-label">nota</span>
        </button>
      ))}
    </div>
  );
}

function CustomAmount({ onAdd, itemField, item, setItem, disabled = false }) {
  const [val, setVal] = useState("");
  const [err, setErr] = useState("");

  function submit() {
    const n = parseInt(val, 10);
    if (!n || n <= 0) { setErr("Digite um valor."); return; }
    if (n % 2 !== 0) { setErr("O valor precisa ser múltiplo de 2."); return; }
    onAdd(n);
    setVal("");
    setErr("");
  }

  return (
    <div className="custom-amount-wrap">
      {itemField && (
        <input
          className="item-input"
          placeholder="Descrição (opcional, ex: doação, item avulso…)"
          value={item}
          onChange={(e) => setItem(e.target.value)}
        />
      )}
      <div className="custom-amount">
        <input
          type="number" step="2" placeholder="Valor (múltiplo de 2)"
          value={val}
          onChange={(e) => { setVal(e.target.value); setErr(""); }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button disabled={disabled} onClick={submit}>Adicionar</button>
      </div>
      {err && <div className="err-msg"><AlertCircle size={14} /> {err}</div>}
    </div>
  );
}

function Historico({ items, onDelete, emptyText, disabled = false }) {
  if (!items.length) return <div className="hist-empty">{emptyText}</div>;
  return (
    <div className="hist-list">
      {items.slice().reverse().map((it) => (
        <div key={it.id} className="hist-row">
          <div className="hist-row-main">
            <span className="hist-val">{formatMoney(it.valor)}</span>
            {it.item ? <span className="hist-item">{it.item}</span> : null}
          </div>
          <div className="hist-row-side">
            <span className="hist-time">
              {new Date(it.hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <button className="hist-del" disabled={disabled} onClick={() => onDelete(it.id)} title="Remover">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- CAIXA ---------------- */

function TelaCaixa({ onBack, refreshSignal, online }) {
  const [tab, setTab] = useState("pedido");
  const [transacoes, setTransacoes] = useState([]);
  const [barracas, setBarracas] = useState([]);
  const [produtosPorBarraca, setProdutosPorBarraca] = useState({});
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingProdutos, setLoadingProdutos] = useState(true);
  const [saving, setSaving] = useState(false);
  const [itemAvulso, setItemAvulso] = useState("");
  const [barracasAbertas, setBarracasAbertas] = useState({});
  const [erroOperacao, setErroOperacao] = useState("");
  const [sucessoOperacao, setSucessoOperacao] = useState("");
  const operacaoEmCurso = useRef(false);
  useEffect(() => {
    if (!sucessoOperacao) return undefined;
    const timer = window.setTimeout(() => setSucessoOperacao(""), 3000);
    return () => window.clearTimeout(timer);
  }, [sucessoOperacao]);

  useEffect(() => {
    (async () => {
      const data = await storageGet(K_CAIXA, true);
      setTransacoes(data || []);
      setLoading(false);
    })();
  }, [refreshSignal]);

  const carregarProdutos = useCallback(async () => {
    setLoadingProdutos(true);
    const bs = (await storageGet(K_BARRACAS, true)) || [];
    setBarracas(bs);
    const mapa = {};
    for (const b of bs) {
      mapa[b.id] = (await storageGet(produtosKey(b.id), true)) || [];
    }
    setProdutosPorBarraca(mapa);
    setLoadingProdutos(false);
  }, []);

  useEffect(() => { carregarProdutos(); }, [carregarProdutos, refreshSignal]);

  const toggleBarraca = (id) => {
    setBarracasAbertas((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const registrarTransacao = useCallback(async (nova) => {
    if (operacaoEmCurso.current || !online) {
      if (!online) setErroOperacao("Sem internet. Aguarde a conexão voltar antes de registrar a venda.");
      return false;
    }
    operacaoEmCurso.current = true;
    setSaving(true);
    setErroOperacao("");
    try {
      const salva = await criarVenda(K_CAIXA, nova);
      setTransacoes((atuais) => [...atuais, salva]);
      setSucessoOperacao("Venda registrada com sucesso.");
      return true;
    } catch (error) {
      setErroOperacao(`A venda não foi registrada: ${error.message}`);
      return false;
    } finally {
      operacaoEmCurso.current = false;
      setSaving(false);
    }
  }, [online]);

  async function addValorAvulso(valor) {
    const novo = {
      id: uid(),
      valor,
      item: itemAvulso.trim() || null,
      hora: Date.now(),
      origem: "caixa",
      tipo: "avulsa",
    };
    if (await registrarTransacao(novo)) setItemAvulso("");
  }

  async function deleteTransacao(id) {
    if (operacaoEmCurso.current || !online) return;
    if (!window.confirm("Remover esta venda do caixa?")) return;
    operacaoEmCurso.current = true;
    setSaving(true); setErroOperacao("");
    try {
      await excluirVenda(K_CAIXA, id);
      setTransacoes((atuais) => atuais.filter((t) => t.id !== id));
      setSucessoOperacao("Lançamento removido.");
    } catch (error) {
      setErroOperacao(`A venda não foi removida: ${error.message}`);
    } finally { operacaoEmCurso.current = false; setSaving(false); }
  }

  function addToCart(barraca, produto) {
    if (produto.esgotado) return;
    setCart((c) => {
      const key = `${barraca.id}-${produto.id}`;
      const existing = c[key];
      return {
        ...c,
        [key]: {
          produtoId: produto.id,
          barracaId: barraca.id,
          nome: produto.nome,
          preco: produto.preco,
          barracaNome: barraca.nome,
          qtd: (existing?.qtd || 0) + 1,
        },
      };
    });
  }
  function decFromCart(key) {
    setCart((c) => {
      const existing = c[key];
      if (!existing) return c;
      if (existing.qtd <= 1) {
        const { [key]: _, ...rest } = c;
        return rest;
      }
      return { ...c, [key]: { ...existing, qtd: existing.qtd - 1 } };
    });
  }
  function removeFromCart(key) {
    setCart((c) => {
      const { [key]: _, ...rest } = c;
      return rest;
    });
  }

  const cartItems = Object.entries(cart);
  const cartTotal = cartItems.reduce((s, [, v]) => s + v.preco * v.qtd, 0);

  async function finalizarPedido() {
    if (cartItems.length === 0) return;
    const descricao = cartItems.map(([, v]) => `${v.qtd}x ${v.nome}`).join(", ");
    const agora = Date.now();
    const novo = {
      id: uid(),
      valor: cartTotal,
      item: descricao,
      hora: agora,
      origem: "caixa",
      tipo: "pedido",
      itens: cartItems.map(([, v]) => ({
        produtoId: v.produtoId,
        barracaId: v.barracaId,
        barracaNome: v.barracaNome,
        nome: v.nome,
        precoUnitario: v.preco,
        quantidade: v.qtd,
        subtotal: v.preco * v.qtd,
      })),
    };
    if (await registrarTransacao(novo)) setCart({});
  }

  const total = transacoes.reduce((s, t) => s + t.valor, 0);

  return (
    <div className="tela">
      <TopBar title="Caixa" subtitle="Venda de fichas" onBack={onBack} icon={<Wallet size={20} />} />
      <Ticket_ accent="gold">
        <div className="total-box">
          <span className="total-label">Total vendido no caixa</span>
          <span className="total-val">{loading ? "…" : formatMoney(total)}</span>
        </div>
      </Ticket_>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "pedido", label: "Montar pedido", icon: <ShoppingCart size={14} /> },
          { key: "avulso", label: "Valor avulso", icon: <Wallet size={14} /> },
        ]}
      />

      {tab === "pedido" && (
        <>
          <div className="section-label-row">
            <SectionLabel>Selecione os itens do pedido</SectionLabel>
            <button className="refresh-btn" onClick={carregarProdutos} title="Atualizar produtos">
              <RefreshCw size={14} />
            </button>
          </div>

          {loadingProdutos ? (
            <div className="hist-empty">Carregando produtos…</div>
          ) : barracas.length === 0 ? (
            <div className="hist-empty">Nenhuma barraca cadastrada ainda.</div>
          ) : (
            <div className="barracas-accordion-list">
              {barracas.map((b) => {
                const produtos = produtosPorBarraca[b.id] || [];
                if (produtos.length === 0) return null;
                const estaAberto = barracasAbertas[b.id];

                return (
                  <div key={b.id} className="barraca-accordion">
                    <button
                      className={`barraca-accordion-header ${estaAberto ? "open" : ""}`}
                      onClick={() => toggleBarraca(b.id)}
                    >
                      <div className="barraca-accordion-title">
                        <Store size={16} />
                        <span>{b.nome}</span>
                        <small>({produtos.length} {produtos.length === 1 ? "item" : "itens"})</small>
                      </div>
                      {estaAberto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>

                    {estaAberto && (
                      <div className="product-grid product-grid-accordion">
                        {produtos.map((p) => {
                          const estoque = statusEstoque(p.quantidade, p.esgotado);
                          return <button
                            key={p.id}
                            className={`product-btn ${p.esgotado ? "disabled" : ""}`}
                            disabled={p.esgotado}
                            onClick={() => addToCart(b, p)}
                          >
                            <span className="product-nome">{p.nome}</span>
                            <span className="product-preco">
                              {p.esgotado ? "Esgotado" : formatMoney(p.preco)}
                            </span>
                            <span className={`cash-stock cash-stock-${estoque.classe}`}>
                              <Package size={11} /> {p.quantidade} un. · {estoque.label}
                            </span>
                          </button>
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <SectionLabel>Pedido atual</SectionLabel>
          <Ticket_ accent="pine">
            {cartItems.length === 0 ? (
              <div className="hist-empty">Nenhum item selecionado ainda.</div>
            ) : (
              <div className="cart-list">
                {cartItems.map(([key, v]) => (
                  <div key={key} className="cart-row">
                    <div className="cart-row-main">
                      <span className="cart-qtd">{v.qtd}x</span>
                      <span className="cart-nome">{v.nome}</span>
                      <span className="cart-sub">({v.barracaNome})</span>
                    </div>
                    <div className="cart-row-side">
                      <span className="cart-val">{formatMoney(v.preco * v.qtd)}</span>
                      <button className="cart-btn" onClick={() => decFromCart(key)}><Minus size={13} /></button>
                      <button className="cart-btn cart-btn-x" onClick={() => removeFromCart(key)}><X size={13} /></button>
                    </div>
                  </div>
                ))}
                <div className="cart-total-row">
                  <span>Total do pedido</span>
                  <span className="cart-total-val">{formatMoney(cartTotal)}</span>
                </div>
              </div>
            )}
            <button className="btn-primary" disabled={cartItems.length === 0 || saving} onClick={finalizarPedido}>
              Finalizar venda
            </button>
          </Ticket_>
        </>
      )}

      {erroOperacao && <div className="err-msg"><AlertCircle size={14} /> {erroOperacao}</div>}
      <ToastSucesso mensagem={sucessoOperacao} />

      {tab === "avulso" && (
        <>
          <SectionLabel>Registrar valor avulso (sem produto cadastrado)</SectionLabel>
          <BillPad onAdd={addValorAvulso} disabled={saving || !online} />
          <CustomAmount onAdd={addValorAvulso} itemField item={itemAvulso} setItem={setItemAvulso} disabled={saving || !online} />
        </>
      )}

      <SectionLabel>Últimas vendas {saving && <em className="saving">salvando…</em>}</SectionLabel>
      <Historico items={transacoes} onDelete={deleteTransacao} emptyText="Nenhuma venda registrada ainda." disabled={saving || !online} />
    </div>
  );
}

/* ---------------- BARRACA ---------------- */

function TelaBarracaSelect({ barracas, onEnter, onBack }) {
  const [sel, setSel] = useState("");
  const [err, setErr] = useState("");

  function entrar() {
    const b = barracas.find((x) => x.id === sel);
    if (!b) { setErr("Escolha uma barraca."); return; }
    onEnter(b);
  }

  return (
    <div className="tela">
      <TopBar title="Barracas" subtitle="Selecionar barraca para operação" onBack={onBack} icon={<Store size={20} />} />
      {barracas.length === 0 ? (
        <div className="hist-empty">Nenhuma barraca cadastrada ainda. Peça a um administrador para cadastrar em Acessos.</div>
      ) : (
        <Ticket_ accent="pine">
          <div className="form-stack">
            <label className="field-label">Sua barraca</label>
            <select value={sel} onChange={(e) => { setSel(e.target.value); setErr(""); }}>
              <option value="">Selecione…</option>
              {barracas.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
            <button className="btn-primary" onClick={entrar}>Acessar barraca</button>
            {err && <div className="err-msg"><AlertCircle size={14} /> {err}</div>}
          </div>
        </Ticket_>
      )}
    </div>
  );
}

function ProdutoForm({ onAdd }) {
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [qtd, setQtd] = useState("");
  const [err, setErr] = useState("");

  function submit() {
    const n = nome.trim();
    const p = parseInt(preco, 10);
    const q = parseInt(qtd, 10);
    if (!n) { setErr("Digite o nome do produto."); return; }
    if (!p || p <= 0) { setErr("Digite um preço."); return; }
    if (p % 2 !== 0) { setErr("O preço precisa ser múltiplo de 2."); return; }
    if (!q || q < 0) { setErr("Digite a quantidade em estoque."); return; }
    onAdd({ nome: n, preco: p, quantidade: q });
    setNome(""); setPreco(""); setQtd(""); setErr("");
  }

  return (
    <div className="form-stack">
      <label className="field-label">Nome do produto</label>
      <input placeholder="Ex: Pastel de queijo" value={nome} onChange={(e) => setNome(e.target.value)} />
      <label className="field-label">Preço (múltiplo de 2)</label>
      <input type="number" step="2" placeholder="Ex: 8" value={preco} onChange={(e) => setPreco(e.target.value)} />
      <label className="field-label">Quantidade em estoque</label>
      <input type="number" placeholder="Ex: 40" value={qtd} onChange={(e) => setQtd(e.target.value)} />
      <button className="btn-primary" onClick={submit}><Plus size={16} /> Cadastrar produto</button>
      {err && <div className="err-msg"><AlertCircle size={14} /> {err}</div>}
    </div>
  );
}

function TelaBarracaVendas({ barraca, onBack, refreshSignal, online }) {
  const [tab, setTab] = useState("vender");
  const [vendas, setVendas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingProdutos, setLoadingProdutos] = useState(true);
  const [saving, setSaving] = useState(false);
  const [itemAvulso, setItemAvulso] = useState("");
  const [erroOperacao, setErroOperacao] = useState("");
  const [sucessoOperacao, setSucessoOperacao] = useState("");
  const operacaoEmCurso = useRef(false);
  useEffect(() => {
    if (!sucessoOperacao) return undefined;
    const timer = window.setTimeout(() => setSucessoOperacao(""), 3000);
    return () => window.clearTimeout(timer);
  }, [sucessoOperacao]);

  useEffect(() => {
    (async () => {
      const data = await storageGet(vendasKey(barraca.id), true);
      setVendas(data || []);
      setLoading(false);
      const p = await storageGet(produtosKey(barraca.id), true);
      setProdutos(p || []);
      setLoadingProdutos(false);
    })();
  }, [barraca.id, refreshSignal]);

  async function registrarVendaAvulsa(valor) {
    if (operacaoEmCurso.current || !online) {
      if (!online) setErroOperacao("Sem internet. Aguarde a conexão voltar antes de registrar a venda.");
      return;
    }
    operacaoEmCurso.current = true;
    const novo = { id: uid(), valor, item: itemAvulso.trim() || null, hora: Date.now() };
    setSaving(true); setErroOperacao("");
    try {
      const salva = await criarVenda(vendasKey(barraca.id), novo);
      setVendas((atuais) => [...atuais, salva]);
      setItemAvulso("");
      setSucessoOperacao("Venda avulsa registrada com sucesso.");
    } catch (error) { setErroOperacao(`A venda não foi registrada: ${error.message}`); }
    finally { operacaoEmCurso.current = false; setSaving(false); }
  }

  async function venderProduto(produto) {
    if (operacaoEmCurso.current || !online || produto.esgotado || produto.quantidade <= 0) return;
    operacaoEmCurso.current = true;
    const novaVenda = {
      id: uid(), valor: produto.preco, item: produto.nome, hora: Date.now(), tipo: "produto",
      itens: [{ produtoId: produto.id, nome: produto.nome, quantidade: 1 }],
    };
    setSaving(true); setErroOperacao("");
    try {
      const resultado = await registrarVendaBarraca(barraca.id, produto, novaVenda);
      setProdutos((atuais) => atuais.map((p) => p.id === produto.id ? resultado.produto : p));
      setVendas((atuais) => [...atuais, resultado.venda]);
      setSucessoOperacao("Venda registrada e estoque atualizado.");
    } catch (error) { setErroOperacao(`A venda não foi registrada: ${error.message}`); }
    finally { operacaoEmCurso.current = false; setSaving(false); }
  }

  async function atualizarProduto(produto) {
    setErroOperacao("");
    try {
      const salvo = await salvarProduto(barraca.id, produto);
      setProdutos((atuais) => atuais.map((p) => p.id === salvo.id ? salvo : p));
    } catch (error) { setErroOperacao(`O produto não foi atualizado: ${error.message}`); }
  }

  function toggleEsgotado(produto) {
    atualizarProduto({ ...produto, esgotado: !produto.esgotado });
  }

  function ajustarEstoque(produto, delta) {
    const novaQtd = Math.max(0, produto.quantidade + delta);
    atualizarProduto({ ...produto, quantidade: novaQtd, esgotado: novaQtd <= 0 ? true : produto.esgotado });
  }

  async function addProduto({ nome, preco, quantidade }) {
    const novo = { id: uid(), nome, preco, quantidade, esgotado: quantidade <= 0 };
    setErroOperacao("");
    try {
      const salvo = await salvarProduto(barraca.id, novo);
      setProdutos((atuais) => [...atuais, salvo]);
    } catch (error) { setErroOperacao(`O produto não foi cadastrado: ${error.message}`); }
  }

  async function removeProduto(id) {
    if (!window.confirm("Excluir este produto? O histórico de vendas será preservado.")) return;
    setErroOperacao("");
    try {
      await excluirProduto(barraca.id, id);
      setProdutos((atuais) => atuais.filter((p) => p.id !== id));
    } catch (error) { setErroOperacao(`O produto não foi excluído: ${error.message}`); }
  }

  async function deleteVenda(id) {
    if (operacaoEmCurso.current || !online) return;
    const venda = vendas.find((item) => item.id === id);
    if (!venda) return;
    operacaoEmCurso.current = true;
    setSaving(true); setErroOperacao("");
    try {
      const resultado = await excluirVendaBarraca(barraca.id, venda, produtos);
      setVendas((atuais) => atuais.filter((v) => v.id !== id));
      if (resultado.produto) {
        setProdutos((atuais) => atuais.map((produto) => produto.id === resultado.produto.id ? resultado.produto : produto));
      }
      setSucessoOperacao(resultado.produto ? "Venda removida e unidade devolvida ao estoque." : "Lançamento removido.");
    } catch (error) { setErroOperacao(`A venda não foi removida: ${error.message}`); }
    finally { operacaoEmCurso.current = false; setSaving(false); }
  }

  const total = vendas.reduce((s, v) => s + v.valor, 0);

  return (
    <div className="tela">
      <TopBar title={barraca.nome} subtitle="Vendas da barraca" onBack={onBack} icon={<Store size={20} />} />
      <Ticket_ accent="pine">
        <div className="total-box">
          <span className="total-label">Total vendido na barraca</span>
          <span className="total-val">{loading ? "…" : formatMoney(total)}</span>
        </div>
      </Ticket_>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "vender", label: "Vender", icon: <ShoppingCart size={14} /> },
          { key: "produtos", label: "Produtos", icon: <Package size={14} /> },
        ]}
      />

      {tab === "vender" && (
        <>
          <SectionLabel>Toque no produto vendido</SectionLabel>
          {loadingProdutos ? (
            <div className="hist-empty">Carregando produtos…</div>
          ) : produtos.length === 0 ? (
            <div className="hist-empty">Nenhum produto cadastrado. Vá em "Produtos" para cadastrar.</div>
          ) : (
            <div className="product-grid">
              {produtos.map((p) => (
                <button
                  key={p.id}
                  className={`product-btn ${p.esgotado || p.quantidade <= 0 ? "disabled" : ""}`}
                  disabled={saving || !online || p.esgotado || p.quantidade <= 0}
                  onClick={() => venderProduto(p)}
                >
                  <span className="product-nome">{p.nome}</span>
                  <span className="product-preco">
                    {p.esgotado || p.quantidade <= 0 ? "Esgotado" : formatMoney(p.preco)}
                  </span>
                  {!p.esgotado && p.quantidade > 0 && <span className="product-estoque">{p.quantidade} un.</span>}
                </button>
              ))}
            </div>
          )}

          <SectionLabel>Venda avulsa (sem produto cadastrado)</SectionLabel>
          <CustomAmount onAdd={registrarVendaAvulsa} itemField item={itemAvulso} setItem={setItemAvulso} disabled={saving || !online} />
        </>
      )}

      {erroOperacao && <div className="err-msg"><AlertCircle size={14} /> {erroOperacao}</div>}
      <ToastSucesso mensagem={sucessoOperacao} />

      {tab === "produtos" && (
        <>
          <SectionLabel>Cadastrar produto</SectionLabel>
          <Ticket_ accent="pine"><ProdutoForm onAdd={addProduto} /></Ticket_>

          <SectionLabel>Produtos cadastrados</SectionLabel>
          {produtos.length === 0 ? (
            <div className="hist-empty">Nenhum produto cadastrado ainda.</div>
          ) : (
            <div className="produto-list">
              {produtos.map((p) => (
                <div key={p.id} className="produto-row">
                  <div className="produto-info">
                    <span className="produto-nome">{p.nome}</span>
                    <span className="produto-meta">{formatMoney(p.preco)} · estoque: {p.quantidade}</span>
                  </div>
                  <div className="produto-actions">
                    <button className="stock-btn" onClick={() => ajustarEstoque(p, -1)} title="Diminuir estoque"><Minus size={13} /></button>
                    <button className="stock-btn" onClick={() => ajustarEstoque(p, 1)} title="Aumentar estoque"><Plus size={13} /></button>
                    <button
                      className={`esgotado-btn ${p.esgotado ? "is-esgotado" : ""}`}
                      onClick={() => toggleEsgotado(p)}
                    >
                      {p.esgotado ? <PackageX size={13} /> : <Package size={13} />}
                      {p.esgotado ? "Esgotado" : "Disponível"}
                    </button>
                    <button className="hist-del" onClick={() => removeProduto(p.id)} title="Excluir produto">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <SectionLabel>Últimas vendas {saving && <em className="saving">salvando…</em>}</SectionLabel>
      <Historico items={vendas} onDelete={deleteVenda} emptyText="Nenhuma venda registrada ainda." disabled={saving || !online} />
    </div>
  );
}

/* ---------------- PAINEL ---------------- */

function TelaPainel({ barracas, setBarracas, onBack, refreshSignal }) {
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState("");
  const [caixaTotal, setCaixaTotal] = useState(0);
  const [barracaTotais, setBarracaTotais] = useState({});
  const [loading, setLoading] = useState(true);

  const carregarRelatorio = useCallback(async () => {
    setLoading(true);
    const caixa = (await storageGet(K_CAIXA, true)) || [];
    const totCaixa = caixa.reduce((s, t) => s + t.valor, 0);
    const totais = {};
    for (const b of barracas) {
      const v = (await storageGet(vendasKey(b.id), true)) || [];
      totais[b.id] = v.reduce((s, x) => s + x.valor, 0);
    }
    setCaixaTotal(totCaixa);
    setBarracaTotais(totais);
    setLoading(false);
  }, [barracas]);

  useEffect(() => { carregarRelatorio(); }, [carregarRelatorio, refreshSignal]);

  async function addBarraca() {
    const n = nome.trim();
    if (!n) {
      setErro("Digite o nome da barraca antes de cadastrar!");
      return;
    }
    setErro("");
    const nova = { id: uid(), nome: n };
    try {
      const salva = await salvarBarracaRegistro(nova);
      setBarracas((atuais) => [...atuais, salva]);
      setNome("");
    } catch (error) { setErro(`A barraca não foi cadastrada: ${error.message}`); }
  }

  async function removeBarraca(id) {
    if (!window.confirm("Excluir esta barraca? Os produtos serão removidos e os operadores vinculados perderão o acesso à barraca.")) return;
    setErro("");
    try {
      await excluirBarracaRegistro(id);
      setBarracas((atuais) => atuais.filter((b) => b.id !== id));
    } catch (error) { setErro(`A barraca não foi excluída: ${error.message}`); }
  }

  const totalBarracas = Object.values(barracaTotais).reduce((s, v) => s + v, 0);
  const diferenca = caixaTotal - totalBarracas;

  return (
    <div className="tela">
      <TopBar title="Painel" subtitle="Cadastro e conferência" onBack={onBack} icon={<ClipboardList size={20} />} />

      <SectionLabel>Conferência geral {loading && <em className="saving">carregando…</em>}</SectionLabel>
      <Ticket_ accent="cran">
        <div className="conf-grid">
          <div className="conf-item">
            <span className="conf-label">Total no caixa</span>
            <span className="conf-val">{formatMoney(caixaTotal)}</span>
          </div>
          <div className="conf-item">
            <span className="conf-label">Total nas barracas</span>
            <span className="conf-val">{formatMoney(totalBarracas)}</span>
          </div>
          <div className="conf-item conf-diff">
            <span className="conf-label">Diferença (fichas em circulação)</span>
            <span className={`conf-val ${diferenca < 0 ? "neg" : ""}`}>{formatMoney(diferenca)}</span>
          </div>
        </div>
        <button className="btn-secondary" onClick={carregarRelatorio}>Atualizar</button>
      </Ticket_>

      <SectionLabel>Barracas cadastradas</SectionLabel>
      <div className="barraca-list">
        {barracas.length === 0 && <div className="hist-empty">Nenhuma barraca cadastrada.</div>}
        {barracas.map((b) => (
          <div key={b.id} className="barraca-row">
            <div className="barraca-info">
              <span className="barraca-nome"><Ticket size={14} /> {b.nome}</span>
            </div>
            <div className="barraca-side">
              <span className="barraca-total">{formatMoney(barracaTotais[b.id] || 0)}</span>
              <button className="hist-del" onClick={() => removeBarraca(b.id)} title="Remover barraca">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <SectionLabel>Cadastrar nova barraca</SectionLabel>
      <div className="form-stack">
        <input
          placeholder="Nome da barraca (ex: Pastel, Pescaria)"
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
            if (erro) setErro("");
          }}
          onKeyDown={(e) => e.key === "Enter" && addBarraca()}
        />
        {erro && <div className="err-msg"><AlertCircle size={14} /> {erro}</div>}
        <button type="button" className="btn-primary" onClick={addBarraca}>
          <Plus size={16} /> Cadastrar
        </button>
      </div>
    </div>
  );
}

/* ---------------- DASHBOARD E ACESSOS ---------------- */

function TelaHistorico({ onBack }) {
  const [historicos, setHistoricos] = useState([]);
  const [nome, setNome] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const carregar = useCallback(async () => {
    setCarregando(true);
    try { setHistoricos(await listarHistoricos()); }
    catch (error) { setErro(`Não foi possível carregar o histórico: ${error.message}`); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  async function resetar() {
    if (!nome.trim()) { setErro("Dê um nome para identificar este evento no histórico."); return; }
    if (!window.confirm(`Arquivar o estado atual como “${nome.trim()}” e iniciar um evento limpo? Vendas, entradas e produtos atuais serão retirados da operação.`)) return;
    setProcessando(true); setErro(""); setSucesso("");
    try { await arquivarEResetarEvento(nome); setNome(""); setSucesso("Evento arquivado e operação resetada com segurança."); await carregar(); }
    catch (error) { setErro(`O reset não foi concluído: ${error.message}`); }
    finally { setProcessando(false); }
  }
  async function restaurar(historico) {
    if (!window.confirm(`Restaurar “${historico.nome}”? Os dados que estão na operação agora serão substituídos. Se precisar deles, arquive-os antes.`)) return;
    setProcessando(true); setErro(""); setSucesso("");
    try { await restaurarEvento(historico); setSucesso(`“${historico.nome}” foi restaurado.`); }
    catch (error) { setErro(`Não foi possível restaurar: ${error.message}`); }
    finally { setProcessando(false); }
  }
  const quantidade = (historico, chave) => historico.dados?.[chave]?.length || 0;
  return <div className="tela">
    <TopBar title="Histórico" subtitle="Arquivo e reinício de eventos" onBack={onBack} icon={<Archive size={20} />} />
    {sucesso && <div className="success-inline"><Check size={16} /> {sucesso}</div>}
    {erro && <div className="err-msg"><AlertCircle size={14} /> {erro}</div>}
    <div className="dashboard-panel reset-panel">
      <div className="panel-heading"><div><h3>Iniciar um evento limpo</h3><p>Uma cópia é criada antes da limpeza. Barracas e acessos são preservados.</p></div></div>
      <div className="reset-form"><input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Encountry 2026 — testes" disabled={processando} /><button className="btn-danger" onClick={resetar} disabled={processando}><Archive size={16} /> {processando ? "Processando…" : "Arquivar e resetar"}</button></div>
    </div>
    <SectionLabel>Eventos arquivados</SectionLabel>
    <div className="history-grid">
      {carregando && <div className="hist-empty">Carregando histórico…</div>}
      {!carregando && historicos.length === 0 && <div className="hist-empty">Nenhum evento arquivado ainda.</div>}
      {historicos.map((historico) => <div className="dashboard-panel history-card" key={historico.id}>
        <div><h3>{historico.nome}</h3><p>{new Date(historico.criado_em).toLocaleString("pt-BR")}</p></div>
        <div className="history-counts"><span>{quantidade(historico, "vendas")} vendas</span><span>{quantidade(historico, "entradas")} entradas</span><span>{quantidade(historico, "produtos")} produtos</span></div>
        <button className="btn-secondary" onClick={() => restaurar(historico)} disabled={processando}><RotateCcw size={15} /> Restaurar</button>
      </div>)}
    </div>
  </div>;
}

function TelaDashboard({ barracas, onBack, onNavigate, refreshSignal }) {
  const [caixa, setCaixa] = useState([]);
  const [vendasBarracas, setVendasBarracas] = useState({});
  const [produtosBarracas, setProdutosBarracas] = useState({});
  const [entradas, setEntradas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [erroRelatorio, setErroRelatorio] = useState("");
  const [barracaExpandida, setBarracaExpandida] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const caixaData = (await storageGet(K_CAIXA, true)) || [];
    const entradasData = (await listarEntradas()) || [];
    const vendas = {};
    const produtos = {};
    for (const barraca of barracas) {
      vendas[barraca.id] = (await storageGet(vendasKey(barraca.id), true)) || [];
      produtos[barraca.id] = (await storageGet(produtosKey(barraca.id), true)) || [];
    }
    setCaixa(caixaData);
    setEntradas(entradasData);
    setVendasBarracas(vendas);
    setProdutosBarracas(produtos);
    setLoading(false);
  }, [barracas]);

  useEffect(() => { carregar(); }, [carregar, refreshSignal]);

  async function exportar() {
    setExportando(true);
    setErroRelatorio("");
    try {
      await exportarRelatorioExcel({ barracas, caixa, vendasBarracas, entradas });
    } catch (error) {
      console.error("Não foi possível gerar o relatório.", error);
      setErroRelatorio("Não foi possível gerar o relatório Excel. Tente novamente.");
    } finally {
      setExportando(false);
    }
  }

  const totalCaixa = caixa.reduce((soma, venda) => soma + venda.valor, 0);
  const itensMaisVendidos = (vendas = []) => Object.values(vendas.reduce((acumulado, venda) => {
    const itens = venda.itens?.length
      ? venda.itens.map((item) => ({ nome: item.nome || venda.item || "Item não identificado", quantidade: Number(item.quantidade) || 1, valor: Number(item.subtotal) || venda.valor }))
      : [{ nome: venda.item || "Venda avulsa", quantidade: 1, valor: venda.valor }];
    itens.forEach((item) => {
      const chave = item.nome.trim().toLocaleLowerCase("pt-BR");
      acumulado[chave] = acumulado[chave]
        ? { ...acumulado[chave], quantidade: acumulado[chave].quantidade + item.quantidade, valor: acumulado[chave].valor + item.valor }
        : item;
    });
    return acumulado;
  }, {})).sort((a, b) => b.quantidade - a.quantidade || b.valor - a.valor).slice(0, 5);
  const porBarraca = barracas.map((barraca) => ({
    ...barraca,
    total: (vendasBarracas[barraca.id] || []).reduce((soma, venda) => soma + venda.valor, 0),
    quantidade: (vendasBarracas[barraca.id] || []).length,
    maisVendidos: itensMaisVendidos(vendasBarracas[barraca.id] || []),
  })).sort((a, b) => b.total - a.total);
  const totalBarracas = porBarraca.reduce((soma, barraca) => soma + barraca.total, 0);
  const totalVendas = caixa.length + porBarraca.reduce((soma, barraca) => soma + barraca.quantidade, 0);
  const maiorTotal = Math.max(...porBarraca.map((barraca) => barraca.total), 1);
  const ultimas = [
    ...caixa.map((venda) => ({ ...venda, origemNome: "Caixa Central" })),
    ...porBarraca.flatMap((barraca) => (vendasBarracas[barraca.id] || []).map((venda) => ({ ...venda, origemNome: barraca.nome }))),
  ].sort((a, b) => b.hora - a.hora).slice(0, 6);

  const vendasComOrigem = [
    ...caixa.map((venda) => ({ ...venda, canal: "caixa" })),
    ...porBarraca.flatMap((barraca) =>
      (vendasBarracas[barraca.id] || []).map((venda) => ({
        ...venda,
        canal: "barraca",
        barracaNome: barraca.nome,
      }))
    ),
  ];
  const quantidadeDaVenda = (venda) =>
    venda.itens?.reduce((soma, item) => soma + (Number(item.quantidade) || 0), 0) || 1;
  const horasComMovimento = [...vendasComOrigem, ...entradas].map((item) => new Date(item.hora).getHours());
  const horaInicial = horasComMovimento.length ? Math.min(...horasComMovimento) : 16;
  const horaFinal = horasComMovimento.length ? Math.max(...horasComMovimento) : 23;
  const horas = Array.from({ length: horaFinal - horaInicial + 1 }, (_, indice) => horaInicial + indice);
  const movimentoPorHora = horas.map((hora) => {
    const vendasDaHora = vendasComOrigem.filter((venda) => new Date(venda.hora).getHours() === hora);
    return {
      hora,
      caixa: vendasDaHora.filter((venda) => venda.canal === "caixa").reduce((soma, venda) => soma + quantidadeDaVenda(venda), 0),
      barracas: vendasDaHora.filter((venda) => venda.canal === "barraca").reduce((soma, venda) => soma + quantidadeDaVenda(venda), 0),
      portaria: entradas.filter((entrada) => new Date(entrada.hora).getHours() === hora).length,
    };
  });
  const maiorMovimento = Math.max(...movimentoPorHora.map((item) => item.caixa + item.barracas + item.portaria), 1);
  const pico = movimentoPorHora.reduce(
    (maior, atual) => atual.caixa + atual.barracas > maior.caixa + maior.barracas ? atual : maior,
    movimentoPorHora[0]
  );
  const picoPortaria = movimentoPorHora.reduce(
    (maior, atual) => atual.portaria > maior.portaria ? atual : maior,
    movimentoPorHora[0]
  );
  const produtosNoPico = pico
    ? Object.values(
      porBarraca.flatMap((barraca) =>
        (vendasBarracas[barraca.id] || [])
          .filter((venda) => new Date(venda.hora).getHours() === pico.hora && venda.item)
          .map((venda) => ({ nome: venda.item, barraca: barraca.nome, quantidade: quantidadeDaVenda(venda) }))
      ).reduce((acumulado, produto) => {
        const chave = `${produto.barraca}-${produto.nome}`;
        acumulado[chave] = acumulado[chave]
          ? { ...acumulado[chave], quantidade: acumulado[chave].quantidade + produto.quantidade }
          : produto;
        return acumulado;
      }, {})
    ).sort((a, b) => b.quantidade - a.quantidade).slice(0, 5)
    : [];
  const adultos = entradas.filter((entrada) => entrada.faixa === "adulto").length;
  const criancas = entradas.length - adultos;
  const visitantes = entradas.filter((entrada) => entrada.vinculo === "visitante").length;
  const membros = entradas.length - visitantes;
  const percentual = (valor) => entradas.length ? Math.round((valor / entradas.length) * 100) : 0;
  const produtosEstoque = barracas.flatMap((barraca) => (produtosBarracas[barraca.id] || []).map((produto) => ({
    ...produto, barracaNome: barraca.nome, status: statusEstoque(produto.quantidade, produto.esgotado),
  }))).sort((a, b) => {
    const prioridade = { empty: 0, low: 1, normal: 2, high: 3 };
    return prioridade[a.status.classe] - prioridade[b.status.classe] || a.quantidade - b.quantidade;
  });
  const movimentosRecentes = [
    ...ultimas.map((venda) => ({ id: `v-${venda.id}`, hora: venda.hora, titulo: venda.item || "Venda avulsa", detalhe: `${venda.origemNome} · ${formatMoney(venda.valor)}`, tipo: "venda" })),
    ...entradas.map((entrada) => ({ id: `e-${entrada.id}`, hora: entrada.hora, titulo: "Entrada registrada", detalhe: `${entrada.faixa === "adulto" ? "Adulto" : "Criança"} · ${entrada.vinculo === "visitante" ? "Visitante" : "Membro"}`, tipo: "entrada" })),
  ].sort((a, b) => b.hora - a.hora).slice(0, 6);

  return (
    <div className="tela">
      <TopBar title="Dashboard" subtitle="Visão geral das vendas" onBack={onBack} icon={<ClipboardList size={20} />} />
      <div className="dashboard-actions">
        <div><h2>Resumo do evento</h2><p>Atualize para acompanhar a operação em tempo real.</p></div>
        <div className="dashboard-quick-actions">
          <button className="btn-primary" disabled={loading || exportando} onClick={exportar}><Download size={16} /> {exportando ? "Gerando…" : "Exportar Excel"}</button>
          <button className="btn-secondary" onClick={() => onNavigate("caixa")}><Plus size={16} /> Nova venda</button>
          <button className="btn-secondary" onClick={() => onNavigate("acessos")}><Store size={16} /> Acessos</button>
          <button className="btn-secondary" onClick={() => onNavigate("historico")}><Archive size={16} /> Histórico</button>
          <button className="btn-secondary" onClick={carregar}><RefreshCw size={16} /> Atualizar</button>
        </div>
      </div>
      {erroRelatorio && <div className="err-msg"><AlertCircle size={14} /> {erroRelatorio}</div>}
      <div className="metric-grid">
        <div className="metric-card metric-blue"><div className="metric-heading"><span>Total de vendas no caixa</span><i><Wallet size={18} /></i></div><strong>{formatMoney(totalCaixa)}</strong><small>{caixa.length} vendas registradas</small></div>
        <div className="metric-card metric-green"><div className="metric-heading"><span>Total de vendas nas barracas</span><i><Store size={18} /></i></div><strong>{formatMoney(totalBarracas)}</strong><small>{porBarraca.reduce((soma, barraca) => soma + barraca.quantidade, 0)} vendas registradas</small></div>
        <div className="metric-card metric-gold"><div className="metric-heading"><span>Vendas registradas</span><i><ClipboardList size={18} /></i></div><strong>{totalVendas}</strong><small>Caixa e barracas</small></div>
        <div className="metric-card metric-portaria"><div className="metric-heading"><span>Pessoas na festa</span><i><Users size={18} /></i></div><strong>{entradas.length}</strong><small>{picoPortaria?.portaria ? `Pico: ${String(picoPortaria.hora).padStart(2, "0")}h · ${picoPortaria.portaria} pessoas` : "Aguardando contagem"}</small></div>
      </div>
      <section className="dashboard-panel peak-panel">
        <div className="panel-heading peak-heading">
          <div><h3>Horários de maior movimento</h3><p>Vendas e pessoas que entraram por hora</p></div>
          {vendasComOrigem.length > 0 && <div className="peak-badge"><TrendingUp size={15} /><span>Pico: {String(pico.hora).padStart(2, "0")}h–{String((pico.hora + 1) % 24).padStart(2, "0")}h</span><strong>{pico.caixa + pico.barracas} itens</strong></div>}
        </div>
        {horasComMovimento.length === 0 ? <div className="hist-empty">Os horários de pico aparecerão após os primeiros registros.</div> : (
          <>
            <div className="peak-legend" aria-hidden="true"><span><i className="legend-stall" /> Barracas</span><span><i className="legend-cash" /> Caixa</span><span><i className="legend-entry" /> Portaria</span></div>
            <div className="hourly-chart" role="img" aria-label={`Gráfico de vendas por hora. Maior movimento entre ${pico.hora} e ${(pico.hora + 1) % 24} horas.`}>
              {movimentoPorHora.map((item) => {
                const totalHora = item.caixa + item.barracas + item.portaria;
                return <div className={`hour-column ${item.hora === pico.hora ? "is-peak" : ""}`} key={item.hora}>
                  <span className="hour-total">{totalHora || ""}</span>
                  <div className="hour-stack" title={`${String(item.hora).padStart(2, "0")}h: ${item.barracas} nas barracas, ${item.caixa} no caixa e ${item.portaria} entradas`}>
                    <i className="hour-bar hour-bar-stall" style={{ height: `${(item.barracas / maiorMovimento) * 100}%` }} />
                    <i className="hour-bar hour-bar-cash" style={{ height: `${(item.caixa / maiorMovimento) * 100}%` }} />
                    <i className="hour-bar hour-bar-entry" style={{ height: `${(item.portaria / maiorMovimento) * 100}%` }} />
                  </div>
                  <span className="hour-label">{String(item.hora).padStart(2, "0")}h</span>
                </div>;
              })}
            </div>
            <div className="peak-products">
              <div className="peak-products-title"><Clock size={17} /><div><strong>Mais vendidos nas barracas durante o pico</strong><span>{String(pico.hora).padStart(2, "0")}h às {String((pico.hora + 1) % 24).padStart(2, "0")}h</span></div></div>
              {produtosNoPico.length === 0 ? <span className="peak-products-empty">Nenhum produto identificado nas vendas das barracas nesse horário.</span> : (
                <div className="peak-product-list">{produtosNoPico.map((produto, indice) => <div className="peak-product" key={`${produto.barraca}-${produto.nome}`}>
                  <b>{indice + 1}</b><div><strong>{produto.nome}</strong><span>{produto.barraca}</span></div><em>{produto.quantidade} un.</em>
                </div>)}</div>
              )}
            </div>
          </>
        )}
      </section>
      <div className="dashboard-visual-grid">
        <section className="dashboard-panel audience-panel">
          <div className="panel-heading"><div><h3>Público da festa</h3><p>Perfil das {entradas.length} pessoas registradas</p></div></div>
          {entradas.length === 0 ? <div className="hist-empty">Os perfis aparecerão após as primeiras entradas.</div> : <div className="audience-rings">
            <div className="audience-group"><div className="audience-ring" style={{ background: `conic-gradient(var(--blue) 0 ${percentual(adultos)}%, #e8edf3 ${percentual(adultos)}% 100%)` }}><div><strong>{percentual(adultos)}%</strong><span>adultos</span></div></div><p>{adultos} adultos · {criancas} crianças</p></div>
            <div className="audience-group"><div className="audience-ring" style={{ background: `conic-gradient(var(--green) 0 ${percentual(visitantes)}%, #e8edf3 ${percentual(visitantes)}% 100%)` }}><div><strong>{percentual(visitantes)}%</strong><span>visitantes</span></div></div><p>{visitantes} visitantes · {membros} membros</p></div>
          </div>}
        </section>
        <section className="dashboard-panel stock-panel">
          <div className="panel-heading"><div><h3>Situação do estoque</h3><p>Itens que precisam de atenção primeiro</p></div></div>
          {produtosEstoque.length === 0 ? <div className="hist-empty">Nenhum produto cadastrado.</div> : <div className="stock-visual-list">{produtosEstoque.slice(0, 7).map((produto) => <div className="stock-visual-row" key={`${produto.barracaNome}-${produto.id}`}><div><strong>{produto.nome}</strong><span>{produto.barracaNome} · {produto.quantidade} un.</span></div><em className={`stock-status stock-${produto.status.classe}`}>{produto.status.label}</em></div>)}</div>}
        </section>
      </div>
      <section className="dashboard-panel activity-panel">
        <div className="panel-heading"><div><h3>Últimos movimentos</h3><p>Vendas e entradas em tempo real</p></div></div>
        {movimentosRecentes.length === 0 ? <div className="hist-empty">Nenhum movimento registrado ainda.</div> : <div className="activity-timeline">{movimentosRecentes.map((movimento) => <div className={`activity-row activity-${movimento.tipo}`} key={movimento.id}><i>{movimento.tipo === "entrada" ? <Users size={14} /> : <Wallet size={14} />}</i><time>{new Date(movimento.hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time><div><strong>{movimento.titulo}</strong><span>{movimento.detalhe}</span></div></div>)}</div>}
      </section>
      <div className="dashboard-columns">
        <section className="dashboard-panel">
          <div className="panel-heading"><div><h3>Desempenho por barraca</h3><p>{loading ? "Carregando dados…" : "Total de vendas registradas"}</p></div></div>
          {porBarraca.length === 0 ? <div className="hist-empty">Cadastre barracas para acompanhar o desempenho.</div> : (
            <div className="ranking-list">
              {porBarraca.map((barraca) => {
                const aberta = barracaExpandida === barraca.id;
                return <div className={`ranking-item ${aberta ? "open" : ""}`} key={barraca.id}>
                  <button className="ranking-row" type="button" aria-expanded={aberta} onClick={() => setBarracaExpandida(aberta ? null : barraca.id)}>
                    <div className="ranking-info"><span>{barraca.nome}</span><small>{barraca.quantidade} vendas · {formatMoney(barraca.total)}</small></div>
                    <div className="ranking-bar-area"><div className="ranking-track"><i style={{ width: `${(barraca.total / maiorTotal) * 100}%` }} /></div>{aberta ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                  </button>
                  {aberta && <div className="ranking-products">
                    {barraca.maisVendidos.length === 0 ? <span className="ranking-products-empty">Nenhum item vendido nesta barraca.</span> : barraca.maisVendidos.map((item, indice) => <div className="ranking-product-row" key={`${barraca.id}-${item.nome}`}><b>{indice + 1}</b><div><strong>{item.nome}</strong><span>{formatMoney(item.valor)}</span></div><em>{item.quantidade} un.</em></div>)}
                  </div>}
                </div>;
              })}
            </div>
          )}
        </section>
        <section className="dashboard-panel">
          <div className="panel-heading"><div><h3>Últimas vendas</h3><p>Movimentações recentes</p></div></div>
          {ultimas.length === 0 ? <div className="hist-empty">Nenhuma venda registrada ainda.</div> : <div className="recent-list">
            {ultimas.map((venda) => <div className="recent-row" key={`${venda.origemNome}-${venda.id}`}>
              <div><strong>{venda.item || "Valor avulso"}</strong><span>{venda.origemNome} · {new Date(venda.hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></div>
              <b>{formatMoney(venda.valor)}</b>
            </div>)}
          </div>}
        </section>
      </div>
    </div>
  );
}

function TelaAcessos({ barracas, setBarracas, usuarioAtualId, onBack }) {
  const vazio = { id: null, nome: "", usuario: "", senha: "", papel: "caixa", barraca_id: "" };
  const [usuarios, setUsuarios] = useState(() => supabase ? [] : listarUsuarios());
  const [form, setForm] = useState(vazio);
  const [erro, setErro] = useState("");
  const [nomeBarraca, setNomeBarraca] = useState("");
  const [carregando, setCarregando] = useState(Boolean(supabase));
  const [salvando, setSalvando] = useState(false);

  const recarregar = useCallback(async () => {
    if (!supabase) {
      setUsuarios(listarUsuarios());
      return;
    }
    setCarregando(true);
    try {
      const resultado = await gerenciarUsuarios("listar");
      setUsuarios(resultado.usuarios || []);
      setErro("");
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { recarregar(); }, [recarregar]);

  async function submit(event) {
    event.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      if (supabase) {
        await gerenciarUsuarios(form.id ? "atualizar" : "criar", { usuario: form });
      } else {
        const resultado = salvarUsuario(form);
        if (resultado.error) throw new Error(resultado.error);
      }
      setForm(vazio);
      await recarregar();
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvando(false);
    }
  }
  function editar(usuario) {
    setForm({ ...usuario, senha: "" }); setErro("");
  }
  async function excluir(id) {
    if (id === usuarioAtualId) { setErro("Não é possível remover o usuário que está logado."); return; }
    if (!window.confirm("Remover este usuário e impedir seu acesso?")) return;
    setSalvando(true);
    setErro("");
    try {
      if (supabase) await gerenciarUsuarios("excluir", { id });
      else removerUsuario(id);
      await recarregar();
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvando(false);
    }
  }
  async function criarBarraca(event) {
    event.preventDefault();
    const nome = nomeBarraca.trim();
    if (!nome) { setErro("Digite o nome da barraca."); return; }
    setErro("");
    try {
      const salva = await salvarBarracaRegistro({ id: uid(), nome });
      setBarracas((atuais) => [...atuais, salva]);
      setNomeBarraca("");
    } catch (error) { setErro(`A barraca não foi cadastrada: ${error.message}`); }
  }
  async function excluirBarraca(id) {
    if (!window.confirm("Excluir esta barraca? Os produtos serão removidos e os operadores vinculados perderão o acesso à barraca.")) return;
    setErro("");
    try {
      await excluirBarracaRegistro(id);
      setBarracas((atuais) => atuais.filter((barraca) => barraca.id !== id));
    } catch (error) { setErro(`A barraca não foi excluída: ${error.message}`); }
  }
  const nomePerfil = (papel) => ({ admin: "Administrador", caixa: "Caixa", barraca: "Barraca", portaria: "Portaria" }[papel]);

  return (
    <div className="tela">
      <TopBar title="Acessos" subtitle="Usuários e permissões" onBack={onBack} icon={<Store size={20} />} />
      <div className="access-layout">
        <section className="dashboard-panel access-users">
          <div className="panel-heading"><div><h3>Usuários cadastrados</h3><p>Defina quem pode operar cada área.</p></div></div>
          <div className="user-list">
            {carregando && <span className="hist-empty">Carregando usuários…</span>}
            {!carregando && usuarios.length === 0 && <span className="hist-empty">Nenhum usuário cadastrado.</span>}
            {usuarios.map((usuario) => <div className="user-row" key={usuario.id}>
              <div className="user-avatar">{usuario.nome.slice(0, 1).toUpperCase()}</div>
              <div className="user-info"><strong>{usuario.nome}</strong><span>{supabase ? usuario.usuario : `@${usuario.usuario}`}</span></div>
              <span className={`role-badge role-${usuario.papel}`}>{nomePerfil(usuario.papel)}</span>
              <button className="btn-secondary user-edit" disabled={salvando} onClick={() => editar(usuario)}>Editar</button>
              <button className="hist-del" disabled={salvando} onClick={() => excluir(usuario.id)} title="Remover usuário"><Trash2 size={15} /></button>
            </div>)}
          </div>
          <div className="access-stalls">
            <div className="panel-heading"><div><h3>Barracas</h3><p>Cadastre as barracas e vincule os operadores ao criar os acessos.</p></div></div>
            <div className="stall-admin-list">
              {barracas.length === 0 && <span className="hist-empty">Nenhuma barraca cadastrada.</span>}
              {barracas.map((barraca) => <div className="stall-admin-row" key={barraca.id}><span>{barraca.nome}</span><button className="hist-del" onClick={() => excluirBarraca(barraca.id)} title="Remover barraca"><Trash2 size={15} /></button></div>)}
            </div>
            <form className="stall-create" onSubmit={criarBarraca}>
              <input value={nomeBarraca} onChange={(e) => setNomeBarraca(e.target.value)} placeholder="Nome da nova barraca" />
              <button className="btn-primary" type="submit"><Plus size={16} /> Criar barraca</button>
            </form>
          </div>
        </section>
        <section className="dashboard-panel access-form-panel">
          <div className="panel-heading"><div><h3>{form.id ? "Editar usuário" : "Novo usuário"}</h3><p>{form.id ? "Deixe a senha vazia para mantê-la." : "Crie um acesso para a equipe."}</p></div></div>
          <form className="form-stack" onSubmit={submit}>
            <label className="field-label">Nome</label><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome da pessoa" />
            <label className="field-label">{supabase ? "E-mail" : "Usuário"}</label><input type={supabase ? "email" : "text"} value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} placeholder={supabase ? "pessoa@email.com" : "Ex: joao"} required />
            <label className="field-label">{form.id ? "Nova senha (opcional)" : "Senha"}</label><input type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} />
            <label className="field-label">Perfil de acesso</label><select value={form.papel} onChange={(e) => setForm({ ...form, papel: e.target.value, barraca_id: "" })}><option value="admin">Administrador</option><option value="caixa">Caixa</option><option value="portaria">Portaria</option><option value="barraca">Barraca</option></select>
            {form.papel === "barraca" && <><label className="field-label">Barraca vinculada</label><select required value={form.barraca_id} onChange={(e) => setForm({ ...form, barraca_id: e.target.value })}><option value="">Selecione uma barraca</option>{barracas.map((barraca) => <option key={barraca.id} value={barraca.id}>{barraca.nome}</option>)}</select></>}
            {erro && <div className="err-msg"><AlertCircle size={14} /> {erro}</div>}
            <button className="btn-primary" disabled={salvando} type="submit"><Plus size={16} /> {salvando ? "Salvando…" : form.id ? "Salvar alterações" : "Criar acesso"}</button>
            {form.id && <button className="btn-secondary" disabled={salvando} type="button" onClick={() => { setForm(vazio); setErro(""); }}>Cancelar edição</button>}
          </form>
        </section>
      </div>
    </div>
  );
}

/* ---------------- APP ---------------- */

function TelaAcesso({ onLogin }) {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);

  async function entrar(event) {
    event.preventDefault();
    setEntrando(true);
    setErro("");
    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email: usuario, password: senha });
      if (error) setErro("E-mail ou senha incorretos.");
    } else {
      const resultado = entrarLocal(usuario, senha);
      if (resultado.error) setErro(resultado.error);
      else onLogin(resultado.perfil);
    }
    setEntrando(false);
  }

  return (
    <div className="app-root login-root">
      <div className="tela acesso-tela">
        <div className="home-header">
          <div className="brand-hero"><img src="/logo-ieq-vila-helena.png" alt="IEQ Vila Helena" /></div>
          <h1>Encountry</h1>
          <p>Festa country · IEQ Vila Helena</p>
        </div>
        <Ticket_ accent="pine">
          <form className="form-stack" onSubmit={entrar}>
            <label className="field-label">{supabase ? "E-mail" : "Usuário"}</label>
            <input type={supabase ? "email" : "text"} autoComplete="username" value={usuario} onChange={(e) => setUsuario(e.target.value)} required />
            <label className="field-label">Senha</label>
            <input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            {erro && <div className="err-msg"><AlertCircle size={14} /> {erro}</div>}
            <button className="btn-primary" disabled={entrando} type="submit"><LogIn size={16} /> {entrando ? "Entrando…" : "Entrar"}</button>
          </form>
          {!supabase && (
            <div className="login-accounts">
              <strong>Acessos iniciais</strong>
              {credenciaisIniciais.map(([perfil, login, senhaInicial]) => (
                <span key={login}>{perfil}: <b>{login}</b> / {senhaInicial}</span>
              ))}
            </div>
          )}
        </Ticket_>
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState("home");
  const [barracas, setBarracas] = useState([]);
  const [barracaAtiva, setBarracaAtiva] = useState(null);
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [carregandoAcesso, setCarregandoAcesso] = useState(bancoCentralConfigurado);
  const [erroAcesso, setErroAcesso] = useState("");
  const online = useConexao();
  const podeOperar = !supabase || online;
  const sincronizacao = useSincronizacao(Boolean(session && perfil));

  const abrirModuloInicial = (perfilAtual) => {
    if (perfilAtual.papel === "admin") { setScreen("dashboard"); return; }
    if (perfilAtual.papel === "caixa") { setScreen("caixa"); return; }
    if (perfilAtual.papel === "portaria") { setScreen("portaria"); return; }
    const barraca = barracas.find((item) => item.id === perfilAtual.barraca_id);
    if (barraca) { setBarracaAtiva(barraca); setScreen("barraca_vendas"); }
    else setScreen("barraca_select");
  };

  useEffect(() => {
    if (!supabase) {
      const sessaoLocal = obterSessaoLocal();
      setSession(sessaoLocal);
      setPerfil(sessaoLocal?.perfil || null);
      setCarregandoAcesso(false);
      return undefined;
    }
    let ativo = true;
    let versao = 0;

    async function aplicarSessao(sessao) {
      const versaoAtual = ++versao;
      if (!ativo) return;
      setSession(sessao);
      setPerfil(null);
      setErroAcesso("");
      if (!sessao) {
        setCarregandoAcesso(false);
        return;
      }
      setCarregandoAcesso(true);
      try {
        const perfilAtual = await obterPerfil(sessao.user.id);
        if (ativo && versaoAtual === versao) setPerfil(perfilAtual);
      } catch (error) {
        console.error("Não foi possível carregar o perfil de acesso.", error);
        if (ativo && versaoAtual === versao) {
          setErroAcesso("Não foi possível consultar sua permissão. Tente sair e entrar novamente.");
        }
      } finally {
        if (ativo && versaoAtual === versao) setCarregandoAcesso(false);
      }
    }

    supabase.auth.getSession().then(({ data: { session: sessao } }) => aplicarSessao(sessao));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      // Consultas assíncronas dentro deste callback podem bloquear o cliente do Supabase.
      setTimeout(() => aplicarSessao(sessao), 0);
    });
    return () => { ativo = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    (async () => {
      const data = await storageGet(K_BARRACAS, true);
      setBarracas(data || []);
    })();
  }, [sincronizacao.versao]);

  if (carregandoAcesso) {
    return <div className="app-root"><div className="tela"><div className="hist-empty">Carregando acesso…</div></div></div>;
  }

  if (!session) {
    return <TelaAcesso onLogin={(perfilLocal) => {
      setSession({ user: { id: perfilLocal.id }, perfil: perfilLocal });
      setPerfil(perfilLocal);
      abrirModuloInicial(perfilLocal);
    }} />;
  }

  if (bancoCentralConfigurado && !perfil) {
    return (
      <div className="app-root"><div className="tela acesso-tela">
        <div className="hist-empty">{erroAcesso || "Seu usuário ainda não recebeu uma permissão de acesso."}</div>
        <button className="btn-secondary" onClick={() => supabase.auth.signOut()}><LogOut size={16} /> Sair</button>
      </div></div>
    );
  }

  const podeAcessarCaixa = !perfil || ["admin", "caixa"].includes(perfil.papel);
  const podeAcessarBarraca = !perfil || ["admin", "barraca"].includes(perfil.papel);
  const podeAcessarPainel = !perfil || perfil.papel === "admin";
  const podeAcessarPortaria = !perfil || ["admin", "portaria"].includes(perfil.papel);
  const barracasPermitidas = perfil?.papel === "barraca"
    ? (perfil.barraca_id ? barracas.filter((b) => b.id === perfil.barraca_id) : barracas)
    : barracas;
  const sair = () => {
    if (supabase) supabase.auth.signOut();
    else {
      sairLocal();
      setSession(null);
      setPerfil(null);
      setScreen("home");
    }
  };

  return (
    <div className="app-root">
      <Navbar screen={screen} onNavigate={setScreen} perfil={perfil} onLogout={sair} />
      <EstadoConexao online={online} sincronizacao={sincronizacao.status} />
      <main className="app-main">
      {screen === "home" && (
        <div className="tela">
          <div className="home-header">
            <div className="brand-hero"><img src="/logo-ieq-vila-helena.png" alt="IEQ Vila Helena" /></div>
            <h1>Encountry</h1>
            <p>Controle de caixa e barracas</p>
            {perfil && <span className="access-badge">Acesso: {perfil.papel}</span>}
          </div>
          <div className="menu-list">
            {podeAcessarCaixa && <button className="menu-card mc-gold" onClick={() => setScreen("caixa")}>
              <div className="mc-icon"><Wallet size={22} /></div>
              <div className="mc-text">
                <h2>Caixa Central</h2>
                <p>Venda fichas e pacotes</p>
              </div>
            </button>}

            {podeAcessarBarraca && <button className="menu-card mc-pine" onClick={() => setScreen("barraca_select")}>
              <div className="mc-icon"><Store size={22} /></div>
              <div className="mc-text">
                <h2>Barraca</h2>
                <p>Acesso e vendas da barraca</p>
              </div>
            </button>}
            {podeAcessarPortaria && <button className="menu-card mc-blue" onClick={() => setScreen("portaria")}>
              <div className="mc-icon"><Users size={22} /></div>
              <div className="mc-text"><h2>Portaria</h2><p>Conte adultos, crianças, visitantes e membros</p></div>
            </button>}

            {podeAcessarPainel && <button className="menu-card mc-cran" onClick={() => setScreen("painel")}>
              <div className="mc-icon"><ClipboardList size={22} /></div>
              <div className="mc-text">
                <h2>Painel Geral</h2>
                <p>Cadastrar e conferir totais</p>
              </div>
            </button>}
            {podeAcessarPainel && <button className="menu-card mc-blue" onClick={() => setScreen("dashboard")}>
              <div className="mc-icon"><ClipboardList size={22} /></div>
              <div className="mc-text">
                <h2>Dashboard</h2>
                <p>Visualize o resumo das vendas</p>
              </div>
            </button>}
            {podeAcessarPainel && <button className="menu-card mc-dark" onClick={() => setScreen("acessos")}>
              <div className="mc-icon"><Store size={22} /></div>
              <div className="mc-text">
                <h2>Controle de acessos</h2>
                <p>Gerencie usuários e permissões</p>
              </div>
            </button>}
            {podeAcessarPainel && <button className="menu-card mc-cran" onClick={() => setScreen("historico")}>
              <div className="mc-icon"><Archive size={22} /></div>
              <div className="mc-text"><h2>Histórico de eventos</h2><p>Arquive, resete ou restaure os dados</p></div>
            </button>}
          </div>
        </div>
      )}

      {screen === "caixa" && <TelaCaixa onBack={() => setScreen("home")} refreshSignal={sincronizacao.versao} online={podeOperar} />}
      {screen === "portaria" && podeAcessarPortaria && <TelaPortaria onBack={() => setScreen("home")} refreshSignal={sincronizacao.versao} online={podeOperar} perfil={perfil} />}

      {screen === "barraca_select" && (
        perfil?.papel === "barraca" ? (
          (() => {
            const barracaVinculada = barracas.find((b) => b.id === perfil.barraca_id);
            return barracaVinculada ? (
              <TelaBarracaVendas barraca={barracaVinculada} onBack={() => setScreen("home")} refreshSignal={sincronizacao.versao} online={podeOperar} />
            ) : (
              <div className="tela">
                <TopBar title="Barraca" subtitle="Acesso do operador" onBack={() => setScreen("home")} icon={<Store size={20} />} />
                <Ticket_ accent="pine"><div className="access-empty"><Store size={28} /><h2>Barraca não vinculada</h2><p>Seu usuário ainda não foi associado a uma barraca. Peça ao administrador para definir o vínculo no módulo Acessos.</p></div></Ticket_>
              </div>
            );
          })()
        ) : (
          <TelaBarracaSelect
            barracas={barracasPermitidas}
            onEnter={(b) => { setBarracaAtiva(b); setScreen("barraca_vendas"); }}
            onBack={() => setScreen("home")}
          />
        )
      )}

      {screen === "barraca_vendas" && barracaAtiva && (
        <TelaBarracaVendas barraca={barracaAtiva} onBack={() => setScreen("barraca_select")} refreshSignal={sincronizacao.versao} online={podeOperar} />
      )}

      {screen === "painel" && (
        <TelaPainel barracas={barracas} setBarracas={setBarracas} onBack={() => setScreen("home")} refreshSignal={sincronizacao.versao} />
      )}
      {screen === "dashboard" && podeAcessarPainel && (
        <TelaDashboard barracas={barracas} onBack={() => setScreen("home")} onNavigate={setScreen} refreshSignal={sincronizacao.versao} />
      )}
      {screen === "acessos" && podeAcessarPainel && (
        <TelaAcessos barracas={barracas} setBarracas={setBarracas} usuarioAtualId={perfil?.id} onBack={() => setScreen("home")} />
      )}
      {screen === "historico" && podeAcessarPainel && <TelaHistorico onBack={() => setScreen("home")} />}
      </main>
      <SiteFooter />
      <MobileNav screen={screen} onNavigate={setScreen} perfil={perfil} />
    </div>
  );
}
