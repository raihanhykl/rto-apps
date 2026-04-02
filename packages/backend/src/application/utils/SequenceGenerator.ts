import { IContractRepository } from '../../domain/interfaces/IContractRepository';
import { IInvoiceRepository } from '../../domain/interfaces/IInvoiceRepository';
import { getWibDateParts } from '../../domain/utils/dateUtils';

/**
 * Centralized sequence generator for contract and invoice numbers.
 * Uses a promise-chain pattern to serialize access and prevent duplicate
 * numbers from concurrent async requests within the same Node.js process.
 *
 * Singleton — call SequenceGenerator.getInstance() to access.
 * Must be initialized with init(contractRepo, invoiceRepo) before first use.
 */
export class SequenceGenerator {
  private static instance: SequenceGenerator | null = null;

  private contractCounter = 0;
  private contractInitialized = false;
  private invoiceCounter = 0;
  private invoiceInitialized = false;

  // Promise chains for serializing concurrent access
  private contractLock: Promise<void> = Promise.resolve();
  private invoiceLock: Promise<void> = Promise.resolve();

  private contractRepo: IContractRepository | null = null;
  private invoiceRepo: IInvoiceRepository | null = null;

  private constructor() {}

  static getInstance(): SequenceGenerator {
    if (!SequenceGenerator.instance) {
      SequenceGenerator.instance = new SequenceGenerator();
    }
    return SequenceGenerator.instance;
  }

  /**
   * Initialize with repository references. Must be called once at startup.
   */
  init(contractRepo: IContractRepository, invoiceRepo: IInvoiceRepository): void {
    this.contractRepo = contractRepo;
    this.invoiceRepo = invoiceRepo;
  }

  /**
   * Reset singleton for testing purposes.
   */
  static reset(): void {
    SequenceGenerator.instance = null;
  }

  private static readonly ROMAN_MONTHS = [
    'I',
    'II',
    'III',
    'IV',
    'V',
    'VI',
    'VII',
    'VIII',
    'IX',
    'X',
    'XI',
    'XII',
  ];

  /**
   * Generate next contract number. Format: N/WNUS-KTR/ROMAN_MONTH/YEAR
   * Serialized to prevent duplicates from concurrent requests.
   */
  async nextContractNumber(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.contractLock = this.contractLock.then(async () => {
        try {
          if (!this.contractRepo) throw new Error('SequenceGenerator not initialized');
          if (!this.contractInitialized) {
            this.contractCounter = await this.contractRepo.findMaxContractSequence();
            this.contractInitialized = true;
          }
          this.contractCounter++;

          const { year, month } = getWibDateParts();
          const romanMonth = SequenceGenerator.ROMAN_MONTHS[month - 1];

          resolve(`${this.contractCounter}/WNUS-KTR/${romanMonth}/${year}`);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  /**
   * Generate next invoice/payment number. Format: PMT-YYMMDD-NNNN
   * Serialized to prevent duplicates from concurrent requests.
   */
  async nextInvoiceNumber(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.invoiceLock = this.invoiceLock.then(async () => {
        try {
          if (!this.invoiceRepo) throw new Error('SequenceGenerator not initialized');
          if (!this.invoiceInitialized) {
            this.invoiceCounter = await this.invoiceRepo.findMaxInvoiceSequence();
            this.invoiceInitialized = true;
          }
          this.invoiceCounter++;

          const { year, month, day } = getWibDateParts();
          const y = year.toString().slice(-2);
          const m = month.toString().padStart(2, '0');
          const d = day.toString().padStart(2, '0');
          const seq = this.invoiceCounter.toString().padStart(4, '0');

          resolve(`PMT-${y}${m}${d}-${seq}`);
        } catch (err) {
          reject(err);
        }
      });
    });
  }
}
