import { PaymentDay } from '../../domain/entities';
import { IPaymentDayRepository } from '../../domain/interfaces';
import { PaymentDayStatus } from '../../domain/enums';

export class InMemoryPaymentDayRepository implements IPaymentDayRepository {
  private data = new Map<string, PaymentDay>();

  private toDateKey(date: Date): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async findById(id: string): Promise<PaymentDay | null> {
    return this.data.get(id) || null;
  }

  async findByContractId(contractId: string): Promise<PaymentDay[]> {
    return Array.from(this.data.values())
      .filter(pd => pd.contractId === contractId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  async findByContractAndDateRange(contractId: string, startDate: Date, endDate: Date): Promise<PaymentDay[]> {
    const startKey = this.toDateKey(startDate);
    const endKey = this.toDateKey(endDate);
    return Array.from(this.data.values())
      .filter(pd => {
        if (pd.contractId !== contractId) return false;
        const key = this.toDateKey(pd.date);
        return key >= startKey && key <= endKey;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  async findByPaymentId(paymentId: string): Promise<PaymentDay[]> {
    return Array.from(this.data.values())
      .filter(pd => pd.paymentId === paymentId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  async findByContractAndDate(contractId: string, date: Date): Promise<PaymentDay | null> {
    const dateKey = this.toDateKey(date);
    for (const pd of this.data.values()) {
      if (pd.contractId === contractId && this.toDateKey(pd.date) === dateKey) {
        return pd;
      }
    }
    return null;
  }

  async findByContractAndStatus(contractId: string, status: PaymentDayStatus): Promise<PaymentDay[]> {
    return Array.from(this.data.values())
      .filter(pd => pd.contractId === contractId && pd.status === status)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  async create(paymentDay: PaymentDay): Promise<PaymentDay> {
    this.data.set(paymentDay.id, { ...paymentDay });
    return { ...paymentDay };
  }

  async createMany(paymentDays: PaymentDay[]): Promise<number> {
    let count = 0;
    for (const pd of paymentDays) {
      // Skip duplicates (same contractId + date)
      const existing = await this.findByContractAndDate(pd.contractId, pd.date);
      if (!existing) {
        this.data.set(pd.id, { ...pd });
        count++;
      }
    }
    return count;
  }

  async update(id: string, data: Partial<PaymentDay>): Promise<PaymentDay | null> {
    const existing = this.data.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.data.set(id, updated);
    return { ...updated };
  }

  async updateByContractAndDate(contractId: string, date: Date, data: Partial<PaymentDay>): Promise<PaymentDay | null> {
    const pd = await this.findByContractAndDate(contractId, date);
    if (!pd) return null;
    return this.update(pd.id, data);
  }

  async updateManyByPaymentId(paymentId: string, data: Partial<PaymentDay>): Promise<number> {
    let count = 0;
    for (const [id, pd] of this.data.entries()) {
      if (pd.paymentId === paymentId) {
        this.data.set(id, { ...pd, ...data, updatedAt: new Date() });
        count++;
      }
    }
    return count;
  }

  async countByContractAndStatus(contractId: string, status: PaymentDayStatus): Promise<number> {
    return Array.from(this.data.values())
      .filter(pd => pd.contractId === contractId && pd.status === status).length;
  }

  async countByContractAndStatuses(contractId: string, statuses: PaymentDayStatus[]): Promise<number> {
    return Array.from(this.data.values())
      .filter(pd => pd.contractId === contractId && statuses.includes(pd.status)).length;
  }

  async findLastPaidOrHolidayDate(contractId: string): Promise<Date | null> {
    const matching = Array.from(this.data.values())
      .filter(pd => pd.contractId === contractId && (pd.status === PaymentDayStatus.PAID || pd.status === PaymentDayStatus.HOLIDAY))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return matching.length > 0 ? new Date(matching[0].date) : null;
  }
}
