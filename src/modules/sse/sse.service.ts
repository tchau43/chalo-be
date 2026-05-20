import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';

export type SseEventType =
  | 'new_order'
  | 'payment_request'
  | 'payment_request_batch'
  | 'order_status_changed'
  | 'checkout_completed'
  | 'payment_completed';

export interface SseEvent {
  type: SseEventType;
  data: Record<string, unknown>;
}

@Injectable()
export class SseService {
  private readonly subject = new Subject<SseEvent>();

  emit(event: SseEvent): void {
    this.subject.next(event);
  }

  stream(types?: SseEventType[]): Observable<SseEvent> {
    if (!types || types.length === 0) return this.subject.asObservable();
    return this.subject.pipe(filter((e) => types.includes(e.type)));
  }
}
