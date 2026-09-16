export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function formatCpfCnpj(value: string) {
  const d = onlyDigits(value);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

/** Validação padrão de dígito verificador — não confirma identidade,
 *  só pega erro de digitação na hora. Não existe consulta pública
 *  gratuita que devolva nome a partir de CPF (dado pessoal, LGPD). */
export function isValidCpf(value: string) {
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(d[i], 10) * (len + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  return calc(9) === parseInt(d[9], 10) && calc(10) === parseInt(d[10], 10);
}

export function isValidCnpj(value: string) {
  const d = onlyDigits(value);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(d[i], 10) * weights[i];
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  return calc(12) === parseInt(d[12], 10) && calc(13) === parseInt(d[13], 10);
}

/** CNPJ é registro público — a BrasilAPI devolve os dados de verdade,
 *  de graça, sem chave. Retorna null se não encontrar ou a API falhar
 *  (a vendedora sempre pode preencher na mão nesse caso). */
export async function fetchCnpjInfo(cnpj: string): Promise<{ razaoSocial: string; nomeFantasia: string } | null> {
  const d = onlyDigits(cnpj);
  if (d.length !== 14) return null;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      razaoSocial: data.razao_social ?? "",
      nomeFantasia: data.nome_fantasia ?? "",
    };
  } catch {
    return null;
  }
}
