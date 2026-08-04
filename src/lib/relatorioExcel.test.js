import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { criarRelatorioExcel } from "./relatorioExcel";

describe("relatório Excel da portaria", () => {
  it("inclui registros, resumo por público e horário de pico", async () => {
    const base = new Date(2026, 7, 4, 19, 10).getTime();
    const entradas = [
      { id: "e1", hora: base, faixa: "adulto", vinculo: "visitante", operadorNome: "Ana", operadorId: "u1" },
      { id: "e2", hora: base + 10 * 60000, faixa: "crianca", vinculo: "visitante", operadorNome: "Ana", operadorId: "u1" },
      { id: "e3", hora: base + 70 * 60000, faixa: "adulto", vinculo: "membro", operadorNome: "Bia", operadorId: "u2" },
    ];
    const { buffer } = await criarRelatorioExcel({ barracas: [], caixa: [], vendasBarracas: {}, entradas });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const portaria = workbook.getWorksheet("Portaria");
    expect(portaria.rowCount).toBe(7);
    expect(portaria.getCell("A1").value).toBe("Registros da portaria");
    expect(portaria.getCell("D5").value).toBe("Visitante");
    expect(portaria.getCell("E7").value).toBe("Adulto");
    expect(portaria.getCell("C5").value.getUTCHours()).toBe(19);

    const resumo = workbook.getWorksheet("Resumo");
    expect(resumo.getCell("B10").value).toBe(1);
    expect(resumo.getCell("C10").value).toBe(1);
    expect(resumo.getCell("B14").value).toBe("19h–20h");
    expect(resumo.getCell("D14").value).toBe(2);
  });
});
