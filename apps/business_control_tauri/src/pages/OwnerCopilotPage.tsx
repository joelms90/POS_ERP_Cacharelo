import { FormEvent, useState } from 'react';
import {
  api,
  OwnerCopilotActionProposal,
  OwnerCopilotMessage,
  OwnerCopilotToolRun,
} from '../services/api';
import { Heading } from '../components/atoms/Heading';

interface OwnerCopilotPageProps {
  businessId: string;
}

const SUGGESTIONS = [
  '¿Cómo van las ventas de hoy?',
  '¿Qué productos requieren atención?',
  'Resume las alertas operativas de mis sucursales.',
];

const toolStatus: Record<OwnerCopilotToolRun['status'], string> = {
  running: 'Consultando',
  completed: 'Listo',
  blocked: 'Restringido',
  failed: 'No disponible',
};

function ToolActivityCard({ run }: { run: OwnerCopilotToolRun }) {
  return (
    <div className="rounded border border-aged-bronze/25 bg-charcoal-surface/50 px-3 py-2 text-xs" aria-label={`Actividad: ${run.tool}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-text-primary">{run.tool}</span>
        <span className="text-[10px] uppercase tracking-wider text-champagne-gold">{toolStatus[run.status]}</span>
      </div>
      <p className="mt-1 text-text-secondary">{run.summary}</p>
    </div>
  );
}

function ActionProposal({ proposal, onConfirm, isConfirming }: {
  proposal: OwnerCopilotActionProposal;
  onConfirm: () => void;
  isConfirming: boolean;
}) {
  const expires = new Date(proposal.expiresAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="mt-3 rounded border border-champagne-gold/40 bg-champagne-gold/5 p-3">
      <p className="text-xs font-semibold text-champagne-gold">Acción propuesta: {proposal.title}</p>
      <p className="mt-1 text-xs text-text-secondary">{proposal.summary}</p>
      <p className="mt-2 text-[10px] text-text-secondary">Requiere tu confirmación. Vence a las {expires}.</p>
      <button
        type="button"
        onClick={onConfirm}
        disabled={isConfirming}
        className="mt-3 rounded border border-champagne-gold bg-champagne-gold/15 px-3 py-1.5 text-xs font-medium text-champagne-gold hover:bg-champagne-gold/25 disabled:opacity-50"
      >
        {isConfirming ? 'Confirmando…' : 'Confirmar acción'}
      </button>
    </div>
  );
}

export function OwnerCopilotPage({ businessId }: OwnerCopilotPageProps) {
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<OwnerCopilotMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [confirmingToken, setConfirmingToken] = useState<string>();
  const [error, setError] = useState<string>();

  const ask = async (text: string) => {
    const message = text.trim();
    if (!message || isSending) return;
    setDraft('');
    setError(undefined);
    setMessages((current) => [...current, { id: `local-${Date.now()}`, role: 'owner', content: message, createdAt: new Date().toISOString() }]);
    setIsSending(true);
    try {
      const response = await api.askOwnerCopilot({ businessId, conversationId, message });
      setConversationId(response.conversationId);
      setMessages(response.history ?? (current => [...current, response.message]));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo consultar al Copiloto.');
    } finally {
      setIsSending(false);
    }
  };

  const confirm = async (proposal: OwnerCopilotActionProposal) => {
    if (!conversationId || confirmingToken) return;
    setConfirmingToken(proposal.confirmationToken);
    setError(undefined);
    try {
      const response = await api.confirmOwnerCopilotAction({ conversationId, confirmationToken: proposal.confirmationToken });
      setMessages(response.history ?? (current => [...current, response.message]));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'La confirmación no pudo completarse.');
    } finally {
      setConfirmingToken(undefined);
    }
  };

  const submit = (event: FormEvent) => { event.preventDefault(); void ask(draft); };

  return (
    <div className="flex min-h-full flex-col gap-5 animate-fade-in" data-testid="owner-copilot-page">
      <section>
        <Heading level={2} className="!border-none !pb-0">Copiloto del Negocio</Heading>
        <p className="mt-1 text-sm text-text-secondary">Consulta información operativa con datos de tu negocio. Las acciones sensibles siempre requieren tu confirmación.</p>
      </section>

      {messages.length === 0 && (
        <section aria-label="Consultas sugeridas" className="rounded border border-aged-bronze/20 bg-onyx-surface p-5">
          <p className="text-xs font-medium uppercase tracking-widest text-text-secondary">Prueba una consulta</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => void ask(suggestion)} className="rounded border border-aged-bronze/40 px-3 py-2 text-left text-xs text-text-primary hover:border-champagne-gold/60 hover:text-champagne-gold">
                {suggestion}
              </button>
            ))}
          </div>
        </section>
      )}

      <section aria-live="polite" className="flex flex-1 flex-col gap-3">
        {messages.map((message) => (
          <article key={message.id} className={`max-w-3xl rounded border p-4 ${message.role === 'owner' ? 'ml-auto border-aged-bronze/35 bg-charcoal-surface' : 'border-champagne-gold/25 bg-onyx-surface'}`}>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-secondary">{message.role === 'owner' ? 'Tú' : 'Copiloto'}</p>
            <p className="whitespace-pre-wrap text-sm text-text-primary">{message.content}</p>
            {message.toolRuns && <div className="mt-3 grid gap-2">{message.toolRuns.map((run, index) => <ToolActivityCard key={`${run.tool}-${index}`} run={run} />)}</div>}
            {message.sources && message.sources.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{message.sources.map((source) => <a key={source.href} href={source.href} className="text-xs text-champagne-gold underline underline-offset-2" target="_blank" rel="noreferrer">Fuente: {source.label}</a>)}</div>}
            {message.actionProposal && <ActionProposal proposal={message.actionProposal} isConfirming={confirmingToken === message.actionProposal.confirmationToken} onConfirm={() => void confirm(message.actionProposal!)} />}
          </article>
        ))}
        {isSending && <div className="max-w-3xl rounded border border-aged-bronze/20 bg-onyx-surface p-4 text-sm text-text-secondary">El Copiloto está consultando fuentes permitidas…</div>}
      </section>

      {error && <p role="alert" className="rounded border border-error-red/50 bg-error-red/10 p-3 text-sm text-error-red">{error}</p>}
      <form onSubmit={submit} className="sticky bottom-0 rounded border border-aged-bronze/30 bg-onyx-surface p-3 shadow-lg">
        <label className="sr-only" htmlFor="copilot-question">Pregunta al Copiloto</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input id="copilot-question" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={isSending} placeholder="Pregunta por ventas, inventario o alertas…" className="min-w-0 flex-1 rounded border border-aged-bronze/35 bg-obsidian px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-champagne-gold focus:outline-none disabled:opacity-60" />
          <button type="submit" disabled={isSending || !draft.trim()} className="rounded bg-champagne-gold px-4 py-2 text-sm font-semibold text-obsidian disabled:opacity-50">Enviar</button>
        </div>
      </form>
    </div>
  );
}
