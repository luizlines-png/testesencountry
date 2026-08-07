import { createClient } from "@supabase/supabase-js";
import { baixarUmaUnidade, devolverUmaUnidade } from "./regras";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (Boolean(url) !== Boolean(anonKey)) {
  throw new Error(
    "Configuração incompleta do Supabase: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = url && anonKey ? createClient(url, anonKey) : null;
export const bancoCentralConfigurado = Boolean(supabase);

export async function obterPerfil(userId) {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from("perfis")
    .select("id, nome, papel, barraca_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;

  // Se uma política RLS estiver desatualizada, a função autenticada ainda
  // consegue devolver exclusivamente o perfil do próprio usuário.
  const resultado = await gerenciarUsuarios("meu-perfil");
  return resultado.perfil || null;
}

async function mensagemErroFuncao(error) {
  try {
    const resposta = await error?.context?.json();
    return resposta?.error || resposta?.message || error.message;
  } catch {
    return error?.message || "Não foi possível concluir a operação.";
  }
}

export async function gerenciarUsuarios(acao, dados = {}) {
  if (!supabase) throw new Error("O Supabase não está configurado.");
  const { data, error } = await supabase.functions.invoke("gerenciar-usuarios", {
    body: { acao, ...dados },
  });
  if (error) throw new Error(await mensagemErroFuncao(error));
  if (data?.error) throw new Error(data.error);
  return data;
}

const K_BARRACAS = "festa-barracas";
const K_CAIXA = "festa-caixa-transacoes";
const vendasKey = (id) => `festa-vendas-${id}`;
const produtosKey = (id) => `festa-produtos-${id}`;
const K_ENTRADAS = "festa-entradas";
const K_HISTORICOS = "encountry-historicos";

function chaveBarraca(chave, prefixo) {
  return chave.startsWith(prefixo) ? chave.slice(prefixo.length) : null;
}

function paraVenda(row) {
  return {
    id: row.id,
    valor: Number(row.valor),
    item: row.item,
    hora: new Date(row.hora).getTime(),
    origem: row.origem,
    tipo: row.tipo,
    itens: row.itens || undefined,
    barraca_id: row.barraca_id || null,
    created_by: row.created_by || null,
    created_at: row.created_at || null,
  };
}

function paraProduto(row) {
  return {
    id: row.id,
    nome: row.nome,
    preco: Number(row.preco),
    quantidade: row.quantidade,
    esgotado: row.esgotado,
  };
}

async function obterCentral(chave) {
  if (chave === K_BARRACAS) {
    const { data, error } = await supabase.from("barracas").select("id, nome").order("nome");
    if (error) throw error;
    return data;
  }
  if (chave === K_CAIXA) {
    const { data, error } = await supabase.from("vendas").select("*").eq("origem", "caixa").order("hora");
    if (error) throw error;
    return data.map(paraVenda);
  }
  const barracaProdutos = chaveBarraca(chave, "festa-produtos-");
  if (barracaProdutos) {
    const { data, error } = await supabase.from("produtos").select("*").eq("barraca_id", barracaProdutos).order("nome");
    if (error) throw error;
    return data.map(paraProduto);
  }
  const barracaVendas = chaveBarraca(chave, "festa-vendas-");
  if (barracaVendas) {
    const { data, error } = await supabase.from("vendas").select("*").eq("barraca_id", barracaVendas).eq("origem", "barraca").order("hora");
    if (error) throw error;
    return data.map(paraVenda);
  }
  return null;
}

export async function storageGet(chave) {
  if (supabase) return obterCentral(chave);
  const valor = localStorage.getItem(chave);
  return valor ? JSON.parse(valor) : null;
}

function localGet(chave) {
  const valor = localStorage.getItem(chave);
  return valor ? JSON.parse(valor) : [];
}

export function assinarAlteracoes(tabelas, onChange, onStatus) {
  if (!supabase) {
    onStatus?.("local");
    return () => {};
  }
  const canal = tabelas.reduce(
    (atual, tabela) => atual.on(
      "postgres_changes",
      { event: "*", schema: "public", table: tabela },
      () => onChange(tabela)
    ),
    supabase.channel(`encountry-${crypto.randomUUID()}`)
  );
  canal.subscribe((status, error) => {
    if (status === "SUBSCRIBED") onStatus?.("online");
    else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      console.error("Falha na sincronização em tempo real.", error);
      onStatus?.("degradado");
    } else if (status === "CLOSED") onStatus?.("offline");
  });
  return () => { supabase.removeChannel(canal); };
}

function paraEntrada(row) {
  return {
    id: row.id,
    faixa: row.faixa,
    vinculo: row.vinculo,
    hora: new Date(row.hora).getTime(),
    operadorId: row.created_by || null,
    operadorNome: row.operador_nome || null,
  };
}

export async function listarEntradas() {
  if (!supabase) return localGet(K_ENTRADAS);
  const { data, error } = await supabase
    .from("entradas")
    .select("*")
    .order("hora");
  if (error) throw error;
  return data.map(paraEntrada);
}

export async function registrarEntrada(entrada) {
  if (!supabase) {
    localSet(K_ENTRADAS, [...localGet(K_ENTRADAS), entrada]);
    window.dispatchEvent(new Event("encountry-entradas"));
    return entrada;
  }
  const { data, error } = await supabase
    .from("entradas")
    .insert({
      id: entrada.id,
      faixa: entrada.faixa,
      vinculo: entrada.vinculo,
      hora: new Date(entrada.hora).toISOString(),
      operador_nome: entrada.operadorNome || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return paraEntrada(data);
}

export async function excluirEntrada(id) {
  if (!supabase) {
    localSet(K_ENTRADAS, localGet(K_ENTRADAS).filter((entrada) => entrada.id !== id));
    window.dispatchEvent(new Event("encountry-entradas"));
    return;
  }
  const { error } = await supabase.from("entradas").delete().eq("id", id);
  if (error) throw error;
}

function localSet(chave, valor) {
  localStorage.setItem(chave, JSON.stringify(valor));
}

function erroHistorico(error) {
  const mensagem = String(error?.message || "");
  const bancoSemHistorico = ["PGRST202", "PGRST205", "42P01", "42883"].includes(error?.code)
    || (/historico_eventos|arquivar_e_resetar_evento|restaurar_evento/i.test(mensagem)
      && /does not exist|schema cache|could not find/i.test(mensagem));
  if (bancoSemHistorico) {
    return new Error("O histórico ainda não foi habilitado no banco online. Aplique a migração mais recente do Supabase.");
  }
  return error;
}

export async function listarHistoricos() {
  if (!supabase) return localGet(K_HISTORICOS).sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  const { data, error } = await supabase
    .from("historico_eventos")
    .select("id, nome, criado_em, dados")
    .order("criado_em", { ascending: false });
  if (error) throw erroHistorico(error);
  return data;
}

export async function arquivarEResetarEvento(nome) {
  if (!supabase) {
    const barracas = localGet(K_BARRACAS);
    const historico = {
      id: crypto.randomUUID(), nome: nome.trim(), criado_em: new Date().toISOString(),
      dados: {
        barracas,
        produtos: barracas.flatMap((b) => localGet(produtosKey(b.id)).map((p) => ({ ...p, barraca_id: b.id }))),
        vendas: [
          ...localGet(K_CAIXA).map((v) => ({ ...v, origem: "caixa" })),
          ...barracas.flatMap((b) => localGet(vendasKey(b.id)).map((v) => ({ ...v, origem: "barraca", barraca_id: b.id }))),
        ],
        entradas: localGet(K_ENTRADAS),
      },
    };
    localSet(K_HISTORICOS, [historico, ...localGet(K_HISTORICOS)]);
    localSet(K_CAIXA, []);
    localSet(K_ENTRADAS, []);
    barracas.forEach((b) => { localSet(produtosKey(b.id), []); localSet(vendasKey(b.id), []); });
    return historico.id;
  }
  const { data, error } = await supabase.rpc("arquivar_e_resetar_evento", { p_nome: nome.trim() });
  if (error) throw erroHistorico(error);
  return data;
}

export async function restaurarEvento(historico) {
  if (!supabase) {
    const dados = historico.dados;
    localSet(K_BARRACAS, dados.barracas || []);
    localSet(K_CAIXA, (dados.vendas || []).filter((v) => v.origem === "caixa"));
    localSet(K_ENTRADAS, dados.entradas || []);
    (dados.barracas || []).forEach((b) => {
      localSet(produtosKey(b.id), (dados.produtos || []).filter((p) => p.barraca_id === b.id));
      localSet(vendasKey(b.id), (dados.vendas || []).filter((v) => v.origem === "barraca" && v.barraca_id === b.id));
    });
    return;
  }
  const { error } = await supabase.rpc("restaurar_evento", { p_historico_id: historico.id });
  if (error) throw erroHistorico(error);
}

function vendaRow(venda, origem, barracaId = null) {
  return {
    id: venda.id,
    valor: venda.valor,
    item: venda.item || null,
    hora: new Date(venda.hora).toISOString(),
    origem,
    tipo: venda.tipo || "avulsa",
    itens: venda.itens || null,
    barraca_id: barracaId,
  };
}

export async function criarVenda(chave, venda) {
  if (!supabase) {
    localSet(chave, [...localGet(chave), venda]);
    return venda;
  }
  const caixa = chave === K_CAIXA;
  const barracaId = chaveBarraca(chave, "festa-vendas-");
  if (!caixa && !barracaId) throw new Error("Destino da venda inválido.");
  const { data, error } = await supabase
    .from("vendas")
    .insert(vendaRow(venda, caixa ? "caixa" : "barraca", barracaId))
    .select("*")
    .single();
  if (error) {
    const { data: existente } = await supabase.from("vendas").select("*").eq("id", venda.id).maybeSingle();
    if (existente) return paraVenda(existente);
    throw error;
  }
  return paraVenda(data);
}

export async function excluirVenda(chave, id) {
  if (!supabase) {
    localSet(chave, localGet(chave).filter((venda) => venda.id !== id));
    return;
  }
  const { error } = await supabase.from("vendas").delete().eq("id", id);
  if (error) throw error;
}

export async function salvarProduto(barracaId, produto) {
  const chave = produtosKey(barracaId);
  if (!supabase) {
    const produtos = localGet(chave);
    const existe = produtos.some((item) => item.id === produto.id);
    localSet(chave, existe ? produtos.map((item) => item.id === produto.id ? produto : item) : [...produtos, produto]);
    return produto;
  }
  const { data, error } = await supabase
    .from("produtos")
    .upsert({ ...produto, barraca_id: barracaId })
    .select("*")
    .single();
  if (error) throw error;
  return paraProduto(data);
}

export async function atualizarProduto(barracaId, produto) {
  const chave = produtosKey(barracaId);
  if (!supabase) {
    localSet(chave, localGet(chave).map((item) => item.id === produto.id ? produto : item));
    return produto;
  }
  const { data, error } = await supabase
    .from("produtos")
    .update({
      nome: produto.nome,
      preco: produto.preco,
      quantidade: produto.quantidade,
      esgotado: produto.esgotado,
    })
    .eq("id", produto.id)
    .eq("barraca_id", barracaId)
    .select("*")
    .single();
  if (error) throw error;
  return paraProduto(data);
}

export async function excluirProduto(barracaId, id) {
  const chave = produtosKey(barracaId);
  if (!supabase) {
    localSet(chave, localGet(chave).filter((produto) => produto.id !== id));
    return;
  }
  const { error } = await supabase.from("produtos").delete().eq("id", id).eq("barraca_id", barracaId);
  if (error) throw error;
}

export async function salvarBarraca(barraca) {
  if (!supabase) {
    const barracas = localGet(K_BARRACAS);
    const existe = barracas.some((item) => item.id === barraca.id);
    localSet(K_BARRACAS, existe ? barracas.map((item) => item.id === barraca.id ? barraca : item) : [...barracas, barraca]);
    return barraca;
  }
  const { data, error } = await supabase.from("barracas").upsert(barraca).select("id, nome").single();
  if (error) throw error;
  return data;
}

export async function excluirBarraca(id) {
  if (!supabase) {
    localSet(K_BARRACAS, localGet(K_BARRACAS).filter((barraca) => barraca.id !== id));
    return;
  }
  const { error } = await supabase.from("barracas").delete().eq("id", id);
  if (error) throw error;
}

export async function registrarVendaBarraca(barracaId, produto, venda) {
  if (!supabase) {
    const atualizado = baixarUmaUnidade(produto);
    salvarProduto(barracaId, atualizado);
    await criarVenda(vendasKey(barracaId), venda);
    return { produto: atualizado, venda };
  }
  const { data, error } = await supabase.rpc("registrar_venda_barraca", {
    p_produto_id: produto.id,
    p_venda_id: venda.id,
    p_hora: new Date(venda.hora).toISOString(),
  });
  if (error) {
    const [{ data: vendaExistente }, { data: produtoAtual }] = await Promise.all([
      supabase.from("vendas").select("*").eq("id", venda.id).maybeSingle(),
      supabase.from("produtos").select("*").eq("id", produto.id).maybeSingle(),
    ]);
    if (vendaExistente && produtoAtual) {
      return { produto: paraProduto(produtoAtual), venda: paraVenda(vendaExistente) };
    }
    throw error;
  }
  return { produto: paraProduto(data.produto), venda: paraVenda(data.venda) };
}

export async function excluirVendaBarraca(barracaId, venda, produtos = []) {
  const chave = vendasKey(barracaId);
  if (!supabase) {
    const produtoId = venda.itens?.[0]?.produtoId;
    const produto = produtos.find((item) => item.id === produtoId)
      || (venda.tipo !== "avulsa" ? produtos.find((item) => item.nome === venda.item) : null);
    let atualizado = null;
    if (produto) {
      atualizado = devolverUmaUnidade(produto);
      await salvarProduto(barracaId, atualizado);
    }
    await excluirVenda(chave, venda.id);
    return { produto: atualizado };
  }
  const { data, error } = await supabase.rpc("excluir_venda_barraca", { p_venda_id: venda.id });
  if (error) throw error;
  return { produto: data?.produto ? paraProduto(data.produto) : null };
}

export { K_BARRACAS, K_CAIXA, K_ENTRADAS, vendasKey, produtosKey };
