export function iniciarUltimaRequisicao(controle) {
  const atual = ++controle.current;
  return () => controle.current === atual;
}
