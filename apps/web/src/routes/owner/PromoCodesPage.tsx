import type { PromoCode, PromoCodeWrite } from '@studio/contracts';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Textarea, useToast } from '@studio/ui';
import { useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router';
import { createPromoCode, fetchPromoCodes, updatePromoCode } from '../../features/promos/promo-api';
import type { StudioViewerContext } from '../../features/studio/types';
import { useAsync } from '../../lib/useAsync';
import { usePageTitle } from '../../lib/usePageTitle';

const localInput = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export function PromoCodesPage() {
  usePageTitle('Promo kodovi'); const ctx = useOutletContext<StudioViewerContext>();
  const promos = useAsync((signal) => fetchPromoCodes(ctx.studio.slug, signal), [ctx.studio.slug]);
  const [open, setOpen] = useState(false); const toast = useToast();
  async function toggle(promo: PromoCode) {
    try { await updatePromoCode(ctx.studio.slug, promo.id, toWrite(promo, promo.status === 'active' ? 'archived' : 'active')); promos.reload(); toast.success(promo.status === 'active' ? 'Promo kod je arhiviran.' : 'Promo kod je aktiviran.'); }
    catch (error) { toast.error('Promjena nije spremljena', error instanceof Error ? error.message : undefined); }
  }
  return <><PageHeader title="Promo kodovi" description="Kreirajte vremenski ograničene popuste s ukupnim i korisničkim limitima." actions={<Button onClick={() => setOpen(!open)}>{open ? 'Zatvori' : 'Novi promo kod'}</Button>} />
    {open ? <PromoForm slug={ctx.studio.slug} currency={ctx.studio.currency} onCreated={() => { setOpen(false); promos.reload(); }} /> : null}
    {promos.status === 'error' ? <Alert tone="danger">Promo kodove nije moguće učitati.</Alert> : null}
    {promos.data?.promoCodes.length ? <div className="grid gap-4 lg:grid-cols-2">{promos.data.promoCodes.map((promo) => <Card key={promo.id}><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-mono text-xl tracking-wider">{promo.code}</h2><Badge tone={promo.status === 'active' ? 'success' : 'neutral'}>{promo.status === 'active' ? 'Aktivan' : 'Arhiviran'}</Badge></div><p className="mt-2 text-sm text-ink-subtle">{promo.discountType === 'percentage' ? `${promo.discountValue}% popusta` : money(promo.discountValue, ctx.studio.currency)}</p></div><Button size="sm" variant="ghost" onClick={() => void toggle(promo)}>{promo.status === 'active' ? 'Arhiviraj' : 'Aktiviraj'}</Button></div><dl className="mt-5 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-ink-subtle">Iskorištenja</dt><dd>{promo.redemptionCount}{promo.maxRedemptions ? ` / ${promo.maxRedemptions}` : ''}</dd></div><div><dt className="text-ink-subtle">Po artistu</dt><dd>{promo.maxRedemptionsPerUser}</dd></div><div className="col-span-2"><dt className="text-ink-subtle">Vrijedi</dt><dd>{date(promo.validFrom)} – {date(promo.validUntil)}</dd></div></dl></Card>)}</div> : promos.status === 'success' ? <Card padded={false}><EmptyState icon="services" title="Još nema promo kodova" description="Kreirajte prvi kod za popust na rezervaciju." /></Card> : null}
  </>;
}

function PromoForm({ slug, currency, onCreated }: { slug: string; currency: string; onCreated: () => void }) {
  const [type, setType] = useState<'percentage'|'fixed'>('percentage'); const [saving, setSaving] = useState(false); const toast = useToast();
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); setSaving(true);
    const monetary = (name: string) => Math.round(Number(String(data.get(name) || '0').replace(',', '.')) * 100);
    try { await createPromoCode(slug, { code: String(data.get('code')), description: String(data.get('description')) || null, discountType: type,
      discountValue: type === 'percentage' ? Number(data.get('value')) : monetary('value'), maxDiscountMinor: data.get('maxDiscount') ? monetary('maxDiscount') : null,
      minimumSpendMinor: monetary('minimumSpend'), validFrom: new Date(String(data.get('validFrom'))).toISOString(), validUntil: new Date(String(data.get('validUntil'))).toISOString(),
      maxRedemptions: data.get('maxRedemptions') ? Number(data.get('maxRedemptions')) : null, maxRedemptionsPerUser: Number(data.get('perUser') || 1) });
      toast.success('Promo kod je kreiran.'); onCreated();
    } catch (error) { toast.error('Promo kod nije spremljen', error instanceof Error ? error.message : undefined); } finally { setSaving(false); }
  }
  const now = new Date(); const later = new Date(now.getTime() + 30 * 86_400_000);
  return <Card className="mb-6"><form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void submit(event)}><Field label="Kod" required><Input name="code" required minLength={2} maxLength={40} placeholder="WELCOME20" className="uppercase" /></Field><Field label="Vrsta popusta"><Select value={type} onChange={(e) => setType(e.target.value as typeof type)}><option value="percentage">Postotak</option><option value="fixed">Fiksni iznos</option></Select></Field><Field label={type === 'percentage' ? 'Popust (%)' : `Popust (${currency})`} required><Input name="value" type="number" min="1" max={type === 'percentage' ? 100 : undefined} step={type === 'percentage' ? 1 : 0.01} required /></Field><Field label={`Maksimalni popust (${currency})`} hint="Opcionalno, korisno za postotak."><Input name="maxDiscount" type="number" min="0.01" step="0.01" /></Field><Field label={`Minimalna cijena (${currency})`}><Input name="minimumSpend" type="number" min="0" step="0.01" defaultValue="0" /></Field><Field label="Ukupni limit"><Input name="maxRedemptions" type="number" min="1" placeholder="Bez limita" /></Field><Field label="Vrijedi od" required><Input name="validFrom" type="datetime-local" defaultValue={localInput(now)} required /></Field><Field label="Vrijedi do" required><Input name="validUntil" type="datetime-local" defaultValue={localInput(later)} required /></Field><Field label="Limit po artistu"><Input name="perUser" type="number" min="1" defaultValue="1" required /></Field><Field label="Opis"><Textarea name="description" rows={2} /></Field><div className="sm:col-span-2"><Button type="submit" loading={saving}>Kreiraj promo kod</Button></div></form></Card>;
}

function money(value: number, currency: string) { return new Intl.NumberFormat('hr-HR', { style: 'currency', currency }).format(value / 100); }
function date(value: string) { return new Intl.DateTimeFormat('hr-HR', { dateStyle: 'medium' }).format(new Date(value)); }
function toWrite(promo: PromoCode, status: 'active'|'archived'): PromoCodeWrite { return { code: promo.code, description: promo.description, discountType: promo.discountType, discountValue: promo.discountValue,
  maxDiscountMinor: promo.maxDiscountMinor, minimumSpendMinor: promo.minimumSpendMinor, validFrom: promo.validFrom, validUntil: promo.validUntil,
  maxRedemptions: promo.maxRedemptions, maxRedemptionsPerUser: promo.maxRedemptionsPerUser, status }; }
