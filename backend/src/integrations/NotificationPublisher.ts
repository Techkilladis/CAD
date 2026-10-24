// AWS replacement: Amazon SNS topic (SMS/e-mail/push) or SES, selected per alert severity.
export interface NotificationEvent {
  type: string;
  shelterId: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  dedupeKey: string;
}

export interface NotificationPublisher {
  /** Publishes the event and returns the channel label stored in AlertLog.notifiedVia. */
  publish(event: NotificationEvent): Promise<string>;
}

/** Local implementation: console log only. */
export class LocalConsoleNotificationPublisher implements NotificationPublisher {
  async publish(event: NotificationEvent): Promise<string> {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[notify:LOCAL] ${event.severity} ${event.type} shelter=${event.shelterId} - ${event.message}`);
    }
    return 'LOCAL';
  }
}

let publisher: NotificationPublisher = new LocalConsoleNotificationPublisher();
export const getNotificationPublisher = () => publisher;
export const setNotificationPublisher = (p: NotificationPublisher) => {
  publisher = p;
};
