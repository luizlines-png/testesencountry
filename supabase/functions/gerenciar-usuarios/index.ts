import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Papel = "admin" | "caixa" | "barraca" | "portaria";

type UsuarioEntrada = {
  id?: string | null;
  nome?: string;
  usuario?: string;
  senha?: string;
  papel?: Papel;
  barraca_id?: string | null;
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function resposta(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function validarUsuario(usuario: UsuarioEntrada, novo: boolean) {
  const nome = usuario.nome?.trim();
  const email = usuario.usuario?.trim().toLowerCase();
  const papel = usuario.papel;
  const senha = usuario.senha || "";
  const barracaId = papel === "barraca" ? usuario.barraca_id || null : null;

  if (!nome || !email || !papel) throw new Error("Preencha nome, e-mail e perfil.");
  if (!email.includes("@")) throw new Error("Informe um e-mail válido.");
  if (!["admin", "caixa", "barraca", "portaria"].includes(papel)) throw new Error("Perfil de acesso inválido.");
  if (novo && senha.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");
  if (!novo && senha && senha.length < 6) throw new Error("A nova senha deve ter pelo menos 6 caracteres.");
  if (papel === "barraca" && !barracaId) throw new Error("Selecione a barraca do operador.");

  return { nome, email, papel, senha, barracaId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return resposta({ error: "Método não permitido." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return resposta({ error: "A função não possui as configurações do Supabase." }, 500);
    }
    if (!authorization) return resposta({ error: "Sessão não encontrada." }, 401);

    const token = authorization.replace(/^Bearer\s+/i, "");
    const clienteUsuario = createClient(supabaseUrl, anonKey);
    const { data: authData, error: authError } = await clienteUsuario.auth.getUser(token);
    if (authError || !authData.user) return resposta({ error: "Sessão inválida ou expirada." }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: perfilAdmin, error: perfilError } = await admin
      .from("perfis")
      .select("id, nome, papel, barraca_id")
      .eq("id", authData.user.id)
      .maybeSingle();
    const body = await req.json();
    const acao = body?.acao;

    if (acao === "meu-perfil") {
      if (perfilError) throw perfilError;
      return resposta({ perfil: perfilAdmin || null });
    }

    if (perfilError || perfilAdmin?.papel !== "admin") {
      return resposta({ error: "Somente administradores podem gerenciar acessos." }, 403);
    }

    if (acao === "listar") {
      const { data: authUsuarios, error: listaError } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (listaError) throw listaError;
      const { data: perfis, error: perfisError } = await admin
        .from("perfis")
        .select("id, nome, papel, barraca_id");
      if (perfisError) throw perfisError;
      const emails = new Map(authUsuarios.users.map((u) => [u.id, u.email || ""]));
      const usuarios = (perfis || []).map((perfil) => ({
        ...perfil,
        usuario: emails.get(perfil.id) || "",
      })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      return resposta({ usuarios });
    }

    if (acao === "criar") {
      const dados = validarUsuario(body.usuario || {}, true);
      const { data: criado, error: criarError } = await admin.auth.admin.createUser({
        email: dados.email,
        password: dados.senha,
        email_confirm: true,
        user_metadata: {
          nome: dados.nome,
          papel: dados.papel,
          barraca_id: dados.barracaId,
        },
      });
      if (criarError || !criado.user) throw criarError || new Error("Não foi possível criar a conta.");
      const { error: perfilNovoError } = await admin.from("perfis").insert({
        id: criado.user.id,
        nome: dados.nome,
        papel: dados.papel,
        barraca_id: dados.barracaId,
      });
      if (perfilNovoError) {
        await admin.auth.admin.deleteUser(criado.user.id);
        throw perfilNovoError;
      }
      return resposta({ usuario: { id: criado.user.id } }, 201);
    }

    if (acao === "atualizar") {
      const entrada = body.usuario || {};
      if (!entrada.id) throw new Error("Usuário não identificado.");
      const dados = validarUsuario(entrada, false);
      const atributos: { email: string; password?: string; user_metadata: Record<string, unknown> } = {
        email: dados.email,
        user_metadata: {
          nome: dados.nome,
          papel: dados.papel,
          barraca_id: dados.barracaId,
        },
      };
      if (dados.senha) atributos.password = dados.senha;
      const { error: atualizarAuthError } = await admin.auth.admin.updateUserById(entrada.id, atributos);
      if (atualizarAuthError) throw atualizarAuthError;
      const { error: atualizarPerfilError } = await admin.from("perfis").upsert({
        id: entrada.id,
        nome: dados.nome,
        papel: dados.papel,
        barraca_id: dados.barracaId,
      });
      if (atualizarPerfilError) throw atualizarPerfilError;
      return resposta({ ok: true });
    }

    if (acao === "excluir") {
      if (!body.id) throw new Error("Usuário não identificado.");
      if (body.id === authData.user.id) throw new Error("Você não pode remover o próprio acesso.");
      const { error: excluirError } = await admin.auth.admin.deleteUser(body.id);
      if (excluirError) throw excluirError;
      return resposta({ ok: true });
    }

    return resposta({ error: "Operação inválida." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível concluir a operação.";
    return resposta({ error: message }, 400);
  }
});
