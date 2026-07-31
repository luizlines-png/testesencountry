export function statusEstoque(quantidade, esgotado) {
  if (esgotado || quantidade <= 0) return { label: "Esgotado", classe: "empty" };
  if (quantidade <= 10) return { label: "Pouco estoque", classe: "low" };
  if (quantidade >= 30) return { label: "Estoque alto", classe: "high" };
  return { label: "Estoque normal", classe: "normal" };
}

export function baixarUmaUnidade(produto) {
  if (produto.esgotado || produto.quantidade <= 0) {
    throw new Error("Produto sem estoque disponível.");
  }
  const quantidade = produto.quantidade - 1;
  return { ...produto, quantidade, esgotado: quantidade === 0 };
}

export function devolverUmaUnidade(produto) {
  return { ...produto, quantidade: produto.quantidade + 1, esgotado: false };
}
