import { logger } from '../utils/logger';

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
    logger.info('notification', { channel: 'LOCAL', ...event });
    return 'LOCAL';
  }
}

let publisher: NotificationPublisher = new LocalConsoleNotificationPublisher();
export const getNotificationPublisher = () => publisher;
export const setNotificationPublisher = (p: NotificationPublisher) => {
  publisher = p;
};
