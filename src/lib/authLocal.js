const CHAVE_SESSAO = "encountry-sessao";
const CHAVE_USUARIOS = "encountry-usuarios";

// Contas iniciais para a operação local. Troque as senhas antes do evento.
const USUARIOS_INICIAIS = [
  { id: "admin-local", usuario: "admin", senha: "admin123", nome: "Administrador", papel: "admin" },
  { id: "caixa-local", usuario: "caixa", senha: "caixa123", nome: "Operador do Caixa", papel: "caixa" },
  { id: "barraca-local", usuario: "barraca", senha: "barraca123", nome: "Operador de Barraca", papel: "barraca" },
];

function obterUsuarios() {
  try {
    const usuarios = JSON.parse(localStorage.getItem(CHAVE_USUARIOS));
    if (Array.isArray(usuarios) && usuarios.length) return usuarios;
  } catch {
    // A lista inicial será criada abaixo.
  }
  localStorage.setItem(CHAVE_USUARIOS, JSON.stringify(USUARIOS_INICIAIS));
  return USUARIOS_INICIAIS;
}

function persistirUsuarios(usuarios) {
  localStorage.setItem(CHAVE_USUARIOS, JSON.stringify(usuarios));
}

export function entrarLocal(usuario, senha) {
  const conta = obterUsuarios().find(
    (item) => item.usuario === usuario.trim().toLowerCase() && item.senha === senha
  );
  if (!conta) return { error: "Usuário ou senha inválidos." };

  const perfil = {
    id: conta.id,
    nome: conta.nome,
    papel: conta.papel,
    barraca_id: conta.barraca_id || null,
  };
  localStorage.setItem(CHAVE_SESSAO, JSON.stringify(perfil));
  return { perfil };
}

export function obterSessaoLocal() {
  try {
    const perfilSalvo = JSON.parse(localStorage.getItem(CHAVE_SESSAO));
    if (!perfilSalvo) return null;
    const usuarioAtual = obterUsuarios().find((usuario) => usuario.id === perfilSalvo.id);
    const perfil = usuarioAtual
      ? { id: usuarioAtual.id, nome: usuarioAtual.nome, papel: usuarioAtual.papel, barraca_id: usuarioAtual.barraca_id || null }
      : perfilSalvo;
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify(perfil));
    return { user: { id: perfil.id }, perfil };
  } catch {
    return null;
  }
}

export function sairLocal() {
  localStorage.removeItem(CHAVE_SESSAO);
}

export function listarUsuarios() {
  return obterUsuarios().map(({ senha, ...usuario }) => usuario);
}

export function salvarUsuario(dados) {
  const usuarios = obterUsuarios();
  const usuario = dados.usuario.trim().toLowerCase();
  const nome = dados.nome.trim();
  if (!nome || !usuario || !dados.papel) return { error: "Preencha nome, usuário e perfil." };
  if (!dados.id && !dados.senha) return { error: "Defina uma senha para o novo usuário." };
  if (usuarios.some((item) => item.usuario === usuario && item.id !== dados.id)) return { error: "Este nome de usuário já está em uso." };

  const anterior = usuarios.find((item) => item.id === dados.id);
  const novo = {
    id: dados.id || `usuario-${Date.now().toString(36)}`,
    nome,
    usuario,
    senha: dados.senha || anterior?.senha,
    papel: dados.papel,
    barraca_id: dados.papel === "barraca" ? (dados.barraca_id || null) : null,
  };
  persistirUsuarios(anterior ? usuarios.map((item) => item.id === novo.id ? novo : item) : [...usuarios, novo]);
  return { usuario: novo };
}

export function removerUsuario(id) {
  persistirUsuarios(obterUsuarios().filter((item) => item.id !== id));
}

export const credenciaisIniciais = [
  ["Administrador", "admin", "admin123"],
  ["Caixa", "caixa", "caixa123"],
  ["Barraca", "barraca", "barraca123"],
];
