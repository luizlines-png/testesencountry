import { describe, expect, it } from "vitest";
import { baixarUmaUnidade, devolverUmaUnidade, podeAdicionarProdutos, podeVerTotalBarraca, resumoEstoqueProduto, statusEstoque } from "./regras";

describe("regras de estoque da barraca", () => {
  it("baixa uma unidade e marca como esgotado ao vender a última", () => {
    expect(baixarUmaUnidade({ id: "p1", quantidade: 1, esgotado: false })).toEqual({
      id: "p1", quantidade: 0, esgotado: true,
    });
  });

  it("impede venda sem estoque", () => {
    expect(() => baixarUmaUnidade({ quantidade: 0, esgotado: true }))
      .toThrow("Produto sem estoque disponível.");
  });

  it("devolve uma unidade e torna o produto disponível", () => {
    expect(devolverUmaUnidade({ id: "p1", quantidade: 0, esgotado: true })).toEqual({
      id: "p1", quantidade: 1, esgotado: false,
    });
  });

  it("classifica os limites visuais do estoque", () => {
    expect(statusEstoque(0, false).classe).toBe("empty");
    expect(statusEstoque(10, false).classe).toBe("low");
    expect(statusEstoque(11, false).classe).toBe("normal");
    expect(statusEstoque(30, false).classe).toBe("high");
  });

  it("permite cadastrar produtos somente ao administrador", () => {
    expect(podeAdicionarProdutos({ papel: "admin" })).toBe(true);
    expect(podeAdicionarProdutos({ papel: "barraca" })).toBe(false);
    expect(podeAdicionarProdutos({ papel: "caixa" })).toBe(false);
  });

  it("calcula o total cadastrado e o saldo restante de um produto", () => {
    const produto = { id: "p1", quantidade: 7 };
    const vendas = [
      { itens: [{ produtoId: "p1", quantidade: 2 }] },
      { itens: [{ produtoId: "p2", quantidade: 4 }] },
      { itens: [{ produtoId: "p1", quantidade: 1 }] },
    ];

    expect(resumoEstoqueProduto(produto, vendas)).toEqual({ cadastrado: 10, restante: 7 });
  });

  it("exibe o total da barraca somente ao administrador", () => {
    expect(podeVerTotalBarraca({ papel: "admin" })).toBe(true);
    expect(podeVerTotalBarraca({ papel: "barraca" })).toBe(false);
  });
});
