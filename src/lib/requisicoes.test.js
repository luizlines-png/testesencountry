import { describe, expect, it } from "vitest";
import { iniciarUltimaRequisicao } from "./requisicoes";

describe("controle de requisições concorrentes", () => {
  it("mantém somente a resposta da requisição mais recente", () => {
    const controle = { current: 0 };
    const primeiraAindaAtual = iniciarUltimaRequisicao(controle);
    const segundaAindaAtual = iniciarUltimaRequisicao(controle);

    expect(primeiraAindaAtual()).toBe(false);
    expect(segundaAindaAtual()).toBe(true);
  });

  it("invalida uma resposta quando a tela é desmontada", () => {
    const controle = { current: 0 };
    const aindaAtual = iniciarUltimaRequisicao(controle);

    controle.current += 1;

    expect(aindaAtual()).toBe(false);
  });
});
