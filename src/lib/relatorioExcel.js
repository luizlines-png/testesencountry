const COR_AZUL = "17375E";
const COR_AZUL_CLARO = "DCE6F1";
const COR_DOURADO = "D59B2D";
const COR_BRANCO = "FFFFFF";
const COR_TEXTO = "1F2937";
const COR_BORDA = "D9E2EC";

function dataVenda(venda) {
  return new Date(venda.hora);
}

function textoJson(valor) {
  return valor ? JSON.stringify(valor) : "";
}

function quantidadeItens(venda) {
  if (!Array.isArray(venda.itens)) return venda.item ? 1 : 0;
  return venda.itens.reduce((total, item) => total + (Number(item.quantidade) || 0), 0);
}

function estilizarCabecalho(linha) {
  linha.height = 28;
  linha.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COR_BRANCO } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR_AZUL } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { bottom: { style: "medium", color: { argb: COR_DOURADO } } };
  });
}

function prepararAba(aba, titulo, descricao, colunas) {
  aba.views = [{ state: "frozen", ySplit: 4 }];
  aba.properties.showGridLines = false;
  aba.mergeCells(1, 1, 1, colunas.length);
  const tituloCell = aba.getCell(1, 1);
  tituloCell.value = titulo;
  tituloCell.font = { bold: true, size: 18, color: { argb: COR_BRANCO } };
  tituloCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR_AZUL } };
  tituloCell.alignment = { vertical: "middle" };
  aba.getRow(1).height = 34;

  aba.mergeCells(2, 1, 2, colunas.length);
  const descricaoCell = aba.getCell(2, 1);
  descricaoCell.value = descricao;
  descricaoCell.font = { italic: true, color: { argb: COR_TEXTO } };
  descricaoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR_AZUL_CLARO } };
  aba.getRow(2).height = 24;

  aba.columns = colunas;
  const cabecalho = aba.getRow(4);
  cabecalho.values = colunas.map((coluna) => coluna.header);
  estilizarCabecalho(cabecalho);
  aba.autoFilter = { from: "A4", to: aba.getCell(4, colunas.length).address };
}

function finalizarAba(aba, totalColunas) {
  const ultimaLinha = Math.max(aba.rowCount, 4);
  for (let linha = 5; linha <= ultimaLinha; linha += 1) {
    const row = aba.getRow(linha);
    row.alignment = { vertical: "middle" };
    if (linha % 2 === 0) {
      row.eachCell({ includeEmpty: true }, (cell, coluna) => {
        if (coluna <= totalColunas) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F7F9FC" } };
        }
      });
    }
    row.eachCell({ includeEmpty: true }, (cell, coluna) => {
      if (coluna <= totalColunas) {
        cell.border = { bottom: { style: "hair", color: { argb: COR_BORDA } } };
      }
    });
  }
}

function baixar(buffer, nome) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function criarRelatorioExcel({ barracas, caixa, vendasBarracas }) {
  const modulo = await import("exceljs");
  const ExcelJS = modulo.default || modulo;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Encountry";
  workbook.company = "IEQ Vila Helena";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const vendasDeBarracas = barracas.flatMap((barraca) =>
    (vendasBarracas[barraca.id] || []).map((venda) => ({ ...venda, barraca }))
  ).sort((a, b) => a.hora - b.hora);
  const vendasDoCaixa = [...caixa].sort((a, b) => a.hora - b.hora);

  const abaBarracas = workbook.addWorksheet("Vendas Barracas");
  const colunasBarracas = [
    { header: "ID da venda", key: "id", width: 24 },
    { header: "ID da barraca", key: "barracaId", width: 22 },
    { header: "Barraca", key: "barraca", width: 24 },
    { header: "Data", key: "data", width: 13, style: { numFmt: "dd/mm/yyyy" } },
    { header: "Hora", key: "hora", width: 11, style: { numFmt: "hh:mm:ss" } },
    { header: "Item/descrição", key: "item", width: 32 },
    { header: "Tipo", key: "tipo", width: 14 },
    { header: "Valor", key: "valor", width: 15, style: { numFmt: '"R$" #,##0.00' } },
    { header: "Origem", key: "origem", width: 13 },
    { header: "Operador (UUID)", key: "operador", width: 38 },
    { header: "Criado em", key: "criadoEm", width: 20, style: { numFmt: "dd/mm/yyyy hh:mm:ss" } },
    { header: "Itens (JSON)", key: "itensJson", width: 42 },
  ];
  prepararAba(abaBarracas, "Vendas das barracas", "Todos os registros de vendas realizados diretamente nas barracas.", colunasBarracas);
  vendasDeBarracas.forEach((venda) => {
    const momento = dataVenda(venda);
    abaBarracas.addRow({
      id: venda.id,
      barracaId: venda.barraca.id,
      barraca: venda.barraca.nome,
      data: momento,
      hora: momento,
      item: venda.item || "",
      tipo: venda.tipo || "avulsa",
      valor: Number(venda.valor) || 0,
      origem: venda.origem || "barraca",
      operador: venda.created_by || "",
      criadoEm: venda.created_at ? new Date(venda.created_at) : momento,
      itensJson: textoJson(venda.itens),
    });
  });
  finalizarAba(abaBarracas, colunasBarracas.length);

  const abaCaixa = workbook.addWorksheet("Vendas Caixa");
  const colunasCaixa = [
    { header: "ID da venda", key: "id", width: 24 },
    { header: "Data", key: "data", width: 13, style: { numFmt: "dd/mm/yyyy" } },
    { header: "Hora", key: "hora", width: 11, style: { numFmt: "hh:mm:ss" } },
    { header: "Tipo", key: "tipo", width: 14 },
    { header: "Descrição", key: "item", width: 40 },
    { header: "Valor total", key: "valor", width: 16, style: { numFmt: '"R$" #,##0.00' } },
    { header: "Qtd. de itens", key: "quantidade", width: 15, style: { numFmt: "#,##0" } },
    { header: "Origem", key: "origem", width: 13 },
    { header: "Operador (UUID)", key: "operador", width: 38 },
    { header: "Criado em", key: "criadoEm", width: 20, style: { numFmt: "dd/mm/yyyy hh:mm:ss" } },
    { header: "Itens (JSON)", key: "itensJson", width: 48 },
  ];
  prepararAba(abaCaixa, "Vendas do caixa central", "Todos os registros do caixa, incluindo pedidos com múltiplos itens.", colunasCaixa);
  vendasDoCaixa.forEach((venda) => {
    const momento = dataVenda(venda);
    abaCaixa.addRow({
      id: venda.id,
      data: momento,
      hora: momento,
      tipo: venda.tipo || "avulsa",
      item: venda.item || "",
      valor: Number(venda.valor) || 0,
      quantidade: quantidadeItens(venda),
      origem: venda.origem || "caixa",
      operador: venda.created_by || "",
      criadoEm: venda.created_at ? new Date(venda.created_at) : momento,
      itensJson: textoJson(venda.itens),
    });
  });
  finalizarAba(abaCaixa, colunasCaixa.length);

  const abaItens = workbook.addWorksheet("Itens do Caixa");
  const colunasItens = [
    { header: "ID da venda", key: "vendaId", width: 24 },
    { header: "Data e hora", key: "momento", width: 20, style: { numFmt: "dd/mm/yyyy hh:mm:ss" } },
    { header: "ID da barraca", key: "barracaId", width: 22 },
    { header: "Barraca", key: "barraca", width: 24 },
    { header: "ID do produto", key: "produtoId", width: 22 },
    { header: "Produto", key: "produto", width: 30 },
    { header: "Preço unitário", key: "preco", width: 17, style: { numFmt: '"R$" #,##0.00' } },
    { header: "Quantidade", key: "quantidade", width: 14, style: { numFmt: "#,##0" } },
    { header: "Subtotal", key: "subtotal", width: 16, style: { numFmt: '"R$" #,##0.00' } },
  ];
  prepararAba(abaItens, "Itens dos pedidos do caixa", "Detalhamento por produto dos pedidos registrados no caixa central.", colunasItens);
  vendasDoCaixa.forEach((venda) => {
    (venda.itens || []).forEach((item) => {
      abaItens.addRow({
        vendaId: venda.id,
        momento: dataVenda(venda),
        barracaId: item.barracaId || "",
        barraca: item.barracaNome || "",
        produtoId: item.produtoId || "",
        produto: item.nome || "",
        preco: Number(item.precoUnitario) || 0,
        quantidade: Number(item.quantidade) || 0,
        subtotal: Number(item.subtotal) || 0,
      });
    });
  });
  finalizarAba(abaItens, colunasItens.length);

  const resumo = workbook.addWorksheet("Resumo", { properties: { tabColor: { argb: COR_DOURADO } } });
  resumo.properties.showGridLines = false;
  resumo.views = [{ state: "frozen", ySplit: 5 }];
  resumo.columns = [
    { width: 30 }, { width: 20 }, { width: 20 }, { width: 20 },
  ];
  resumo.mergeCells("A1:D1");
  resumo.getCell("A1").value = "Relatório de vendas — Encountry";
  resumo.getCell("A1").font = { bold: true, size: 20, color: { argb: COR_BRANCO } };
  resumo.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR_AZUL } };
  resumo.getCell("A1").alignment = { vertical: "middle" };
  resumo.getRow(1).height = 38;
  resumo.mergeCells("A2:D2");
  resumo.getCell("A2").value = `Gerado em ${new Date().toLocaleString("pt-BR")}`;
  resumo.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR_AZUL_CLARO } };

  resumo.getRow(4).values = ["Indicador", "Caixa", "Barracas", "Total"];
  estilizarCabecalho(resumo.getRow(4));
  resumo.getRow(5).values = ["Quantidade de vendas", vendasDoCaixa.length, vendasDeBarracas.length, { formula: "B5+C5" }];
  resumo.getRow(6).values = ["Valor vendido", { formula: `SUM('Vendas Caixa'!F5:F${Math.max(5, vendasDoCaixa.length + 4)})` }, { formula: `SUM('Vendas Barracas'!H5:H${Math.max(5, vendasDeBarracas.length + 4)})` }, { formula: "B6+C6" }];
  ["B6", "C6", "D6"].forEach((endereco) => { resumo.getCell(endereco).numFmt = '"R$" #,##0.00'; });
  ["B5", "C5", "D5"].forEach((endereco) => { resumo.getCell(endereco).numFmt = "#,##0"; });

  resumo.getRow(9).values = ["Barraca", "Quantidade de vendas", "Total vendido", "Ticket médio"];
  estilizarCabecalho(resumo.getRow(9));
  const ultimaVendaBarraca = Math.max(5, vendasDeBarracas.length + 4);
  barracas.forEach((barraca, indice) => {
    const linha = 10 + indice;
    resumo.getRow(linha).values = [
      barraca.nome,
      { formula: `COUNTIF('Vendas Barracas'!C5:C${ultimaVendaBarraca},A${linha})` },
      { formula: `SUMIF('Vendas Barracas'!C5:C${ultimaVendaBarraca},A${linha},'Vendas Barracas'!H5:H${ultimaVendaBarraca})` },
      { formula: `IFERROR(C${linha}/B${linha},0)` },
    ];
    resumo.getCell(linha, 2).numFmt = "#,##0";
    resumo.getCell(linha, 3).numFmt = '"R$" #,##0.00';
    resumo.getCell(linha, 4).numFmt = '"R$" #,##0.00';
  });
  finalizarAba(resumo, 4);
  resumo.getColumn(1).alignment = { horizontal: "left", vertical: "middle" };

  const dataArquivo = new Date().toISOString().slice(0, 10);
  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, nome: `relatorio-encountry-${dataArquivo}.xlsx` };
}

export async function exportarRelatorioExcel(dados) {
  const { buffer, nome } = await criarRelatorioExcel(dados);
  baixar(buffer, nome);
}
