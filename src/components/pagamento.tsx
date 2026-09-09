import { useState } from 'react';
import { Button, SectionTitle } from './ui/primitives';
import { Field, OptionCard } from './ui/forms';
import { Sheet } from './ui/overlays';
import { PAYMENT_ICON, PAYMENT_LABEL } from './domain';
import { useApp } from '../store/app';
import { accountOpen } from '../lib/domain';
import { money } from '../lib/format';
import type { PaymentMethod } from '../types';

/* Recebimento de uma conta — o mesmo componente no financeiro e em campo.
 *
 * Existiam duas implementações: uma aqui no financeiro e outra dentro de
 * field.tsx, órfã (nenhum arquivo a importava). A cópia órfã inicializava o
 * campo com `useState(String(amount))`, e como o sheet fica montado o tempo
 * todo, ela capturava o valor da PRIMEIRA renderização — quando ainda não há
 * conta escolhida e o valor é zero. O motorista abria o recebimento de
 * R$ 450,00 e via "Registrar R$ 0,00".
 *
 * A versão que sobrou não guarda o valor derivado em estado: o campo vazio
 * significa "quitar o total", e o total é lido da conta a cada renderização.
 * Não há o que ficar velho. */

const FORMAS: PaymentMethod[] = ['pix', 'dinheiro', 'cartao'];

export function SheetPagamentoConta({
  accountId,
  onClose,
}: {
  /** null fecha o sheet. */
  accountId: string | null;
  onClose: () => void;
}) {
  const { accounts, registerAccountPayment } = useApp();
  const conta = accounts.find((a) => a.id === accountId);
  const emAberto = conta ? accountOpen(conta) : 0;

  const [forma, setForma] = useState<PaymentMethod>('pix');
  const [digitado, setDigitado] = useState('');

  // Campo vazio = quitar o total, que é o caso comum na porta do cliente.
  const valor = digitado === '' ? emAberto : Number(digitado) || 0;

  function fechar() {
    setDigitado('');
    onClose();
  }

  return (
    <Sheet
      open={accountId !== null}
      onClose={fechar}
      title="Registrar pagamento"
      subtitle={conta ? `${conta.partyName} • ${money(emAberto)} em aberto` : undefined}
      footer={
        <Button
          size="lg"
          block
          disabled={valor <= 0}
          onClick={() => {
            // Nunca dá baixa acima do que está em aberto.
            if (conta) registerAccountPayment(conta.id, Math.min(valor, emAberto), forma);
            fechar();
          }}
        >
          Registrar {money(valor)}
        </Button>
      }
    >
      <div className="space-y-2.5 px-4 pb-2">
        <Field label="Valor recebido (R$)" hint="Deixe em branco para quitar o total.">
          <input
            value={digitado}
            onChange={(e) => setDigitado(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder={String(Math.round(emAberto))}
            className="h-12 w-full rounded-xl border border-shell-300 bg-white px-3.5 text-[16px] tnum text-shell-900 placeholder:text-shell-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </Field>
        <SectionTitle className="pt-1">Forma</SectionTitle>
        {FORMAS.map((m) => (
          <OptionCard
            key={m}
            selected={forma === m}
            onClick={() => setForma(m)}
            icon={PAYMENT_ICON[m]}
            title={PAYMENT_LABEL[m]}
          />
        ))}
      </div>
    </Sheet>
  );
}
