import { createClient } from "@supabase/supabase-js";

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

async function excluirAusentes(tabela, idsAtuais, filtro, coluna = "id") {
  const { data, error } = await supabase.from(tabela).select(coluna).match(filtro);
  if (error) throw error;
  const excluir = data.map((row) => row[coluna]).filter((id) => !idsAtuais.includes(id));
  if (excluir.length) {
    const { error: deleteError } = await supabase.from(tabela).delete().in(coluna, excluir);
    if (deleteError) throw deleteError;
  }
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

async function salvarCentral(chave, valor) {
  if (chave === K_BARRACAS) {
    const rows = valor.map(({ id, nome }) => ({ id, nome }));
    if (rows.length) {
      const { error } = await supabase.from("barracas").upsert(rows);
      if (error) throw error;
    }
    await excluirAusentes("barracas", rows.map((row) => row.id), {});
    return;
  }

  const barracaProdutos = chaveBarraca(chave, "festa-produtos-");
  if (barracaProdutos) {
    const rows = valor.map((p) => ({ ...p, barraca_id: barracaProdutos }));
    if (rows.length) {
      const { error } = await supabase.from("produtos").upsert(rows);
      if (error) throw error;
    }
    await excluirAusentes("produtos", rows.map((row) => row.id), { barraca_id: barracaProdutos });
    return;
  }

  const caixa = chave === K_CAIXA;
  const barracaVendas = chaveBarraca(chave, "festa-vendas-");
  if (caixa || barracaVendas) {
    const origem = caixa ? "caixa" : "barraca";
    const rows = valor.map((v) => ({
      id: v.id,
      valor: v.valor,
      item: v.item,
      hora: new Date(v.hora).toISOString(),
      origem,
      tipo: v.tipo || "avulsa",
      itens: v.itens || null,
      barraca_id: caixa ? null : barracaVendas,
    }));
    if (rows.length) {
      const { error } = await supabase.from("vendas").upsert(rows);
      if (error) throw error;
    }
    await excluirAusentes("vendas", rows.map((row) => row.id), caixa ? { origem: "caixa" } : { origem: "barraca", barraca_id: barracaVendas });
  }
}

export async function storageGet(chave) {
  try {
    if (supabase) return await obterCentral(chave);
    const valor = localStorage.getItem(chave);
    return valor ? JSON.parse(valor) : null;
  } catch (error) {
    console.error("Não foi possível carregar os dados.", error);
    return null;
  }
}

export async function storageSet(chave, valor) {
  try {
    if (supabase) await salvarCentral(chave, valor);
    else localStorage.setItem(chave, JSON.stringify(valor));
    return true;
  } catch (error) {
    console.error("Não foi possível salvar os dados.", error);
    return false;
  }
}

export { K_BARRACAS, K_CAIXA, vendasKey, produtosKey };
