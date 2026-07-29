import React, { useState, useEffect, useCallback } from "react";
import {
  Store, Wallet, ClipboardList, Plus, Trash2, ArrowLeft, AlertCircle,
  Ticket, Package, PackageX, ShoppingCart, Minus, X, RefreshCw,
  ChevronDown, ChevronUp, LogIn, LogOut, Menu, Clock, TrendingUp
} from "lucide-react";
import { bancoCentralConfigurado, gerenciarUsuarios, obterPerfil, storageGet, storageSet, supabase } from "./lib/supabase";
import { credenciaisIniciais, entrarLocal, listarUsuarios, obterSessaoLocal, removerUsuario, sairLocal, salvarUsuario } from "./lib/authLocal";
import "./App.css";

const NOTES = [2, 4, 6, 10, 20, 50];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function formatMoney(v) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}
function statusEstoque(quantidade, esgotado) {
  if (esgotado || quantidade <= 0) return { label: "Esgotado", classe: "empty" };
  if (quantidade <= 10) return { label: "Pouco estoque", classe: "low" };
  if (quantidade >= 30) return { label: "Estoque alto", classe: "high" };
  return { label: "Estoque normal", classe: "normal" };
}


const K_BARRACAS = "festa-barracas";
const K_CAIXA = "festa-caixa-transacoes";
const vendasKey = (id) => `festa-vendas-${id}`;
const produtosKey = (id) => `festa-produtos-${id}`;

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
        {podePainel && <button className={screen === "painel" ? "active" : ""} onClick={() => navegar("painel")}>Painel</button>}
        {podePainel && <button className={screen === "dashboard" ? "active" : ""} onClick={() => navegar("dashboard")}>Dashboard</button>}
        {podePainel && <button className={screen === "acessos" ? "active" : ""} onClick={() => navegar("acessos")}>Acessos</button>}
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
      { key: "barraca_select", label: "Barracas", icon: <Store size={19} /> },
      { key: "acessos", label: "Acessos", icon: <ClipboardList size={19} /> },
    ]
    : perfil?.papel === "caixa"
      ? [
        { key: "home", label: "Início", icon: <Ticket size={19} /> },
        { key: "caixa", label: "Caixa", icon: <Wallet size={19} /> },
      ]
      : [
        { key: "home", label: "Início", icon: <Ticket size={19} /> },
        { key: "barraca_select", label: "Barraca", icon: <Store size={19} /> },
      ];
  return <nav className="mobile-bottom-nav">{itens.map((item) => <button key={item.key} className={screen === item.key || (item.key === "barraca_select" && screen === "barraca_vendas") ? "active" : ""} onClick={() => onNavigate(item.key)}>{item.icon}<span>{item.label}</span></button>)}</nav>;
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

function BillPad({ onAdd }) {
  return (
    <div className="bill-pad">
      {NOTES.map((n) => (
        <button key={n} className="bill" onClick={() => onAdd(n)}>
          <span className="bill-val">R$ {n}</span>
          <span className="bill-label">nota</span>
        </button>
      ))}
    </div>
  );
}

function CustomAmount({ onAdd, itemField, item, setItem }) {
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
        <button onClick={submit}>Adicionar</button>
      </div>
      {err && <div className="err-msg"><AlertCircle size={14} /> {err}</div>}
    </div>
  );
}

function Historico({ items, onDelete, emptyText }) {
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
            <button className="hist-del" onClick={() => onDelete(it.id)} title="Remover">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- CAIXA ---------------- */

function TelaCaixa({ onBack }) {
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

  useEffect(() => {
    (async () => {
      const data = await storageGet(K_CAIXA, true);
      setTransacoes(data || []);
      setLoading(false);
    })();
  }, []);

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

  useEffect(() => { carregarProdutos(); }, [carregarProdutos]);

  const toggleBarraca = (id) => {
    setBarracasAbertas((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const persistTransacoes = useCallback(async (list) => {
    setSaving(true);
    await storageSet(K_CAIXA, list, true);
    setSaving(false);
  }, []);

  function addValorAvulso(valor) {
    const novo = {
      id: uid(),
      valor,
      item: itemAvulso.trim() || null,
      hora: Date.now(),
      origem: "caixa",
      tipo: "avulsa",
    };
    const list = [...transacoes, novo];
    setTransacoes(list);
    persistTransacoes(list);
    setItemAvulso("");
  }

  function deleteTransacao(id) {
    const list = transacoes.filter((t) => t.id !== id);
    setTransacoes(list);
    persistTransacoes(list);
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

  function finalizarPedido() {
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
    const list = [...transacoes, novo];
    setTransacoes(list);
    persistTransacoes(list);
    setCart({});
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
            <button className="btn-primary" disabled={cartItems.length === 0} onClick={finalizarPedido}>
              Finalizar venda
            </button>
          </Ticket_>
        </>
      )}

      {tab === "avulso" && (
        <>
          <SectionLabel>Registrar valor avulso (sem produto cadastrado)</SectionLabel>
          <BillPad onAdd={addValorAvulso} />
          <CustomAmount onAdd={addValorAvulso} itemField item={itemAvulso} setItem={setItemAvulso} />
        </>
      )}

      <SectionLabel>Últimas vendas {saving && <em className="saving">salvando…</em>}</SectionLabel>
      <Historico items={transacoes} onDelete={deleteTransacao} emptyText="Nenhuma venda registrada ainda." />
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

function TelaBarracaVendas({ barraca, onBack }) {
  const [tab, setTab] = useState("vender");
  const [vendas, setVendas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingProdutos, setLoadingProdutos] = useState(true);
  const [saving, setSaving] = useState(false);
  const [itemAvulso, setItemAvulso] = useState("");

  useEffect(() => {
    (async () => {
      const data = await storageGet(vendasKey(barraca.id), true);
      setVendas(data || []);
      setLoading(false);
      const p = await storageGet(produtosKey(barraca.id), true);
      setProdutos(p || []);
      setLoadingProdutos(false);
    })();
  }, [barraca.id]);

  const persistVendas = useCallback(async (list) => {
    setSaving(true);
    await storageSet(vendasKey(barraca.id), list, true);
    setSaving(false);
  }, [barraca.id]);

  const persistProdutos = useCallback(async (list) => {
    await storageSet(produtosKey(barraca.id), list, true);
  }, [barraca.id]);

  function registrarVendaAvulsa(valor) {
    const novo = { id: uid(), valor, item: itemAvulso.trim() || null, hora: Date.now() };
    const list = [...vendas, novo];
    setVendas(list);
    persistVendas(list);
    setItemAvulso("");
  }

  function venderProduto(produto) {
    if (produto.esgotado || produto.quantidade <= 0) return;
    const novaQtd = produto.quantidade - 1;
    const novosProdutos = produtos.map((p) =>
      p.id === produto.id ? { ...p, quantidade: novaQtd, esgotado: novaQtd <= 0 } : p
    );
    setProdutos(novosProdutos);
    persistProdutos(novosProdutos);

    const novaVenda = { id: uid(), valor: produto.preco, item: produto.nome, hora: Date.now() };
    const list = [...vendas, novaVenda];
    setVendas(list);
    persistVendas(list);
  }

  function toggleEsgotado(produto) {
    const novosProdutos = produtos.map((p) =>
      p.id === produto.id ? { ...p, esgotado: !p.esgotado } : p
    );
    setProdutos(novosProdutos);
    persistProdutos(novosProdutos);
  }

  function ajustarEstoque(produto, delta) {
    const novaQtd = Math.max(0, produto.quantidade + delta);
    const novosProdutos = produtos.map((p) =>
      p.id === produto.id ? { ...p, quantidade: novaQtd, esgotado: novaQtd <= 0 ? true : p.esgotado } : p
    );
    setProdutos(novosProdutos);
    persistProdutos(novosProdutos);
  }

  function addProduto({ nome, preco, quantidade }) {
    const novo = { id: uid(), nome, preco, quantidade, esgotado: quantidade <= 0 };
    const list = [...produtos, novo];
    setProdutos(list);
    persistProdutos(list);
  }

  function removeProduto(id) {
    const list = produtos.filter((p) => p.id !== id);
    setProdutos(list);
    persistProdutos(list);
  }

  function deleteVenda(id) {
    const list = vendas.filter((v) => v.id !== id);
    setVendas(list);
    persistVendas(list);
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
                  disabled={p.esgotado || p.quantidade <= 0}
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
          <CustomAmount onAdd={registrarVendaAvulsa} itemField item={itemAvulso} setItem={setItemAvulso} />
        </>
      )}

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
      <Historico items={vendas} onDelete={deleteVenda} emptyText="Nenhuma venda registrada ainda." />
    </div>
  );
}

/* ---------------- PAINEL ---------------- */

function TelaPainel({ barracas, setBarracas, onBack }) {
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

  useEffect(() => { carregarRelatorio(); }, [carregarRelatorio]);

  async function addBarraca() {
    const n = nome.trim();
    if (!n) {
      setErro("Digite o nome da barraca antes de cadastrar!");
      return;
    }
    setErro("");
    const nova = { id: uid(), nome: n };
    const list = [...barracas, nova];
    
    setBarracas(list);
    await storageSet(K_BARRACAS, list, true);
    setNome("");
    carregarRelatorio();
  }

  async function removeBarraca(id) {
    const list = barracas.filter((b) => b.id !== id);
    setBarracas(list);
    await storageSet(K_BARRACAS, list, true);
    carregarRelatorio();
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

function TelaDashboard({ barracas, onBack, onNavigate }) {
  const [caixa, setCaixa] = useState([]);
  const [vendasBarracas, setVendasBarracas] = useState({});
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    const caixaData = (await storageGet(K_CAIXA, true)) || [];
    const vendas = {};
    for (const barraca of barracas) vendas[barraca.id] = (await storageGet(vendasKey(barraca.id), true)) || [];
    setCaixa(caixaData);
    setVendasBarracas(vendas);
    setLoading(false);
  }, [barracas]);

  useEffect(() => { carregar(); }, [carregar]);

  const totalCaixa = caixa.reduce((soma, venda) => soma + venda.valor, 0);
  const porBarraca = barracas.map((barraca) => ({
    ...barraca,
    total: (vendasBarracas[barraca.id] || []).reduce((soma, venda) => soma + venda.valor, 0),
    quantidade: (vendasBarracas[barraca.id] || []).length,
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
  const horasComVenda = vendasComOrigem.map((venda) => new Date(venda.hora).getHours());
  const horaInicial = horasComVenda.length ? Math.min(...horasComVenda) : 16;
  const horaFinal = horasComVenda.length ? Math.max(...horasComVenda) : 23;
  const horas = Array.from({ length: horaFinal - horaInicial + 1 }, (_, indice) => horaInicial + indice);
  const movimentoPorHora = horas.map((hora) => {
    const vendasDaHora = vendasComOrigem.filter((venda) => new Date(venda.hora).getHours() === hora);
    return {
      hora,
      caixa: vendasDaHora.filter((venda) => venda.canal === "caixa").reduce((soma, venda) => soma + quantidadeDaVenda(venda), 0),
      barracas: vendasDaHora.filter((venda) => venda.canal === "barraca").reduce((soma, venda) => soma + quantidadeDaVenda(venda), 0),
    };
  });
  const maiorMovimento = Math.max(...movimentoPorHora.map((item) => item.caixa + item.barracas), 1);
  const pico = movimentoPorHora.reduce(
    (maior, atual) => atual.caixa + atual.barracas > maior.caixa + maior.barracas ? atual : maior,
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

  return (
    <div className="tela">
      <TopBar title="Dashboard" subtitle="Visão geral das vendas" onBack={onBack} icon={<ClipboardList size={20} />} />
      <div className="dashboard-actions">
        <div><h2>Resumo do evento</h2><p>Atualize para acompanhar a operação em tempo real.</p></div>
        <div className="dashboard-quick-actions">
          <button className="btn-secondary" onClick={() => onNavigate("caixa")}><Plus size={16} /> Nova venda</button>
          <button className="btn-secondary" onClick={() => onNavigate("acessos")}><Store size={16} /> Acessos</button>
          <button className="btn-secondary" onClick={carregar}><RefreshCw size={16} /> Atualizar</button>
        </div>
      </div>
      <div className="metric-grid">
        <div className="metric-card metric-blue"><div className="metric-heading"><span>Vendido no caixa</span><i><Wallet size={18} /></i></div><strong>{formatMoney(totalCaixa)}</strong><small>{caixa.length} registros</small></div>
        <div className="metric-card metric-green"><div className="metric-heading"><span>Vendido nas barracas</span><i><Store size={18} /></i></div><strong>{formatMoney(totalBarracas)}</strong><small>{porBarraca.reduce((s, b) => s + b.quantidade, 0)} registros</small></div>
        <div className="metric-card metric-gold"><div className="metric-heading"><span>Vendas registradas</span><i><ClipboardList size={18} /></i></div><strong>{totalVendas}</strong><small>Caixa e barracas</small></div>
      </div>
      <section className="dashboard-panel peak-panel">
        <div className="panel-heading peak-heading">
          <div><h3>Horários de maior movimento</h3><p>Quantidade de produtos vendidos por hora no caixa e nas barracas</p></div>
          {vendasComOrigem.length > 0 && <div className="peak-badge"><TrendingUp size={15} /><span>Pico: {String(pico.hora).padStart(2, "0")}h–{String((pico.hora + 1) % 24).padStart(2, "0")}h</span><strong>{pico.caixa + pico.barracas} itens</strong></div>}
        </div>
        {vendasComOrigem.length === 0 ? <div className="hist-empty">Os horários de pico aparecerão após as primeiras vendas.</div> : (
          <>
            <div className="peak-legend" aria-hidden="true"><span><i className="legend-stall" /> Barracas</span><span><i className="legend-cash" /> Caixa</span></div>
            <div className="hourly-chart" role="img" aria-label={`Gráfico de vendas por hora. Maior movimento entre ${pico.hora} e ${(pico.hora + 1) % 24} horas.`}>
              {movimentoPorHora.map((item) => {
                const totalHora = item.caixa + item.barracas;
                return <div className={`hour-column ${item.hora === pico.hora ? "is-peak" : ""}`} key={item.hora}>
                  <span className="hour-total">{totalHora || ""}</span>
                  <div className="hour-stack" title={`${String(item.hora).padStart(2, "0")}h: ${item.barracas} nas barracas e ${item.caixa} no caixa`}>
                    <i className="hour-bar hour-bar-stall" style={{ height: `${(item.barracas / maiorMovimento) * 100}%` }} />
                    <i className="hour-bar hour-bar-cash" style={{ height: `${(item.caixa / maiorMovimento) * 100}%` }} />
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
      <div className="dashboard-columns">
        <section className="dashboard-panel">
          <div className="panel-heading"><div><h3>Desempenho por barraca</h3><p>{loading ? "Carregando dados…" : "Total de vendas registradas"}</p></div></div>
          {porBarraca.length === 0 ? <div className="hist-empty">Cadastre barracas para acompanhar o desempenho.</div> : (
            <div className="ranking-list">
              {porBarraca.map((barraca) => <div className="ranking-row" key={barraca.id}>
                <div className="ranking-info"><span>{barraca.nome}</span><small>{barraca.quantidade} vendas · {formatMoney(barraca.total)}</small></div>
                <div className="ranking-track"><i style={{ width: `${(barraca.total / maiorTotal) * 100}%` }} /></div>
              </div>)}
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
    const lista = [...barracas, { id: uid(), nome }];
    setBarracas(lista);
    await storageSet(K_BARRACAS, lista, true);
    setNomeBarraca("");
    setErro("");
  }
  async function excluirBarraca(id) {
    const lista = barracas.filter((barraca) => barraca.id !== id);
    setBarracas(lista);
    await storageSet(K_BARRACAS, lista, true);
  }
  const nomePerfil = (papel) => ({ admin: "Administrador", caixa: "Caixa", barraca: "Barraca" }[papel]);

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
            <label className="field-label">Perfil de acesso</label><select value={form.papel} onChange={(e) => setForm({ ...form, papel: e.target.value, barraca_id: "" })}><option value="admin">Administrador</option><option value="caixa">Caixa</option><option value="barraca">Barraca</option></select>
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

  const abrirModuloInicial = (perfilAtual) => {
    if (perfilAtual.papel === "admin") { setScreen("dashboard"); return; }
    if (perfilAtual.papel === "caixa") { setScreen("caixa"); return; }
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
    async function carregarSessao() {
      const { data: { session: sessao } } = await supabase.auth.getSession();
      if (ativo) {
        setSession(sessao);
        setPerfil(await obterPerfil(sessao?.user?.id));
        setCarregandoAcesso(false);
      }
    }
    carregarSessao();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_evento, sessao) => {
      setSession(sessao);
      setPerfil(await obterPerfil(sessao?.user?.id));
    });
    return () => { ativo = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    (async () => {
      const data = await storageGet(K_BARRACAS, true);
      setBarracas(data || []);
    })();
  }, []);

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
        <div className="hist-empty">Seu usuário ainda não recebeu uma permissão de acesso.</div>
        <button className="btn-secondary" onClick={() => supabase.auth.signOut()}><LogOut size={16} /> Sair</button>
      </div></div>
    );
  }

  const podeAcessarCaixa = !perfil || ["admin", "caixa"].includes(perfil.papel);
  const podeAcessarBarraca = !perfil || ["admin", "barraca"].includes(perfil.papel);
  const podeAcessarPainel = !perfil || perfil.papel === "admin";
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
          </div>
        </div>
      )}

      {screen === "caixa" && <TelaCaixa onBack={() => setScreen("home")} />}

      {screen === "barraca_select" && (
        perfil?.papel === "barraca" ? (
          (() => {
            const barracaVinculada = barracas.find((b) => b.id === perfil.barraca_id);
            return barracaVinculada ? (
              <TelaBarracaVendas barraca={barracaVinculada} onBack={() => setScreen("home")} />
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
        <TelaBarracaVendas barraca={barracaAtiva} onBack={() => setScreen("barraca_select")} />
      )}

      {screen === "painel" && (
        <TelaPainel barracas={barracas} setBarracas={setBarracas} onBack={() => setScreen("home")} />
      )}
      {screen === "dashboard" && podeAcessarPainel && (
        <TelaDashboard barracas={barracas} onBack={() => setScreen("home")} onNavigate={setScreen} />
      )}
      {screen === "acessos" && podeAcessarPainel && (
        <TelaAcessos barracas={barracas} setBarracas={setBarracas} usuarioAtualId={perfil?.id} onBack={() => setScreen("home")} />
      )}
      </main>
      <SiteFooter />
      <MobileNav screen={screen} onNavigate={setScreen} perfil={perfil} />
    </div>
  );
}
