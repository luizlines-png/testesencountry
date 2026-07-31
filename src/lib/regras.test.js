import { describe, expect, it } from "vitest";
import { baixarUmaUnidade, devolverUmaUnidade, statusEstoque } from "./regras";

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
});
